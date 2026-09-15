using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DELED.Data;
using DELED.Models;
using DELED.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace DELED.Controllers
{
    [Route("api/[controller]")]
    [Route("[controller]")]
    [ApiController]
    
    public class BulkEmailController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly EmailService _emailService;
        private readonly IConfiguration _configuration;

        public BulkEmailController(AppDbContext context, EmailService emailService, IConfiguration configuration)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
        }

        /// <summary>
        /// Retrieves all bulk email recipients
        /// </summary>
        [HttpGet("recipients")]
        public async Task<ActionResult<IEnumerable<BulkEmailRecipient>>> GetRecipients()
        {
            try
            {
                var recipients = await _context.BulkEmailRecipients.ToListAsync();
                return Ok(recipients);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving recipients.", error = ex.Message });
            }
        }

        /// <summary>
        /// Adds a new bulk email recipient
        /// </summary>
        [HttpPost("recipients")]
        public async Task<ActionResult<BulkEmailRecipient>> AddRecipient([FromBody] BulkEmailRecipient recipient)
        {
            if (recipient == null)
            {
                return BadRequest(new { message = "Invalid recipient data." });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                _context.BulkEmailRecipients.Add(recipient);
                await _context.SaveChangesAsync();
                return CreatedAtAction(nameof(GetRecipients), new { id = recipient.Id }, recipient);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error adding recipient.", error = ex.Message });
            }
        }

        /// <summary>
        /// Adds multiple bulk email recipients in a single call
        /// </summary>
        [HttpPost("recipients/bulk")]
        public async Task<IActionResult> AddRecipientsBulk([FromBody] List<BulkEmailRecipient> recipients)
        {
            if (recipients == null || !recipients.Any())
            {
                return BadRequest(new { message = "Invalid or empty recipient list." });
            }

            try
            {
                _context.BulkEmailRecipients.AddRange(recipients);
                await _context.SaveChangesAsync();
                return Ok(new { success = true, count = recipients.Count, message = "Recipients imported successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error importing recipients.", error = ex.Message });
            }
        }

        /// <summary>
        /// Deletes a bulk email recipient
        /// </summary>
        [HttpDelete("recipients/{id}")]
        public async Task<IActionResult> DeleteRecipient(int id)
        {
            try
            {
                var recipient = await _context.BulkEmailRecipients.FindAsync(id);
                if (recipient == null)
                {
                    return NotFound(new { message = $"Recipient with ID {id} not found." });
                }

                _context.BulkEmailRecipients.Remove(recipient);
                await _context.SaveChangesAsync();
                return Ok(new { success = true, message = "Recipient deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting recipient.", error = ex.Message });
            }
        }

        /// <summary>
        /// Request body model for sending bulk email
        /// </summary>
        public class BulkEmailRequest
        {
            public string Subject { get; set; } = string.Empty;
            public string Body { get; set; } = string.Empty;
            public bool UseFeePendingTemplate { get; set; } = false;
            public bool UseProfilePictureCorrectionTemplate { get; set; } = false;
            public bool UseScribeTemplate { get; set; } = false;
            public bool UseScribeHindiOnlyTemplate { get; set; } = false;
        }

        /// <summary>
        /// Result of sending email to a specific recipient
        /// </summary>
        public class SendResult
        {
            public string Email { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
            public string? ErrorMessage { get; set; }
        }

        /// <summary>
        /// Generates the HTML template for DELED 2026 fee pending reminder
        /// </summary>
        public static string GenerateFeePendingEmailTemplate(string name, string registrationNumber)
        {
            return $@"
                <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                    <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                        <tr>
                            <td style=""width: 90px; vertical-align: middle;"">
                                <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                            </td>
                            <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड  (DELED) 2026</h2>
                            </td>
                        </tr>
                    </table>

                    <div style=""text-align: center; margin-bottom: 20px;"">
                        <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">DELED 2026 - FEE PAYMENT PENDING</h3>
                    </div>

                    <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                        <p style=""margin: 0 0 15px 0;"">Dear <strong>{name}</strong>,</p>
                        <p style=""margin: 0 0 15px 0;"">You have registered for DELED 2026, but your fee is pending and without the fee your registration will be incomplete. Please login and complete your payment: <a href=""https://www.ukdeled.com"" style=""color: blue; font-weight: bold; text-decoration: underline;"">ukdeled.com</a>.</p>
                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 25px; font-weight: bold;"">
                        <p style=""margin: 0 0 10px 0;"">आपने DELED 2026 के लिए पंजीकरण किया है किन्तु पंजीकरण शुल्क का भुगतान नहीं हुआ है| अतः आपका आवेदन अपूर्ण है| कृपया वेबसाईट <a href=""https://www.ukdeled.com"" style=""color: blue; font-weight: bold; text-decoration: underline;"">ukdeled.com</a> पर लॉग इन कर शुल्क का भुगतान करें|

Last date for fee payment/ शुल्क भुगतान की अंकित तिथि  : 06 August 2026 |</p>
                        
                    </div>
                        <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                            <p style=""margin: 0 0 5px 0;""><strong>Candidate Name :</strong> <strong style=""font-size: 16px; color: #000;"">{name}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Registration No. :</strong> <strong style=""font-size: 16px; color: #000;"">{registrationNumber}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Last Date for Fee Payment :</strong> <strong style=""font-size: 16px; color: red;"">06 August 2026</strong></p>
                        </div>
                    </div>

                    <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                        <p style=""margin: 0 0 4px 0;"">Regards,</p>
                        <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                        <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                    </div>
                </div>";
        }

        /// <summary>
        /// Generates the HTML template for DELED 2026 profile picture correction notice
        /// </summary>
        public static string GenerateProfilePictureCorrectionEmailTemplate(string name, string registrationNumber)
        {
            return $@"
                <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                    <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                        <tr>
                            <td style=""width: 90px; vertical-align: middle;"">
                                <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                            </td>
                            <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड  (DELED) 2026</h2>
                            </td>
                        </tr>
                    </table>

                    <div style=""text-align: center; margin-bottom: 20px;"">
                        <h3 style=""color: red; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">DELED 2026 - PROFILE PICTURE CORRECTION NOTICE</h3>
                    </div>

                    <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                        <p style=""margin: 0 0 15px 0;"">Dear <strong>{name}</strong>,</p>
                        <p style=""margin: 0 0 15px 0;"">It has been observed that your uploaded profile picture on your DELED 2026 application form is incorrect, unclear, or invalid. Please log in to your candidate account at <a href=""https://www.ukdeled.com"" style=""color: blue; font-weight: bold; text-decoration: underline;"">ukdeled.com</a> and upload a correct and proper profile picture before the last date.</p>
                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 25px; font-weight: bold;"">
                        <p style=""margin: 0 0 10px 0;"">आपके DELED 2026 आवेदन पत्र में अपलोड की गई प्रोफाइल फोटो त्रुटिपूर्ण/अस्पष्ट पाई गई है| कृपया वेबसाईट <a href=""https://www.ukdeled.com"" style=""color: blue; font-weight: bold; text-decoration: underline;"">ukdeled.com</a> पर लॉग इन कर अपनी सही एवं स्पष्ट प्रोफाइल फोटो अपडेट/संशोधित करें|

Last date for photo correction / फोटो संशोधन की अंकित तिथि : 15 August 2026 |</p>
                        
                    </div>
                        <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                            <p style=""margin: 0 0 5px 0;""><strong>Candidate Name :</strong> <strong style=""font-size: 16px; color: #000;"">{name}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Registration No. :</strong> <strong style=""font-size: 16px; color: #000;"">{registrationNumber}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Last Date for Photo Correction :</strong> <strong style=""font-size: 16px; color: red;"">15 August 2026</strong></p>
                        </div>
                    </div>

                    <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                        <p style=""margin: 0 0 4px 0;"">Regards,</p>
                        <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                        <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                    </div>
                </div>";
        }

        /// <summary>
        /// Generates the HTML template for DELED 2026 Scribe (श्रुतलेखक) notice
        /// </summary>
        public static string GenerateScribeEmailTemplate(string name, string registrationNumber)
        {
            string scribePdfUrl = "https://ukdeled.com/API/Notices/Formats%20for%20scribe_%E0%A4%B6%E0%A5%8D%E0%A4%B0%E0%A5%81%E0%A4%A4%E0%A4%B2%E0%A5%87%E0%A4%96%E0%A4%95.pdf";

            return $@"
                <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                    <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                        <tr>
                            <td style=""width: 90px; vertical-align: middle;"">
                                <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                            </td>
                            <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड  (DELED) 2026</h2>
                            </td>
                        </tr>
                    </table>

                    <div style=""text-align: center; margin-bottom: 20px;"">
                        <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">DELED 2026 - NOTICE FOR SCRIBE</h3>
                    </div>

                    <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                        <p style=""margin: 0 0 15px 0;"">Dear <strong>{name}</strong>,</p>
                        <p style=""margin: 0 0 15px 0;"">For the Uttarakhand Teachers Eligibility Test (DELED 2026) scheduled on <strong>29 September 2026</strong>, Physically Handicapped candidates who have claimed for a Scribe must download the Scribe Form, fill it completely, and send the required documents by <strong>14 September 2026</strong> to <a href=""mailto:secydeled@gmail.com"" style=""color: blue; font-weight: bold;"">secydeled@gmail.com</a>. Download Form: <a href=""{scribePdfUrl}"" style=""color: blue; font-weight: bold; text-decoration: underline;"">Download Scribe Form (PDF)</a>.</p>
                        
                        <div style=""color: red; font-size: 13.5px; line-height: 1.6; border-top: 1px solid #f9cbd3; padding-top: 15px; margin-bottom: 20px; font-weight: bold;"">
                            <p style=""margin: 0 0 10px 0;"">दिनांक 29 सितम्बर 2026 को प्रस्तावित उत्तराखण्ड  (DELED-I &amp; II) 2026 हेतु जिन दिव्यांगजन अभ्यर्थियों द्वारा ऑनलाइन आवेदन में श्रुतलेखक का दावा किया है, वे परिषद् की वेबसाइट से श्रुतलेखक प्रारूप डाउनलोड कर पूर्ण रूप से भरकर वांछित अभिलेख (परिशिष्ट-5(I), 5(II), परिशिष्ट-छ:, शैक्षिक योग्यता प्रमाण पत्र एवं दो फोटो) दिनांक 14 सितम्बर 2026 तक अपनी पंजीकृत ई-मेल आई डी से परिषद् की ई-मेल secydeled@gmail.com पर अनिवार्यतः प्रेषित करें| प्रारूप डाउनलोड करें: <a href=""{scribePdfUrl}"" style=""color: blue; font-weight: bold; text-decoration: underline;"">Download Scribe Form (श्रुतलेखक प्रारूप)</a></p>
                            <p style=""margin: 0;"">Last date for submission / अभिलेख उपलब्ध कराने की अंतिम तिथि : 14 September 2026 |</p>
                        </div>

                        <div style=""background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 15px; margin: 15px 0; font-size: 13.5px; line-height: 1.6; color: #7f1d1d;"">
                            <p style=""margin: 0; font-weight: bold;"">
                                ⚠️ महत्वपूर्ण: दिनांक 14 सितम्बर 2026 के पश्चात् प्राप्त होने वाले किसी भी प्रत्यावेदन पर विचार नहीं किया जाएगा। निर्धारित तिथि तक वांछित अभिलेख उपलब्ध कराने वाले दिव्यांगजन अभ्यर्थियों को ही परिषद् द्वारा श्रुतलेखक की अनुमति प्रदान की जाएगी।
                            </p>
                        </div>

                        <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                            <p style=""margin: 0 0 5px 0;""><strong>Candidate Name :</strong> <strong style=""font-size: 16px; color: #000;"">{name}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Registration No. :</strong> <strong style=""font-size: 16px; color: #000;"">{registrationNumber}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Last Date for Submission :</strong> <strong style=""font-size: 16px; color: red;"">14 September 2026</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>Email for Submission :</strong> <strong style=""font-size: 16px; color: blue;"">secydeled@gmail.com</strong></p>
                        </div>
                    </div>

                    <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                        <p style=""margin: 0 0 4px 0;"">Regards,</p>
                        <p style=""margin: 0 0 4px 0;"">DELED 2026 UBSE,</p>
                        <p style=""margin: 0;"">Ramnagar (Nainital)</p>
                    </div>
                </div>";
        }

        /// <summary>
        /// Generates the HTML template for DELED 2026 Scribe (श्रुतलेखक) notice in Hindi only
        /// </summary>
        public static string GenerateScribeHindiOnlyEmailTemplate(string name, string registrationNumber)
        {
            string scribePdfUrl = "https://ukdeled.com/API/Notices/Formats%20for%20scribe_%E0%A4%B6%E0%A5%8D%E0%A4%B0%E0%A5%81%E0%A4%A4%E0%A4%B2%E0%A5%87%E0%A4%96%E0%A4%95.pdf";

            return $@"
                <div style=""font-family: Arial, sans-serif; background-color: #FFFDE4; border: 1px solid #ddd; padding: 25px; max-width: 650px; margin: 0 auto; color: #333;"">
                    <table style=""width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #006400; padding-bottom: 15px;"">
                        <tr>
                            <td style=""width: 90px; vertical-align: middle;"">
                                <img src=""https://ukdeled.com/API/Logo/ubse_white.jpg"" alt=""Logo"" style=""width: 80px; height: 80px; border-radius: 50%; display: block;"" />
                            </td>
                            <td style=""vertical-align: middle; text-align: center; padding-left: 10px;"">
                                <h1 style=""color: #006400; margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">UTTARAKHAND BOARD OF SCHOOL EDUCATION</h1>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड विद्यालयी शिक्षा परिषद् रामनगर, नैनीताल, उत्तराखंड</h2>
                                <h2 style=""color: #000; margin: 4px 0 0 0; font-size: 14px; font-weight: bold;"">उत्तराखंड  (DELED) 2026</h2>
                            </td>
                        </tr>
                    </table>

                    <div style=""text-align: center; margin-bottom: 20px;"">
                        <h3 style=""color: blue; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"">DELED 2026 - श्रुतलेखक हेतु आवश्यक सूचना</h3>
                    </div>

                    <div style=""font-size: 14px; line-height: 1.6; margin-bottom: 25px;"">
                        <p style=""margin: 0 0 15px 0; font-weight: bold;"">प्रिय <strong>{name}</strong>,</p>
                        
                        <div style=""color: #000; font-size: 14px; line-height: 1.7; border-top: 1px solid #ccc; padding-top: 15px; margin-bottom: 20px; font-weight: bold;"">
                            <p style=""margin: 0 0 10px 0;"">दिनांक 29 सितम्बर 2026 को प्रस्तावित उत्तराखण्ड  (DELED-I &amp; II) 2026 हेतु जिन दिव्यांगजन अभ्यर्थियों द्वारा ऑनलाइन आवेदन में श्रुतलेखक का दावा किया है, वे परिषद् की वेबसाइट से श्रुतलेखक प्रारूप डाउनलोड कर पूर्ण रूप से भरकर वांछित अभिलेख (परिशिष्ट-5(I), 5(II), परिशिष्ट-छ:, शैक्षिक योग्यता प्रमाण पत्र एवं दो फोटो) दिनांक 14 सितम्बर 2026 तक अपनी पंजीकृत ई-मेल आई डी से परिषद् की ई-मेल secydeled@gmail.com पर अनिवार्यतः प्रेषित करें| प्रारूप डाउनलोड करें: <a href=""{scribePdfUrl}"" style=""color: blue; font-weight: bold; text-decoration: underline;"">Download Scribe Form (श्रुतलेखक प्रारूप)</a></p>
                            <p style=""margin: 0;"">अभिलेख उपलब्ध कराने की अंतिम तिथि : <span style=""color: red;"">14 सितम्बर 2026</span> |</p>
                        </div>

                        <div style=""background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 15px; margin: 15px 0; font-size: 13.5px; line-height: 1.6; color: #7f1d1d;"">
                            <p style=""margin: 0; font-weight: bold;"">
                                ⚠️ महत्वपूर्ण: दिनांक 14 सितम्बर 2026 के पश्चात् प्राप्त होने वाले किसी भी प्रत्यावेदन पर विचार नहीं किया जाएगा। निर्धारित तिथि तक वांछित अभिलेख उपलब्ध कराने वाले दिव्यांगजन अभ्यर्थियों को ही परिषद् द्वारा श्रुतलेखक की अनुमति प्रदान की जाएगी।
                            </p>
                        </div>

                        <div style=""margin: 20px 0; font-size: 15px; line-height: 1.8;"">
                            <p style=""margin: 0 0 5px 0;""><strong>अभ्यर्थी का नाम :</strong> <strong style=""font-size: 16px; color: #000;"">{name}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>पंजीकरण सं० :</strong> <strong style=""font-size: 16px; color: #000;"">{registrationNumber}</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>अभिलेख जमा करने की अंतिम तिथि :</strong> <strong style=""font-size: 16px; color: red;"">14 सितम्बर 2026</strong></p>
                            <p style=""margin: 0 0 5px 0;""><strong>अभिलेख भेजने हेतु ई-मेल :</strong> <strong style=""font-size: 16px; color: blue;"">secydeled@gmail.com</strong></p>
                        </div>
                    </div>

                    <div style=""font-size: 13px; line-height: 1.5; color: #333; font-weight: bold;"">
                        <p style=""margin: 0 0 4px 0;"">सादर,</p>
                        <p style=""margin: 0 0 4px 0;"">सचिव,</p>
                        <p style=""margin: 0 0 4px 0;"">उत्तराखण्ड विद्यालयी शिक्षा परिषद्,</p>
                        <p style=""margin: 0;"">रामनगर (नैनीताल)</p>
                    </div>
                </div>";
        }

        /// <summary>
        /// Retrieves the fee pending email HTML template with placeholders
        /// </summary>
        [HttpGet("template/fee-pending")]
        public IActionResult GetFeePendingTemplate()
        {
            string defaultSubject = "DELED 2026 - Registration Fee Pending Notice";
            string sampleTemplateHtml = GenerateFeePendingEmailTemplate("{Name}", "{RegistrationNumber}");
            return Ok(new
            {
                subject = defaultSubject,
                template = sampleTemplateHtml,
                placeholders = new[] { "{Name}", "{RegistrationNumber}" }
            });
        }

        /// <summary>
        /// Retrieves the profile picture correction email HTML template with placeholders
        /// </summary>
        [HttpGet("template/profile-picture-correction")]
        public IActionResult GetProfilePictureCorrectionTemplate()
        {
            string defaultSubject = "DELED 2026 - Profile Picture Correction Notice";
            string sampleTemplateHtml = GenerateProfilePictureCorrectionEmailTemplate("{Name}", "{RegistrationNumber}");
            return Ok(new
            {
                subject = defaultSubject,
                template = sampleTemplateHtml,
                placeholders = new[] { "{Name}", "{RegistrationNumber}" }
            });
        }

        /// <summary>
        /// Retrieves the Scribe (श्रुतलेखक) email HTML template with placeholders
        /// </summary>
        [HttpGet("template/scribe")]
        public IActionResult GetScribeTemplate()
        {
            string defaultSubject = "DELED 2026 - Notice for Scribe / श्रुतलेखक हेतु आवश्यक सूचना";
            string sampleTemplateHtml = GenerateScribeEmailTemplate("{Name}", "{RegistrationNumber}");
            return Ok(new
            {
                subject = defaultSubject,
                template = sampleTemplateHtml,
                placeholders = new[] { "{Name}", "{RegistrationNumber}" }
            });
        }

        /// <summary>
        /// Retrieves the Hindi-only Scribe (श्रुतलेखक) email HTML template with placeholders
        /// </summary>
        [HttpGet("template/scribe-hindi")]
        public IActionResult GetScribeHindiOnlyTemplate()
        {
            string defaultSubject = "DELED 2026 - श्रुतलेखक हेतु आवश्यक सूचना";
            string sampleTemplateHtml = GenerateScribeHindiOnlyEmailTemplate("{Name}", "{RegistrationNumber}");
            return Ok(new
            {
                subject = defaultSubject,
                template = sampleTemplateHtml,
                placeholders = new[] { "{Name}", "{RegistrationNumber}" }
            });
        }

        /// <summary>
        /// Sends bulk email to all recipients in the database table
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendBulkEmail([FromBody] BulkEmailRequest request, [FromQuery] bool downloadPdf = false)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Invalid request." });
            }

            if (!request.UseFeePendingTemplate && !request.UseProfilePictureCorrectionTemplate && !request.UseScribeTemplate && !request.UseScribeHindiOnlyTemplate && (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Body)))
            {
                return BadRequest(new { message = "Subject and Body are required when not using a predefined template." });
            }

            try
            {
                var recipients = await _context.BulkEmailRecipients.ToListAsync();

                if (!recipients.Any())
                {
                    return Ok(new
                    {
                        success = false,
                        message = "No recipients found in the database. Add recipients first.",
                        totalProcessed = 0,
                        successfulSends = 0,
                        failedSends = 0,
                        results = new List<SendResult>()
                    });
                }

                string defaultSubject;
                if (request.UseScribeHindiOnlyTemplate)
                {
                    defaultSubject = "DELED 2026 - श्रुतलेखक हेतु आवश्यक सूचना";
                }
                else if (request.UseScribeTemplate)
                {
                    defaultSubject = "DELED 2026 - Notice for Scribe / श्रुतलेखक हेतु आवश्यक सूचना";
                }
                else if (request.UseProfilePictureCorrectionTemplate)
                {
                    defaultSubject = "DELED 2026 - Profile Picture Correction Notice";
                }
                else
                {
                    defaultSubject = "DELED 2026 - Registration Fee Pending Notice";
                }

                string subject = !string.IsNullOrWhiteSpace(request.Subject)
                    ? request.Subject
                    : defaultSubject;

                

                string? bccEmails = _configuration["EmailSettings:AdminBccEmails"];

                var results = new List<SendResult>();
                int successfulSends = 0;
                int failedSends = 0;

                foreach (var recipient in recipients)
                {
                    string personalizedBody;
                    if (request.UseScribeHindiOnlyTemplate)
                    {
                        personalizedBody = GenerateScribeHindiOnlyEmailTemplate(recipient.Name, recipient.RegistrationNumber);
                    }
                    else if (request.UseScribeTemplate)
                    {
                        personalizedBody = GenerateScribeEmailTemplate(recipient.Name, recipient.RegistrationNumber);
                    }
                    else if (request.UseProfilePictureCorrectionTemplate)
                    {
                        personalizedBody = GenerateProfilePictureCorrectionEmailTemplate(recipient.Name, recipient.RegistrationNumber);
                    }
                    else if (request.UseFeePendingTemplate)
                    {
                        personalizedBody = GenerateFeePendingEmailTemplate(recipient.Name, recipient.RegistrationNumber);
                    }
                    else
                    {
                        // Perform replacement of placeholder tokens if present
                        personalizedBody = request.Body
                            .Replace("{Name}", recipient.Name)
                            .Replace("{RegistrationNumber}", recipient.RegistrationNumber)
                            .Replace("{Email}", recipient.Email)
                            .Replace("{PhoneNumber}", recipient.PhoneNumber);
                    }

                    // Send the email using the EmailService with BCC support from appsettings.json
                    string sendStatus;
                    if (!string.IsNullOrWhiteSpace(bccEmails))
                    {
                        sendStatus = _emailService.SendEmailWithCcBcc(recipient.Email, subject, personalizedBody, string.Empty, bccEmails);
                    }
                    else
                    {
                        sendStatus = _emailService.SendEmail(recipient.Email, subject, personalizedBody);
                    }

                    var result = new SendResult
                    {
                        Email = recipient.Email,
                        Name = recipient.Name
                    };

                    if (sendStatus == "Email sent" || sendStatus.StartsWith("Email sent"))
                    {
                        result.Status = "Sent";
                        successfulSends++;
                    }
                    else
                    {
                        result.Status = "Failed";
                        result.ErrorMessage = sendStatus;
                        failedSends++;
                    }

                    results.Add(result);
                }

                // Generate PDF report after email process completes
                string pdfReportUrl = string.Empty;
                string reportFileName = string.Empty;

                try
                {
                    DateTime now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"));
                    byte[] pdfBytes = GenerateBulkEmailPdfReport(recipients.Count, successfulSends, failedSends, results, now);
                    reportFileName = $"BulkEmailReport_{now:yyyyMMdd_HHmmss}.pdf";

                    string reportsDir = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot", "Reports", "BulkEmail");
                    if (!System.IO.Directory.Exists(reportsDir))
                    {
                        System.IO.Directory.CreateDirectory(reportsDir);
                    }

                    string filePath = System.IO.Path.Combine(reportsDir, reportFileName);
                    await System.IO.File.WriteAllBytesAsync(filePath, pdfBytes);

                    pdfReportUrl = $"/Reports/BulkEmail/{reportFileName}";
                }
                catch (Exception)
                {
                    // Ignore PDF generation failures so main email response succeeds
                }

                if (downloadPdf && !string.IsNullOrEmpty(reportFileName))
                {
                    string filePath = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot", "Reports", "BulkEmail", reportFileName);
                    if (System.IO.File.Exists(filePath))
                    {
                        byte[] fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                        return File(fileBytes, "application/pdf", reportFileName);
                    }
                }

                return Ok(new
                {
                    success = successfulSends > 0,
                    message = $"Bulk email process complete. {successfulSends} sent successfully, {failedSends} failed.",
                    totalProcessed = recipients.Count,
                    successfulSends,
                    failedSends,
                    reportFileName,
                    pdfReportUrl,
                    results
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during the bulk email process.", error = ex.Message });
            }
        }

        /// <summary>
        /// Download or view generated bulk email PDF report
        /// </summary>
        [HttpGet("download-report/{fileName}")]
        public IActionResult DownloadReport(string fileName)
        {
            string filePath = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot", "Reports", "BulkEmail", fileName);
            if (!System.IO.File.Exists(filePath))
            {
                return NotFound(new { message = "Report file not found." });
            }
            byte[] fileBytes = System.IO.File.ReadAllBytes(filePath);
            return File(fileBytes, "application/pdf", fileName);
        }

        /// <summary>
        /// Generates a PDF report containing summary and detailed success/failed email logs
        /// </summary>
        public static byte[] GenerateBulkEmailPdfReport(
            int totalProcessed,
            int successfulSends,
            int failedSends,
            List<SendResult> results,
            DateTime generatedAt)
        {
            QuestPDF.Settings.License = LicenseType.Community;

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(30);
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                    // HEADER
                    page.Header().Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().AlignCenter().Text("UTTARAKHAND BOARD OF SCHOOL EDUCATION")
                                .Bold().FontSize(13).FontColor(Colors.Blue.Darken3);

                            col.Item().AlignCenter().Text("DELED - 2026")
                                .Bold().FontSize(10);

                            col.Item().AlignCenter().Text("Bulk Email Delivery Status Report")
                                .Bold().FontSize(11).FontColor(Colors.Grey.Darken3);

                            col.Item().AlignRight()
                                .Text($"Generated On: {generatedAt:dd/MM/yyyy hh:mm:ss tt}")
                                .FontSize(8).Italic();
                        });
                    });

                    // CONTENT
                    page.Content().PaddingVertical(15).Column(col =>
                    {
                        // SUMMARY CARDS TABLE
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn();
                                columns.RelativeColumn();
                                columns.RelativeColumn();
                            });

                            table.Cell().Background(Colors.Blue.Lighten5).Border(1).BorderColor(Colors.Blue.Lighten3).Padding(10).Column(c =>
                            {
                                c.Item().AlignCenter().Text("Total Processed").FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                                c.Item().AlignCenter().Text($"{totalProcessed}").FontSize(16).Bold().FontColor(Colors.Blue.Darken2);
                            });

                            table.Cell().Background(Colors.Green.Lighten5).Border(1).BorderColor(Colors.Green.Lighten3).Padding(10).Column(c =>
                            {
                                c.Item().AlignCenter().Text("Successfully Sent").FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                                c.Item().AlignCenter().Text($"{successfulSends}").FontSize(16).Bold().FontColor(Colors.Green.Darken2);
                            });

                            table.Cell().Background(Colors.Red.Lighten5).Border(1).BorderColor(Colors.Red.Lighten3).Padding(10).Column(c =>
                            {
                                c.Item().AlignCenter().Text("Failed / Not Sent").FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                                c.Item().AlignCenter().Text($"{failedSends}").FontSize(16).Bold().FontColor(Colors.Red.Darken2);
                            });
                        });

                        col.Item().PaddingVertical(10);

                        // SUCCESSFUL EMAILS SECTION
                        var successList = results.Where(r => r.Status == "Sent").ToList();
                        col.Item().Text($"Successfully Delivered Emails ({successList.Count})")
                            .Bold().FontSize(11).FontColor(Colors.Green.Darken2);

                        col.Item().PaddingTop(5).Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.ConstantColumn(35);
                                cols.RelativeColumn(2);
                                cols.RelativeColumn(3);
                                cols.ConstantColumn(60);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Green.Darken2).Padding(5).Text("S.No").Bold().FontColor(Colors.White);
                                header.Cell().Background(Colors.Green.Darken2).Padding(5).Text("Candidate Name").Bold().FontColor(Colors.White);
                                header.Cell().Background(Colors.Green.Darken2).Padding(5).Text("Email Address").Bold().FontColor(Colors.White);
                                header.Cell().Background(Colors.Green.Darken2).Padding(5).Text("Status").Bold().FontColor(Colors.White);
                            });

                            if (!successList.Any())
                            {
                                table.Cell().ColumnSpan(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).AlignCenter().Text("No emails sent successfully.").Italic();
                            }
                            else
                            {
                                for (int i = 0; i < successList.Count; i++)
                                {
                                    var item = successList[i];
                                    var bg = i % 2 == 0 ? Colors.White : Colors.Grey.Lighten4;

                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text($"{i + 1}");
                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.Name ?? "");
                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.Email ?? "");
                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text("SENT").Bold().FontColor(Colors.Green.Darken2);
                                }
                            }
                        });

                        col.Item().PaddingVertical(12);

                        // FAILED / NOT SENT EMAILS SECTION
                        var failedList = results.Where(r => r.Status != "Sent").ToList();
                        col.Item().Text($"Failed / Not Sent Emails ({failedList.Count})")
                            .Bold().FontSize(11).FontColor(Colors.Red.Darken2);

                        col.Item().PaddingTop(5).Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.ConstantColumn(35);
                                cols.RelativeColumn(2);
                                cols.RelativeColumn(3);
                                cols.RelativeColumn(3);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Red.Darken2).Padding(5).Text("S.No").Bold().FontColor(Colors.White);
                                header.Cell().Background(Colors.Red.Darken2).Padding(5).Text("Candidate Name").Bold().FontColor(Colors.White);
                                header.Cell().Background(Colors.Red.Darken2).Padding(5).Text("Email Address").Bold().FontColor(Colors.White);
                                header.Cell().Background(Colors.Red.Darken2).Padding(5).Text("Error Details").Bold().FontColor(Colors.White);
                            });

                            if (!failedList.Any())
                            {
                                table.Cell().ColumnSpan(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).AlignCenter().Text("None (0 failed emails).").Italic();
                            }
                            else
                            {
                                for (int i = 0; i < failedList.Count; i++)
                                {
                                    var item = failedList[i];
                                    var bg = i % 2 == 0 ? Colors.White : Colors.Grey.Lighten4;

                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text($"{i + 1}");
                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.Name ?? "");
                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.Email ?? "");
                                    table.Cell().Background(bg).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(item.ErrorMessage ?? "Failed").FontColor(Colors.Red.Darken2);
                                }
                            }
                        });
                    });

                    // FOOTER
                    page.Footer().Row(row =>
                    {
                        row.RelativeItem().Text("DELED 2026 Confidential Report").FontSize(8).FontColor(Colors.Grey.Medium);
                        row.RelativeItem().AlignRight().Text(x =>
                        {
                            x.Span("Page ");
                            x.CurrentPageNumber();
                            x.Span(" of ");
                            x.TotalPages();
                        });
                    });
                });
            });

            return document.GeneratePdf();
        }

        /// <summary>
        /// Dedicated endpoint for sending bulk fee pending reminder emails to all recipients.
        /// Subject and HTML body template are automatically generated by the controller.
        /// Pass downloadPdf=true to download the generated PDF report directly from Swagger.
        /// </summary>
        [HttpPost("send-fee-pending")]
        public async Task<IActionResult> SendBulkFeePendingEmail([FromQuery] bool downloadPdf = false)
        {
            var req = new BulkEmailRequest
            {
                UseFeePendingTemplate = true,
                Subject = "DELED 2026 - Registration Fee Pending Notice"
            };
            return await SendBulkEmail(req, downloadPdf);
        }

        /// <summary>
        /// Dedicated endpoint for sending bulk profile picture correction emails to all recipients.
        /// Subject and HTML body template are automatically generated by the controller.
        /// Pass downloadPdf=true to download the generated PDF report directly from Swagger.
        /// </summary>
        [HttpPost("send-profile-picture-correction")]
        public async Task<IActionResult> SendBulkProfilePictureCorrectionEmail([FromQuery] bool downloadPdf = false)
        {
            var req = new BulkEmailRequest
            {
                UseProfilePictureCorrectionTemplate = true,
                Subject = "DELED 2026 - Profile Picture Correction Notice"
            };
            return await SendBulkEmail(req, downloadPdf);
        }

        /// <summary>
        /// Dedicated endpoint for sending bulk scribe (श्रुतलेखक) notice emails to all recipients.
        /// Subject and HTML body template are automatically generated by the controller based on UBSE notice.
        /// Pass downloadPdf=true to download the generated PDF report directly from Swagger.
        /// </summary>
        [HttpPost("send-scribe")]
        public async Task<IActionResult> SendBulkScribeEmail([FromQuery] bool downloadPdf = false)
        {
            var req = new BulkEmailRequest
            {
                UseScribeTemplate = true,
                Subject = "DELED 2026 - Notice for Scribe / श्रुतलेखक हेतु आवश्यक सूचना"
            };
            return await SendBulkEmail(req, downloadPdf);
        }

        /// <summary>
        /// Dedicated endpoint for sending bulk scribe (श्रुतलेखक) notice emails in Hindi only to all recipients.
        /// Subject and HTML body template in Hindi are automatically generated by the controller based on UBSE notice.
        /// Pass downloadPdf=true to download the generated PDF report directly from Swagger.
        /// </summary>
        [HttpPost("send-scribe-hindi")]
        public async Task<IActionResult> SendBulkScribeHindiOnlyEmail([FromQuery] bool downloadPdf = false)
        {
            var req = new BulkEmailRequest
            {
                UseScribeHindiOnlyTemplate = true,
                Subject = "DELED 2026 - श्रुतलेखक हेतु आवश्यक सूचना"
            };
            return await SendBulkEmail(req, downloadPdf);
        }

        /// <summary>
        /// Download the latest generated bulk email PDF report directly from Swagger
        /// </summary>
        [HttpGet("latest-report")]
        public IActionResult GetLatestReport()
        {
            string reportsDir = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot", "Reports", "BulkEmail");
            if (!System.IO.Directory.Exists(reportsDir))
            {
                return NotFound(new { message = "No reports generated yet." });
            }

            var latestFile = new System.IO.DirectoryInfo(reportsDir)
                .GetFiles("*.pdf")
                .OrderByDescending(f => f.LastWriteTime)
                .FirstOrDefault();

            if (latestFile == null)
            {
                return NotFound(new { message = "No PDF reports found." });
            }

            byte[] fileBytes = System.IO.File.ReadAllBytes(latestFile.FullName);
            return File(fileBytes, "application/pdf", latestFile.Name);
        }
    }
}
