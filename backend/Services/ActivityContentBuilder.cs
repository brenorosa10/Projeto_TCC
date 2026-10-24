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
                Position = index,
                Objectives = role == SectionRoles.Prep ? CleanList(request.Objectives) : null,
                EstimatedMinutes = role == SectionRoles.Prep ? NormalizeMinutes(request.EstimatedMinutes) : null,
                Tips = role == SectionRoles.Prep ? CleanList(request.Tips) : null
            };

            if (role == SectionRoles.Prep)
            {
                var imageError = ActivityImage.Apply(section, request.ImageDataUrl);
                if (imageError is not null)
                {
                    return (null, null, imageError);
                }
            }

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

            var intro = ContentBlocks.Normalize(item.Intro);
            var promptBlocks = ContentBlocks.Normalize(item.PromptBlocks);
            var feedbackBlocks = ContentBlocks.Normalize(item.FeedbackBlocks);
            var mappedItem = new ActivityItem
            {
                Id = existing?.Id ?? Guid.NewGuid(),
                Kind = kind,
                Prompt = TrimToNull(item.Prompt) ?? ContentBlocks.Flatten(intro, promptBlocks),
                Explanation = TrimToNull(item.Explanation)
                    ?? ContentBlocks.Flatten(feedbackBlocks)
                    ?? TrimToNull(string.Join("\n\n", item.FeedbackMessages ?? [])),
                TimeLimitSeconds = kind == ItemKinds.Flashcard ? null : item.TimeLimitSeconds ?? 30,
                Position = positionOffset + index,
                AllowMultiple = kind == ItemKinds.MultipleChoice && item.AllowMultiple == true,
                CaseSensitive = kind is ItemKinds.ShortAnswer or ItemKinds.Cloze && item.CaseSensitive == true,
                Front = TrimToNull(item.Front),
                Back = TrimToNull(item.Back),
                Intro = intro,
                PromptBlocks = promptBlocks,
                FeedbackBlocks = feedbackBlocks,
                FeedbackMessages = ContentBlocks.CleanList(item.FeedbackMessages),
                Topics = ContentBlocks.CleanList(item.Topics),
                Difficulty = ContentBlocks.NormalizeDifficulty(item.Difficulty),
                ChallengeId = TrimToNull(item.ChallengeId),
                RequireExplanation = ContentBlocks.SupportsReflection(kind) && item.RequireExplanation == true,
                ExplanationMinLength = ContentBlocks.SupportsReflection(kind) && item.RequireExplanation == true
                    ? NormalizeExplanationMin(item.ExplanationMinLength)
                    : null,
                ExplanationPrompt = ContentBlocks.SupportsReflection(kind) && item.RequireExplanation == true
                    ? (TrimToNull(item.ExplanationPrompt) ?? "Como você pensou sobre a resposta?")
                    : null,
                ImagePosition = NormalizeImagePosition(item.ImagePosition)
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
            case ItemKinds.Ordering:
                mappedItem.OrderEntries = MapOrderEntries(item.OrderEntries, existing?.OrderEntries);
                break;
            case ItemKinds.Cloze:
                mappedItem.ClozeBlanks = ClozeMarkup.ParseBlanks(
                    item.Prompt,
                    existing?.ClozeBlanks,
                    item.ClozeBlanks);
                break;
            case ItemKinds.Categorize:
                mappedItem.Categories = MapCategories(item.Categories, existing?.Categories);
                mappedItem.CategoryItems = MapCategoryItems(
                    item.CategoryItems,
                    mappedItem.Categories,
                    existing?.CategoryItems);
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
                    Position = 0,
                    ImageUrl = existingTrue?.ImageUrl
                },
                new QuestionOption
                {
                    Id = existingFalse?.Id ?? Guid.NewGuid(),
                    Text = "Falso",
                    IsCorrect = !correctTrue,
                    Position = 1,
                    ImageUrl = existingFalse?.ImageUrl
                }
            ];
        }

        return incoming
            .Select((option, optionIndex) => new QuestionOption
            {
                Id = ResolveOptionId(option.Id, existing?.Options),
                Text = option.Text?.Trim() ?? string.Empty,
                IsCorrect = option.IsCorrect,
                Position = optionIndex,
                ImageUrl = OptionImageUrl.Normalize(option.ImageUrl).Value
            })
            .ToList();
    }

    private static string? ValidateItem(string kind, CreateActivityItemRequest item)
    {
        if (!ItemKinds.All.Contains(kind))
        {
            return "Tipo de questão não suportado. Use multiple_choice, true_false, short_answer, matching, ordering, cloze, categorize ou flashcard.";
        }

        if (kind != ItemKinds.Flashcard && item.TimeLimitSeconds is < 5 or > 300)
        {
            return "O tempo por questão deve ficar entre 5 e 300 segundos.";
        }

        var blockError = ContentBlocks.Validate(item.Intro)
            ?? ContentBlocks.Validate(item.PromptBlocks)
            ?? ContentBlocks.Validate(item.FeedbackBlocks);
        if (blockError is not null)
        {
            return blockError;
        }

        if (item.RequireExplanation == true && !ContentBlocks.SupportsReflection(kind))
        {
            return "A reflexão escrita só pode ser exigida em múltipla escolha ou verdadeiro/falso.";
        }

        if (item.RequireExplanation == true && item.ExplanationMinLength is < 1 or > 2000)
        {
            return "O mínimo da reflexão deve ficar entre 1 e 2000 caracteres.";
        }

        return kind switch
        {
            ItemKinds.MultipleChoice => ValidateMultipleChoice(item),
            ItemKinds.TrueFalse => ValidateTrueFalse(item),
            ItemKinds.ShortAnswer => ValidateShortAnswer(item),
            ItemKinds.Matching => ValidateMatching(item),
            ItemKinds.Ordering => ValidateOrdering(item),
            ItemKinds.Cloze => ValidateCloze(item),
            ItemKinds.Categorize => ValidateCategorize(item),
            ItemKinds.Flashcard => ValidateFlashcard(item),
            _ => "Tipo de questão não suportado."
        };
    }

    private static string? ValidateOptionContent(IReadOnlyList<CreateQuestionOptionRequest> options)
    {
        foreach (var option in options)
        {
            if (string.IsNullOrWhiteSpace(option.Text) && string.IsNullOrWhiteSpace(option.ImageUrl))
            {
                return "Cada alternativa precisa de texto ou de uma imagem.";
            }

            var image = OptionImageUrl.Normalize(option.ImageUrl);
            if (image.Error is not null)
            {
                return image.Error;
            }
        }

        return null;
    }

    private static string? ValidateMultipleChoice(CreateActivityItemRequest item)
    {
        if (!HasAuthoredPrompt(item))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var options = item.Options ?? [];
        if (options.Count is < 2 or > 6)
        {
            return "Cada questão de múltipla escolha deve ter de 2 a 6 alternativas.";
        }

        var optionError = ValidateOptionContent(options);
        if (optionError is not null)
        {
            return optionError;
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
        if (!HasAuthoredPrompt(item))
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

        var optionError = ValidateOptionContent(options);
        if (optionError is not null)
        {
            return optionError;
        }

        return options.Count(option => option.IsCorrect) != 1
            ? "Questões de verdadeiro ou falso devem ter exatamente uma alternativa correta."
            : null;
    }

    private static string? ValidateShortAnswer(CreateActivityItemRequest item)
    {
        if (!HasAuthoredPrompt(item))
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

    private static string? ValidateOrdering(CreateActivityItemRequest item)
    {
        if (!HasAuthoredPrompt(item))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var entries = item.OrderEntries ?? [];
        if (entries.Count < 3)
        {
            return "Questões de ordenação precisam de pelo menos três itens.";
        }

        return entries.Any(entry => string.IsNullOrWhiteSpace(entry.Text))
            ? "Todos os itens da ordenação precisam de texto."
            : null;
    }

    private static string? ValidateCloze(CreateActivityItemRequest item)
    {
        if (string.IsNullOrWhiteSpace(item.Prompt))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var blanks = ClozeMarkup.ParseBlanks(item.Prompt, null, item.ClozeBlanks);
        if (blanks.Count == 0)
        {
            return "Use {{resposta}} no enunciado para marcar cada lacuna.";
        }

        return blanks.Any(blank => blank.AcceptedAnswers.Count == 0)
            ? "Cada lacuna precisa de pelo menos uma resposta aceita."
            : null;
    }

    private static string? ValidateCategorize(CreateActivityItemRequest item)
    {
        if (!HasAuthoredPrompt(item))
        {
            return "Cada questão precisa de um enunciado.";
        }

        var categories = item.Categories ?? [];
        var members = item.CategoryItems ?? [];
        if (categories.Count < 2)
        {
            return "Questões de categorias precisam de pelo menos duas categorias.";
        }

        if (members.Count < 3)
        {
            return "Questões de categorias precisam de pelo menos três itens.";
        }

        if (categories.Any(category => string.IsNullOrWhiteSpace(category.Label)))
        {
            return "Todas as categorias precisam de um nome.";
        }

        if (members.Any(member => string.IsNullOrWhiteSpace(member.Text)))
        {
            return "Todos os itens precisam de texto.";
        }

        return members.Any(member => member.CategoryId is null)
            ? "Cada item precisa pertencer a uma categoria."
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

        if (item.OrderEntries is { Count: > 0 })
        {
            return ItemKinds.Ordering;
        }

        if (item.Categories is { Count: > 0 } || item.CategoryItems is { Count: > 0 })
        {
            return ItemKinds.Categorize;
        }

        if (item.ClozeBlanks is { Count: > 0 } || item.Prompt?.Contains("{{") == true)
        {
            return ItemKinds.Cloze;
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
            ItemIds = [],
            Objectives = existing?.Objectives,
            EstimatedMinutes = existing?.EstimatedMinutes,
            Tips = existing?.Tips,
            ImageBytes = existing?.ImageBytes,
            ImageContentType = existing?.ImageContentType
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

    private static List<OrderEntry> MapOrderEntries(
        List<CreateOrderEntryRequest>? incoming,
        List<OrderEntry>? existing)
    {
        return (incoming ?? [])
            .Select((entry, index) => new OrderEntry
            {
                Id = ResolveListId(entry.Id, existing?.ElementAtOrDefault(index)?.Id),
                Text = entry.Text.Trim(),
                Position = index
            })
            .ToList();
    }

    private static List<CategoryBucket> MapCategories(
        List<CreateCategoryRequest>? incoming,
        List<CategoryBucket>? existing)
    {
        return (incoming ?? [])
            .Select((category, index) => new CategoryBucket
            {
                Id = ResolveListId(category.Id, existing?.ElementAtOrDefault(index)?.Id),
                Label = category.Label.Trim(),
                Position = index
            })
            .ToList();
    }

    private static List<CategoryItem> MapCategoryItems(
        List<CreateCategoryItemRequest>? incoming,
        List<CategoryBucket> categories,
        List<CategoryItem>? existing)
    {
        var categoryIds = categories.Select(category => category.Id).ToHashSet();
        return (incoming ?? [])
            .Select((item, index) =>
            {
                var categoryId = item.CategoryId is Guid id && categoryIds.Contains(id)
                    ? id
                    : categories.ElementAtOrDefault(0)?.Id ?? Guid.NewGuid();
                return new CategoryItem
                {
                    Id = ResolveListId(item.Id, existing?.ElementAtOrDefault(index)?.Id),
                    Text = item.Text.Trim(),
                    CategoryId = categoryId
                };
            })
            .ToList();
    }

    private static Guid ResolveListId(Guid? incoming, Guid? existing) =>
        incoming is Guid id && existing == id ? id : existing ?? Guid.NewGuid();

    private static List<string>? CleanList(List<string>? values)
    {
        var cleaned = (values ?? [])
            .Select(value => value.Trim())
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return cleaned.Count == 0 ? null : cleaned;
    }

    private static int? NormalizeMinutes(int? minutes) =>
        minutes is >= 1 and <= 180 ? minutes : null;

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool HasAuthoredPrompt(CreateActivityItemRequest item) =>
        ContentBlocks.HasPrompt(
            item.Prompt,
            ContentBlocks.Normalize(item.Intro),
            ContentBlocks.Normalize(item.PromptBlocks));

    private static int NormalizeExplanationMin(int? value) =>
        value is >= 1 and <= 2000 ? value.Value : 20;

    private static string NormalizeImagePosition(string? value) =>
        value?.Trim().ToLowerInvariant() == "before" ? "before" : "after";
}
