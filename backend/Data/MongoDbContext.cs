using MongoDB.Driver;
using Astro.Api.Domain;

namespace Astro.Api.Data;

public class MongoDbContext
{
    public IMongoDatabase Database { get; }
    public IMongoCollection<Profile> Profiles { get; }
    public IMongoCollection<ClassRoom> Classes { get; }
    public IMongoCollection<Activity> Activities { get; }
    public IMongoCollection<LiveSession> LiveSessions { get; }
    public IMongoCollection<AnswerAttempt> AnswerAttempts { get; }
    public IMongoCollection<ReviewProgress> ReviewProgress { get; }
    public IMongoCollection<StudySession> StudySessions { get; }

    public MongoDbContext(IMongoDatabase database)
    {
        Database = database;
        Profiles = database.GetCollection<Profile>("profiles");
        Classes = database.GetCollection<ClassRoom>("classes");
        Activities = database.GetCollection<Activity>("activities");
        LiveSessions = database.GetCollection<LiveSession>("liveSessions");
        AnswerAttempts = database.GetCollection<AnswerAttempt>("answerAttempts");
        ReviewProgress = database.GetCollection<ReviewProgress>("reviewProgress");
        StudySessions = database.GetCollection<StudySession>("studySessions");
    }
}
