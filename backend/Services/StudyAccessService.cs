using MongoDB.Driver;
using Astro.Api.Data;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public class StudyAccessService(MongoDbContext db)
{
    public async Task<bool> CanStudyAsync(Profile? profile, Activity activity, CancellationToken cancellationToken)
    {
        if (activity.IsPublic)
        {
            return true;
        }

        if (profile is null)
        {
            return false;
        }

        if (profile.Role == UserRoles.Professor)
        {
            if (activity.ProfessorId == profile.Id)
            {
                return true;
            }

            var linkedOwned = activity.LinkedClassIds();
            if (linkedOwned.Count == 0)
            {
                return false;
            }

            return await db.Classes
                .Find(classroom => linkedOwned.Contains(classroom.Id) && classroom.ProfessorId == profile.Id)
                .AnyAsync(cancellationToken);
        }

        var linked = activity.LinkedClassIds();
        if (linked.Count == 0)
        {
            return false;
        }

        return await db.Classes
            .Find(classroom => linked.Contains(classroom.Id) && classroom.Enrollments.Any(enrollment => enrollment.StudentId == profile.Id))
            .AnyAsync(cancellationToken);
    }

    public async Task<Profile?> GetProfileAsync(Guid? userId, CancellationToken cancellationToken)
    {
        if (userId is null)
        {
            return null;
        }

        return await db.Profiles
            .Find(profile => profile.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
