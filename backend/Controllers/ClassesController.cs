using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Hubs;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/classes")]
public class ClassesController(
    MongoDbContext db,
    CurrentUserService currentUser,
    ClassCodeGenerator codeGenerator,
    LiveSessionService liveSessions,
    IHubContext<LiveSessionHub> hub) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ClassResponse>>> List(CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado. Conclua o login." });
        }

        var filter = profile.Role == UserRoles.Professor
            ? Builders<ClassRoom>.Filter.Eq(c => c.ProfessorId, profile.Id)
            : Builders<ClassRoom>.Filter.ElemMatch(c => c.Enrollments, e => e.StudentId == profile.Id);

        var classrooms = await db.Classes
            .Find(filter)
            .SortByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(classrooms.Select(ToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClassResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var classroom = await db.Classes
            .Find(c => c.Id == id)
            .FirstOrDefaultAsync(cancellationToken);

        if (classroom is null)
        {
            return NotFound(new { detail = "Turma não encontrada." });
        }

        var allowed = classroom.ProfessorId == profile.Id
            || classroom.Enrollments.Any(e => e.StudentId == profile.Id);

        if (!allowed)
        {
            return Forbid();
        }

        return Ok(ToResponse(classroom));
    }

    [HttpPost]
    public async Task<ActionResult<ClassResponse>> Create(
        [FromBody] CreateClassRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role != UserRoles.Professor)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas professores podem criar turmas." });
        }

        var name = request.Name.Trim();
        if (name.Length < 2)
        {
            return BadRequest(new { detail = "O nome da turma deve ter pelo menos 2 caracteres." });
        }

        var code = await codeGenerator.GenerateUniqueAsync(cancellationToken);
        var classroom = new ClassRoom
        {
            Id = Guid.NewGuid(),
            Name = name,
            Code = code,
            ProfessorId = profile.Id,
            ProfessorName = profile.FullName,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await db.Classes.InsertOneAsync(classroom, cancellationToken: cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = classroom.Id }, ToResponse(classroom));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ClassResponse>> Update(
        Guid id,
        [FromBody] UpdateClassRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var classroom = await db.Classes.Find(c => c.Id == id).FirstOrDefaultAsync(cancellationToken);
        if (classroom is null)
        {
            return NotFound(new { detail = "Turma não encontrada." });
        }

        if (classroom.ProfessorId != profile.Id)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você só pode alterar turmas que criou." });
        }

        var name = request.Name.Trim();
        if (name.Length < 2)
        {
            return BadRequest(new { detail = "O nome da turma deve ter pelo menos 2 caracteres." });
        }

        var renamed = await db.Classes.UpdateOneAsync(
            c => c.Id == classroom.Id && c.ProfessorId == profile.Id,
            Builders<ClassRoom>.Update.Set(c => c.Name, name),
            cancellationToken: cancellationToken);
        if (renamed.MatchedCount == 0)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você só pode alterar turmas que criou." });
        }

        classroom.Name = name;
        return Ok(ToResponse(classroom));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var classroom = await db.Classes.Find(c => c.Id == id).FirstOrDefaultAsync(cancellationToken);
        if (classroom is null)
        {
            return NotFound(new { detail = "Turma não encontrada." });
        }

        if (classroom.ProfessorId != profile.Id)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você só pode excluir turmas que criou." });
        }

        var activeSessions = await db.LiveSessions
            .Find(session =>
                session.ClassId == id
                && session.ProfessorId == profile.Id
                && session.Status != LiveSessionStatuses.Ended)
            .ToListAsync(cancellationToken);

        foreach (var session in activeSessions)
        {
            var ended = await liveSessions.EndAsync(session.Id, cancellationToken);
            if (ended.State is not null)
            {
                await LiveSessionHub.BroadcastAsync(hub, liveSessions, ended.State.Id, cancellationToken);
                continue;
            }

            await db.LiveSessions.UpdateOneAsync(
                item => item.Id == session.Id && item.ProfessorId == profile.Id,
                Builders<LiveSession>.Update
                    .Set(item => item.Status, LiveSessionStatuses.Ended)
                    .Set(item => item.Phase, LiveSessionPhases.Ended)
                    .Set(item => item.EndedAt, DateTimeOffset.UtcNow),
                cancellationToken: cancellationToken);
        }

        await db.Activities.UpdateManyAsync(
            Builders<Activity>.Filter.AnyEq(activity => activity.ClassIds, id),
            Builders<Activity>.Update.Pull(activity => activity.ClassIds, id),
            cancellationToken: cancellationToken);

        await db.Activities.UpdateManyAsync(
            activity => activity.ClassId == id,
            Builders<Activity>.Update.Set(activity => activity.ClassId, Guid.Empty),
            cancellationToken: cancellationToken);

        var deleted = await db.Classes.DeleteOneAsync(
            c => c.Id == id && c.ProfessorId == profile.Id,
            cancellationToken);

        if (deleted.DeletedCount == 0)
        {
            return NotFound(new { detail = "Turma não encontrada." });
        }

        return NoContent();
    }

    [HttpPost("join")]
    public async Task<ActionResult<ClassResponse>> Join(
        [FromBody] JoinClassRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado. Autentique-se para ingressar." });
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas alunos podem ingressar em turmas com código." });
        }

        var code = request.Code.Trim().ToUpperInvariant();
        if (code.Length == 0)
        {
            return BadRequest(new { detail = "Informe o código da turma." });
        }

        var classroom = await db.Classes
            .Find(c => c.Code == code)
            .FirstOrDefaultAsync(cancellationToken);

        if (classroom is null)
        {
            return NotFound(new { detail = "Código de turma inválido." });
        }

        var enrollment = new ClassEnrollment
        {
            StudentId = profile.Id,
            StudentName = profile.FullName,
            JoinedAt = DateTimeOffset.UtcNow
        };

        await db.Classes.UpdateOneAsync(
            c => c.Id == classroom.Id && !c.Enrollments.Any(e => e.StudentId == profile.Id),
            Builders<ClassRoom>.Update.Push(c => c.Enrollments, enrollment),
            cancellationToken: cancellationToken);

        var current = await db.Classes.Find(c => c.Id == classroom.Id).FirstOrDefaultAsync(cancellationToken)
            ?? classroom;
        return Ok(ToResponse(current));
    }

    [HttpPost("{id:guid}/leave")]
    public async Task<IActionResult> Leave(Guid id, CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas alunos podem sair de turmas." });
        }

        var result = await db.Classes.UpdateOneAsync(
            c => c.Id == id && c.Enrollments.Any(e => e.StudentId == profile.Id),
            Builders<ClassRoom>.Update.PullFilter(c => c.Enrollments, e => e.StudentId == profile.Id),
            cancellationToken: cancellationToken);

        if (result.MatchedCount == 0)
        {
            return NotFound(new { detail = "Você não está nesta turma." });
        }

        return NoContent();
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

    private static ClassResponse ToResponse(ClassRoom classroom) =>
        new(
            classroom.Id,
            classroom.Name,
            classroom.Code,
            classroom.ProfessorId,
            classroom.ProfessorName,
            classroom.CreatedAt,
            classroom.StudentCount);
}
