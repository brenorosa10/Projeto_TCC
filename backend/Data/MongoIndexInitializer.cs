using MongoDB.Driver;
using Astro.Api.Domain;

namespace Astro.Api.Data;

public class MongoIndexInitializer(MongoDbContext db, ILogger<MongoIndexInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await db.Profiles.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Profile>(Builders<Profile>.IndexKeys.Ascending(x => x.Email)),
                new CreateIndexModel<Profile>(
                    Builders<Profile>.IndexKeys.Ascending(x => x.GoogleId),
                    new CreateIndexOptions { Unique = true, Sparse = true })
            ],
            cancellationToken);

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
                    Builders<Activity>.IndexKeys.Ascending(x => x.ClassId).Ascending(x => x.Type)),
                new CreateIndexModel<Activity>(
                    Builders<Activity>.IndexKeys.Ascending(x => x.ClassId).Descending(x => x.CreatedAt))
            ],
            cancellationToken);

        await db.LiveSessions.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<LiveSession>(
                    Builders<LiveSession>.IndexKeys.Ascending(x => x.Pin)),
                new CreateIndexModel<LiveSession>(
                    Builders<LiveSession>.IndexKeys.Ascending(x => x.ActivityId))
            ],
            cancellationToken);

        await db.AnswerAttempts.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<AnswerAttempt>(
                    Builders<AnswerAttempt>.IndexKeys.Ascending(x => x.StudentId).Ascending(x => x.ActivityId)),
                new CreateIndexModel<AnswerAttempt>(
                    Builders<AnswerAttempt>.IndexKeys.Ascending(x => x.ActivityId).Ascending(x => x.ItemId))
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

        logger.LogInformation("Índices MongoDB verificados.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
