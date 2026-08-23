using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;
using Astro.Api.Data;
using Astro.Api.Hubs;
using Astro.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 20_971_520;
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Astro API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT emitido pelo Astro após o login com Google (Bearer {token})",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddSingleton<PasswordHashingService>();
builder.Services.AddScoped<ClassCodeGenerator>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddScoped<StudyAccessService>();
builder.Services.AddScoped<StudySessionService>();
builder.Services.AddSignalR();

ConfigureMongo(builder);
ConfigureAuth(builder);

builder.Services.AddAuthorization();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<LiveSessionHub>("/hubs/live");
app.MapGet("/", () => Results.Ok(new { name = "Astro.Api", docs = "/swagger" }));

app.Run();

static void ConfigureAuth(WebApplicationBuilder builder)
{
    var googleClientId = builder.Configuration["Auth:Google:ClientId"] ?? "YOUR_GOOGLE_CLIENT_ID";
    var googleClientSecret = builder.Configuration["Auth:Google:ClientSecret"] ?? "YOUR_GOOGLE_CLIENT_SECRET";
    var jwtKey = builder.Configuration["Auth:Jwt:Key"]
        ?? throw new InvalidOperationException("Auth:Jwt:Key não configurada.");
    var jwtIssuer = builder.Configuration["Auth:Jwt:Issuer"] ?? "Astro.Api";
    var jwtAudience = builder.Configuration["Auth:Jwt:Audience"] ?? "Astro.Frontend";
    var frontendUrl = builder.Configuration["Auth:FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";

    builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        })
        .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
        {
            options.Cookie.Name = "astro.external";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(15);
            options.SlidingExpiration = false;
        })
        .AddGoogle(options =>
        {
            options.ClientId = googleClientId;
            options.ClientSecret = googleClientSecret;
            options.CallbackPath = "/signin-google";
            options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.SaveTokens = false;
            options.Scope.Add("profile");
            options.Scope.Add("email");
            options.ClaimActions.MapJsonKey("picture", "picture");
            options.Events.OnRemoteFailure = context =>
            {
                context.Response.Redirect($"{frontendUrl}/auth/callback?error=google");
                context.HandleResponse();
                return Task.CompletedTask;
            };
        })
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,
                ValidateAudience = true,
                ValidAudience = jwtAudience,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                NameClaimType = "sub",
                RoleClaimType = ClaimTypes.Role,
                ClockSkew = TimeSpan.FromMinutes(1)
            };

            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        context.Token = accessToken;
                    }

                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    if (context.Principal?.Identity is ClaimsIdentity identity)
                    {
                        var sub = identity.FindFirst("sub")?.Value;
                        if (!string.IsNullOrEmpty(sub) && identity.FindFirst(ClaimTypes.NameIdentifier) is null)
                        {
                            identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, sub));
                        }
                    }

                    return Task.CompletedTask;
                }
            };
        });
}

static void ConfigureMongo(WebApplicationBuilder builder)
{
    var mongoUri = builder.Configuration.GetConnectionString("MongoDb")
        ?? throw new InvalidOperationException("Connection string 'MongoDb' não configurada.");

    var conventions = new ConventionPack
    {
        new CamelCaseElementNameConvention(),
        new IgnoreExtraElementsConvention(true)
    };
    ConventionRegistry.Register("astro", conventions, _ => true);

    BsonSerializer.RegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));
    BsonSerializer.RegisterSerializer(new DateTimeOffsetSerializer(BsonType.DateTime));

    var mongoUrl = new MongoUrl(mongoUri);
    var clientSettings = MongoClientSettings.FromUrl(mongoUrl);
    clientSettings.ApplicationName = mongoUrl.ApplicationName ?? "Astro.Api";

    var mongoClient = new MongoClient(clientSettings);
    var databaseName = string.IsNullOrWhiteSpace(mongoUrl.DatabaseName) ? "astro" : mongoUrl.DatabaseName;

    builder.Services.AddSingleton<IMongoClient>(mongoClient);
    builder.Services.AddSingleton(mongoClient.GetDatabase(databaseName));
    builder.Services.AddSingleton<MongoDbContext>();
    builder.Services.AddHostedService<MongoIndexInitializer>();
}
