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
[Route("api/classes")]
public class ClassesController(
    MongoDbContext db,
    CurrentUserService currentUser,
    ClassCodeGenerator codeGenerator) : ControllerBase
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

        var code = await codeGenerator.GenerateUniqueAsync(cancellationToken);
        var classroom = new ClassRoom
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Code = code,
            ProfessorId = profile.Id,
            ProfessorName = profile.FullName,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await db.Classes.InsertOneAsync(classroom, cancellationToken: cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = classroom.Id }, ToResponse(classroom));
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
