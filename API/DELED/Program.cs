
using DELED.Data;
using DELED.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using DELED.Services;
using DELED.Middleware;
using Microsoft.Extensions.FileProviders;
using System.Net.Http;

var builder = WebApplication.CreateBuilder(args);

// Configure Logging
builder.Logging.ClearProviders(); // Clear default providers
builder.Logging.AddConsole(); // Log to console
builder.Logging.AddDebug(); // Log to debug output (Visual Studio)
builder.Logging.AddEventSourceLogger(); // Log to Event Viewer


builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthorization();
builder.Services.AddSingleton<OtpService>();
builder.Services.AddScoped<ISecurityService, SecurityService>();
builder.Services.AddScoped<IEncryptionService, EncryptionService>();
builder.Services.AddScoped<IFileStorageService, FileStorageService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<DatabaseLoggerService>(); // Add database logger
builder.Services.AddHostedService<EmailSchedulerService>();
builder.Services.AddHostedService<PaymentRequerySchedulerService>();
builder.Services.AddHttpClient<IAtomPaymentService, AtomPaymentService>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policyBuilder =>
    {
        policyBuilder.AllowAnyOrigin()
                      .AllowAnyMethod()
                      .AllowAnyHeader();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(builder.Configuration.GetConnectionString("Database1"),
        new MySqlServerVersion(new Version(8, 0, 2)),
        mysqlOptions =>
        {
            mysqlOptions.CommandTimeout(180); // Set command timeout to 180 seconds (3 minutes)
        }), ServiceLifetime.Scoped, ServiceLifetime.Singleton);

// Add DbContextFactory for DatabaseLoggerService to use independent DB connections
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseMySql(builder.Configuration.GetConnectionString("Database1"),
        new MySqlServerVersion(new Version(8, 0, 2)),
        mysqlOptions =>
        {
            mysqlOptions.CommandTimeout(180);
        }));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Issuer"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var userIdClaim = context.Principal?.Identity?.Name
                ?? context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            var sessionIdClaim = context.Principal?.FindFirst("SessionId")?.Value;

            if (int.TryParse(userIdClaim, out int userId))
            {
                var userAuth = await dbContext.UserAuths.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
                if (userAuth != null && !string.IsNullOrEmpty(userAuth.SessionId) && !string.IsNullOrEmpty(sessionIdClaim))
                {
                    if (userAuth.SessionId != sessionIdClaim)
                    {
                        context.Fail("Your session has expired because your account was logged in from another device/browser.");
                    }
                }
            }
        }
    };
});


var app = builder.Build();



// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// -------------------- STATIC FILES --------------------
// Enables wwwroot (Swagger custom JS / CSS)
app.UseStaticFiles();

// Configure file storage static path from appsettings
var filePath = builder.Configuration["FilePath"];
bool staticFilesConfigured = false;
if (!string.IsNullOrWhiteSpace(filePath))
{
    try
    {
        if (!Directory.Exists(filePath))
        {
            Directory.CreateDirectory(filePath);
        }

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(filePath),
            RequestPath = ""
        });
        staticFilesConfigured = true;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Program] Failed to configure custom static files path '{filePath}', falling back to wwwroot: {ex.Message}");
    }
}

if (!staticFilesConfigured)
{
    try
    {
        var fallbackPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        if (!Directory.Exists(fallbackPath))
        {
            Directory.CreateDirectory(fallbackPath);
        }

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(fallbackPath),
            RequestPath = ""
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Program] Failed to configure fallback static files path: {ex.Message}");
    }
}

// app.UseHttpsRedirection();

app.UseCors();

app.UseMiddleware<EncryptionMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<RequestLoggingMiddleware>();

app.MapControllers();

app.Run();
