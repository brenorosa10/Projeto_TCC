using System.Collections.Concurrent;

namespace Astro.Api.Services;

public sealed class QuizGenerationRateLimiter
{
    public const int MaxRequests = 8;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    private readonly ConcurrentDictionary<Guid, Queue<DateTimeOffset>> _hits = new();

    public bool TryAcquire(Guid userId, DateTimeOffset now)
    {
        var queue = _hits.GetOrAdd(userId, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() >= Window)
            {
                queue.Dequeue();
            }

            if (queue.Count >= MaxRequests)
            {
                return false;
            }

            queue.Enqueue(now);
            return true;
        }
    }
}
