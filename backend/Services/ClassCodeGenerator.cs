using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Astro.Api.Data;

namespace Astro.Api.Services;

public class ClassCodeGenerator(AppDbContext db)
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public async Task<string> GenerateUniqueAsync(CancellationToken cancellationToken = default)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var code = GenerateCode();
            var exists = await db.Classes.AnyAsync(c => c.Code == code, cancellationToken);
            if (!exists)
            {
                return code;
            }
        }

        throw new InvalidOperationException("Não foi possível gerar um código único de turma.");
    }

    private static string GenerateCode()
    {
        Span<char> buffer = stackalloc char[8];
        for (var i = 0; i < buffer.Length; i++)
        {
            buffer[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new string(buffer);
    }
}
