namespace Astro.Api.Services;

public static class LeitnerScheduler
{
    public const int MinBox = 1;
    public const int MaxBox = 5;

    public static (int BoxLevel, DateTimeOffset NextReviewAt) Next(
        int currentBox,
        bool remembered,
        DateTimeOffset now)
    {
        if (!remembered)
        {
            return (MinBox, now);
        }

        var box = Math.Min(MaxBox, Math.Max(MinBox, currentBox) + 1);
        return (box, now.Add(DelayFor(box)));
    }

    public static TimeSpan DelayFor(int box) => box switch
    {
        1 => TimeSpan.Zero,
        2 => TimeSpan.FromDays(1),
        3 => TimeSpan.FromDays(3),
        4 => TimeSpan.FromDays(7),
        _ => TimeSpan.FromDays(14)
    };
}
