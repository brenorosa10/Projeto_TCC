using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/classes")]
public class ClassesController(
    AppDbContext db,
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

        if (profile.Role == UserRoles.Professor)
        {
            var taught = await db.Classes.AsNoTracking()
                .Where(c => c.ProfessorId == profile.Id)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new ClassResponse(
                    c.Id,
                    c.Name,
                    c.Code,
                    c.ProfessorId,
                    c.Professor!.FullName,
                    c.CreatedAt,
                    c.Enrollments.Count))
                .ToListAsync(cancellationToken);
            return Ok(taught);
        }

        var enrolled = await db.ClassEnrollments.AsNoTracking()
            .Where(e => e.StudentId == profile.Id)
            .OrderByDescending(e => e.JoinedAt)
            .Select(e => new ClassResponse(
                e.Class!.Id,
                e.Class.Name,
                e.Class.Code,
                e.Class.ProfessorId,
                e.Class.Professor!.FullName,
                e.Class.CreatedAt,
                e.Class.Enrollments.Count))
            .ToListAsync(cancellationToken);

        return Ok(enrolled);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClassResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        var classroom = await db.Classes.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new ClassResponse(
                c.Id,
                c.Name,
                c.Code,
                c.ProfessorId,
                c.Professor!.FullName,
                c.CreatedAt,
                c.Enrollments.Count))
            .FirstOrDefaultAsync(cancellationToken);

        if (classroom is null)
        {
            return NotFound(new { detail = "Turma não encontrada." });
        }

        var allowed = classroom.ProfessorId == profile.Id
            || await db.ClassEnrollments.AnyAsync(
                e => e.ClassId == id && e.StudentId == profile.Id,
                cancellationToken);

        if (!allowed)
        {
            return Forbid();
        }

        return Ok(classroom);
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
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Classes.Add(classroom);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = classroom.Id },
            new ClassResponse(
                classroom.Id,
                classroom.Name,
                classroom.Code,
                classroom.ProfessorId,
                profile.FullName,
                classroom.CreatedAt,
                0));
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
            .Include(c => c.Professor)
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.Code == code, cancellationToken);

        if (classroom is null)
        {
            return NotFound(new { detail = "Código de turma inválido." });
        }

        var already = classroom.Enrollments.Any(e => e.StudentId == profile.Id);
        if (!already)
        {
            db.ClassEnrollments.Add(new ClassEnrollment
            {
                ClassId = classroom.Id,
                StudentId = profile.Id,
                JoinedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        var studentCount = await db.ClassEnrollments.CountAsync(
            e => e.ClassId == classroom.Id,
            cancellationToken);

        return Ok(new ClassResponse(
            classroom.Id,
            classroom.Name,
            classroom.Code,
            classroom.ProfessorId,
            classroom.Professor?.FullName,
            classroom.CreatedAt,
            studentCount));
    }

    private async Task<Profile?> GetCurrentProfileAsync(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        if (userId is null)
        {
            return null;
        }

        return await db.Profiles.FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);
    }
}
