using System.ComponentModel.DataAnnotations;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using DELED.Data;
using DELED.Encryptions;
using DELED.Models;
using DELED.Models.NonDbModels;
using DELED.Services;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Net;
using System.Net.Mail;

namespace DELED.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserRegistrationsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly OtpService _otpService;
        private static readonly SemaphoreSlim _registrationLock = new SemaphoreSlim(1, 1);

        public UserRegistrationsController(AppDbContext context, IConfiguration configuration, OtpService otpService)
        {
            _context = context;
            _configuration = configuration;
            _otpService = otpService;
        }

        // Helper method to format phone number for SMS gateway (remove country code)
        private string FormatPhoneForSMS(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
                return phoneNumber;

            Console.WriteLine($"[DEBUG] Input phone number: '{phoneNumber}'");

            // Remove all non-digit characters first
            string formatted = new string(phoneNumber.Where(char.IsDigit).ToArray());
            Console.WriteLine($"[DEBUG] After digit extraction: '{formatted}' (Length: {formatted.Length})");

            // Remove country code 91 if present at the start
            // Valid formats: 91XXXXXXXXXX (12 digits) or XXXXXXXXXX (10 digits)
            if (formatted.Length == 12 && formatted.StartsWith("91"))
            {
                // Remove the 91 prefix
                formatted = formatted.Substring(2);
                Console.WriteLine($"[DEBUG] Removed 91 prefix: '{formatted}'");
            }
            else if (formatted.Length == 11 && formatted.StartsWith("0"))
            {
                // Remove leading 0 if present (some users add it)
                formatted = formatted.Substring(1);
                Console.WriteLine($"[DEBUG] Removed leading 0: '{formatted}'");
            }
            else
            {
                Console.WriteLine($"[DEBUG] No prefix to remove");
            }

            Console.WriteLine($"[DEBUG] Final phone for SMS: '{formatted}' (Length: {formatted.Length})");
            return formatted;
        }

        private SmsService CreateSmsService()
        {
            return new SmsService(
                GetSmsSetting("ApiUrl", "https://www.smsgateway.center/SMSApi/rest/send"),
                GetSmsSetting("ApiKey", "6042614833445292185"),
                GetSmsSetting("UserId", "diversified"),
                GetSmsSetting("SenderId", "REGNOW"),
                GetSmsSetting("Password", "23Dbspl74@")
            );
        }

        private string GetSmsSetting(string key, string defaultValue)
        {
            return _configuration[$"SmsSettings:{key}"] ?? defaultValue;
        }

        private string BuildSmsMessage(string templateSettingKey, string defaultTemplate, string otp, UserRegistration user, string generatedPassword = "")
        {
            var template = GetSmsSetting(templateSettingKey, defaultTemplate);

            return template
                .Replace("{otp}", otp)
                .Replace("{fullName}", user.FullName)
                .Replace("{email}", user.Email)
                .Replace("{password}", generatedPassword);
        }

        /// <summary>
        /// Generates a unique registration number for new users.
        /// Format: 26XXXXXX where 26 is the year (2026) and XXXXXX is a sequential number.
        /// </summary>
        private string GenerateRegistrationNumber()
        {
            string prefix = DELED.Helpers.TimeHelper.GetIST().Year.ToString().Substring(2) + "2"; // 262

            var lastUser = _context.Users
                .Where(u => u.RegistrationNo.StartsWith(prefix))
                .ToList()
                .Select(u =>
                {
                    string sequencePart = u.RegistrationNo.Substring(prefix.Length);
                    return int.TryParse(sequencePart, out int seq) ? seq : 0;
                })
                .DefaultIfEmpty(0)
                .Max();

            int nextSequence = lastUser + 1;

            return prefix + nextSequence.ToString("D5");
        }

        [HttpGet("count")]
        public async Task<IActionResult> GetRegistrationCount()
        {
            try
            {
                var TotalRegistration = await _context.Users.CountAsync();
                var paidCount = await _context.Users.CountAsync(u => u.IsPaymentCompleted);
                return Ok(new { success = true, TotalRegistration, paidCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetUserById(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new { success = false, message = "User not found." });
            }
            return Ok(new
            {
                userId = user.UserId,
                fullName = user.FullName,
                fatherName = user.FatherName,
                phoneNumber = user.PhoneNumber,
                email = user.Email
            });
        }

        [HttpGet("registration-number/{phoneNumber}")]
        public async Task<IActionResult> GetRegistrationNumberByPhone(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
            {
                return BadRequest(new { success = false, message = "Phone number is required." });
            }

            string cleanedPhone = FormatPhoneForSMS(phoneNumber);

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.PhoneNumber == cleanedPhone);

            if (user == null)
            {
                return NotFound(new { success = false, message = "No user found with the provided phone number." });
            }

            return Ok(new { success = true, registrationNo = user.RegistrationNo });
        }

        [HttpPost("SentEMAILOTP")]
        public async Task<ActionResult<string>> sendEMAILOtp(OTPEmailRequest otprequest)
        {
            var (emailotp, emailotpexpiryTime) = _otpService.GenerateOtp();

            string emailBody = $@"
                <div style=""text-align: center; background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); border: 2px solid black; min-width: 200px; max-width: 300px; width: 100%; margin: 50px auto;"">
                    <h2 style=""color: blue;"">Email Authentication OTP <hr /></h2>
                     <p>
                        <strong>OTP:</strong><br /> {emailotp}
                    </p>
                </div>";

            var result = new EmailService(_context, _configuration).SendEmail(otprequest.Email, "Your OTP For Registration in DBRANLU Recruitment Portal", emailBody);

            EmailOtps otps = new EmailOtps
            {
                EmailOTP = emailotp,
                Expires = emailotpexpiryTime
            };

            string otpsjson = JsonConvert.SerializeObject(otps);
            //string encryptedJson = _securityService.Encrypt(otpsjson);

            return Ok(otps);
        }

        [HttpPost("SentPhoneOTP")]
        public async Task<ActionResult<string>> sendPhoneOtp(OTPPhoneRequest otprequest)
        {
            var (phoneotp, emailotpexpiryTime) = _otpService.GenerateOtp();

            var smsService = new SmsService(
                "https://www.smsgateway.center/SMSApi/rest/send", // API URL
                "6042614833445292185",                            // API Key
                "diversified",
                "REGNOW", // Sender ID
                "23Dbspl74@"
            );

            string mobileNumber = otprequest.Phone;
            string message = $"{phoneotp} is OTP for DELED 2026 UBSE registration REGNOW";
            string templateId = "1207161207955867884";

            try
            {
                SmsGatewayResult response = smsService.SendSms(mobileNumber, message, templateId);
                Console.WriteLine("Response from SMS API: " + response.RawResponse);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error sending SMS: " + ex.Message);
            }

            PhoneOtps otps = new PhoneOtps();
            otps.PhoneOTP = phoneotp;
            otps.Expires = emailotpexpiryTime;

            string otpsjson = JsonConvert.SerializeObject(otps);

            //string encryptedJson = _securityService.Encrypt(otpsjson);
            return Ok(otps);
        }

        private bool IsRegistrationClosed()
        {
            var timeline = _context.RegistrationTimelines.FirstOrDefault(t => t.Key == "closes");
            if (timeline != null && DateTime.TryParse($"{timeline.DateValue} 23:59:59", out DateTime parsedDate))
            {
                return DELED.Helpers.TimeHelper.GetIST() >= parsedDate;
            }
            return false;
        }

        // API 1: Register User - Takes details and sends OTP to both Email and Mobile

        [HttpPost("Register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (IsRegistrationClosed())
            {
                return BadRequest(new { success = false, message = "Registration period has closed." });
            }

            try
            {


                // Validate request
                if (string.IsNullOrWhiteSpace(request.FullName) || 
                    string.IsNullOrWhiteSpace(request.FatherName) ||
                    string.IsNullOrWhiteSpace(request.Email) || 
                    string.IsNullOrWhiteSpace(request.PhoneNumber))
                {
                    return BadRequest(new { success = false, message = "All fields are required." });
                }

                if (request.FullName.Trim().Length > 50)
                {
                    return BadRequest(new { success = false, message = "Name cannot exceed 50 characters." });
                }

                if (request.FatherName.Trim().Length > 50)
                {
                    return BadRequest(new { success = false, message = "Father's Name cannot exceed 50 characters." });
                }

                // Clean phone number before checking
                string cleanedPhone = FormatPhoneForSMS(request.PhoneNumber);
                string normalizedEmail = request.Email.Trim().ToLower();

                // Remove any conflicting unverified registration records matching email or phone that do NOT match the current request.UserId
                var conflictingUnverifiedUsers = await _context.Users
                    .Where(u => !u.IsOTPVerified && 
                                (u.Email.ToLower() == normalizedEmail || u.PhoneNumber == cleanedPhone) &&
                                (!request.UserId.HasValue || u.UserId != request.UserId.Value))
                    .ToListAsync();

                if (conflictingUnverifiedUsers.Any())
                {
                    _context.Users.RemoveRange(conflictingUnverifiedUsers);
                    await _context.SaveChangesAsync();
                }

                // Check if verified email already exists
                var existingEmailUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.IsOTPVerified && u.Email.ToLower() == normalizedEmail);

                // Check if verified phone number already exists
                var existingPhoneUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.IsOTPVerified && u.PhoneNumber == cleanedPhone);

                if (existingEmailUser != null && existingPhoneUser != null)
                {
                    return BadRequest(new 
                    { 
                        success = false, 
                        message = "Mobile number and Email ID combination already exists." 
                    });
                }

                if (existingEmailUser != null)
                {
                    return BadRequest(new 
                    { 
                        success = false, 
                        message = "Email ID already exists." 
                    });
                }

                if (existingPhoneUser != null)
                {
                    return BadRequest(new 
                    { 
                        success = false, 
                        message = "Mobile number already exists." 
                    });
                }

                UserRegistration user = null;
                bool isNew = true;
                string emailOtp = string.Empty;
                string mobileOtp = string.Empty;
                DateTime expiry = DateTime.MinValue;

                // Generate distinct OTPs for Email and Mobile
                var (genEmailOtp, genExpiry) = _otpService.GenerateOtp();
                emailOtp = genEmailOtp;
                expiry = genExpiry;
                do
                {
                    var (genMobileOtp, _) = _otpService.GenerateOtp();
                    mobileOtp = genMobileOtp;
                } while (mobileOtp == emailOtp);

                string combinedOtp = $"{emailOtp}:{mobileOtp}";

                if (request.UserId.HasValue && request.UserId.Value > 0)
                {
                    user = await _context.Users.FindAsync(request.UserId.Value);
                    if (user != null)
                    {
                        if (user.IsOTPVerified)
                        {
                            return BadRequest(new { success = false, message = "This registration is already verified. Please log in." });
                        }

                        // Update existing user details
                        user.FullName = request.FullName;
                        user.FatherName = request.FatherName;
                        user.Email = normalizedEmail;
                        user.PhoneNumber = cleanedPhone;
                        user.EmailOTP = combinedOtp;
                        user.OTPExpiry = expiry;
                        user.Expiry = expiry;

                        _context.Users.Update(user);
                        isNew = false;
                    }
                }

                await _registrationLock.WaitAsync();
                try
                {
                    if (isNew)
                    {
                        // Generate unique registration number
                        string registrationNo = GenerateRegistrationNumber();

                        // Create user registration record (not verified yet)
                        user = new UserRegistration
                        {
                            RegistrationNo = registrationNo,
                            FullName = request.FullName,
                            FatherName = request.FatherName,
                            Email = normalizedEmail,  // Save normalized (lowercase, trimmed) email
                            PhoneNumber = cleanedPhone,  // Save cleaned 10-digit number
                            EmailOTP = combinedOtp,
                            OTPExpiry = expiry,
                            Expiry = expiry,
                            IsOTPVerified = false,
                            CreatedOn = DELED.Helpers.TimeHelper.GetIST()
                        };

                        _context.Users.Add(user);
                    }

                    await _context.SaveChangesAsync();
                }
                finally
                {
                    _registrationLock.Release();
                }

                // Send OTP via Email
                string emailBody = $@"
                    <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                        <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                            <tr>
                                <td style=""width: 90px; vertical-align: middle;"">
                                    <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                                </td>
                                <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                    <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">द्विवर्षीय डी०एल०एड० (D.El.Ed.) प्रशिक्षण प्रवेश परीक्षा 2026</h2>
                                </td>
                            </tr>
                        </table>

                        <div style=""text-align: center; margin-bottom: 20px;"">
                            <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">OTP Code</h3>
                        </div>

                        <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                            <p style=""margin: 0 0 15px 0;"">Dear <strong>{user.FullName}</strong>,</p>
                            <p style=""margin: 0 0 15px 0;"">Thank you for registering for DELED-2026 account.</p>
                            <p style=""margin: 0 0 15px 0;"">This one time registration process will give you continuous access to apply for DELED-2026 Examination Process.</p>
                            <p style=""margin: 20px 0; font-size: 15px;"">
                                One Time Password (OTP) for <strong>Email Verification</strong>: <strong style=""font-size: 22px; font-family: monospace; letter-spacing: 2px; color: #1e40af; margin-left: 5px;"">{emailOtp}</strong>
                            </p>
                            
                        </div>

                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 25px; font-weight: bold;"">
                            <p style=""margin: 0 0 10px 0;"">आवश्यक निर्देश : वेबसाइट <a href=""http://www.ukdeled.com"" style=""color: red; text-decoration: underline;"">www.ukdeled.com</a> पर लॉगिन कर समस्त आवेदन प्रविष्टियों को पूर्ण कर परीक्षा शुल्क का भुगतान आवेदन की अंतिम तिथि तक अवश्य करें| अदत्त (UNPAID) आवेदन को अंतिम तिथि के उपरांत अमान्य एवं निरस्त कर दिया जायेगा |</p>
                            <p style=""margin: 0;"">परीक्षा शुल्क का भुगतान करने के पश्चात सम्पूर्ण आवेदन को डाऊनलोड कर सुरक्षित रखें |</p>
                        </div>

                        <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                            <p style=""margin: 0 0 4px 0;"">Regards,</p>
                            <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                            <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                        </div>
                    </div>";

                string emailResult = "Not sent";
                SmsGatewayResult smsResult = SmsGatewayResult.NotSent("Not sent");

                try
                {
                    var emailService = new EmailService(_context, _configuration);
                    emailResult = emailService.SendEmail(user.Email, "DELED Registration Email OTP", emailBody);
                    
                    if (emailResult != "Email sent")
                    {
                        Console.WriteLine($"Email sending failed: {emailResult}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Email sending exception: {ex.Message}");
                    emailResult = $"Error: {ex.Message}";
                }

                // Send OTP via SMS
                try
                {
                    var smsService = CreateSmsService();

                    string phoneForSMS = FormatPhoneForSMS(user.PhoneNumber);
                    string smsMessage = BuildSmsMessage(
                        "OtpMessageTemplate",
                        "{otp} is OTP for DELED 2026 UBSE registration REGNOW",
                        mobileOtp,
                        user);
                    string templateId = GetSmsSetting("OtpTemplateId", "1207161207955867884");
                    string entityId = GetSmsSetting("EntityId", "");

                    Console.WriteLine($"[SMS] Sending to: '{phoneForSMS}' (Length: {phoneForSMS.Length})");
                    Console.WriteLine($"[SMS] Message: '{smsMessage}'");
                    
                    smsResult = smsService.SendSms(phoneForSMS, smsMessage, templateId, entityId);
                    Console.WriteLine($"[SMS] Accepted: {smsResult.IsAccepted}; Response: {smsResult.RawResponse}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SMS] ERROR: {ex.Message}");
                    smsResult = SmsGatewayResult.NotSent($"Error: {ex.Message}");
                }

                return Ok(new
                {
                    success = true,
                    message = "OTP sent to your email and mobile number.",
                    userId = user.UserId,
                    registrationNo = user.RegistrationNo,
                    otpExpiry = expiry,
                    emailStatus = emailResult,
                    smsAccepted = smsResult.IsAccepted,
                    smsStatus = smsResult
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        // API 2: Verify Email OTP
        [HttpPost("VerifyEmailOTP")]
        public async Task<IActionResult> VerifyEmailOTP([FromBody] VerifyOTPRequest request)
        {
            try
            {
                // Find user by userId
                var user = await _context.Users.FindAsync(request.UserId);

                if (user == null)
                {
                    return NotFound(new { success = false, message = "User not found." });
                }

                // Check if already verified
                if (user.IsOTPVerified)
                {
                    return BadRequest(new { success = false, message = "User already verified." });
                }

                // Check OTP expiry
                if (DELED.Helpers.TimeHelper.GetIST() > user.OTPExpiry)
                {
                    return BadRequest(new { success = false, message = "OTP has expired." });
                }

                // Extract separate Email and Mobile OTPs
                string expectedEmailOtp = user.EmailOTP ?? "";
                string expectedMobileOtp = user.EmailOTP ?? "";
                if (!string.IsNullOrEmpty(user.EmailOTP) && user.EmailOTP.Contains(":"))
                {
                    var parts = user.EmailOTP.Split(':');
                    expectedEmailOtp = parts[0].Trim();
                    expectedMobileOtp = parts[1].Trim();
                }

                string inputMobileOtp = (request.MobileOTP ?? request.OTP ?? "").Trim();
                string inputEmailOtp = (request.EmailOTP ?? "").Trim();

                if (!string.IsNullOrEmpty(request.EmailOTP) || !string.IsNullOrEmpty(request.MobileOTP))
                {
                    if (string.IsNullOrWhiteSpace(inputMobileOtp))
                    {
                        return BadRequest(new { success = false, message = "Mobile OTP is required." });
                    }
                    if (string.IsNullOrWhiteSpace(inputEmailOtp))
                    {
                        return BadRequest(new { success = false, message = "Email OTP is required." });
                    }
                    if (inputMobileOtp != expectedMobileOtp && inputEmailOtp != expectedEmailOtp)
                    {
                        return BadRequest(new { success = false, message = "Both Mobile OTP and Email OTP are invalid." });
                    }
                    if (inputMobileOtp != expectedMobileOtp)
                    {
                        return BadRequest(new { success = false, message = "Invalid Mobile OTP. Please enter the OTP received on your mobile." });
                    }
                    if (inputEmailOtp != expectedEmailOtp)
                    {
                        return BadRequest(new { success = false, message = "Invalid Email OTP. Please enter the OTP received on your email." });
                    }
                }
                else
                {
                    if (inputMobileOtp != expectedMobileOtp && inputMobileOtp != expectedEmailOtp)
                    {
                        return BadRequest(new { success = false, message = "Invalid OTP." });
                    }
                }

                // Mark as verified
                user.IsOTPVerified = true;
                await _context.SaveChangesAsync();

                // Generate password and send to user
                string generatedPassword = PasswordGenerate.GeneratePassword();
                string hashedPassword = Sha256Hasher.ComputeSHA256Hash(generatedPassword);

                // Create UserAuth entry
                string sessionId = Guid.NewGuid().ToString();
                var userAuth = new UserAuth
                {
                    UserId = user.UserId,
                    Password = hashedPassword,
                    ClearPass = generatedPassword,
                    SessionId = sessionId
                };

                _context.UserAuths.Add(userAuth);
                await _context.SaveChangesAsync();

                // Send credentials via Email
                string emailBody = $@"
                    <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                        <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                            <tr>
                                <td style=""width: 90px; vertical-align: middle;"">
                                    <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                                </td>
                                <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                    <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">द्विवर्षीय डी०एल०एड० (D.El.Ed.) प्रशिक्षण प्रवेश परीक्षा 2026</h2>
                                </td>
                            </tr>
                        </table>

                        <div style=""text-align: center; margin-bottom: 20px;"">
                            <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">Account Login Details</h3>
                        </div>

                        <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                            <p style=""margin: 0 0 15px 0;"">Dear <strong>{user.FullName}</strong>,</p>
                            <p style=""margin: 0 0 15px 0;"">Your login details for applying to DELED 2026 are given below:</p>
                            <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                                <p style=""margin: 0 0 5px 0;""><strong>Registration No. :</strong> <strong style=""font-size: 16px; color: #000;"">{user.RegistrationNo}</strong></p>
                                <p style=""margin: 0 0 5px 0;""><strong>Password :</strong> <strong style=""font-size: 16px; color: #000;"">{generatedPassword}</strong></p>
                                <p style=""margin: 0;""><strong>Mobile No. :</strong> <strong style=""font-size: 16px; color: #000;"">{user.PhoneNumber}</strong></p>
                            </div>
                        </div>

                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 25px; font-weight: bold;"">
                            <p style=""margin: 0 0 10px 0;"">आवश्यक निर्देश : वेबसाइट <a href=""http://www.ukdeled.com"" style=""color: red; text-decoration: underline;"">www.ukdeled.com</a> पर लॉगिन कर समस्त आवेदन प्रविष्टियों को पूर्ण कर परीक्षा शुल्क का भुगतान आवेदन की अंतिम तिथि तक अवश्य करें| अदत्त (UNPAID) आवेदन को अंतिम तिथि के उपरांत अमान्य एवं निरस्त कर दिया जायेगा |</p>
                            <p style=""margin: 0;"">परीक्षा शुल्क का भुगतान करने के पश्चात सम्पूर्ण आवेदन को डाऊनलोड कर सुरक्षित रखें |</p>
                        </div>

                        <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                            <p style=""margin: 0 0 4px 0;"">Regards,</p>
                            <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                            <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                        </div>
                    </div>";

                try
                {
                    new EmailService(_context, _configuration).SendEmail(user.Email, "DELED Registration Successful", emailBody);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Email sending failed: {ex.Message}");
                }

                // Send credentials via SMS
                try
                {
                    var smsService = CreateSmsService();

                    string smsMessage = BuildSmsMessage(
                        "CredentialsMessageTemplate",
                        "DELED Registration Successful! Your Email: {email}, Password: {password}",
                        user.EmailOTP,
                        user,
                        generatedPassword);
                    string templateId = GetSmsSetting("CredentialsTemplateId", GetSmsSetting("OtpTemplateId", "1207161207955867884"));
                    string entityId = GetSmsSetting("EntityId", "");

                    string phoneForSMS = FormatPhoneForSMS(user.PhoneNumber);
                    var smsResult = smsService.SendSms(phoneForSMS, smsMessage, templateId, entityId);
                    Console.WriteLine($"[SMS] Credentials accepted: {smsResult.IsAccepted}; Response: {smsResult.RawResponse}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"SMS sending failed: {ex.Message}");
                }

                // Generate JWT token
                var securitykey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
                var credentials = new SigningCredentials(securitykey, SecurityAlgorithms.HmacSha256);

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, user.UserId.ToString()),
                    new Claim("SessionId", sessionId)
                };

                var token = new JwtSecurityToken(
                    issuer: _configuration["Jwt:Issuer"],
                    audience: _configuration["Jwt:Issuer"],
                    claims: claims,
                    expires: DELED.Helpers.TimeHelper.GetIST().AddMinutes(120),
                    signingCredentials: credentials
                );

                string tokenString = new JwtSecurityTokenHandler().WriteToken(token);

                return Ok(new
                {
                    success = true,
                    message = "Email OTP verified successfully. Password sent to your email and mobile.",
                    token = tokenString,
                    userId = user.UserId,
                    email = user.Email
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        // API 3: Verify Mobile OTP
        [HttpPost("VerifyMobileOTP")]
        public async Task<IActionResult> VerifyMobileOTP([FromBody] VerifyOTPRequest request)
        {
            if (IsRegistrationClosed())
            {
                return BadRequest(new { success = false, message = "Registration period has closed." });
            }

            try
            {
                // Find user by userId
                var user = await _context.Users.FindAsync(request.UserId);

                if (user == null)
                {
                    return NotFound(new { success = false, message = "User not found." });
                }

                // Check if already verified
                if (user.IsOTPVerified)
                {
                    return BadRequest(new { success = false, message = "User already verified." });
                }

                // Check OTP expiry
                if (DELED.Helpers.TimeHelper.GetIST() > user.OTPExpiry)
                {
                    return BadRequest(new { success = false, message = "OTP has expired." });
                }

                // Extract separate Email and Mobile OTPs
                string expectedEmailOtp = user.EmailOTP ?? "";
                string expectedMobileOtp = user.EmailOTP ?? "";
                if (!string.IsNullOrEmpty(user.EmailOTP) && user.EmailOTP.Contains(":"))
                {
                    var parts = user.EmailOTP.Split(':');
                    expectedEmailOtp = parts[0].Trim();
                    expectedMobileOtp = parts[1].Trim();
                }

                string inputMobileOtp = (request.MobileOTP ?? request.OTP ?? "").Trim();
                string inputEmailOtp = (request.EmailOTP ?? "").Trim();

                if (!string.IsNullOrEmpty(request.EmailOTP) || !string.IsNullOrEmpty(request.MobileOTP))
                {
                    if (string.IsNullOrWhiteSpace(inputMobileOtp))
                    {
                        return BadRequest(new { success = false, message = "Mobile OTP is required." });
                    }
                    if (string.IsNullOrWhiteSpace(inputEmailOtp))
                    {
                        return BadRequest(new { success = false, message = "Email OTP is required." });
                    }
                    if (inputMobileOtp != expectedMobileOtp && inputEmailOtp != expectedEmailOtp)
                    {
                        return BadRequest(new { success = false, message = "Both Mobile OTP and Email OTP are invalid." });
                    }
                    if (inputMobileOtp != expectedMobileOtp)
                    {
                        return BadRequest(new { success = false, message = "Invalid Mobile OTP. Please enter the OTP received on your mobile." });
                    }
                    if (inputEmailOtp != expectedEmailOtp)
                    {
                        return BadRequest(new { success = false, message = "Invalid Email OTP. Please enter the OTP received on your email." });
                    }
                }
                else
                {
                    if (inputMobileOtp != expectedMobileOtp && inputMobileOtp != expectedEmailOtp)
                    {
                        return BadRequest(new { success = false, message = "Invalid OTP." });
                    }
                }

                // Mark as verified
                user.IsOTPVerified = true;
                await _context.SaveChangesAsync();

                // Generate password and send to user
                string generatedPassword = PasswordGenerate.GeneratePassword();
                string hashedPassword = Sha256Hasher.ComputeSHA256Hash(generatedPassword);

                // Create UserAuth entry
                string mobileSessionId = Guid.NewGuid().ToString();
                var userAuth = new UserAuth
                {
                    UserId = user.UserId,
                    Password = hashedPassword,
                    ClearPass = generatedPassword,
                    SessionId = mobileSessionId
                };

                _context.UserAuths.Add(userAuth);
                await _context.SaveChangesAsync();

                // Send credentials via Email
                string emailBody = $@"
                    <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                        <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                            <tr>
                                <td style=""width: 90px; vertical-align: middle;"">
                                    <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                                </td>
                                <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                    <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">द्विवर्षीय डी०एल०एड० (D.El.Ed.) प्रशिक्षण प्रवेश परीक्षा 2026</h2>
                                </td>
                            </tr>
                        </table>

                        <div style=""text-align: center; margin-bottom: 20px;"">
                            <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">Account Login Details</h3>
                        </div>

                        <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                            <p style=""margin: 0 0 15px 0;"">Dear <strong>{user.FullName}</strong>,</p>
                            <p style=""margin: 0 0 15px 0;"">Your login details for applying to DELED 2026 are given below:</p>
                            <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                                <p style=""margin: 0 0 5px 0;""><strong>Registration No. :</strong> <strong style=""font-size: 16px; color: #000;"">{user.RegistrationNo}</strong></p>
                                <p style=""margin: 0 0 5px 0;""><strong>Password :</strong> <strong style=""font-size: 16px; color: #000;"">{generatedPassword}</strong></p>
                                <p style=""margin: 0;""><strong>Mobile No. :</strong> <strong style=""font-size: 16px; color: #000;"">{user.PhoneNumber}</strong></p>
                            </div>
                        </div>

                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 25px; font-weight: bold;"">
                            <p style=""margin: 0 0 10px 0;"">आवश्यक निर्देश : वेबसाइट <a href=""http://www.ukdeled.com"" style=""color: red; text-decoration: underline;"">www.ukdeled.com</a> पर लॉगिन कर समस्त आवेदन प्रविष्टियों को पूर्ण कर परीक्षा शुल्क का भुगतान आवेदन की अंतिम तिथि तक अवश्य करें| अदत्त (UNPAID) आवेदन को अंतिम तिथि के उपरांत अमान्य एवं निरस्त कर दिया जायेगा |</p>
                            <p style=""margin: 0;"">परीक्षा शुल्क का भुगतान करने के पश्चात सम्पूर्ण आवेदन को डाऊनलोड कर सुरक्षित रखें |</p>
                        </div>

                        <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                            <p style=""margin: 0 0 4px 0;"">Regards,</p>
                            <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                            <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                        </div>
                    </div>";

                try
                {
                    new EmailService(_context, _configuration).SendEmail(user.Email, "DELED Registration Successful", emailBody);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Email sending failed: {ex.Message}");
                }

                // Send credentials via SMS
                try
                {
                    var smsService = CreateSmsService();

                    string smsMessage = BuildSmsMessage(
                        "CredentialsMessageTemplate",
                        "DELED Registration Successful! Your Email: {email}, Password: {password}",
                        user.EmailOTP,
                        user,
                        generatedPassword);
                    string templateId = GetSmsSetting("CredentialsTemplateId", GetSmsSetting("OtpTemplateId", "1207161207955867884"));
                    string entityId = GetSmsSetting("EntityId", "");

                    string phoneForSMS = FormatPhoneForSMS(user.PhoneNumber);
                    var smsResult = smsService.SendSms(phoneForSMS, smsMessage, templateId, entityId);
                    Console.WriteLine($"[SMS] Credentials accepted: {smsResult.IsAccepted}; Response: {smsResult.RawResponse}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"SMS sending failed: {ex.Message}");
                }

                // Generate JWT token
                var securitykey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
                var credentials = new SigningCredentials(securitykey, SecurityAlgorithms.HmacSha256);

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, user.UserId.ToString()),
                    new Claim("SessionId", mobileSessionId)
                };

                var token = new JwtSecurityToken(
                    issuer: _configuration["Jwt:Issuer"],
                    audience: _configuration["Jwt:Issuer"],
                    claims: claims,
                    expires: DELED.Helpers.TimeHelper.GetIST().AddMinutes(120),
                    signingCredentials: credentials
                );

                string tokenString = new JwtSecurityTokenHandler().WriteToken(token);

                return Ok(new
                {
                    success = true,
                    message = "Mobile OTP verified successfully. Password sent to your email and mobile.",
                    token = tokenString,
                    userId = user.UserId,
                    email = user.Email
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpPost("ResendOTP")]
        public async Task<IActionResult> ResendOTP([FromBody] ResendOTPRequest request)
        {
            if (IsRegistrationClosed())
            {
                return BadRequest(new { success = false, message = "Registration period has closed." });
            }

            try
            {
                var user = await _context.Users.FindAsync(request.UserId);
                if (user == null)
                {
                    return NotFound(new { success = false, message = "User not found." });
                }

                if (user.IsOTPVerified)
                {
                    return BadRequest(new { success = false, message = "User already verified." });
                }

                // Generate new distinct OTPs for Email and Mobile
                var (emailOtp, expiry) = _otpService.GenerateOtp();
                var (mobileOtp, _) = _otpService.GenerateOtp();
                string combinedOtp = $"{emailOtp}:{mobileOtp}";

                user.EmailOTP = combinedOtp;
                user.OTPExpiry = expiry;
                user.Expiry = expiry;

                _context.Users.Update(user);
                await _context.SaveChangesAsync();

                // Send OTP via Email
                string emailResult = "";
                try
                {
                    string emailBody = $@"
                    <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                        <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                            <tr>
                                <td style=""width: 90px; vertical-align: middle;"">
                                    <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                                </td>
                                <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                    <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड DELED 2026</h2>
                                </td>
                            </tr>
                        </table>

                        <div style=""text-align: center; margin-bottom: 20px;"">
                            <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">OTP Code (Resend)</h3>
                        </div>

                        <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                            <p style=""margin: 0 0 15px 0;"">Dear <strong>{user.FullName}</strong>,</p>
                            <p style=""margin: 0 0 15px 0;"">You requested to resend the verification code for your DELED-2026 account.</p>
                            <p style=""margin: 20px 0; font-size: 15px;"">
                                One Time Password (OTP) for <strong>Email Verification</strong>: <strong style=""font-size: 20px; font-family: monospace; letter-spacing: 1px; color: #1e40af; margin-left: 5px;"">{emailOtp}</strong>
                            </p>
                            
                        </div>

                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 25px; font-weight: bold;"">
                            <p style=""margin: 0 0 10px 0;"">आवश्यक निर्देश : वेबसाइट <a href=""http://www.ukdeled.com"" style=""color: red; text-decoration: underline;"">www.ukdeled.com</a> पर लॉगिन कर समस्त आवेदन प्रविष्टियों को पूर्ण कर परीक्षा शुल्क का भुगतान आवेदन की अंतिम तिथि तक अवश्य करें| अदत्त (UNPAID) आवेदन को अंतिम तिथि के उपरांत अमान्य एवं निरस्त कर दिया जायेगा |</p>
                            <p style=""margin: 0;"">परीक्षा शुल्क का भुगतान करने के पश्चात सम्पूर्ण आवेदन को डाऊनलोड कर सुरक्षित रखें |</p>
                        </div>

                        <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                            <p style=""margin: 0 0 4px 0;"">Regards,</p>
                            <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                            <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                        </div>
                    </div>";

                    var emailService = new EmailService(_context, _configuration);
                    emailResult = emailService.SendEmail(user.Email, "DELED Registration OTP", emailBody);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Email sending failed: {ex.Message}");
                }

                // Send OTP via SMS
                try
                {
                    var smsService = CreateSmsService();
                    string smsMessage = BuildSmsMessage(
                        "OtpMessageTemplate",
                        "{otp} is OTP for DELED 2026 UBSE registration REGNOW",
                        mobileOtp,
                        user);
                    string templateId = GetSmsSetting("OtpTemplateId", "1207161207955867884");
                    string entityId = GetSmsSetting("EntityId", "");

                    string phoneForSMS = FormatPhoneForSMS(user.PhoneNumber);
                    var smsResult = smsService.SendSms(phoneForSMS, smsMessage, templateId, entityId);
                    Console.WriteLine($"[SMS] OTP accepted: {smsResult.IsAccepted}; Response: {smsResult.RawResponse}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"SMS sending failed: {ex.Message}");
                }

                return Ok(new
                {
                    success = true,
                    message = "OTP resent successfully to your email and mobile number.",
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [Authorize]
        [HttpPost("ChangePassword")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            try
            {
                int userId = GetUserIdFromToken();
                var userAuth = await _context.UserAuths.FirstOrDefaultAsync(u => u.UserId == userId);
                if (userAuth == null)
                {
                    return NotFound(new { success = false, message = "User authentication entry not found." });
                }

                string hashedOld = Sha256Hasher.ComputeSHA256Hash(request.OldPassword);
                if (hashedOld != userAuth.Password)
                {
                    return BadRequest(new { success = false, message = "Incorrect current password." });
                }

                userAuth.Password = Sha256Hasher.ComputeSHA256Hash(request.NewPassword);
                userAuth.ClearPass = request.NewPassword;
                await _context.SaveChangesAsync();
                return Ok(new { success = true, message = "Password updated successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        private int GetUserIdFromToken()
        {
            var nameClaim = User.Identity?.Name;
            if (string.IsNullOrEmpty(nameClaim) || !int.TryParse(nameClaim, out int userId))
            {
                throw new System.UnauthorizedAccessException("Invalid user identity in token.");
            }
            return userId;
        }



        [HttpGet("DebugUsers")]
        public async Task<IActionResult> DebugUsers()
        {
            var users = await _context.Users.Select(u => new { u.UserId, u.Email, u.PhoneNumber, u.FullName, u.IsOTPVerified }).ToListAsync();
            return Ok(users);
        }

        [HttpPost("ForgetPassword/Email")]
        public async Task<IActionResult> ForgetPasswordEmail([FromBody] ForgotPasswordRequest request)
        {
            try
            {


                if (string.IsNullOrWhiteSpace(request.Email))
                {
                    return BadRequest("Ensure the email is registered.");
                }

                if (string.IsNullOrWhiteSpace(request.PhoneNumber))
                {
                    return BadRequest("Ensure the phone number is registered.");
                }

                // Clean and format phone number
                string cleanedPhone = FormatPhoneForSMS(request.PhoneNumber);
                string normalizedEmail = request.Email.Trim().ToLower();

                // Find user by email AND phone number combination
                var user = await _context.Users.FirstOrDefaultAsync(u => 
                    u.Email.ToLower() == normalizedEmail && 
                    u.PhoneNumber == cleanedPhone);

                if (user == null)
                {
                    return BadRequest("Ensure the email and phone number combination is registered.");
                }

                // Generate new password
                string generatedPassword = PasswordGenerate.GeneratePassword();
                string hashedPassword = Sha256Hasher.ComputeSHA256Hash(generatedPassword);

                // Update UserAuth table
                var userAuth = await _context.UserAuths.FirstOrDefaultAsync(ua => ua.UserId == user.UserId);
                if (userAuth == null)
                {
                    userAuth = new UserAuth
                    {
                        UserId = user.UserId,
                        Password = hashedPassword,
                        ClearPass = generatedPassword
                    };
                    _context.UserAuths.Add(userAuth);
                }
                else
                {
                    userAuth.Password = hashedPassword;
                    userAuth.ClearPass = generatedPassword;
                }

                await _context.SaveChangesAsync();

                // Send email
                string emailBody = $@"
                    <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                        <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                            <tr>
                                <td style=""width: 90px; vertical-align: middle;"">
                                    <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                                </td>
                                <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                    <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                    <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">द्विवर्षीय डी०एल०एड० (D.El.Ed.) प्रशिक्षण प्रवेश परीक्षा 2026</h2>
                                </td>
                            </tr>
                        </table>

                        <div style=""text-align: center; margin-bottom: 20px;"">
                            <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">Forgot Password</h3>
                        </div>

                        <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                            <p style=""margin: 0 0 15px 0;"">Dear <strong>{user.FullName}</strong>,</p>
                            <p style=""margin: 0 0 15px 0;"">Your login details for applying to DELED 2026 are given below:</p>
                            <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                                <p style=""margin: 0 0 5px 0;""><strong>Registration No. :</strong> <strong style=""font-size: 16px; color: #000;"">{user.RegistrationNo}</strong></p>
                                <p style=""margin: 0 0 5px 0;""><strong>Password :</strong> <strong style=""font-size: 16px; color: #000;"">{generatedPassword}</strong></p>
                                <p style=""margin: 0;""><strong>Mobile No. :</strong> <strong style=""font-size: 16px; color: #000;"">{user.PhoneNumber}</strong></p>
                            </div>
                        </div>

                        <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 20px;"">
                            <p style=""margin: 0 0 4px 0;"">Regards,</p>
                            <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                            <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                        </div>
                    </div>";

                string emailResult = "Not sent";
                try
                {
                    var emailService = new EmailService(_context, _configuration);
                    emailResult = emailService.SendEmail(user.Email, "DELED Forgot Password Recovery", emailBody);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Forgot Password Email failed: {ex.Message}");
                }

                if (emailResult == "Email sent")
                {
                    return Ok(new { success = true, message = "Your new password has been sent to your registered Email ID." });
                }
                else
                {
                    return StatusCode(500, $"Email sending failed: {emailResult}");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        private string ValidateIdentityProof(string identityProof, string identityProofNo)
        {
            if (string.IsNullOrWhiteSpace(identityProof) || identityProof == "Select")
                return null;

            if (string.IsNullOrWhiteSpace(identityProofNo))
                return "Identity Proof Number is required.";

            string cleanNo = identityProofNo.Trim();

            if (identityProof == "Aadhar Card")
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(cleanNo, @"^\d{12}$"))
                {
                    return "Aadhar Card Number must be exactly 12 digits.";
                }
            }
            else if (identityProof == "Pan Card")
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(cleanNo, @"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                {
                    return "Invalid PAN Card Number format (e.g. ABCDE1234F).";
                }
            }
            else if (identityProof == "Voter ID")
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(cleanNo, @"^[A-Za-z0-9]+$"))
                {
                    return "Voter ID must contain only alphanumeric characters.";
                }
            }
            else if (identityProof == "Passport")
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(cleanNo, @"^[A-Za-z][0-9]{7}$"))
                {
                    return "Invalid Passport Number format (e.g. A1234567).";
                }
            }
            else if (identityProof == "Driving License")
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(cleanNo, @"^[A-Za-z0-9]+$"))
                {
                    return "Driving License must contain only alphanumeric characters.";
                }
            }

            return null; // Valid
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin/applicant-complete/{registrationNo}")]
        public async Task<IActionResult> GetCompleteApplicantByRegNo(string registrationNo)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(registrationNo))
                {
                    return BadRequest(new { success = false, message = "Registration number is required." });
                }

                var cleanRegNo = registrationNo.Trim().ToLower();
                var user = await _context.Users.FirstOrDefaultAsync(u => u.RegistrationNo.ToLower() == cleanRegNo);
                if (user == null)
                {
                    return NotFound(new { success = false, message = "Candidate registration number not found." });
                }

                var latestPayment = await _context.PaymentTransactions
                    .Where(p => p.UserId == user.UserId && p.Status=="SUCCESS")
                    .OrderByDescending(p => p.UpdatedOn)
                    .FirstOrDefaultAsync();

                var completeDetails = await (from usr in _context.Users
                                             
                                             join personal in _context.UserPersonalDetails
                                             on usr.UserId equals personal.UserId into userPersonal
                                             from personal in userPersonal.DefaultIfEmpty()
                                             
                                             join exam in _context.ExamTypes
                                             on (personal != null ? personal.ExamTypeId : 0) equals exam.Id into examGroup
                                             from exam in examGroup.DefaultIfEmpty()
                                             
                                             join city1 in _context.ExamCity
                                             on (personal != null ? personal.ExamCity1 : 0) equals city1.CityId into city1Group
                                             from city1 in city1Group.DefaultIfEmpty()
                                             
                                             join city2 in _context.ExamCity
                                             on (personal != null ? personal.ExamCity2 : 0) equals city2.CityId into city2Group
                                             from city2 in city2Group.DefaultIfEmpty()
                                             
                                             join state in _context.State
                                             on (personal != null ? personal.StateId : 0) equals state.Id into stateGroup
                                             from state in stateGroup.DefaultIfEmpty()
                                             
                                             join dist in _context.City
                                             on (personal != null ? personal.District : 0) equals dist.Id into distGroup
                                             from dist in distGroup.DefaultIfEmpty()
                                             
                                             where usr.UserId == user.UserId
                                             select new UserCompleteDetailsDTO
                                              {
                                                  UserId = usr.UserId,
                                                  FullName = usr.FullName,
                                                  FatherName = usr.FatherName,
                                                  PhoneNumber = usr.PhoneNumber,
                                                  Email = usr.Email,
                                                  CreatedOn = usr.CreatedOn,
                                                  IsOTPVerified = usr.IsOTPVerified,
                                                  RegistrationNo = usr.RegistrationNo,
                                                  IsPaymentCompleted = false,
                                                  PaymentDate = null,

                                                  PersonalDetailId = personal != null ? (int?)personal.PersonalDetailId : null,
                                                  ExamTypeId = personal != null ? (int?)personal.ExamTypeId : null,
                                                  ApplicationFor = exam != null ? exam.Name : "",
                                                  AppliedCategory = personal != null ? personal.AppliedCategory : null,
                                                  GraduationCourse = personal != null ? personal.GraduationCourse : null,
                                                  GraduationUniversity = personal != null ? personal.GraduationUniversity : null,
                                                  GraduationDate = personal != null ? personal.GraduationDate : null,
                                                  ApplicantName = usr.FullName,
                                                  Gender = personal != null ? personal.Gender : "",
                                                  DOB = personal != null ? personal.DOB : null,
                                                  MotherName = personal != null ? personal.MotherName : "",
                                                  HusbandName = personal != null ? personal.HusbandName : null,
                                                  Category = personal != null ? personal.Category : "",
                                                  SubCategory = personal != null ? personal.SubCategory : "",
                                                  RetirementDate = personal != null ? personal.RetirementDate : null,
                                                  SportsType = personal != null ? personal.SportsType : null,
                                                  IsPhysicallyHandicapped = personal != null && personal.IsPhysicallyHandicapped,
                                                  DisabilityType = personal != null ? personal.DisabilityType : null,
                                                  ScribeRequired = personal != null && personal.ScribeRequired,
                                                  ExamCity1 = city1 != null ? city1.CityCode.ToString() + "/" + city1.CityName : "",
                                                  ExamCity2 = city2 != null ? city2.CityCode.ToString() + "/" + city2.CityName : "",
                                                  MailingAddress = personal != null ? personal.MailingAddress : "",
                                                  StateId = personal != null ? personal.StateId : 0,
                                                  State = state != null ? state.Name : "",
                                                  DistrictId = personal != null ? personal.District : 0,
                                                  District = dist != null ? dist.Name : "",
                                                  PinCode = personal != null ? personal.PinCode : "",
                                                  IdentityProof = personal != null ? personal.IdentityProof : "",
                                                  IdentityProofNo = personal != null ? personal.IdentityProofNo : "",
                                                  PersonalDetailsCreatedOn = personal != null ? (DateTime?)personal.CreatedOn : null,
                                                  PersonalDetailsUpdatedOn = personal != null ? personal.UpdatedOn : null,
                                                  PersonalDetailsIsActive = personal != null && personal.IsActive,
                                                  TransactionId = null,
                                                  TransactionDate = null,
                                                  TransactionAmount = null,
                                                  TransactionStatus = null,
                                              }).FirstOrDefaultAsync();

                if (completeDetails == null)
                {
                    return NotFound(new { success = false, message = "Candidate details not found." });
                }

                if (latestPayment != null)
                {
                    completeDetails.TransactionId = latestPayment.AtomTxnId;
                    completeDetails.TransactionDate = latestPayment.UpdatedOn;
                    completeDetails.TransactionAmount = latestPayment.Amount;
                    completeDetails.TransactionStatus = latestPayment.Status;
                }

                if (user.IsPaymentCompleted || (latestPayment != null && latestPayment.Status == "SUCCESS"))
                {
                    completeDetails.IsPaymentCompleted = true;
                    completeDetails.PaymentDate = user.PaymentDate ?? latestPayment?.UpdatedOn;
                }

                var maxStep = await _context.UserStepProgresses
                    .Where(s => s.UserId == user.UserId)
                    .OrderByDescending(s => s.StepNumber)
                    .Select(s => s.StepNumber)
                    .FirstOrDefaultAsync();

                completeDetails.CompletedStep = maxStep;

                var uploads = await _context.Uploads.FirstOrDefaultAsync(u => u.UserId == user.UserId);

                return Ok(new
                {
                    success = true,
                    data = completeDetails,
                    uploads = uploads != null ? new
                    {
                        photoFile = uploads.PhotoFile,
                        signatureFile = uploads.SignatureFile,
                        thumbImp = uploads.ThumbImp
                    } : null
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin/daily-report-pdf")]
        public async Task<IActionResult> GetDailyReportPdf()
        {
            try
            {
                var usersByDate = await _context.Users
                    .GroupBy(u => u.CreatedOn.Date)
                    .Select(g => new { Date = g.Key, Count = g.Count() })
                    .ToListAsync();

                var paymentsByDate = await _context.PaymentTransactions
                    .Where(p => p.Status == "SUCCESS" && p.UpdatedOn.HasValue)
                    .GroupBy(p => p.UpdatedOn.Value.Date)
                    .Select(g => new { Date = g.Key, Count = g.Count() })
                    .ToListAsync();

                var allDates = usersByDate.Select(u => u.Date)
                    .Union(paymentsByDate.Select(p => p.Date))
                    .OrderBy(d => d)
                    .ToList();

                var dateWiseData = new List<EmailSchedulerService.DateWiseReportDto>();
                int cummReg = 0;
                int cummFees = 0;
                foreach (var d in allDates)
                {
                    int reg = usersByDate.FirstOrDefault(u => u.Date == d)?.Count ?? 0;
                    int fees = paymentsByDate.FirstOrDefault(p => p.Date == d)?.Count ?? 0;
                    cummReg += reg;
                    cummFees += fees;
                    dateWiseData.Add(new EmailSchedulerService.DateWiseReportDto
                    {
                        Date = d,
                        RegNo = reg,
                        RegCumm = cummReg,
                        FeesNo = fees,
                        FeesCumm = cummFees
                    });
                }

                var cityData = await (
                    from pd in _context.UserPersonalDetails
                    join u in _context.Users on pd.UserId equals u.UserId
                    join ec in _context.ExamCity on pd.ExamCity1 equals ec.CityId into ecJoin
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

                var pdfBytes = EmailSchedulerService.GenerateDailyReportPdf(
                    generatedAt: DELED.Helpers.TimeHelper.GetIST(),
                    dateWiseData: dateWiseData,
                    cityRows: cityRows);

                return File(pdfBytes, "application/pdf", $"DELED_Daily_Report_{DELED.Helpers.TimeHelper.GetIST():dd-MM-yyyy}.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error generating report PDF: {ex.Message}" });
            }
        }
    }

    public class ChangePasswordRequest
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public string OldPassword { get; set; } = string.Empty;

        [Required]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ForgotPasswordRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [Phone]
        public string PhoneNumber { get; set; } = string.Empty;

        public string RecaptchaToken { get; set; } = string.Empty;
    }

    // Request Models
    public class RegisterRequest
    {
        public int? UserId { get; set; }

        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required]
        public string FatherName { get; set; } = string.Empty;

        [Required]
        [Phone]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        public string RecaptchaToken { get; set; } = string.Empty;
    }

    public class VerifyOTPRequest
    {
        [Required]
        public int UserId { get; set; }

        public string OTP { get; set; } = string.Empty;
        public string? MobileOTP { get; set; }
        public string? EmailOTP { get; set; }
    }

    public class ResendOTPRequest
    {
        [Required]
        public int UserId { get; set; }
    }

    public class OTPEmailRequest
    {
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class OTPPhoneRequest
    {
        [Phone]
        public string Phone { get; set; } = string.Empty;
    }

    public class EmailOtps
    {
        public string EmailOTP { get; set; } = string.Empty;
        public DateTime Expires { get; set; }
    }

    public class PhoneOtps
    {
        public string PhoneOTP { get; set; } = string.Empty;
        public DateTime Expires { get; set; }
    }

    public class UpdateApplicantRequest
    {
        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required]
        public string FatherName { get; set; } = string.Empty;

        [Required]
        [Phone]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        public bool IsPaymentCompleted { get; set; }

        public UpdatePersonalDetailsRequest? PersonalDetails { get; set; }
    }

    public class UpdatePersonalDetailsRequest
    {
        public int ExamTypeId { get; set; }
        public string? AppliedCategory { get; set; }
        public string? GraduationCourse { get; set; }
        public string? GraduationUniversity { get; set; }
        public string? GraduationDate { get; set; }
        public string Gender { get; set; } = string.Empty;
        public string? DOB { get; set; }
        public string MotherName { get; set; } = string.Empty;
        public string? HusbandName { get; set; }
        public string Category { get; set; } = string.Empty;
        public string SubCategory { get; set; } = string.Empty;
        public string? RetirementDate { get; set; }
        public string? SportsType { get; set; }
        public bool IsPhysicallyHandicapped { get; set; }
        public string? DisabilityType { get; set; }
        public bool ScribeRequired { get; set; }
        public int ExamCity1 { get; set; }
        public int ExamCity2 { get; set; }
        public string MailingAddress { get; set; } = string.Empty;
        public int StateId { get; set; }
        public int District { get; set; }
        public string PinCode { get; set; } = string.Empty;
        public string IdentityProof { get; set; } = string.Empty;
        public string IdentityProofNo { get; set; } = string.Empty;
    }
}
