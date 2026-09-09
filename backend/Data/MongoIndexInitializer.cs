using MongoDB.Driver;
using Astro.Api.Domain;

namespace Astro.Api.Data;

public class MongoIndexInitializer(MongoDbContext db, ILogger<MongoIndexInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await EnsureIndexesAsync(cancellationToken);
            logger.LogInformation("Índices MongoDB verificados.");
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Não foi possível falar com o MongoDB na inicialização. A API sobe, mas login e dados falham até o Atlas conectar.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task EnsureIndexesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.Profiles.Indexes.DropOneAsync("email_1", cancellationToken);
        }
        catch (Exception)
        {
            // Índice legado pode não existir.
        }

        await MergeDuplicateEmailsAsync(cancellationToken);

        await EnsureProfileIndexesAsync(cancellationToken);

        await db.Classes.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<ClassRoom>(
                    Builders<ClassRoom>.IndexKeys.Ascending(x => x.Code),
                    new CreateIndexOptions { Unique = true }),
                new CreateIndexModel<ClassRoom>(
                    Builders<ClassRoom>.IndexKeys.Ascending(x => x.ProfessorId)),
                new CreateIndexModel<ClassRoom>(
                    Builders<ClassRoom>.IndexKeys.Ascending("enrollments.studentId"))
            ],
            cancellationToken);

        await db.Activities.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Activity>(
                    Builders<Activity>.IndexKeys.Ascending(x => x.ProfessorId).Descending(x => x.CreatedAt)),
                new CreateIndexModel<Activity>(
                    Builders<Activity>.IndexKeys.Ascending(x => x.ClassIds)),
                new CreateIndexModel<Activity>(
                    Builders<Activity>.IndexKeys.Ascending(x => x.ClassId).Ascending(x => x.Type)),
                new CreateIndexModel<Activity>(
                    Builders<Activity>.IndexKeys.Ascending(x => x.ClassId).Descending(x => x.CreatedAt)),
                new CreateIndexModel<Activity>(
                    Builders<Activity>.IndexKeys.Ascending(x => x.IsPublic).Ascending(x => x.Type).Descending(x => x.CreatedAt))
            ],
            cancellationToken);

        await db.LiveSessions.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<LiveSession>(
                    Builders<LiveSession>.IndexKeys.Ascending(x => x.Pin)),
                new CreateIndexModel<LiveSession>(
                    Builders<LiveSession>.IndexKeys.Ascending(x => x.Pin),
                    new CreateIndexOptions<LiveSession>
                    {
                        Name = "pin_active_unique",
                        Unique = true,
                        PartialFilterExpression = Builders<LiveSession>.Filter.In(
                            x => x.Status,
                            new[] { LiveSessionStatuses.Lobby, LiveSessionStatuses.Running })
                    }),
                new CreateIndexModel<LiveSession>(
                    Builders<LiveSession>.IndexKeys.Ascending(x => x.ActivityId)),
                new CreateIndexModel<LiveSession>(
                    Builders<LiveSession>.IndexKeys.Ascending(x => x.ProfessorId).Descending(x => x.StartedAt))
            ],
            cancellationToken);

        await db.AnswerAttempts.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<AnswerAttempt>(
                    Builders<AnswerAttempt>.IndexKeys.Ascending(x => x.StudentId).Ascending(x => x.ActivityId)),
                new CreateIndexModel<AnswerAttempt>(
                    Builders<AnswerAttempt>.IndexKeys.Ascending(x => x.ActivityId).Ascending(x => x.ItemId)),
                new CreateIndexModel<AnswerAttempt>(
                    Builders<AnswerAttempt>.IndexKeys.Ascending(x => x.LiveSessionId))
            ],
            cancellationToken);

        await db.ReviewProgress.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<ReviewProgress>(
                    Builders<ReviewProgress>.IndexKeys
                        .Ascending(x => x.StudentId)
                        .Ascending(x => x.ActivityId)
                        .Ascending(x => x.ItemId),
                    new CreateIndexOptions { Unique = true }),
                new CreateIndexModel<ReviewProgress>(
                    Builders<ReviewProgress>.IndexKeys.Ascending(x => x.StudentId).Ascending(x => x.NextReviewAt))
            ],
            cancellationToken);

        await db.StudySessions.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<StudySession>(
                    Builders<StudySession>.IndexKeys
                        .Ascending(x => x.StudentId)
                        .Ascending(x => x.ActivityId)
                        .Ascending(x => x.Status)
                        .Descending(x => x.StartedAt)),
                new CreateIndexModel<StudySession>(
                    Builders<StudySession>.IndexKeys.Ascending(x => x.ActivityId))
            ],
            cancellationToken);
    }

    private async Task MergeDuplicateEmailsAsync(CancellationToken cancellationToken)
    {
        var profiles = await db.Profiles.Find(FilterDefinition<Profile>.Empty).ToListAsync(cancellationToken);
        var groups = profiles
            .Where(profile => !string.IsNullOrWhiteSpace(profile.Email))
            .GroupBy(profile => profile.Email.Trim().ToLowerInvariant())
            .Where(group => group.Count() > 1);

        foreach (var group in groups)
        {
            var duplicates = group.ToList();
            var keeper = PickKeeper(duplicates);

            foreach (var extra in duplicates.Where(profile => profile.Id != keeper.Id))
            {
                CopyMissingIdentity(keeper, extra);
                await RetargetProfileAsync(extra.Id, keeper.Id, cancellationToken);
                await db.Profiles.DeleteOneAsync(profile => profile.Id == extra.Id, cancellationToken);
            }

            keeper.Email = group.Key;
            await db.Profiles.ReplaceOneAsync(profile => profile.Id == keeper.Id, keeper, cancellationToken: cancellationToken);
            logger.LogWarning(
                "Perfis duplicados do e-mail {Email} foram unificados no id {ProfileId}.",
                group.Key,
                keeper.Id);
        }
    }

    private static Profile PickKeeper(List<Profile> duplicates)
    {
        return duplicates
            .OrderByDescending(profile => !string.IsNullOrWhiteSpace(profile.PasswordHash))
            .ThenByDescending(profile => !string.IsNullOrWhiteSpace(profile.GoogleId))
            .ThenByDescending(profile => !string.IsNullOrWhiteSpace(profile.Role))
            .ThenBy(profile => profile.CreatedAt)
            .First();
    }

    private static void CopyMissingIdentity(Profile keeper, Profile extra)
    {
        if (string.IsNullOrWhiteSpace(keeper.GoogleId))
        {
            keeper.GoogleId = extra.GoogleId;
        }

        if (string.IsNullOrWhiteSpace(keeper.PasswordHash))
        {
            keeper.PasswordHash = extra.PasswordHash;
        }

        if (string.IsNullOrWhiteSpace(keeper.Username))
        {
            keeper.Username = extra.Username;
            keeper.UsernameNormalized = extra.UsernameNormalized;
        }

        keeper.FullName ??= extra.FullName;
        keeper.AvatarUrl ??= extra.AvatarUrl;
        if (string.IsNullOrWhiteSpace(keeper.Role))
        {
            keeper.Role = extra.Role;
        }
    }

    private async Task RetargetProfileAsync(Guid fromId, Guid toId, CancellationToken cancellationToken)
    {
        await db.Classes.UpdateManyAsync(
            classroom => classroom.ProfessorId == fromId,
            Builders<ClassRoom>.Update.Set(classroom => classroom.ProfessorId, toId),
            cancellationToken: cancellationToken);

        var classes = await db.Classes
            .Find(classroom => classroom.Enrollments.Any(enrollment => enrollment.StudentId == fromId))
            .ToListAsync(cancellationToken);

        foreach (var classroom in classes)
        {
            foreach (var enrollment in classroom.Enrollments.Where(enrollment => enrollment.StudentId == fromId))
            {
                enrollment.StudentId = toId;
            }

            classroom.Enrollments = classroom.Enrollments
                .GroupBy(enrollment => enrollment.StudentId)
                .Select(group => group.OrderBy(enrollment => enrollment.JoinedAt).First())
                .ToList();

            await db.Classes.ReplaceOneAsync(
                item => item.Id == classroom.Id,
                classroom,
                cancellationToken: cancellationToken);
        }

        await db.Activities.UpdateManyAsync(
            activity => activity.ProfessorId == fromId,
            Builders<Activity>.Update.Set(activity => activity.ProfessorId, toId),
            cancellationToken: cancellationToken);

        await db.AnswerAttempts.UpdateManyAsync(
            attempt => attempt.StudentId == fromId,
            Builders<AnswerAttempt>.Update.Set(attempt => attempt.StudentId, toId),
            cancellationToken: cancellationToken);

        var extraProgress = await db.ReviewProgress
            .Find(progress => progress.StudentId == fromId)
            .ToListAsync(cancellationToken);

        foreach (var progress in extraProgress)
        {
            var exists = await db.ReviewProgress
                .Find(item =>
                    item.StudentId == toId
                    && item.ActivityId == progress.ActivityId
                    && item.ItemId == progress.ItemId)
                .AnyAsync(cancellationToken);

            if (exists)
            {
                await db.ReviewProgress.DeleteOneAsync(item => item.Id == progress.Id, cancellationToken);
            }
            else
            {
                progress.StudentId = toId;
                await db.ReviewProgress.ReplaceOneAsync(
                    item => item.Id == progress.Id,
                    progress,
                    cancellationToken: cancellationToken);
            }
        }

        await db.StudySessions.UpdateManyAsync(
            session => session.StudentId == fromId,
            Builders<StudySession>.Update.Set(session => session.StudentId, toId),
            cancellationToken: cancellationToken);
    }

    private async Task EnsureProfileIndexesAsync(CancellationToken cancellationToken)
    {
        await CreateIndexSafelyAsync(
            "email_unique",
            () => db.Profiles.Indexes.CreateOneAsync(
                new CreateIndexModel<Profile>(
                    Builders<Profile>.IndexKeys.Ascending(x => x.Email),
                    new CreateIndexOptions { Unique = true, Name = "email_unique" }),
                cancellationToken: cancellationToken));

        await CreateIndexSafelyAsync(
            "usernameNormalized_unique",
            () => db.Profiles.Indexes.CreateOneAsync(
                new CreateIndexModel<Profile>(
                    Builders<Profile>.IndexKeys.Ascending(x => x.UsernameNormalized),
                    new CreateIndexOptions { Unique = true, Sparse = true, Name = "usernameNormalized_unique" }),
                cancellationToken: cancellationToken));

        await CreateIndexSafelyAsync(
            "googleId_1",
            () => db.Profiles.Indexes.CreateOneAsync(
                new CreateIndexModel<Profile>(
                    Builders<Profile>.IndexKeys.Ascending(x => x.GoogleId),
                    new CreateIndexOptions { Unique = true, Sparse = true }),
                cancellationToken: cancellationToken));
    }

    private async Task CreateIndexSafelyAsync(string name, Func<Task> create)
    {
        try
        {
            await create();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Não foi possível criar o índice {IndexName}. A API continua sem ele.", name);
        }
    }
}
