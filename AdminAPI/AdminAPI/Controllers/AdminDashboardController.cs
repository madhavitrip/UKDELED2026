using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using DELED.Data;
using DELED.Models;
using DELED.Services;

namespace DELED.Controllers
{
    [Route("api/UserRegistrations")]
    [Route("UserRegistrations")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminDashboardController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AdminDashboardController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpGet("count")]
        [AllowAnonymous] // Maintain compatibility with original count endpoint
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

        [HttpGet("admin/dashboard-data")]
        [AllowAnonymous] // Keep alignment with dashboard data access
        public async Task<IActionResult> GetAdminDashboardData(
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null,
            [FromQuery] string? searchQuery = null,
            [FromQuery] string? filterStatus = null)
        {
            try
            {
                var count = await _context.Users.CountAsync();
                var paidCount = await _context.Users.CountAsync(u => u.IsPaymentCompleted);
                var finalExamCount = await _context.UserPersonalDetails.CountAsync();

                var usersQuery = _context.Users.AsQueryable();

                // Filter search query
                if (!string.IsNullOrWhiteSpace(searchQuery))
                {
                    var q = searchQuery.Trim().ToLower();
                    usersQuery = usersQuery.Where(u => (u.RegistrationNo != null && u.RegistrationNo.ToLower().Contains(q)) ||
                                                       (u.FullName != null && u.FullName.ToLower().Contains(q)) ||
                                                       (u.PhoneNumber != null && u.PhoneNumber.Contains(q)) ||
                                                       (u.Email != null && u.Email.ToLower().Contains(q)));
                }

                // Filter status
                if (!string.IsNullOrWhiteSpace(filterStatus) && !filterStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    bool isPaid = filterStatus.Equals("paid", StringComparison.OrdinalIgnoreCase);
                    usersQuery = usersQuery.Where(u => u.IsPaymentCompleted == isPaid);
                }

                var totalCount = await usersQuery.CountAsync();

                List<UserRegistration> paginatedUsers;
                if (page.HasValue && pageSize.HasValue)
                {
                    paginatedUsers = await usersQuery
                        .OrderByDescending(u => u.UserId)
                        .Skip((page.Value - 1) * pageSize.Value)
                        .Take(pageSize.Value)
                        .ToListAsync();
                }
                else
                {
                    paginatedUsers = await usersQuery
                        .OrderByDescending(u => u.UserId)
                        .ToListAsync();
                }

                var userIds = paginatedUsers.Select(u => u.UserId).ToList();

                var personalDetails = await _context.UserPersonalDetails.Where(pd => userIds.Contains(pd.UserId)).ToListAsync();
                var examTypes = await _context.ExamTypes.ToListAsync();
                var auths = await _context.UserAuths.Where(a => userIds.Contains(a.UserId)).ToListAsync();
                var txns = await _context.PaymentTransactions.Where(t => userIds.Contains(t.UserId)).ToListAsync();

                var usersList = (from user in paginatedUsers
                                 join personal in personalDetails on user.UserId equals personal.UserId into userPersonal
                                 from personal in userPersonal.DefaultIfEmpty()
                                 join exam in examTypes on (personal != null ? personal.ExamTypeId : 0) equals exam.Id into examGroup
                                 from exam in examGroup.DefaultIfEmpty()
                                 join auth in auths on user.UserId equals auth.UserId into userAuth
                                 from auth in userAuth.DefaultIfEmpty()
                                 let userTxns = txns.Where(t => t.UserId == user.UserId).ToList()
                                 let latestTxn = userTxns.OrderByDescending(t => t.Id).FirstOrDefault()
                                 select new
                                 {
                                     regNo = user.RegistrationNo,
                                     name = user.FullName,
                                     mobile = user.PhoneNumber,
                                     email = user.Email,
                                     appliedFor = exam != null ? exam.Name : (personal != null ? personal.AppliedCategory ?? "Not Selected" : "Not Selected"),
                                     status = user.IsPaymentCompleted ? "Paid" : "Unpaid",
                                     amount = user.IsPaymentCompleted ? 
                                              (exam != null ? $"₹{exam.Payment}" : "₹0") : "₹0",
                                     date = user.CreatedOn.ToString("yyyy-MM-dd"),
                                     clearPass = auth != null ? auth.ClearPass : "",
                                     txnStatus = latestTxn != null ? latestTxn.Status : "PENDING"
                                 }).ToList();

                // Email logs in database
                var emailLogsList = await (from log in _context.EmailLogs
                                           join sched in _context.EmailSchedules on log.ScheduleId equals sched.Id
                                           select new
                                           {
                                               recipient = sched.ToEmails,
                                               subject = sched.Subject,
                                               status = log.IsSuccess ? "Delivered" : "Failed",
                                               timeSentVal = log.SentOn
                                           })
                                           .OrderByDescending(x => x.timeSentVal)
                                           .Take(20)
                                           .ToListAsync();

                var formattedEmailLogsList = emailLogsList.Select(x => new
                {
                    recipient = x.recipient,
                    subject = x.subject,
                    status = x.status,
                    timeSent = x.timeSentVal.ToString("yyyy-MM-dd HH:mm")
                }).ToList();

                // Payment transactions in database
                var paymentsList = await (from pay in _context.PaymentTransactions
                                          join usr in _context.Users on pay.UserId equals usr.UserId
                                          select new
                                          {
                                              txId = pay.AtomTxnId ?? pay.MerchantTxnId,
                                              regNo = usr.RegistrationNo,
                                              name = usr.FullName,
                                              status = pay.Status,
                                              amount = pay.Amount,
                                              payId = pay.Id
                                          })
                                          .OrderByDescending(x => x.payId)
                                          .Take(20)
                                          .ToListAsync();

                return Ok(new
                {
                    success = true,
                    stats = new
                    {
                        totalRegistration = count.ToString("D4"),
                        paidApplications = paidCount.ToString("D4"),
                        finalExamCount = finalExamCount.ToString("D4"),
                        admitCardDownloaded = $"0000 / {count.ToString("D4")}"
                    },
                    applications = usersList,
                    totalApplicationsCount = totalCount,
                    emailLogs = formattedEmailLogsList,
                    payments = paymentsList
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpGet("admin/payment-status/{registrationNo}")]
        public async Task<IActionResult> GetPaymentStatusByRegNo(string registrationNo)
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

                var txns = await _context.PaymentTransactions
                    .Where(t => t.UserId == user.UserId)
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                // Format the output report text
                var sb = new System.Text.StringBuilder();
                sb.AppendLine("--- PAYMENT STATUS REPORT ---");
                sb.AppendLine($"Registration No  : {user.RegistrationNo}");
                sb.AppendLine($"Candidate Name   : {user.FullName}");
                sb.AppendLine($"Mobile Number    : {user.PhoneNumber}");
                sb.AppendLine($"Email Address    : {user.Email}");
                sb.AppendLine($"Payment Status   : {(user.IsPaymentCompleted ? "SUCCESS / PAID" : "PENDING / UNPAID")}");
                if (user.PaymentDate.HasValue)
                {
                    sb.AppendLine($"Final Paid Date  : {user.PaymentDate.Value.ToString("yyyy-MM-dd HH:mm:ss")}");
                }
                sb.AppendLine();
                sb.AppendLine("--- TRANSACTION HISTORY (PaymentTransactions) ---");

                if (txns.Count == 0)
                {
                    sb.AppendLine("No transactions found in PaymentTransactions table.");
                }
                else
                {
                    int index = 1;
                    foreach (var t in txns)
                    {
                        sb.AppendLine($"Transaction #{index++}:");
                        sb.AppendLine($"Merchant Txn ID : {t.MerchantTxnId ?? "N/A"}");
                        sb.AppendLine($"Atom Txn ID     : {t.AtomTxnId ?? "N/A"}");
                        sb.AppendLine($"Amount (INR)    : {t.Amount.ToString("F2")}");
                        sb.AppendLine($"Created Date    : {t.CreatedOn.ToString("yyyy-MM-dd HH:mm:ss")}");
                        if (t.UpdatedOn.HasValue)
                        {
                            sb.AppendLine($"Updated Date    : {t.UpdatedOn.Value.ToString("yyyy-MM-dd HH:mm:ss")}");
                        }
                        sb.AppendLine($"Gateway Code    : {t.Status ?? "PENDING"}");
                        sb.AppendLine("----------------------------------------");
                    }
                }

                string formattedOutput = sb.ToString().TrimEnd();

                return Ok(new { success = true, output = formattedOutput, transactions = txns });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpGet("admin/applicant/{registrationNo}")]
        public async Task<IActionResult> GetApplicantByRegNo(string registrationNo)
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

                var personal = await _context.UserPersonalDetails.FirstOrDefaultAsync(pd => pd.UserId == user.UserId);

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        userId = user.UserId,
                        registrationNo = user.RegistrationNo,
                        fullName = user.FullName,
                        fatherName = user.FatherName,
                        phoneNumber = user.PhoneNumber,
                        email = user.Email,
                        isPaymentCompleted = user.IsPaymentCompleted,
                        personalDetails = personal != null ? new
                        {
                            personalDetailId = personal.PersonalDetailId,
                            examTypeId = personal.ExamTypeId,
                            appliedCategory = personal.AppliedCategory,
                            graduationCourse = personal.GraduationCourse,
                            graduationUniversity = personal.GraduationUniversity,
                            graduationDate = personal.GraduationDate,
                            gender = personal.Gender,
                            dob = personal.DOB?.ToString("yyyy-MM-dd"),
                            motherName = personal.MotherName,
                            husbandName = personal.HusbandName,
                            category = personal.Category,
                            subCategory = personal.SubCategory,
                            retirementDate = personal.RetirementDate?.ToString("yyyy-MM-dd"),
                            sportsType = personal.SportsType,
                            isPhysicallyHandicapped = personal.IsPhysicallyHandicapped,
                            disabilityType = personal.DisabilityType,
                            multiDisabilityType = personal.MultiDisabilityType,
                            scribeRequired = personal.ScribeRequired,
                            examCity1 = personal.ExamCity1,
                            examCity2 = personal.ExamCity2,
                            mailingAddress = personal.MailingAddress,
                            stateId = personal.StateId,
                            district = personal.District,
                            pinCode = personal.PinCode,
                            identityProof = personal.IdentityProof,
                            identityProofNo = personal.IdentityProofNo
                        } : null
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

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
                    .Where(p => p.UserId == user.UserId)
                    .OrderByDescending(p => p.Id)
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
                                             select new DELED.Models.NonDbModels.UserCompleteDetailsDTO
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
                                                 ApplicationFor = exam != null ? exam.Name : (personal != null ? personal.AppliedCategory ?? "" : ""),
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
                                                 MultiDisabilityType = personal != null ? personal.MultiDisabilityType : null,
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

        [HttpPut("admin/applicant/{registrationNo}")]
        public async Task<IActionResult> UpdateApplicantByRegNo(string registrationNo, [FromBody] UpdateApplicantRequest request)
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

                if (request.FullName != null && request.FullName.Trim().Length > 50)
                {
                    return BadRequest(new { success = false, message = "Name cannot exceed 50 characters." });
                }

                if (request.FatherName != null && request.FatherName.Trim().Length > 50)
                {
                    return BadRequest(new { success = false, message = "Father's Name cannot exceed 50 characters." });
                }

                user.FullName = request.FullName;
                user.FatherName = request.FatherName;
                user.PhoneNumber = request.PhoneNumber;
                user.Email = request.Email;
                user.IsPaymentCompleted = request.IsPaymentCompleted;

                // Handle personal details update/insertion
                if (request.PersonalDetails != null)
                {
                    if (request.PersonalDetails.MotherName != null && request.PersonalDetails.MotherName.Trim().Length > 50)
                    {
                        return BadRequest(new { success = false, message = "Mother's Name cannot exceed 50 characters." });
                    }

                    if (request.PersonalDetails.HusbandName != null && request.PersonalDetails.HusbandName.Trim().Length > 50)
                    {
                        return BadRequest(new { success = false, message = "Husband's Name cannot exceed 50 characters." });
                    }

                    if (request.PersonalDetails.MailingAddress != null && request.PersonalDetails.MailingAddress.Trim().Length > 200)
                    {
                        return BadRequest(new { success = false, message = "Mailing Address cannot exceed 200 characters." });
                    }

                    var validationError = ValidateIdentityProof(request.PersonalDetails.IdentityProof, request.PersonalDetails.IdentityProofNo);
                    if (validationError != null)
                    {
                        return BadRequest(new { success = false, message = validationError });
                    }

                    if (request.PersonalDetails.SubCategory == "EX-SERVICEMAN (Self)")
                    {
                        if (string.IsNullOrWhiteSpace(request.PersonalDetails.RetirementDate))
                        {
                            return BadRequest(new { success = false, message = "Retirement Date is required for Ex-Serviceman." });
                        }
                        if (DateTime.TryParse(request.PersonalDetails.RetirementDate, out DateTime retVal))
                        {
                            if (retVal.Date >= DateTime.Today)
                            {
                                return BadRequest(new { success = false, message = "Retirement Date must be in the past." });
                            }
                        }
                        else
                        {
                            return BadRequest(new { success = false, message = "Invalid Retirement Date format." });
                        }
                    }

                    var personal = await _context.UserPersonalDetails.FirstOrDefaultAsync(pd => pd.UserId == user.UserId);
                    if (personal == null)
                    {
                        personal = new UserPersonalDetails { UserId = user.UserId };
                        _context.UserPersonalDetails.Add(personal);
                    }

                    personal.ExamTypeId = request.PersonalDetails.ExamTypeId;
                    personal.AppliedCategory = request.PersonalDetails.AppliedCategory;
                    personal.GraduationCourse = request.PersonalDetails.GraduationCourse;
                    personal.GraduationUniversity = request.PersonalDetails.GraduationUniversity;
                    personal.GraduationDate = request.PersonalDetails.GraduationDate;
                    personal.Gender = request.PersonalDetails.Gender ?? string.Empty;
                    personal.MotherName = request.PersonalDetails.MotherName ?? string.Empty;
                    personal.HusbandName = string.Equals(request.PersonalDetails.Gender?.Trim(), "Male", StringComparison.OrdinalIgnoreCase) ? null : request.PersonalDetails.HusbandName;
                    personal.Category = request.PersonalDetails.Category ?? string.Empty;
                    personal.SubCategory = request.PersonalDetails.SubCategory ?? string.Empty;
                    if (personal.SubCategory == "EX-SERVICEMAN (Self)" && !string.IsNullOrWhiteSpace(request.PersonalDetails.RetirementDate))
                    {
                        if (DateTime.TryParse(request.PersonalDetails.RetirementDate, out DateTime retVal))
                        {
                            personal.RetirementDate = retVal;
                        }
                        else
                        {
                            personal.RetirementDate = null;
                        }
                    }
                    else
                    {
                        personal.RetirementDate = null;
                    }
                    personal.SportsType = request.PersonalDetails.SportsType;
                    personal.IsPhysicallyHandicapped = request.PersonalDetails.IsPhysicallyHandicapped;
                    personal.DisabilityType = request.PersonalDetails.DisabilityType;
                    personal.MultiDisabilityType = request.PersonalDetails.MultiDisabilityType;
                    personal.ScribeRequired = request.PersonalDetails.ScribeRequired;
                    personal.ExamCity1 = request.PersonalDetails.ExamCity1;
                    personal.ExamCity2 = request.PersonalDetails.ExamCity2;
                    personal.MailingAddress = request.PersonalDetails.MailingAddress ?? string.Empty;
                    personal.StateId = request.PersonalDetails.StateId;
                    personal.District = request.PersonalDetails.District;
                    personal.PinCode = request.PersonalDetails.PinCode ?? string.Empty;
                    personal.IdentityProof = request.PersonalDetails.IdentityProof ?? string.Empty;
                    personal.IdentityProofNo = request.PersonalDetails.IdentityProofNo ?? string.Empty;

                    if (!string.IsNullOrWhiteSpace(request.PersonalDetails.DOB))
                    {
                        if (DateTime.TryParse(request.PersonalDetails.DOB, out DateTime dobVal))
                        {
                            personal.DOB = dobVal;
                        }
                        else
                        {
                            personal.DOB = null;
                        }
                    }
                    else
                    {
                        personal.DOB = null;
                    }
                    personal.UpdatedOn = DateTime.Now;
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Applicant record updated successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        private string? ValidateIdentityProof(string identityProof, string identityProofNo)
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

        [HttpGet("admin/submission-report-data")]
        public async Task<IActionResult> GetSubmissionReportData([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var usersQuery = _context.Users.AsQueryable();
                var paymentsQuery = _context.PaymentTransactions.Where(p => p.Status == "SUCCESS").AsQueryable();

                if (startDate.HasValue)
                {
                    var startVal = startDate.Value.Date;
                    usersQuery = usersQuery.Where(u => u.CreatedOn.Date >= startVal);
                    paymentsQuery = paymentsQuery.Where(p => p.UpdatedOn.HasValue && p.UpdatedOn.Value.Date >= startVal);
                }

                if (endDate.HasValue)
                {
                    var endVal = endDate.Value.Date;
                    usersQuery = usersQuery.Where(u => u.CreatedOn.Date <= endVal);
                    paymentsQuery = paymentsQuery.Where(p => p.UpdatedOn.HasValue && p.UpdatedOn.Value.Date <= endVal);
                }

                var usersByDate = await usersQuery
                    .GroupBy(u => u.CreatedOn.Date)
                    .Select(g => new { Date = g.Key, Count = g.Count() })
                    .ToListAsync();

                var paymentsByDate = await paymentsQuery
                    .GroupBy(p => p.UpdatedOn.Value.Date)
                    .Select(g => new { Date = g.Key, Count = g.Count() })
                    .ToListAsync();

                var allDates = usersByDate.Select(u => u.Date)
                    .Union(paymentsByDate.Select(p => p.Date))
                    .OrderBy(d => d)
                    .ToList();

                var dateWiseData = new List<object>();
                int cummReg = 0;
                int cummFees = 0;
                foreach (var d in allDates)
                {
                    int reg = usersByDate.FirstOrDefault(u => u.Date == d)?.Count ?? 0;
                    int fees = paymentsByDate.FirstOrDefault(p => p.Date == d)?.Count ?? 0;
                    cummReg += reg;
                    cummFees += fees;
                    dateWiseData.Add(new
                    {
                        Date = d.ToString("yyyy-MM-dd"),
                        RegNo = reg,
                        RegCumm = cummReg,
                        FeesNo = fees,
                        FeesCumm = cummFees
                    });
                }

                // Exam city breakdown
                var personalQuery = _context.UserPersonalDetails.AsQueryable();
                if (startDate.HasValue)
                {
                    var startVal = startDate.Value.Date;
                    personalQuery = personalQuery.Where(pd => pd.CreatedOn.Date >= startVal);
                }
                if (endDate.HasValue)
                {
                    var endVal = endDate.Value.Date;
                    personalQuery = personalQuery.Where(pd => pd.CreatedOn.Date <= endVal);
                }

                var cityData = await (
                    from pd in personalQuery
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
                        return new
                        {
                            CityName = cityNameDisplay,
                            Deled = city.Count,
                            Deled1 = city.Count,
                            Deled2 = 0,
                            Total = city.Count
                        };
                    }).ToList();

                var countTotalPaid = await (
                    from pd in personalQuery
                    join u in _context.Users on pd.UserId equals u.UserId
                    where u.IsPaymentCompleted
                    select pd.PersonalDetailId
                ).CountAsync();

                return Ok(new
                {
                    success = true,
                    dateWise = dateWiseData,
                    cityWise = cityRows,
                    deledCount = countTotalPaid,
                    deled1Count = countTotalPaid,
                    deled2Count = 0,
                    bothCount = 0
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpGet("admin/paid-applications")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPaidApplications(
            [FromQuery] string? searchRegNo = null,
            [FromQuery] string? sortBy = "regNo",
            [FromQuery] string? sortOrder = "asc",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                var baseQuery = _context.Users
                    .Where(u => u.IsPaymentCompleted && u.RegistrationNo != null && u.RegistrationNo != "");

                if (!string.IsNullOrWhiteSpace(searchRegNo))
                {
                    var cleanSearch = searchRegNo.Trim().ToLower();
                    baseQuery = baseQuery.Where(u => u.RegistrationNo.ToLower().Contains(cleanSearch));
                }

                // Group by RegistrationNo to select first created record (smallest UserId) for each unique RegistrationNo
                var firstUserIdsPerRegNo = await baseQuery
                    .GroupBy(u => u.RegistrationNo)
                    .Select(g => g.Min(u => u.UserId))
                    .ToListAsync();

                var query = _context.Users.Where(u => firstUserIdsPerRegNo.Contains(u.UserId)).AsQueryable();

                bool isAsc = string.IsNullOrWhiteSpace(sortOrder) || sortOrder.Equals("asc", StringComparison.OrdinalIgnoreCase);
                bool isDateSort = !string.IsNullOrWhiteSpace(sortBy) && (sortBy.Equals("paymentDate", StringComparison.OrdinalIgnoreCase) || sortBy.Equals("date", StringComparison.OrdinalIgnoreCase));

                if (isDateSort)
                {
                    query = isAsc
                        ? query.OrderBy(u => u.PaymentDate ?? DateTime.MinValue).ThenBy(u => u.RegistrationNo)
                        : query.OrderByDescending(u => u.PaymentDate ?? DateTime.MinValue).ThenByDescending(u => u.RegistrationNo);
                }
                else
                {
                    query = isAsc
                        ? query.OrderBy(u => u.RegistrationNo)
                        : query.OrderByDescending(u => u.RegistrationNo);
                }

                var totalCount = query.Count();

                var paginatedUsers = await query
                    .Skip((Math.Max(1, page) - 1) * Math.Max(1, pageSize))
                    .Take(Math.Max(1, pageSize))
                    .ToListAsync();

                var userIds = paginatedUsers.Select(u => u.UserId).ToList();

                var personalDetailsList = await _context.UserPersonalDetails
                    .Where(pd => userIds.Contains(pd.UserId))
                    .ToListAsync();

                var uploadsList = await _context.Uploads
                    .Where(u => userIds.Contains(u.UserId))
                    .ToListAsync();

                var examTypes = await _context.ExamTypes.ToListAsync();

                var result = paginatedUsers.Select(user =>
                {
                    var personal = personalDetailsList.FirstOrDefault(pd => pd.UserId == user.UserId);
                    var upload = uploadsList.FirstOrDefault(u => u.UserId == user.UserId);
                    var exam = examTypes.FirstOrDefault(e => e.Id == (personal != null ? personal.ExamTypeId : 0));

                    return new
                    {
                        userId = user.UserId,
                        registrationNo = user.RegistrationNo,
                        name = user.FullName,
                        fatherName = user.FatherName,
                        gender = personal != null ? personal.Gender : "",
                        dob = personal?.DOB != null ? personal.DOB.Value.ToString("dd-MM-yyyy") : null,
                        photoFile = upload != null ? upload.PhotoFile : null,
                        thumbImp = upload != null ? upload.ThumbImp : null,
                        signatureFile = upload != null ? upload.SignatureFile : null,
                        isPaymentCompleted = user.IsPaymentCompleted,
                        paymentDate = user.PaymentDate != null ? user.PaymentDate.Value.ToString("dd-MM-yyyy HH:mm:ss") : null,
                        appliedFor = exam != null ? exam.Name : (personal != null ? personal.AppliedCategory ?? "Not Selected" : "Not Selected")
                    };
                }).ToList();

                return Ok(new
                {
                    success = true,
                    totalCount,
                    page,
                    pageSize,
                    data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }
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
        public string? MultiDisabilityType { get; set; }
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
