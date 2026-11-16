using Astro.Api.Domain;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class AnalyticsReflectionTests
{
    [Fact]
    public void KeepsLatestLiveAttemptAndSkipsBlankReflection()
    {
        var sessionId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var item = ChoiceItem();
        var older = Attempt(item.Id, studentId, sessionId, "texto antigo", answeredAt: DateTimeOffset.UnixEpoch);
        var newer = Attempt(item.Id, studentId, sessionId, "  raciocínio final  ", answeredAt: DateTimeOffset.UnixEpoch.AddMinutes(2), isCorrect: true);
        newer.SelectedOptionId = item.Options![1].Id;
        var blank = Attempt(item.Id, Guid.NewGuid(), sessionId, "   ", answeredAt: DateTimeOffset.UnixEpoch.AddMinutes(3));

        var latest = AnalyticsReflectionBuilder.LatestLive([older, newer, blank]);
        var rows = AnalyticsReflectionBuilder.Build(
            item,
            latest,
            new Dictionary<(Guid, Guid), string> { [(sessionId, studentId)] = "Ana" },
            [],
            new Dictionary<Guid, string>());

        var row = Assert.Single(rows);
        Assert.Equal("Ana", row.StudentName);
        Assert.Equal("Vênus", row.SelectedOptions);
        Assert.True(row.IsCorrect);
        Assert.Equal("raciocínio final", row.Text);
        Assert.Equal(AnalyticsReflectionBuilder.LiveSource, row.Source);
        Assert.Equal(newer.AnsweredAt, row.AnsweredAt);
    }

    [Fact]
    public void ImageOptionUsesImagemLabel()
    {
        var item = ChoiceItem();
        item.Options![0].Text = "  ";
        item.Options[0].ImageUrl = "https://cdn.example/marte.png";
        var label = StudyAnswerFormatter.SelectedOptionLabels(item, item.Options[0].Id, null);
        Assert.Equal("Imagem", label);
    }

    [Fact]
    public void SessionScopeExcludesOtherSessionsAndIndividualAnswers()
    {
        var sessionId = Guid.NewGuid();
        var otherSession = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var item = ChoiceItem();
        var inSession = Attempt(item.Id, studentId, sessionId, "ao vivo desta sessão");
        var other = Attempt(item.Id, studentId, otherSession, "outra sessão");
        var individual = Attempt(item.Id, studentId, liveSessionId: null, "modo individual");

        var scoped = AnalyticsReflectionBuilder.LatestLive([inSession, other])
            .Where(attempt => attempt.LiveSessionId == sessionId)
            .ToList();
        var rows = AnalyticsReflectionBuilder.Build(
            item,
            scoped,
            new Dictionary<(Guid, Guid), string> { [(sessionId, studentId)] = "Ana" },
            [],
            new Dictionary<Guid, string> { [studentId] = "Ana Individual" });

        var row = Assert.Single(rows);
        Assert.Equal("ao vivo desta sessão", row.Text);
        Assert.Equal(AnalyticsReflectionBuilder.LiveSource, row.Source);
        Assert.DoesNotContain(rows, reflection => reflection.Text == individual.TextAnswer);
    }

    [Fact]
    public void IncludesIndividualWhenNoSessionFilterAndLabelsOrigin()
    {
        var studentId = Guid.NewGuid();
        var item = ChoiceItem();
        var older = Attempt(item.Id, studentId, null, "primeira", answeredAt: DateTimeOffset.UnixEpoch);
        var newer = Attempt(item.Id, studentId, null, "revisada", answeredAt: DateTimeOffset.UnixEpoch.AddHours(1), isCorrect: false);
        newer.SelectedOptionIds = [item.Options![0].Id, item.Options[1].Id];

        var rows = AnalyticsReflectionBuilder.Build(
            item,
            [],
            new Dictionary<(Guid, Guid), string>(),
            AnalyticsReflectionBuilder.LatestIndividual([older, newer]),
            new Dictionary<Guid, string> { [studentId] = "Bruno" });

        var row = Assert.Single(rows);
        Assert.Equal("Bruno", row.StudentName);
        Assert.Equal("Marte, Vênus", row.SelectedOptions);
        Assert.False(row.IsCorrect);
        Assert.Equal("revisada", row.Text);
        Assert.Equal(AnalyticsReflectionBuilder.IndividualSource, row.Source);
    }

    [Fact]
    public void QuestionsWithoutReflectionDoNotExposeTexts()
    {
        var item = ChoiceItem();
        item.RequireExplanation = false;
        var attempt = Attempt(item.Id, Guid.NewGuid(), Guid.NewGuid(), "não deve vazar");

        var rows = AnalyticsReflectionBuilder.Build(
            item,
            [attempt],
            new Dictionary<(Guid, Guid), string>(),
            [attempt],
            new Dictionary<Guid, string>());

        Assert.Empty(rows);
        Assert.False(AnalyticsReflectionBuilder.AcceptsReflection(item));
    }

    private static ActivityItem ChoiceItem()
    {
        var correct = new QuestionOption { Id = Guid.NewGuid(), Text = "Marte", IsCorrect = true, Position = 0 };
        var wrong = new QuestionOption { Id = Guid.NewGuid(), Text = "Vênus", IsCorrect = false, Position = 1 };
        return new ActivityItem
        {
            Id = Guid.NewGuid(),
            Kind = ItemKinds.MultipleChoice,
            RequireExplanation = true,
            Options = [correct, wrong]
        };
    }

    private static AnswerAttempt Attempt(
        Guid itemId,
        Guid studentId,
        Guid? liveSessionId,
        string? text,
        DateTimeOffset? answeredAt = null,
        bool? isCorrect = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            StudentId = studentId,
            LiveSessionId = liveSessionId,
            TextAnswer = text,
            IsCorrect = isCorrect,
            AnsweredAt = answeredAt ?? DateTimeOffset.UtcNow
        };
}
