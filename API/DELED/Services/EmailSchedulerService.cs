using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Threading;
using System.Threading.Tasks;
using DELED.Data;
using DELED.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace DELED.Services
{
    public class EmailSchedulerService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<EmailSchedulerService> _logger;

        public EmailSchedulerService(IServiceProvider serviceProvider, ILogger<EmailSchedulerService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Email Scheduler Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessSchedulesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while executing Email Scheduler Service.");
                }

                // Check every 1 minute
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task ProcessSchedulesAsync(CancellationToken stoppingToken)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
                var istNow = DELED.Helpers.TimeHelper.GetIST();
                var today = DateOnly.FromDateTime(istNow.Date);
                var nowTime = istNow.TimeOfDay;

                // Ensure default Daily Report schedule exists in database automatically
                var hasDailyReport = await context.EmailSchedules
                    .AnyAsync(s => s.ScheduleName == "Daily Report", stoppingToken);
                
                if (!hasDailyReport)
                {
                    var adminEmail = configuration["EmailSettings:AdminEmail"];
                    var ccEmail = configuration["EmailSettings:AdminCcEmails"] ;
                    var bccEmail = configuration["EmailSettings:AdminBccEmails"];
                    
                    var defaultSchedule = new EmailSchedule
                    {
                        ScheduleName = "Daily Report",
                        Subject = "DELED 2026 Daily Report",
                        ToEmails = adminEmail,
                        CcEmails = ccEmail,
                        BccEmails = bccEmail,
                        ScheduledTime = DELED.Helpers.TimeHelper.GetIST().TimeOfDay, // Temporarily send immediately on startup
                        IsActive = true,
                        MessageBody = "Daily registration and payment report",
                        LastSentDate = null
                    };
                    context.EmailSchedules.Add(defaultSchedule);
                    await context.SaveChangesAsync(stoppingToken);
                }

                // Fetch active schedules that haven't been sent today, and whose ScheduledTime has passed
                var schedules = await context.EmailSchedules
                    .Where(s => s.IsActive && 
                                (s.LastSentDate == null || s.LastSentDate < today) && 
                                s.ScheduledTime <= nowTime)
                    .ToListAsync(stoppingToken);

                foreach (var schedule in schedules)
                {
                    await SendDailyReportEmailAsync(context, configuration, schedule, today);
                }
            }
        }

        public static byte[] GenerateDailyReportPdf(
            DateTime generatedAt,
            List<DateWiseReportDto> dateWiseData,
            List<(string CityName, int Count)> cityRows)
        {
            // QuestPDF community licence — set once at startup, but safe to call here too.
            QuestPDF.Settings.License = LicenseType.Community;

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(30);
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                    // ── HEADER ──────────────────────────────────────────────────
                    page.Header().Row(row =>
                    {
                        string logoPath = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot", "Logo", "ubse_white.jpg");
                        if (System.IO.File.Exists(logoPath))
                        {
                            row.ConstantItem(80).Height(80).Image(logoPath);
                        }

                        row.RelativeItem().Column(col =>
                        {
                            col.Item().AlignCenter().Text("UTTARAKHAND BOARD OF SCHOOL EDUCATION")
                                .Bold().FontSize(13);

                            col.Item().AlignCenter().Text("UKDELED - 2026")
                                .Bold().FontSize(11);

                            col.Item().AlignCenter().Text("Registration Report")
                                .Bold().FontSize(11);

                            col.Item().AlignRight()
                                .Text($"Date & Time : {generatedAt:dd/MM/yyyy hh:mm:ss tt}")
                                .Bold().FontSize(9);
                        });
                    });

                    // ── BODY ─────────────────────────────────────────────────────
                    page.Content().PaddingTop(15).Column(col =>
                    {
                        // ── Section 1: Date Wise Form Submission Report ──────────
                        col.Item().AlignCenter().Text("Date Wise Form Submission Report")
                            .Bold().FontSize(11);

                        col.Item().PaddingTop(4).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(30);   // Sr.No.
                                c.RelativeColumn(3);    // Date
                                c.RelativeColumn(1);    // Reg No
                                c.RelativeColumn(1);    // Reg Cumm
                                c.RelativeColumn(1);    // Fees No
                                c.RelativeColumn(1);    // Fees Cumm
                            });

                            // Header
                            static IContainer HeaderCell(IContainer c) =>
                                c.Border(1).BorderColor("#000000").Padding(4).AlignCenter();

                            table.Header(h =>
                            {
                                h.Cell().RowSpan(2).Element(HeaderCell).AlignMiddle().Text("Sr.\nNo.").Bold();
                                h.Cell().RowSpan(2).Element(HeaderCell).AlignMiddle().Text("Date").Bold();
                                h.Cell().ColumnSpan(2).Element(HeaderCell).Text("Registration").Bold();
                                h.Cell().ColumnSpan(2).Element(HeaderCell).Text("Fees Paid").Bold();

                                h.Cell().Element(HeaderCell).Text("No.").Bold();
                                h.Cell().Element(HeaderCell).Text("Cumm.").Bold();
                                h.Cell().Element(HeaderCell).Text("No.").Bold();
                                h.Cell().Element(HeaderCell).Text("Cumm.").Bold();
                            });

                            static IContainer DataCell(IContainer c) =>
                                c.Border(1).BorderColor("#000000").Padding(4);

                            int sr = 1;
                            foreach (var row in dateWiseData)
                            {
                                table.Cell().Element(DataCell).AlignCenter().Text(sr++.ToString());
                                table.Cell().Element(DataCell).Text(row.Date.ToString("dd/MM/yyyy"));
                                table.Cell().Element(DataCell).AlignCenter().Text(row.RegNo.ToString());
                                table.Cell().Element(DataCell).AlignCenter().Text(row.RegCumm.ToString());
                                table.Cell().Element(DataCell).AlignCenter().Text(row.FeesNo.ToString());
                                table.Cell().Element(DataCell).AlignCenter().Text(row.FeesCumm.ToString());
                            }
                        });

                        // ── Section 2: Exam City Wise Report ─────────────────────
                        col.Item().PaddingTop(25).AlignCenter().Text("Exam City Wise Paid Application count Report")
                            .Bold().FontSize(11);

                        col.Item().PaddingTop(4).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(35);   // Sr.No.
                                c.RelativeColumn(3);    // Exam City Code/Name
                                c.RelativeColumn(1);    // DELED
                            });

                            static IContainer HeaderCell(IContainer c) =>
                                c.Border(1).BorderColor("#000000").Padding(4).AlignCenter();

                            table.Header(h =>
                            {
                                h.Cell().Element(HeaderCell).Text("Sr.\nNo.").Bold();
                                h.Cell().Element(HeaderCell).Text("Exam City Code/Name").Bold();
                                h.Cell().Element(HeaderCell).Text("DELED").Bold();
                            });

                            static IContainer DataCell(IContainer c) =>
                                c.Border(1).BorderColor("#000000").Padding(4);

                            int sr = 1;
                            int totalAll = 0;

                            foreach (var city in cityRows)
                            {
                                table.Cell().Element(DataCell).AlignCenter().Text(sr++.ToString());
                                table.Cell().Element(DataCell).Text(city.CityName);
                                table.Cell().Element(DataCell).AlignCenter().Text(city.Count.ToString());

                                totalAll += city.Count;
                            }

                            table.Cell().ColumnSpan(2).Element(DataCell).AlignRight().Text("Total").Bold();
                            table.Cell().Element(DataCell).AlignCenter().Text(totalAll.ToString()).Bold();
                        });
                    });

                    // ── FOOTER ────────────────────────────────────────────────────
                    page.Footer().AlignRight()
                        .Text(x =>
                        {
                            x.Span("Page ").FontSize(8);
                            x.CurrentPageNumber().FontSize(8);
                            x.Span(" of ").FontSize(8);
                            x.TotalPages().FontSize(8);
                        });
                });
            });

            return document.GeneratePdf();
        }

        public class DateWiseReportDto
        {
            public DateTime Date { get; set; }
            public int RegNo { get; set; }
            public int RegCumm { get; set; }
            public int FeesNo { get; set; }
            public int FeesCumm { get; set; }
        }


        // ─────────────────────────────────────────────────────────────────────────
        //  EMAIL SENDER  (PDF attached instead of inline HTML stats)
        // ─────────────────────────────────────────────────────────────────────────

        public static async Task<byte[]> GetDailyReportPdfBytesAsync(AppDbContext context)
        {
            var endOfPeriod = DELED.Helpers.TimeHelper.GetIST();

            var usersByDate = await context.Users
                .Where(u => u.IsOTPVerified)
                .GroupBy(u => u.CreatedOn.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var paymentsByDate = await context.Users
                .Where(u => u.IsPaymentCompleted && u.PaymentDate.HasValue)
                .GroupBy(u => u.PaymentDate.Value.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var allDates = usersByDate.Select(u => u.Date)
                .Union(paymentsByDate.Select(p => p.Date))
                .OrderBy(d => d)
                .ToList();

            var dateWiseData = new List<DateWiseReportDto>();
            int cummReg = 0;
            int cummFees = 0;
            foreach (var d in allDates)
            {
                int reg = usersByDate.FirstOrDefault(u => u.Date == d)?.Count ?? 0;
                int fees = paymentsByDate.FirstOrDefault(p => p.Date == d)?.Count ?? 0;
                cummReg += reg;
                cummFees += fees;
                dateWiseData.Add(new DateWiseReportDto
                {
                    Date = d,
                    RegNo = reg,
                    RegCumm = cummReg,
                    FeesNo = fees,
                    FeesCumm = cummFees
                });
            }

            // Exam city breakdown — fetching single DELED paid count per city
            var cityData = await (
                from pd in context.UserPersonalDetails
                join u in context.Users on pd.UserId equals u.UserId
                join ec in context.ExamCity on pd.ExamCity1 equals ec.CityId into ecJoin
                from ec in ecJoin.DefaultIfEmpty()
                where u.IsPaymentCompleted
                group new { ec.CityName, ec.CityCode } by new { ec.CityName, ec.CityCode } into g
                select new { CityName = g.Key.CityName, CityCode = g.Key.CityCode, Count = g.Count() }
            ).ToListAsync();

            var cityRows = cityData
                .OrderBy(n => n.CityCode ?? "999")
                .Select(city =>
                {
                    string cityNameDisplay = !string.IsNullOrEmpty(city.CityName)
                        ? (!string.IsNullOrEmpty(city.CityCode) ? $"{city.CityCode} - {city.CityName}" : city.CityName)
                        : "Not Specified";
                    return (CityName: cityNameDisplay, Count: city.Count);
                }).ToList();

            // ── Generate PDF ──────────────────────────────────────────────────
            return GenerateDailyReportPdf(
                generatedAt: DELED.Helpers.TimeHelper.GetIST(),
                dateWiseData: dateWiseData,
                cityRows: cityRows);
        }

        public static async Task SendDailyReportEmailAsync(
            AppDbContext context,
            IConfiguration configuration,
            EmailSchedule schedule,
            DateOnly today,
            ILogger logger = null)
        {
            var log = new EmailLog
            {
                ScheduleId = schedule.Id,
                SentOn = DELED.Helpers.TimeHelper.GetIST()
            };

            try
            {
                var endOfPeriod = DELED.Helpers.TimeHelper.GetIST();
                var pdfBytes = await GetDailyReportPdfBytesAsync(context);

                string reportFileName = $"DELED_Report_{DELED.Helpers.TimeHelper.GetIST():dd-MM-yyyy}.pdf";

                // ── Build email body (simple — stats are in the PDF attachment) ───
                string emailBody;
                var bodyIntro = !string.IsNullOrWhiteSpace(schedule.MessageBody)
                    ? schedule.MessageBody.Replace("\r\n", "<br/>").Replace("\n", "<br/>")
                    : "Please find attached the DELED 2026 daily application and payment report.";

                emailBody = $@"
                <html>
                <body>
                    <p style=""font-family: Arial, sans-serif; color: #333; line-height: 1.6;"">
                        {bodyIntro}<br/><br/>
                        Report Date: <strong>{endOfPeriod:dd MMMM yyyy, hh:mm tt}</strong><br/><br/>
                        The detailed statistics from the start of registration to today are available in the attached PDF report.<br/><br/>
                        Best regards,<br/>
                        Uttarakhand DELED 2026 Online Portal Team<br/>
                        Email: info@ukdeled.com | Phone: 8062987406
                    </p>
                </body>
                </html>";

                // ── Setup SMTP and send ───────────────────────────────────────────
                var host = configuration["EmailSettings:Host"];
                var port = int.Parse(configuration["EmailSettings:Port"]);
                var email = configuration["EmailSettings:Email"];
                var username = configuration["EmailSettings:Username"] ?? email;
                var password = configuration["EmailSettings:Password"];
                var displayName = configuration["EmailSettings:Displayname"] ?? "UKDELED-2026";

                System.Net.ServicePointManager.SecurityProtocol = System.Net.SecurityProtocolType.Tls12 | System.Net.SecurityProtocolType.Tls13;

                using var smtpClient = new SmtpClient(host)
                {
                    Port = port,
                    Credentials = new NetworkCredential(username, password),
                    EnableSsl = true
                };

                using var mailMessage = new MailMessage();
                mailMessage.From = new MailAddress(email, displayName);
                mailMessage.Subject = schedule.Subject;
                mailMessage.Body = emailBody;
                mailMessage.IsBodyHtml = true;

                // Attach the generated PDF
                var pdfStream = new MemoryStream(pdfBytes);
                mailMessage.Attachments.Add(
                    new Attachment(pdfStream, reportFileName, "application/pdf"));

                // Recipients
                if (!string.IsNullOrWhiteSpace(schedule.ToEmails))
                    foreach (var to in schedule.ToEmails.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                        mailMessage.To.Add(to.Trim());

                var ccSource = schedule.CcEmails;
                if (!string.IsNullOrWhiteSpace(ccSource))
                    foreach (var cc in ccSource.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                        mailMessage.CC.Add(cc.Trim());

                var bccSource = schedule.BccEmails;
                if (!string.IsNullOrWhiteSpace(bccSource))
                    foreach (var bcc in bccSource.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                        mailMessage.Bcc.Add(bcc.Trim());

                if (mailMessage.To.Count > 0 || mailMessage.CC.Count > 0 || mailMessage.Bcc.Count > 0)
                    smtpClient.Send(mailMessage);

                // ── Update schedule & log ─────────────────────────────────────────
                schedule.LastSentDate = today;
                context.EmailSchedules.Update(schedule);

                log.IsSuccess = true;
                log.ErrorMessage = "";

                var msg = $"Successfully sent daily email report for schedule: {schedule.ScheduleName}";
                if (logger != null) logger.LogInformation(msg); else Console.WriteLine(msg);
            }
            catch (Exception ex)
            {
                log.IsSuccess = false;
                log.ErrorMessage = ex.ToString();

                var msg = $"Failed to send daily email report for schedule: {schedule.ScheduleName}. Error: {ex}";
                if (logger != null) logger.LogError(ex, msg); else Console.WriteLine(msg);
            }

            context.EmailLogs.Add(log);
            await context.SaveChangesAsync();
        }

        /*        public static async Task SendDailyReportEmailAsync(AppDbContext context, IConfiguration configuration, EmailSchedule schedule, DateOnly today, ILogger logger = null)
                {
                    var log = new EmailLog
                    {
                        ScheduleId = schedule.Id,
                        SentOn = DELED.Helpers.TimeHelper.GetIST()
                    };

                    try
                    {
                        // Calculate counts for the last 24 hours (from execution time back to 24 hours ago)
                        var startOfPeriod = DELED.Helpers.TimeHelper.GetIST().AddDays(-1);
                        var endOfPeriod = DELED.Helpers.TimeHelper.GetIST();

                        // Total Registrations in last 24h
                        var regCountToday = await context.Users
                            .CountAsync(u => u.CreatedOn >= startOfPeriod && u.CreatedOn <= endOfPeriod);
                        // Total Registrations Overall
                        var regCountOverall = await context.Users.CountAsync();

                        // Total Payments Received in last 24h (Success payments only)
                        var paymentCountToday = await context.Users
                            .CountAsync(u => u.IsPaymentCompleted && u.PaymentDate.HasValue && u.PaymentDate.Value >= startOfPeriod && u.PaymentDate.Value <= endOfPeriod);

                        // Total Payments Received Overall
                        var paymentCountOverall = await context.Users
                            .CountAsync(u => u.IsPaymentCompleted);
                        var deled1CountToday = await (from pd in context.UserPersonalDetails
                                                     join et in context.ExamTypes on pd.ExamTypeId equals et.Id
                                                     where pd.CreatedOn >= startOfPeriod && pd.CreatedOn <= endOfPeriod &&
                                                           (et.Name == "DELEDI" || et.Name == "Both" || et.Name == "BOTH" || et.Name == "DELED-I" || et.Name == "DELED-I & DELED-II")
                                                     select pd).CountAsync();

                        // Applied for DELED 2 in last 24h (DELEDII or BOTH)
                        var deled2CountToday = await (from pd in context.UserPersonalDetails
                                                     join et in context.ExamTypes on pd.ExamTypeId equals et.Id
                                                     where pd.CreatedOn >= startOfPeriod && pd.CreatedOn <= endOfPeriod &&
                                                           (et.Name == "DELEDII" || et.Name == "Both" || et.Name == "BOTH" || et.Name == "DELED-II" || et.Name == "DELED-I & DELED-II")
                                                     select pd).CountAsync();

                        // Applied for DELED 1 Overall
                        var deled1CountOverall = await (from pd in context.UserPersonalDetails
                                                       join et in context.ExamTypes on pd.ExamTypeId equals et.Id
                                                       where et.Name == "DELEDI" || et.Name == "Both" || et.Name == "BOTH" || et.Name == "DELED-I" || et.Name == "DELED-I & DELED-II"
                                                       select pd).CountAsync();

                        // Applied for DELED 2 Overall
                        var deled2CountOverall = await (from pd in context.UserPersonalDetails
                                                       join et in context.ExamTypes on pd.ExamTypeId equals et.Id
                                                       where et.Name == "DELEDII" || et.Name == "Both" || et.Name == "BOTH" || et.Name == "DELED-II" || et.Name == "DELED-I & DELED-II"
                                                       select pd).CountAsync();

                        // Exam City wise candidates with completed payments (Last 24h)
                        var examCityWisePaymentToday = await (from u in context.Users
                                                               join pd in context.UserPersonalDetails on u.UserId equals pd.UserId
                                                               join ec1 in context.ExamCity on pd.ExamCity1 equals ec1.CityId into ec1Join
                                                               from ec1 in ec1Join.DefaultIfEmpty()
                                                               join p in context.Payments on u.UserId equals p.UserId into pJoin
                                                               from p in pJoin.DefaultIfEmpty()
                                                               where u.CreatedOn >= startOfPeriod && u.CreatedOn <= endOfPeriod && p.Status == "SUCCESS"
                                                               group ec1.CityName by ec1.CityName into g
                                                               select new { CityName = g.Key, Count = g.Count() })
                                                               .OrderByDescending(x => x.Count)
                                                               .ToListAsync();

                        // Exam City wise candidates with completed payments Overall
                        var examCityWisePaymentOverall = await (from u in context.Users
                                                                 join pd in context.UserPersonalDetails on u.UserId equals pd.UserId
                                                                 join ec1 in context.ExamCity on pd.ExamCity1 equals ec1.CityId into ec1Join
                                                                 from ec1 in ec1Join.DefaultIfEmpty()
                                                                 join p in context.Payments on u.UserId equals p.UserId into pJoin
                                                                 from p in pJoin.DefaultIfEmpty()
                                                                 where p.Status == "SUCCESS"
                                                                 group ec1.CityName by ec1.CityName into g
                                                                 select new { CityName = g.Key, Count = g.Count() })
                                                                 .OrderByDescending(x => x.Count)
                                                                 .ToListAsync();

                        // Build Exam City wise table HTML (Last 24h)
                        var examCityTableToday = "<h3 style='color: #0c5a30; margin-top: 20px;'>Exam City Wise Candidates (Payments Done) - Last 24 Hours</h3>";
                        if (examCityWisePaymentToday.Any())
                        {
                            examCityTableToday += @"
                            <table style='border-collapse: collapse; width: 100%; max-width: 500px; margin-top: 10px;'>
                                <thead>
                                    <tr style='background-color: #e8f5e9;'>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: left;'>Exam City</th>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: center; width: 100px;'>Candidates</th>
                                    </tr>
                                </thead>
                                <tbody>";

                            foreach (var city in examCityWisePaymentToday)
                            {
                                examCityTableToday += $@"
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>{city.CityName ?? "Not Specified"}</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;'>{city.Count}</td>
                                    </tr>";
                            }

                            examCityTableToday += @"
                                </tbody>
                            </table>";
                        }
                        else
                        {
                            examCityTableToday += "<p style='color: #666; font-style: italic;'>No payment data available for this period.</p>";
                        }

                        // Build Exam City wise table HTML Overall
                        var examCityTableOverall = "<h3 style='color: #0c5a30; margin-top: 20px;'>Exam City Wise Candidates (Payments Done) - Overall</h3>";
                        if (examCityWisePaymentOverall.Any())
                        {
                            examCityTableOverall += @"
                            <table style='border-collapse: collapse; width: 100%; max-width: 500px; margin-top: 10px;'>
                                <thead>
                                    <tr style='background-color: #e8f5e9;'>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: left;'>Exam City</th>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: center; width: 100px;'>Candidates</th>
                                    </tr>
                                </thead>
                                <tbody>";

                            foreach (var city in examCityWisePaymentOverall)
                            {
                                examCityTableOverall += $@"
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>{city.CityName ?? "Not Specified"}</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;'>{city.Count}</td>
                                    </tr>";
                            }

                            examCityTableOverall += @"
                                </tbody>
                            </table>";
                        }
                        else
                        {
                            examCityTableOverall += "<p style='color: #666; font-style: italic;'>No payment data available.</p>";
                        }

                        // Compile Email Body
                        var statsTableHtml = $@"
                            <h2 style='color: #0c5a30; border-bottom: 2px solid #0c5a30; padding-bottom: 8px;'>DELED 2026 Daily Application & Payment Report</h2>
                            <p>Dear Administrator,</p>
                            <p>Please find below the application and registration statistics collected for the last 24 hours and overall (from <strong>{startOfPeriod:dd MMMM yyyy, hh:mm tt}</strong> to <strong>{endOfPeriod:dd MMMM yyyy, hh:mm tt}</strong>):</p>

                            <h3 style='color: #0c5a30; margin-top: 20px;'>Last 24 Hours Statistics</h3>
                            <table style='border-collapse: collapse; width: 100%; max-width: 500px; margin-top: 10px;'>
                                <thead>
                                    <tr style='background-color: #f2f2f2;'>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: left;'>Metric Description</th>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: center; width: 100px;'>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>New Registrations</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; color: #1e3a8a;'>{regCountToday}</td>
                                    </tr>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Successful Payments Received</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; color: #0f766e;'>{paymentCountToday}</td>
                                    </tr>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Applied for DELED I (Primary)</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;'>{deled1CountToday}</td>
                                    </tr>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Applied for DELED II (Upper Primary)</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;'>{deled2CountToday}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <h3 style='color: #0c5a30; margin-top: 20px;'>Overall Statistics</h3>
                            <table style='border-collapse: collapse; width: 100%; max-width: 500px; margin-top: 10px;'>
                                <thead>
                                    <tr style='background-color: #f2f2f2;'>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: left;'>Metric Description</th>
                                        <th style='border: 1px solid #ddd; padding: 10px; text-align: center; width: 100px;'>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Total Registrations</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; color: #1e3a8a;'>{regCountOverall}</td>
                                    </tr>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Total Successful Payments</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; color: #0f766e;'>{paymentCountOverall}</td>
                                    </tr>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Total Applied for DELED I (Primary)</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;'>{deled1CountOverall}</td>
                                    </tr>
                                    <tr>
                                        <td style='border: 1px solid #ddd; padding: 10px;'>Total Applied for DELED II (Upper Primary)</td>
                                        <td style='border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold;'>{deled2CountOverall}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {examCityTableToday}

                            {examCityTableOverall}
                            <br/>
                            <p>Best regards,<br/>DELED Online Administration Portal</p>";

                        string emailBody;
                        if (!string.IsNullOrWhiteSpace(schedule.MessageBody))
                        {
                            emailBody = $@"
                                <html>
                                <body style='font-family: Arial, sans-serif; color: #333; line-height: 1.6;'>
                                    <div style='margin-bottom: 20px; font-weight: bold;'>
                                        {schedule.MessageBody.Replace("\r\n", "<br/>").Replace("\n", "<br/>")}
                                    </div>
                                    {statsTableHtml}
                                </body>
                                </html>";
                        }
                        else
                        {
                            emailBody = $@"
                                <html>
                                <body style='font-family: Arial, sans-serif; color: #333; line-height: 1.6;'>
                                    {statsTableHtml}
                                </body>
                                </html>";
                        }

                        // Setup SMTP Client
                        var host = configuration["EmailSettings:Host"];
                        var port = int.Parse(configuration["EmailSettings:Port"]);
                        var email = configuration["EmailSettings:Email"];
                        var username = configuration["EmailSettings:Username"] ?? email;
                        var password = configuration["EmailSettings:Password"];
                        var displayName = configuration["EmailSettings:Displayname"] ?? "UKDELED-2026";

                        System.Net.ServicePointManager.SecurityProtocol = System.Net.SecurityProtocolType.Tls12 | System.Net.SecurityProtocolType.Tls13;

                        using (var smtpClient = new SmtpClient(host))
                        {
                            smtpClient.Port = port;
                            smtpClient.Credentials = new NetworkCredential(username, password);
                            smtpClient.EnableSsl = true;

                            using (var mailMessage = new MailMessage())
                            {
                                mailMessage.From = new MailAddress(email, displayName);
                                mailMessage.Subject = schedule.Subject;
                                mailMessage.Body = emailBody;
                                mailMessage.IsBodyHtml = true;

                                // Add To Emails
                                if (!string.IsNullOrWhiteSpace(schedule.ToEmails))
                                {
                                    foreach (var to in schedule.ToEmails.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                                    {
                                        mailMessage.To.Add(to.Trim());
                                    }
                                }

                                // Add CC Emails (Read directly from DB schedule field)
                                var ccSource = schedule.CcEmails;
                                if (!string.IsNullOrWhiteSpace(ccSource))
                                {
                                    foreach (var cc in ccSource.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                                    {
                                        mailMessage.CC.Add(cc.Trim());
                                    }
                                }

                                // Add BCC Emails (Read directly from DB schedule field)
                                var bccSource = schedule.BccEmails;
                                if (!string.IsNullOrWhiteSpace(bccSource))
                                {
                                    foreach (var bcc in bccSource.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                                    {
                                        mailMessage.Bcc.Add(bcc.Trim());
                                    }
                                }

                                // Check if we have at least one recipient
                                if (mailMessage.To.Count > 0 || mailMessage.CC.Count > 0 || mailMessage.Bcc.Count > 0)
                                {
                                    smtpClient.Send(mailMessage);
                                }
                            }
                        }

                        // Update schedule sent status
                        schedule.LastSentDate = today;
                        context.EmailSchedules.Update(schedule);

                        log.IsSuccess = true;
                        log.ErrorMessage = "";
                        if (logger != null)
                        {
                            logger.LogInformation($"Successfully sent daily email report for schedule: {schedule.ScheduleName}");
                        }
                        else
                        {
                            Console.WriteLine($"Successfully sent daily email report for schedule: {schedule.ScheduleName}");
                        }
                    }
                    catch (Exception ex)
                    {
                        log.IsSuccess = false;
                        log.ErrorMessage = ex.ToString();
                        if (logger != null)
                        {
                            logger.LogError(ex, $"Failed to send daily email report for schedule: {schedule.ScheduleName}");
                        }
                        else
                        {
                            Console.WriteLine($"Failed to send daily email report for schedule: {schedule.ScheduleName}. Error: {ex}");
                        }
                    }

                    // Write logs and save DB changes
                    context.EmailLogs.Add(log);
                    await context.SaveChangesAsync();
                }
        */
    }
}
