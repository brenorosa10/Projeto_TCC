using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
public class ActivitiesController(
    MongoDbContext db,
    CurrentUserService currentUser) : ControllerBase
{
    [HttpGet("api/activities")]
    public async Task<ActionResult<IEnumerable<ActivitySummaryResponse>>> ListMine(
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role != UserRoles.Professor)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas professores têm uma biblioteca de atividades." });
        }

        var classIds = await db.Classes
            .Find(c => c.ProfessorId == profile.Id)
            .Project(c => c.Id)
            .ToListAsync(cancellationToken);

        var filter = Builders<Activity>.Filter.Or(
            Builders<Activity>.Filter.Eq(a => a.ProfessorId, profile.Id),
            Builders<Activity>.Filter.In(a => a.ClassId, classIds),
            Builders<Activity>.Filter.AnyIn(a => a.ClassIds, classIds));

        var activities = await db.Activities
            .Find(filter)
            .SortByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(activities.Select(ToSummary));
    }

    [HttpPost("api/activities")]
    public async Task<ActionResult<ActivityResponse>> Create(
        [FromBody] CreateActivityRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role != UserRoles.Professor)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas professores podem criar atividades." });
        }

        var type = request.Type.Trim().ToLowerInvariant();
        var validationError = type == ActivityTypes.Quiz
            ? ValidateQuizItems(request.Items)
            : ValidateFlashcardItems(request.Items);

        if (validationError is not null)
        {
            return BadRequest(new { detail = validationError });
        }

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            ProfessorId = profile.Id,
            Title = request.Title.Trim(),
            Type = type,
            CreatedAt = DateTimeOffset.UtcNow,
            Items = type == ActivityTypes.Quiz
                ? MapQuizItems(request.Items)
                : MapFlashcardItems(request.Items)
        };

        await db.Activities.InsertOneAsync(activity, cancellationToken: cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = activity.Id }, ToResponse(activity, includeAnswers: true));
    }

    [HttpGet("api/classes/{classId:guid}/activities")]
    public async Task<ActionResult<IEnumerable<ActivitySummaryResponse>>> ListByClass(
        Guid classId,
        CancellationToken cancellationToken)
    {
        var access = await ResolveClassAccessAsync(classId, cancellationToken);
        if (access.Error is not null)
        {
            return access.Error;
        }

        var filter = Builders<Activity>.Filter.Or(
            Builders<Activity>.Filter.AnyEq(a => a.ClassIds, classId),
            Builders<Activity>.Filter.Eq(a => a.ClassId, classId));

        var activities = await db.Activities
            .Find(filter)
            .SortByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(activities.Select(ToSummary));
    }

    [HttpPost("api/classes/{classId:guid}/activities/{activityId:guid}")]
    public async Task<ActionResult<ActivityResponse>> LinkToClass(
        Guid classId,
        Guid activityId,
        CancellationToken cancellationToken)
    {
        var result = await MutateClassLinkAsync(classId, activityId, link: true, cancellationToken);
        return result.Error ?? Ok(result.Activity);
    }

    [HttpDelete("api/classes/{classId:guid}/activities/{activityId:guid}")]
    public async Task<ActionResult<ActivityResponse>> UnlinkFromClass(
        Guid classId,
        Guid activityId,
        CancellationToken cancellationToken)
    {
        var result = await MutateClassLinkAsync(classId, activityId, link: false, cancellationToken);
        return result.Error ?? Ok(result.Activity);
    }

    [HttpPut("api/activities/{id:guid}/classes")]
    public async Task<ActionResult<ActivityResponse>> AssignClasses(
        Guid id,
        [FromBody] AssignActivityClassesRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var activity = await db.Activities
            .Find(a => a.Id == id)
            .FirstOrDefaultAsync(cancellationToken);

        if (activity is null)
        {
            return NotFound(new { detail = "Atividade não encontrada." });
        }

        if (!await OwnsActivityAsync(profile, activity, cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas o autor da atividade pode vinculá-la a turmas." });
        }

        var ownedClassIds = await db.Classes
            .Find(c => c.ProfessorId == profile.Id)
            .Project(c => c.Id)
            .ToListAsync(cancellationToken);

        var requested = request.ClassIds.Distinct().ToList();
        if (requested.Any(classId => !ownedClassIds.Contains(classId)))
        {
            return BadRequest(new { detail = "Só é possível vincular turmas suas." });
        }

        activity.ClassIds = requested;
        activity.ClassId = Guid.Empty;
        await db.Activities.ReplaceOneAsync(a => a.Id == activity.Id, activity, cancellationToken: cancellationToken);
        return Ok(ToResponse(activity, includeAnswers: true));
    }

    [HttpGet("api/activities/{id:guid}")]
    public async Task<ActionResult<ActivityResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var activity = await db.Activities
            .Find(a => a.Id == id)
            .FirstOrDefaultAsync(cancellationToken);

        if (activity is null)
        {
            return NotFound(new { detail = "Atividade não encontrada." });
        }

        var owns = await OwnsActivityAsync(profile, activity, cancellationToken);
        if (owns)
        {
            return Ok(ToResponse(activity, includeAnswers: true));
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não tem acesso a esta atividade." });
        }

        var linked = activity.LinkedClassIds();
        if (linked.Count == 0)
        {
            return NotFound(new { detail = "Atividade não encontrada." });
        }

        var enrolled = await db.Classes
            .Find(c => linked.Contains(c.Id) && c.Enrollments.Any(e => e.StudentId == profile.Id))
            .AnyAsync(cancellationToken);

        if (!enrolled)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não tem acesso a esta atividade." });
        }

        return Ok(ToResponse(activity, includeAnswers: false));
    }

    [HttpPost("api/activities/{id:guid}/import-flashcards")]
    public async Task<ActionResult<ActivityResponse>> ImportFlashcards(
        Guid id,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var quiz = await db.Activities
            .Find(a => a.Id == id)
            .FirstOrDefaultAsync(cancellationToken);

        if (quiz is null)
        {
            return NotFound(new { detail = "Atividade não encontrada." });
        }

        if (!await OwnsActivityAsync(profile, quiz, cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas o autor do quiz pode importar flashcards." });
        }

        if (quiz.Type != ActivityTypes.Quiz)
        {
            return BadRequest(new { detail = "Só é possível importar flashcards a partir de um quiz." });
        }

        var cards = quiz.Items
            .Where(item => !string.IsNullOrWhiteSpace(item.Prompt))
            .Select(item =>
            {
                var correct = item.Options?.FirstOrDefault(o => o.IsCorrect);
                if (correct is null || string.IsNullOrWhiteSpace(correct.Text))
                {
                    return null;
                }

                return new ActivityItem
                {
                    Id = Guid.NewGuid(),
                    Kind = ItemKinds.Flashcard,
                    Front = item.Prompt!.Trim(),
                    Back = correct.Text.Trim(),
                    Position = 0
                };
            })
            .Where(card => card is not null)
            .Cast<ActivityItem>()
            .Select((card, index) =>
            {
                card.Position = index;
                return card;
            })
            .ToList();

        if (cards.Count == 0)
        {
            return BadRequest(new { detail = "Nenhuma questão com alternativa correta pôde ser convertida em flashcard." });
        }

        var title = quiz.Title.EndsWith("(flashcards)", StringComparison.OrdinalIgnoreCase)
            ? quiz.Title
            : $"{quiz.Title} (flashcards)";

        var existing = await db.Activities
            .Find(a => a.SourceActivityId == quiz.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var linked = quiz.LinkedClassIds();

        if (existing is not null)
        {
            existing.Title = title;
            existing.Items = cards;
            existing.ProfessorId = quiz.ProfessorId != Guid.Empty ? quiz.ProfessorId : profile.Id;
            existing.ClassIds = linked;
            existing.ClassId = Guid.Empty;
            await db.Activities.ReplaceOneAsync(a => a.Id == existing.Id, existing, cancellationToken: cancellationToken);
            return Ok(ToResponse(existing, includeAnswers: true));
        }

        var deck = new Activity
        {
            Id = Guid.NewGuid(),
            ProfessorId = quiz.ProfessorId != Guid.Empty ? quiz.ProfessorId : profile.Id,
            ClassIds = linked,
            Title = title,
            Type = ActivityTypes.Flashcards,
            SourceActivityId = quiz.Id,
            CreatedAt = DateTimeOffset.UtcNow,
            Items = cards
        };

        await db.Activities.InsertOneAsync(deck, cancellationToken: cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = deck.Id }, ToResponse(deck, includeAnswers: true));
    }

    private async Task<(ActivityResponse? Activity, ActionResult? Error)> MutateClassLinkAsync(
        Guid classId,
        Guid activityId,
        bool link,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return (null, Unauthorized(new { detail = "Perfil não encontrado." }));
        }

        var classroom = await db.Classes
            .Find(c => c.Id == classId)
            .FirstOrDefaultAsync(cancellationToken);

        if (classroom is null)
        {
            return (null, NotFound(new { detail = "Turma não encontrada." }));
        }

        if (classroom.ProfessorId != profile.Id)
        {
            return (null, StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas o professor da turma pode vincular atividades." }));
        }

        var activity = await db.Activities
            .Find(a => a.Id == activityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (activity is null)
        {
            return (null, NotFound(new { detail = "Atividade não encontrada." }));
        }

        if (!await OwnsActivityAsync(profile, activity, cancellationToken))
        {
            return (null, StatusCode(StatusCodes.Status403Forbidden, new { detail = "Esta atividade não é sua." }));
        }

        var linked = activity.LinkedClassIds();
        if (link)
        {
            if (!linked.Contains(classId))
            {
                linked.Add(classId);
            }
        }
        else
        {
            linked.Remove(classId);
        }

        activity.ClassIds = linked;
        activity.ClassId = Guid.Empty;
        if (activity.ProfessorId == Guid.Empty)
        {
            activity.ProfessorId = profile.Id;
        }

        await db.Activities.ReplaceOneAsync(a => a.Id == activity.Id, activity, cancellationToken: cancellationToken);
        return (ToResponse(activity, includeAnswers: true), null);
    }

    private async Task<bool> OwnsActivityAsync(Profile profile, Activity activity, CancellationToken cancellationToken)
    {
        if (profile.Role != UserRoles.Professor)
        {
            return false;
        }

        if (activity.ProfessorId == profile.Id)
        {
            return true;
        }

        var linked = activity.LinkedClassIds();
        if (linked.Count == 0)
        {
            return false;
        }

        return await db.Classes
            .Find(c => linked.Contains(c.Id) && c.ProfessorId == profile.Id)
            .AnyAsync(cancellationToken);
    }

    private async Task<(Profile? Profile, ClassRoom? Classroom, ActionResult? Error)> ResolveClassAccessAsync(
        Guid classId,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return (null, null, Unauthorized(new { detail = "Perfil não encontrado." }));
        }

        var classroom = await db.Classes
            .Find(c => c.Id == classId)
            .FirstOrDefaultAsync(cancellationToken);

        if (classroom is null)
        {
            return (profile, null, NotFound(new { detail = "Turma não encontrada." }));
        }

        var allowed = classroom.ProfessorId == profile.Id
            || classroom.Enrollments.Any(e => e.StudentId == profile.Id);

        if (!allowed)
        {
            return (profile, classroom, StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não tem acesso a esta turma." }));
        }

        return (profile, classroom, null);
    }

    private async Task<Profile?> GetCurrentProfileAsync(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        if (userId is null)
        {
            return null;
        }

        return await db.Profiles
            .Find(p => p.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static string? ValidateQuizItems(List<CreateActivityItemRequest> items)
    {
        if (items.Count == 0)
        {
            return "O quiz precisa de pelo menos uma questão.";
        }

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Prompt))
            {
                return "Cada questão precisa de um enunciado.";
            }

            var options = item.Options ?? [];
            if (options.Count is < 2 or > 5)
            {
                return "Cada questão deve ter de 2 a 5 alternativas.";
            }

            if (options.Any(option => string.IsNullOrWhiteSpace(option.Text)))
            {
                return "Todas as alternativas precisam de texto.";
            }

            if (options.Count(option => option.IsCorrect) != 1)
            {
                return "Cada questão deve ter exatamente uma alternativa correta.";
            }

            if (item.TimeLimitSeconds is < 5 or > 300)
            {
                return "O tempo por questão deve ficar entre 5 e 300 segundos.";
            }
        }

        return null;
    }

    private static string? ValidateFlashcardItems(List<CreateActivityItemRequest> items)
    {
        if (items.Count == 0)
        {
            return "O deck precisa de pelo menos um cartão.";
        }

        if (items.Any(item => string.IsNullOrWhiteSpace(item.Front) || string.IsNullOrWhiteSpace(item.Back)))
        {
            return "Cada cartão precisa de frente e verso.";
        }

        return null;
    }

    private static List<ActivityItem> MapQuizItems(List<CreateActivityItemRequest> items) =>
        items.Select((item, index) => new ActivityItem
        {
            Id = Guid.NewGuid(),
            Kind = ItemKinds.MultipleChoice,
            Prompt = item.Prompt!.Trim(),
            Explanation = string.IsNullOrWhiteSpace(item.Explanation) ? null : item.Explanation.Trim(),
            TimeLimitSeconds = item.TimeLimitSeconds ?? 30,
            Position = index,
            Options = item.Options!
                .Select((option, optionIndex) => new QuestionOption
                {
                    Id = Guid.NewGuid(),
                    Text = option.Text.Trim(),
                    IsCorrect = option.IsCorrect,
                    Position = optionIndex
                })
                .ToList()
        }).ToList();

    private static List<ActivityItem> MapFlashcardItems(List<CreateActivityItemRequest> items) =>
        items.Select((item, index) => new ActivityItem
        {
            Id = Guid.NewGuid(),
            Kind = ItemKinds.Flashcard,
            Front = item.Front!.Trim(),
            Back = item.Back!.Trim(),
            Position = index
        }).ToList();

    private static ActivitySummaryResponse ToSummary(Activity activity) =>
        new(
            activity.Id,
            activity.ProfessorId,
            activity.Title,
            activity.Type,
            activity.CreatedAt,
            activity.Items.Count,
            activity.SourceActivityId,
            activity.LinkedClassIds());

    private static ActivityResponse ToResponse(Activity activity, bool includeAnswers) =>
        new(
            activity.Id,
            activity.ProfessorId,
            activity.Title,
            activity.Type,
            activity.CreatedAt,
            activity.SourceActivityId,
            activity.LinkedClassIds(),
            activity.Items
                .OrderBy(item => item.Position)
                .Select(item => ToItemResponse(item, includeAnswers))
                .ToList());

    private static ActivityItemResponse ToItemResponse(ActivityItem item, bool includeAnswers) =>
        new(
            item.Id,
            item.Kind,
            item.Prompt,
            includeAnswers ? item.Explanation : null,
            item.TimeLimitSeconds,
            item.Position,
            item.Options?
                .OrderBy(option => option.Position)
                .Select(option => new QuestionOptionResponse(
                    option.Id,
                    option.Text,
                    includeAnswers ? option.IsCorrect : null,
                    option.Position))
                .ToList(),
            item.Front,
            item.Back);
}
