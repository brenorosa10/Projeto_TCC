using Microsoft.EntityFrameworkCore;
using Astro.Api.Domain;

namespace Astro.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<ClassRoom> Classes => Set<ClassRoom>();
    public DbSet<ClassEnrollment> ClassEnrollments => Set<ClassEnrollment>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<LiveSession> LiveSessions => Set<LiveSession>();
    public DbSet<AnswerAttempt> AnswerAttempts => Set<AnswerAttempt>();
    public DbSet<Flashcard> Flashcards => Set<Flashcard>();
    public DbSet<FlashcardProgress> FlashcardProgress => Set<FlashcardProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Profile>(entity =>
        {
            entity.ToTable("profiles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200);
            entity.Property(x => x.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(500);
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(20).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ClassRoom>(entity =>
        {
            entity.ToTable("classes");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(8).IsFixedLength().IsRequired();
            entity.Property(x => x.ProfessorId).HasColumnName("professor_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasOne(x => x.Professor)
                .WithMany(x => x.TaughtClasses)
                .HasForeignKey(x => x.ProfessorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ClassEnrollment>(entity =>
        {
            entity.ToTable("class_enrollments");
            entity.HasKey(x => new { x.ClassId, x.StudentId });
            entity.Property(x => x.ClassId).HasColumnName("class_id");
            entity.Property(x => x.StudentId).HasColumnName("student_id");
            entity.Property(x => x.JoinedAt).HasColumnName("joined_at");
            entity.HasOne(x => x.Class)
                .WithMany(x => x.Enrollments)
                .HasForeignKey(x => x.ClassId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Student)
                .WithMany(x => x.Enrollments)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Activity>(entity =>
        {
            entity.ToTable("activities");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ClassId).HasColumnName("class_id");
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(200);
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(40);
            entity.Property(x => x.Mode).HasColumnName("mode").HasMaxLength(20);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Question>(entity =>
        {
            entity.ToTable("questions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ActivityId).HasColumnName("activity_id");
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(40);
            entity.Property(x => x.Prompt).HasColumnName("prompt");
            entity.Property(x => x.Explanation).HasColumnName("explanation");
            entity.Property(x => x.TimeLimitSeconds).HasColumnName("time_limit_seconds");
            entity.Property(x => x.Position).HasColumnName("position");
        });

        modelBuilder.Entity<QuestionOption>(entity =>
        {
            entity.ToTable("question_options");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuestionId).HasColumnName("question_id");
            entity.Property(x => x.Text).HasColumnName("text");
            entity.Property(x => x.IsCorrect).HasColumnName("is_correct");
            entity.Property(x => x.Position).HasColumnName("position");
        });

        modelBuilder.Entity<LiveSession>(entity =>
        {
            entity.ToTable("live_sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ActivityId).HasColumnName("activity_id");
            entity.Property(x => x.Pin).HasColumnName("pin").HasMaxLength(6);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30);
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.EndedAt).HasColumnName("ended_at");
            entity.HasIndex(x => x.Pin);
        });

        modelBuilder.Entity<AnswerAttempt>(entity =>
        {
            entity.ToTable("answer_attempts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.StudentId).HasColumnName("student_id");
            entity.Property(x => x.QuestionId).HasColumnName("question_id");
            entity.Property(x => x.LiveSessionId).HasColumnName("live_session_id");
            entity.Property(x => x.SelectedOptionId).HasColumnName("selected_option_id");
            entity.Property(x => x.IsCorrect).HasColumnName("is_correct");
            entity.Property(x => x.ResponseTimeMs).HasColumnName("response_time_ms");
            entity.Property(x => x.Score).HasColumnName("score");
            entity.Property(x => x.AnsweredAt).HasColumnName("answered_at");
        });

        modelBuilder.Entity<Flashcard>(entity =>
        {
            entity.ToTable("flashcards");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ClassId).HasColumnName("class_id");
            entity.Property(x => x.Front).HasColumnName("front");
            entity.Property(x => x.Back).HasColumnName("back");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<FlashcardProgress>(entity =>
        {
            entity.ToTable("flashcard_progress");
            entity.HasKey(x => new { x.FlashcardId, x.StudentId });
            entity.Property(x => x.FlashcardId).HasColumnName("flashcard_id");
            entity.Property(x => x.StudentId).HasColumnName("student_id");
            entity.Property(x => x.BoxLevel).HasColumnName("box_level");
            entity.Property(x => x.NextReviewAt).HasColumnName("next_review_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });
    }
}
