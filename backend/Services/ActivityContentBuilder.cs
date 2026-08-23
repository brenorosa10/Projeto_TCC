using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class ActivityContentBuilder
{
    public static (List<ActivitySection>? Sections, List<ActivityItem>? Items, string? Error) Build(
        string activityType,
        CreateActivityRequest request,
        Activity? existing = null)
    {
        if (request.Sections is { Count: > 0 })
        {
            return BuildFromSections(activityType, request.Sections, existing);
        }

        var items = request.Items ?? [];
        var mapped = MapItems(activityType, items, existing?.Items.ToDictionary(item => item.Id));
        if (mapped.Error is not null)
        {
            return (null, null, mapped.Error);
        }

        if (mapped.Items!.Count == 0)
        {
            return (null, null, "A atividade precisa de pelo menos um item na seção de prática.");
        }

        var sections = DefaultSections(mapped.Items, existing?.Sections);
        return (sections, mapped.Items, null);
    }

    public static List<ActivitySection> DefaultSections(
        IReadOnlyList<ActivityItem> items,
        IReadOnlyList<ActivitySection>? existing = null)
    {
        var prep = CloneSection(
            existing?.FirstOrDefault(section => section.Role == SectionRoles.Prep),
            SectionRoles.Prep,
            position: 0);

        var practiceExisting = existing?.FirstOrDefault(section => section.Role == SectionRoles.Practice);
        var practice = new ActivitySection
        {
            Id = practiceExisting?.Id is Guid id && id != Guid.Empty ? id : Guid.NewGuid(),
            Role = SectionRoles.Practice,
            Title = practiceExisting?.Title,
            Body = practiceExisting?.Body,
            Position = 1,
            ItemIds = items.OrderBy(item => item.Position).Select(item => item.Id).ToList()
        };

        var feedback = CloneSection(
            existing?.FirstOrDefault(section => section.Role == SectionRoles.Feedback),
            SectionRoles.Feedback,
            position: 2,
            defaultTitle: "Resultados",
            defaultTemplate: FeedbackTemplates.ScoreSummary);

        prep.ItemIds = [];
        feedback.ItemIds = [];

        foreach (var item in items)
        {
            item.SectionId = practice.Id;
        }

        return [prep, practice, feedback];
    }

    public static IReadOnlyList<ActivitySection> ResolveSections(Activity activity)
    {
        if (activity.Sections is { Count: > 0 })
        {
            return activity.Sections.OrderBy(section => section.Position).ToList();
        }

        return DefaultSections(activity.Items);
    }

    private static (List<ActivitySection>? Sections, List<ActivityItem>? Items, string? Error) BuildFromSections(
        string activityType,
        List<CreateActivitySectionRequest> requests,
        Activity? existing)
    {
        var existingSections = existing?.Sections?.ToDictionary(section => section.Id) ?? [];
        var existingItems = existing?.Items?.ToDictionary(item => item.Id);
        var sections = new List<ActivitySection>(requests.Count);
        var allItems = new List<ActivityItem>();
        var globalPosition = 0;

        foreach (var (request, index) in requests.Select((value, i) => (value, i)))
        {
            var role = request.Role.Trim().ToLowerInvariant();
            if (!SectionRoles.All.Contains(role))
            {
                return (null, null, "Cada seção deve ser prep, practice ou feedback.");
            }

            var section = new ActivitySection
            {
                Id = ResolveSectionId(request.Id, existingSections),
                Role = role,
                Title = TrimToNull(request.Title),
                Body = TrimToNull(request.Body),
                FeedbackTemplate = role == SectionRoles.Feedback
                    ? (TrimToNull(request.FeedbackTemplate) ?? FeedbackTemplates.ScoreSummary)
                    : TrimToNull(request.FeedbackTemplate),
                Position = index
            };

            if (role == SectionRoles.Practice)
            {
                var mapped = MapItems(activityType, request.Items ?? [], existingItems, globalPosition);
                if (mapped.Error is not null)
                {
                    return (null, null, mapped.Error);
                }

                foreach (var item in mapped.Items!)
                {
                    item.SectionId = section.Id;
                }

                section.ItemIds = mapped.Items.Select(item => item.Id).ToList();
                allItems.AddRange(mapped.Items);
                globalPosition += mapped.Items.Count;
            }
            else if (request.Items is { Count: > 0 })
            {
                return (null, null, "Apenas seções de prática podem ter questões ou cartões.");
            }

            sections.Add(section);
        }

        if (allItems.Count == 0)
        {
            return (null, null, "A atividade precisa de pelo menos um item na seção de prática.");
        }

        return (EnsureStandardSections(sections, allItems), allItems, null);
    }

    private static List<ActivitySection> EnsureStandardSections(
        List<ActivitySection> sections,
        List<ActivityItem> items)
    {
        if (sections.All(section => section.Role != SectionRoles.Prep))
        {
            sections.Insert(0, CloneSection(null, SectionRoles.Prep, position: 0));
        }

        if (sections.All(section => section.Role != SectionRoles.Feedback))
        {
            sections.Add(CloneSection(
                null,
                SectionRoles.Feedback,
                position: sections.Count,
                defaultTitle: "Resultados",
                defaultTemplate: FeedbackTemplates.ScoreSummary));
        }

        for (var i = 0; i < sections.Count; i++)
        {
            sections[i].Position = i;
        }

        var practice = sections.First(section => section.Role == SectionRoles.Practice);
        foreach (var item in items.Where(item => item.SectionId is null))
        {
            item.SectionId = practice.Id;
        }

        return sections;
    }

    private static (List<ActivityItem>? Items, string? Error) MapItems(
        string activityType,
        List<CreateActivityItemRequest> items,
        IReadOnlyDictionary<Guid, ActivityItem>? existingById,
        int positionOffset = 0)
    {
        var mapped = new List<ActivityItem>(items.Count);
        foreach (var (item, index) in items.Select((value, i) => (value, i)))
        {
            var kind = ResolveKind(item, activityType);
            var existing = ResolveExisting(item.Id, existingById);
            var validationError = ValidateItem(kind, item);
            if (validationError is not null)
            {
                return (null, validationError);
            }

            var mappedItem = new ActivityItem
            {
                Id = existing?.Id ?? Guid.NewGuid(),
                Kind = kind,
                Prompt = TrimToNull(item.Prompt),
                Explanation = TrimToNull(item.Explanation),
                TimeLimitSeconds = kind == ItemKinds.Flashcard ? null : item.TimeLimitSeconds ?? 30,
                Position = positionOffset + index,
                AllowMultiple = kind == ItemKinds.MultipleChoice && item.AllowMultiple == true,
                CaseSensitive = kind == ItemKinds.ShortAnswer && item.CaseSensitive == true,
                Front = TrimToNull(item.Front),
                Back = TrimToNull(item.Back)
            };

            var payloadError = ApplyKindPayload(mappedItem, item, existing);
            if (payloadError is not null)
            {
                return (null, payloadError);
            }

            var imageError = ActivityImage.Apply(mappedItem, item.ImageDataUrl);
            if (imageError is not null)
            {
                return (null, imageError);
            }

            mapped.Add(mappedItem);
        }

        return (mapped, null);
    }

    private static string? ApplyKindPayload(
        ActivityItem mappedItem,
        CreateActivityItemRequest item,
        ActivityItem? existing)
    {
        switch (mappedItem.Kind)
        {
            case ItemKinds.MultipleChoice:
            case ItemKinds.TrueFalse:
                mappedItem.Options = BuildOptions(mappedItem.Kind, item, existing);
                break;
            case ItemKinds.ShortAnswer:
                mappedItem.AcceptedAnswers = (item.AcceptedAnswers ?? [])
                    .Select(answer => answer.Trim())
                    .Where(answer => answer.Length > 0)
                    .Distinct(StringComparer.Ordinal)
                    .ToList();
                break;
            case ItemKinds.Matching:
                mappedItem.Pairs = (item.Pairs ?? [])
                    .Select((pair, index) => new MatchingPair
                    {
                        LeftId = ResolvePairSideId(pair.LeftId, existing?.Pairs, left: true, index),
                        RightId = ResolvePairSideId(pair.RightId, existing?.Pairs, left: false, index),
                        Left = pair.Left.Trim(),
                        Right = pair.Right.Trim()
                    })
                    .ToList();
                break;
        }

        return mappedItem.Kind is ItemKinds.MultipleChoice or ItemKinds.TrueFalse
            && (mappedItem.Options is null || mappedItem.Options.Count == 0)
                ? "A questão precisa de alternativas."
                : null;
    }

    private static List<QuestionOption> BuildOptions(
        string kind,
        CreateActivityItemRequest item,
        ActivityItem? existing)
    {
        var incoming = item.Options ?? [];
        if (kind == ItemKinds.TrueFalse && incoming.Count == 0)
        {
            var existingTrue = existing?.Options?.FirstOrDefault(option =>
                option.Text.Equals("Verdadeiro", StringComparison.OrdinalIgnoreCase));
            var existingFalse = existing?.Options?.FirstOrDefault(option =>
                option.Text.Equals("Falso", StringComparison.OrdinalIgnoreCase));
            var correctTrue = item.CorrectTrue ?? existingTrue?.IsCorrect ?? true;

            return
            [
                new QuestionOption
                {
                    Id = existingTrue?.Id ?? Guid.NewGuid(),
                    Text = "Verdadeiro",
                    IsCorrect = correctTrue,
                    Position = 0
                },
                new QuestionOption
                {
                    Id = existingFalse?.Id ?? Guid.NewGuid(),
                    Text = "Falso",
                    IsCorrect = !correctTrue,
                    Position = 1
                }
            ];
        }

        return incoming
            .Select((option, optionIndex) => new QuestionOption
            {
                Id = ResolveOptionId(option.Id, existing?.Options),
                Text = option.Text.Trim(),
                IsCorrect = option.IsCorrect,
                Position = optionIndex
            })
            .ToList();
    }

    private static string? ValidateItem(string kind, CreateActivityItemRequest item)
    {
        if (!ItemKinds.All.Contains(kind))
        {
            return "Tipo de questão não suportado. Use multiple_choice, true_false, short_answer, matching ou flashcard.";
        }

        if (kind != ItemKinds.Flashcard && item.TimeLimitSeconds is < 5 or > 300)
        {
            return "O tempo por questão deve ficar entre 5 e 300 segundos.";
        }

        return kind switch
        {
            ItemKinds.MultipleChoice => ValidateMultipleChoice(item),
            ItemKinds.TrueFalse => ValidateTrueFalse(item),
            ItemKinds.ShortAnswer => ValidateShortAnswer(item),
            ItemKinds.Matching => ValidateMatching(item),
            ItemKinds.Flashcard => ValidateFlashcard(item),
            _ => "Tipo de questão não suportado."
        };
    }

    private static string? ValidateMultipleChoice(CreateActivityItemRequest item)
    {
        if (string.IsNullOrWhiteSpace(item.Prompt))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var options = item.Options ?? [];
        if (options.Count is < 2 or > 6)
        {
            return "Cada questão de múltipla escolha deve ter de 2 a 6 alternativas.";
        }

        if (options.Any(option => string.IsNullOrWhiteSpace(option.Text)))
        {
            return "Todas as alternativas precisam de texto.";
        }

        var correctCount = options.Count(option => option.IsCorrect);
        if (item.AllowMultiple == true)
        {
            return correctCount < 1
                ? "Questões de múltipla escolha com várias respostas precisam de ao menos uma alternativa correta."
                : null;
        }

        return correctCount != 1
            ? "Cada questão deve ter exatamente uma alternativa correta."
            : null;
    }

    private static string? ValidateTrueFalse(CreateActivityItemRequest item)
    {
        if (string.IsNullOrWhiteSpace(item.Prompt))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var options = item.Options ?? [];
        if (options.Count == 0)
        {
            return item.CorrectTrue is null
                ? "Questões de verdadeiro ou falso precisam da resposta correta."
                : null;
        }

        if (options.Count != 2)
        {
            return "Questões de verdadeiro ou falso devem ter exatamente duas alternativas.";
        }

        if (options.Any(option => string.IsNullOrWhiteSpace(option.Text)))
        {
            return "Todas as alternativas precisam de texto.";
        }

        return options.Count(option => option.IsCorrect) != 1
            ? "Questões de verdadeiro ou falso devem ter exatamente uma alternativa correta."
            : null;
    }

    private static string? ValidateShortAnswer(CreateActivityItemRequest item)
    {
        if (string.IsNullOrWhiteSpace(item.Prompt))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var answers = (item.AcceptedAnswers ?? [])
            .Where(answer => !string.IsNullOrWhiteSpace(answer))
            .ToList();

        return answers.Count == 0
            ? "Questões de resposta curta precisam de pelo menos uma resposta aceita."
            : null;
    }

    private static string? ValidateMatching(CreateActivityItemRequest item)
    {
        var pairs = item.Pairs ?? [];
        if (pairs.Count < 2)
        {
            return "Questões de associação precisam de pelo menos dois pares.";
        }

        return pairs.Any(pair => string.IsNullOrWhiteSpace(pair.Left) || string.IsNullOrWhiteSpace(pair.Right))
            ? "Cada par de associação precisa de texto nos dois lados."
            : null;
    }

    private static string? ValidateFlashcard(CreateActivityItemRequest item) =>
        string.IsNullOrWhiteSpace(item.Front) || string.IsNullOrWhiteSpace(item.Back)
            ? "Cada cartão precisa de frente e verso."
            : null;

    public static string ResolveKind(CreateActivityItemRequest item, string activityType)
    {
        if (!string.IsNullOrWhiteSpace(item.Kind))
        {
            return item.Kind.Trim().ToLowerInvariant();
        }

        if (item.Pairs is { Count: > 0 })
        {
            return ItemKinds.Matching;
        }

        if (item.AcceptedAnswers is { Count: > 0 })
        {
            return ItemKinds.ShortAnswer;
        }

        if (item.CorrectTrue is not null)
        {
            return ItemKinds.TrueFalse;
        }

        if (!string.IsNullOrWhiteSpace(item.Front) || !string.IsNullOrWhiteSpace(item.Back))
        {
            return ItemKinds.Flashcard;
        }

        return activityType == ActivityTypes.Flashcards
            ? ItemKinds.Flashcard
            : ItemKinds.MultipleChoice;
    }

    private static ActivitySection CloneSection(
        ActivitySection? existing,
        string role,
        int position,
        string? defaultTitle = null,
        string? defaultTemplate = null)
    {
        return new ActivitySection
        {
            Id = existing?.Id is Guid id && id != Guid.Empty ? id : Guid.NewGuid(),
            Role = role,
            Title = existing?.Title ?? defaultTitle,
            Body = existing?.Body,
            FeedbackTemplate = existing?.FeedbackTemplate ?? defaultTemplate,
            Position = position,
            ItemIds = []
        };
    }

    private static Guid ResolveSectionId(Guid? id, IReadOnlyDictionary<Guid, ActivitySection> existing) =>
        id is Guid sectionId && existing.ContainsKey(sectionId) ? sectionId : Guid.NewGuid();

    private static ActivityItem? ResolveExisting(
        Guid? id,
        IReadOnlyDictionary<Guid, ActivityItem>? existingById) =>
        id is Guid itemId && existingById is not null && existingById.TryGetValue(itemId, out var found)
            ? found
            : null;

    private static Guid ResolveOptionId(Guid? id, List<QuestionOption>? existingOptions) =>
        id is Guid optionId && existingOptions is not null && existingOptions.Any(option => option.Id == optionId)
            ? optionId
            : Guid.NewGuid();

    private static Guid ResolvePairSideId(
        Guid? id,
        List<MatchingPair>? existing,
        bool left,
        int index)
    {
        if (id is Guid sideId && existing is not null)
        {
            var match = existing.Any(pair => left ? pair.LeftId == sideId : pair.RightId == sideId);
            if (match)
            {
                return sideId;
            }
        }

        if (existing is not null && index < existing.Count)
        {
            return left ? existing[index].LeftId : existing[index].RightId;
        }

        return Guid.NewGuid();
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
