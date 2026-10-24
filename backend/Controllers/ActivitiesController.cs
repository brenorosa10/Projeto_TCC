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
    CurrentUserService currentUser,
    GeminiQuizGenerator quizGenerator) : ControllerBase
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

        return Ok(activities.Select(ActivityMapper.ToSummary));
    }

    [HttpPost("api/activities")]
    [RequestSizeLimit(20_971_520)]
    public async Task<ActionResult<ActivityResponse>> Create(
        [FromBody] CreateActivityRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role is not (UserRoles.Professor or UserRoles.Aluno))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não pode criar atividades." });
        }

        var type = request.Type.Trim().ToLowerInvariant();
        var built = ActivityContentBuilder.Build(type, request);
        if (built.Error is not null)
        {
            return BadRequest(new { detail = built.Error });
        }

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            ProfessorId = profile.Id,
            Title = request.Title.Trim(),
            Type = type,
            IsPublic = profile.Role == UserRoles.Professor && request.IsPublic,
            CreatedAt = DateTimeOffset.UtcNow,
            Sections = built.Sections!,
            Items = built.Items!
        };

        var sizeError = ActivityImage.ValidateDocumentSize(activity);
        if (sizeError is not null)
        {
            return BadRequest(new { detail = sizeError });
        }

        await db.Activities.InsertOneAsync(activity, cancellationToken: cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = activity.Id }, ActivityMapper.ToResponse(activity, includeAnswers: true));
    }

    [HttpPut("api/activities/{id:guid}")]
    [RequestSizeLimit(20_971_520)]
    public async Task<ActionResult<ActivityResponse>> Update(
        Guid id,
        [FromBody] CreateActivityRequest request,
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

        if (!IsActivityAuthor(profile, activity))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas o autor da atividade pode editá-la." });
        }

        var type = request.Type.Trim().ToLowerInvariant();
        if (type != activity.Type)
        {
            return BadRequest(new { detail = "Não é possível alterar o tipo da atividade." });
        }

        var built = ActivityContentBuilder.Build(type, request, activity);
        if (built.Error is not null)
        {
            return BadRequest(new { detail = built.Error });
        }

        activity.Title = request.Title.Trim();
        activity.IsPublic = profile.Role == UserRoles.Professor && request.IsPublic;
        activity.Sections = built.Sections!;
        activity.Items = built.Items!;

        var sizeError = ActivityImage.ValidateDocumentSize(activity);
        if (sizeError is not null)
        {
            return BadRequest(new { detail = sizeError });
        }

        await db.Activities.ReplaceOneAsync(a => a.Id == activity.Id, activity, cancellationToken: cancellationToken);
        return Ok(ActivityMapper.ToResponse(activity, includeAnswers: true));
    }

    [HttpDelete("api/activities/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
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

        if (!IsActivityAuthor(profile, activity))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas o autor da atividade pode excluí-la." });
        }

        await db.AnswerAttempts.DeleteManyAsync(a => a.ActivityId == id, cancellationToken);
        await db.ReviewProgress.DeleteManyAsync(p => p.ActivityId == id, cancellationToken);
        await db.LiveSessions.DeleteManyAsync(s => s.ActivityId == id, cancellationToken);
        await db.StudySessions.DeleteManyAsync(s => s.ActivityId == id, cancellationToken);
        await db.Activities.DeleteOneAsync(a => a.Id == id, cancellationToken);
        return NoContent();
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

        return Ok(activities.Select(ActivityMapper.ToSummary));
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

        if (!IsActivityAuthor(profile, activity))
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
        return Ok(ActivityMapper.ToResponse(activity, includeAnswers: true));
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

        if (await CanViewAnswersAsync(profile, activity, cancellationToken))
        {
            return Ok(ActivityMapper.ToResponse(activity, includeAnswers: true));
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não tem acesso a esta atividade." });
        }

        if (activity.IsPublic)
        {
            return Ok(ActivityMapper.ToResponse(activity, includeAnswers: false));
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

        return Ok(ActivityMapper.ToResponse(activity, includeAnswers: false));
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

        if (!IsActivityAuthor(profile, quiz))
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
                    Position = 0,
                    ImageBytes = item.ImageBytes,
                    ImageContentType = item.ImageContentType
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
            existing.Sections = ActivityContentBuilder.DefaultSections(cards, existing.Sections);
            existing.ProfessorId = quiz.ProfessorId != Guid.Empty ? quiz.ProfessorId : profile.Id;
            existing.ClassIds = linked;
            existing.ClassId = Guid.Empty;
            existing.IsPublic = quiz.IsPublic;
            await db.Activities.ReplaceOneAsync(a => a.Id == existing.Id, existing, cancellationToken: cancellationToken);
            return Ok(ActivityMapper.ToResponse(existing, includeAnswers: true));
        }

        var deck = new Activity
        {
            Id = Guid.NewGuid(),
            ProfessorId = quiz.ProfessorId != Guid.Empty ? quiz.ProfessorId : profile.Id,
            ClassIds = linked,
            Title = title,
            Type = ActivityTypes.Flashcards,
            SourceActivityId = quiz.Id,
            IsPublic = quiz.IsPublic,
            CreatedAt = DateTimeOffset.UtcNow,
            Items = cards,
            Sections = ActivityContentBuilder.DefaultSections(cards)
        };

        await db.Activities.InsertOneAsync(deck, cancellationToken: cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = deck.Id }, ActivityMapper.ToResponse(deck, includeAnswers: true));
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

        if (!IsActivityAuthor(profile, activity))
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
        return (ActivityMapper.ToResponse(activity, includeAnswers: true), null);
    }

    [HttpPost("api/activities/quiz/generate")]
    public async Task<ActionResult<GenerateQuizQuestionsResponse>> GenerateQuizQuestions(
        [FromBody] GenerateQuizQuestionsRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role is not (UserRoles.Professor or UserRoles.Aluno))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não pode gerar questões." });
        }

        if (string.IsNullOrWhiteSpace(request.Context) || request.Context.Trim().Length < GeneratedQuizSanitizer.MinContextLength)
        {
            return BadRequest(new { detail = "Descreva o assunto com pelo menos algumas frases antes de gerar." });
        }

        try
        {
            var generated = await quizGenerator.GenerateAsync(request, profile.Id, cancellationToken);
            return Ok(generated);
        }
        catch (GeminiApiException exception)
        {
            return StatusCode(exception.StatusCode, new { detail = exception.Message });
        }
    }

    private static bool IsActivityAuthor(Profile profile, Activity activity) =>
        activity.ProfessorId == profile.Id;

    private async Task<bool> TeachesLinkedClassAsync(Profile profile, Activity activity, CancellationToken cancellationToken)
    {
        if (profile.Role != UserRoles.Professor)
        {
            return false;
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

    private Task<bool> CanViewAnswersAsync(Profile profile, Activity activity, CancellationToken cancellationToken) =>
        IsActivityAuthor(profile, activity)
            ? Task.FromResult(true)
            : TeachesLinkedClassAsync(profile, activity, cancellationToken);

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
}
