using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DELED.Data;
using DELED.Models;
using DELED.Models.NonDbModels;
using DELED.Services;

namespace DELED.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UserPersonalDetailsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ISecurityService _securityService;

        public UserPersonalDetailsController(AppDbContext context, ISecurityService securityService)
        {
            _context = context;
            _securityService = securityService;
        }

        // GET: api/UserPersonalDetails/applicant/{registrationNo}
        // GET: api/UserPersonalDetails/applicant-complete/{registrationNo}
        // GET: api/UserPersonalDetails/verify/{registrationNo}
        [AllowAnonymous]
        [HttpGet("applicant/{registrationNo}")]
        [HttpGet("applicant-complete/{registrationNo}")]
        [HttpGet("verify/{registrationNo}")]
        public async Task<IActionResult> GetCompleteApplicantByRegNo(string registrationNo)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(registrationNo))
                {
                    return BadRequest(new { success = false, message = "Registration identifier or token is required." });
                }

                var cleanInput = registrationNo.Trim();
                string candidateRegNo = cleanInput;

                // Attempt URL-safe decryption if parameter is an encrypted token
                string decrypted = _securityService.DecryptUrlSafe(cleanInput);
                if (string.IsNullOrEmpty(decrypted))
                {
                    decrypted = _securityService.Decrypt(cleanInput);
                }

                if (!string.IsNullOrEmpty(decrypted))
                {
                    candidateRegNo = decrypted.Trim();
                }

                var user = await _context.Users.FirstOrDefaultAsync(u => u.RegistrationNo.ToLower() == candidateRegNo.ToLower());
                if (user == null)
                {
                    return NotFound(new { success = false, message = "Candidate registration record not found." });
                }

                var latestPayment = await _context.PaymentTransactions
                    .Where(p => p.UserId == user.UserId && p.Status == "SUCCESS")
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
                string encryptedToken = _securityService.EncryptUrlSafe(user.RegistrationNo);

                return Ok(new
                {
                    success = true,
                    data = completeDetails,
                    uploads = uploads != null ? new
                    {
                        photoFile = uploads.PhotoFile,
                        signatureFile = uploads.SignatureFile,
                        thumbImp = uploads.ThumbImp
                    } : null,
                    encryptedToken = encryptedToken,
                    verificationUrl = $"https://ukdeled.com/verify?token={encryptedToken}",
                    registrationNo = user.RegistrationNo
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        // GET: api/UserPersonalDetails/complete/me
        // Join UserRegistration and UserPersonalDetails tables
        [HttpGet("complete/me")]
        public async Task<ActionResult<UserCompleteDetailsDTO>> GetCompleteUserDetails()
        {
            try
            {
                int userId = GetUserIdFromToken();

                // Get the latest payment transaction for the user
                var latestPayment = await _context.PaymentTransactions
                    .Where(p => p.UserId == userId && p.Status=="SUCCESS")
                    .OrderByDescending(p => p.UpdatedOn)
                    .FirstOrDefaultAsync();

                var completeDetails = await (from user in _context.Users
                                             
                                             join personal in _context.UserPersonalDetails
                                             on user.UserId equals personal.UserId into userPersonal
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
                                             
                                             where user.UserId == userId
                                             select new UserCompleteDetailsDTO
                                             {
                                                 // User Registration Details
                                                 UserId = user.UserId,
                                                 FullName = user.FullName,
                                                 FatherName = user.FatherName,
                                                 PhoneNumber = user.PhoneNumber,
                                                 Email = user.Email,
                                                 CreatedOn = user.CreatedOn,
                                                 IsOTPVerified = user.IsOTPVerified,
                                                 RegistrationNo = user.RegistrationNo,
                                                 IsPaymentCompleted = false, // Will be set below
                                                 PaymentDate = null, // Will be set below

                                                                                                   // User Personal Details (null if not exists)
                                                  PersonalDetailId = personal != null ? (int?)personal.PersonalDetailId : null,
                                                  ExamTypeId = personal != null ? (int?)personal.ExamTypeId : null,
                                                  ApplicationFor = exam != null ? exam.Name : "",
                                                  AppliedCategory = personal != null ? personal.AppliedCategory : null,
                                                  GraduationCourse = personal != null ? personal.GraduationCourse : null,
                                                  GraduationUniversity = personal != null ? personal.GraduationUniversity : null,
                                                  GraduationDate = personal != null ? personal.GraduationDate : null,
                                                  ApplicantName = user.FullName,
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
                    return NotFound(new { success = false, message = "User not found." });
                }

                // Set payment details from the latest transaction
                // Set payment details from the latest transaction
                if (latestPayment != null)
                {
                    completeDetails.TransactionId = latestPayment.AtomTxnId;
                    completeDetails.TransactionDate = latestPayment.UpdatedOn;   // or CreatedOn if that's your transaction date
                    completeDetails.TransactionAmount = latestPayment.Amount;
                    completeDetails.TransactionStatus = latestPayment.Status;

                    if (latestPayment.Status == "SUCCESS")
                    {
                        completeDetails.IsPaymentCompleted = true;
                        completeDetails.PaymentDate = latestPayment.UpdatedOn;
                    }
                }

                var maxStep = await _context.UserStepProgresses
                    .Where(s => s.UserId == userId)
                    .OrderByDescending(s => s.StepNumber)
                    .Select(s => s.StepNumber)
                    .FirstOrDefaultAsync();

                completeDetails.CompletedStep = maxStep;

                var uploads = await _context.Uploads.FirstOrDefaultAsync(u => u.UserId == userId);
                var userObj = await _context.Users.FindAsync(userId);
                string encryptedToken = userObj != null ? _securityService.EncryptUrlSafe(userObj.RegistrationNo) : "";

                return Ok(new
                {
                    success = true,
                    data = completeDetails,
                    uploads = uploads != null ? new
                    {
                        photoFile = uploads.PhotoFile,
                        signatureFile = uploads.SignatureFile,
                        thumbImp = uploads.ThumbImp
                    } : null,
                    encryptedToken = encryptedToken,
                    verificationUrl = $"https://ukdeled.com/verify?token={encryptedToken}",
                    registrationNo = userObj?.RegistrationNo
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        // GET: api/UserPersonalDetails/complete
        // Join UserRegistration and UserPersonalDetails tables for all users
        [HttpGet("complete")]
        public async Task<ActionResult<IEnumerable<UserCompleteDetailsDTO>>> GetAllCompleteUserDetails()
        {
            try
            {
                // Get all latest payment transactions (one per user)
                var latestPayments = await _context.PaymentTransactions
                    .GroupBy(p => p.UserId)
                    .Select(g => g.OrderByDescending(p => p.Id).FirstOrDefault())
                    .ToListAsync();

                var paymentDict = latestPayments.ToDictionary(p => p.UserId, p => p);

                var completeDetailsList = await (from user in _context.Users
                                                 
                                                 join personal in _context.UserPersonalDetails
                                                 on user.UserId equals personal.UserId into userPersonal
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
                                                 
                                                 select new UserCompleteDetailsDTO
                                                 {
                                                     // User Registration Details
                                                     UserId = user.UserId,
                                                     FullName = user.FullName,
                                                     FatherName = user.FatherName,
                                                     PhoneNumber = user.PhoneNumber,
                                                     Email = user.Email,
                                                     CreatedOn = user.CreatedOn,
                                                     IsOTPVerified = user.IsOTPVerified,
                                                     RegistrationNo = user.RegistrationNo,
                                                     IsPaymentCompleted = false, // Will be set below
                                                     PaymentDate = null, // Will be set below

                                                                                                       // User Personal Details (null if not exists)
                                                  PersonalDetailId = personal != null ? (int?)personal.PersonalDetailId : null,
                                                  ExamTypeId = personal != null ? (int?)personal.ExamTypeId : null,
                                                  ApplicationFor = exam != null ? exam.Name : "",
                                                  AppliedCategory = personal != null ? personal.AppliedCategory : null,
                                                  GraduationCourse = personal != null ? personal.GraduationCourse : null,
                                                  GraduationUniversity = personal != null ? personal.GraduationUniversity : null,
                                                  GraduationDate = personal != null ? personal.GraduationDate : null,
                                                  ApplicantName = user.FullName,
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
                                                 }).ToListAsync();

                // Set payment details from the latest transactions
                // Set payment details from the latest transactions
                foreach (var detail in completeDetailsList)
                {
                    if (paymentDict.TryGetValue(detail.UserId, out var payment) && payment != null)
                    {
                        // Transaction Details
                        detail.TransactionId = payment.AtomTxnId;           // Change to TransactionId if your column name differs
                        detail.TransactionDate = payment.UpdatedOn;     // Or payment.CreatedOn / payment.TxnDate
                        detail.TransactionAmount = payment.Amount;
                        detail.TransactionStatus = payment.Status;

                        // Payment Status
                        if (payment.Status == "SUCCESS")
                        {
                            detail.IsPaymentCompleted = true;
                            detail.PaymentDate = payment.UpdatedOn;
                        }
                    }
                }

                var steps = await _context.UserStepProgresses
                    .GroupBy(s => s.UserId)
                    .Select(g => new { UserId = g.Key, MaxStep = g.Max(s => s.StepNumber) })
                    .ToListAsync();

                var stepMap = steps.ToDictionary(s => s.UserId, s => s.MaxStep);

                foreach (var detail in completeDetailsList)
                {
                    if (stepMap.TryGetValue(detail.UserId, out int maxStep))
                    {
                        detail.CompletedStep = maxStep;
                    }
                }

                return Ok(new { success = true, count = completeDetailsList.Count, data = completeDetailsList });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpPost]
        [HttpPut]
        [HttpPatch]
        public async Task<IActionResult> CreateOrUpdateUserPersonalDetails([FromBody] UserPersonalDetails dto, [FromQuery] int completedStep = 0)
        {
            try
            {
                int userId = GetUserIdFromToken();
                dto.UserId = userId;

                bool isPaymentCompleted = await _context.PaymentTransactions
                    .AnyAsync(p => p.UserId == dto.UserId && p.Status == "SUCCESS");

                bool isCorrectionWindowOpen = false;
                var correctionStartTimeline = await _context.RegistrationTimelines.FirstOrDefaultAsync(t => t.Label == "CORRECTION WINDOW" && t.Key == "starts");
                var correctionCloseTimeline = await _context.RegistrationTimelines.FirstOrDefaultAsync(t => t.Label == "CORRECTION WINDOW" && t.Key == "closes");

                if (correctionStartTimeline != null && correctionCloseTimeline != null)
                {
                    if (DateTime.TryParse($"{correctionStartTimeline.DateValue} 00:00:00", out DateTime startDate) && 
                        DateTime.TryParse($"{correctionCloseTimeline.DateValue} 23:59:59", out DateTime closeDate))
                    {
                        var now = DELED.Helpers.TimeHelper.GetIST();
                        if (now >= startDate && now <= closeDate)
                        {
                            isCorrectionWindowOpen = true;
                        }
                    }
                }

                var feeTimeline = await _context.RegistrationTimelines.FirstOrDefaultAsync(t => t.Key == "fee");
                if (feeTimeline != null && DateTime.TryParse($"{feeTimeline.DateValue} 23:59:59", out DateTime feeParsedDate))
                {
                    if (DELED.Helpers.TimeHelper.GetIST() >= feeParsedDate)
                    {
                        if (!(isCorrectionWindowOpen && isPaymentCompleted))
                        {
                            return BadRequest(new { success = false, message = "Last date for amendments has passed. No further changes can be made." });
                        }
                    }
                }

                // Check if Step 4 is completed or payment is completed
                bool isStep4Completed = await _context.UserStepProgresses
                    .AnyAsync(s => s.UserId == userId && s.StepNumber >= 4);

                if ((isStep4Completed || isPaymentCompleted) && !(isCorrectionWindowOpen && isPaymentCompleted))
                {
                    return BadRequest(new { success = false, message = "Application is confirmed and locked. Personal details cannot be updated." });
                }


                var userReg = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (userReg == null)
                {
                    return NotFound(new { success = false, message = "User not found." });
                }

                bool userRegUpdated = false;

                if (!string.IsNullOrEmpty(dto.EmailId) && dto.EmailId != userReg.Email)
                {
                    if (isCorrectionWindowOpen && isPaymentCompleted)
                    {
                        var oldLocal = userReg.Email.Split('@')[0];
                        var newLocal = dto.EmailId.Split('@')[0];
                        if (oldLocal != newLocal)
                        {
                            return BadRequest(new { success = false, message = "In correction mode, you can only correct the domain part (e.g. gmail.com) of your email. The part before @ must remain unchanged." });
                        }
                        
                        // Check if the new email is already in use by another user
                        var emailExists = await _context.Users.AnyAsync(u => u.Email == dto.EmailId && u.UserId != userId);
                        if (emailExists)
                        {
                            return BadRequest(new { success = false, message = "The corrected email is already registered to another user." });
                        }

                        userReg.Email = dto.EmailId;
                        userRegUpdated = true;
                    }
                }

                if (!string.IsNullOrEmpty(dto.MobileNo) && dto.MobileNo != userReg.PhoneNumber)
                {
                    if (isCorrectionWindowOpen && isPaymentCompleted)
                    {
                        return BadRequest(new { success = false, message = "Mobile Number cannot be changed from the backend during correction mode." });
                    }
                    userReg.PhoneNumber = dto.MobileNo;
                    userRegUpdated = true;
                }

                if (!string.IsNullOrEmpty(dto.ApplicantName) && dto.ApplicantName.Trim().ToUpper() != userReg.FullName.Trim().ToUpper())
                {
                    if (isCorrectionWindowOpen && isPaymentCompleted)
                    {
                        int distance = ComputeLevenshteinDistance(userReg.FullName, dto.ApplicantName);
                        int maxLength = Math.Max(userReg.FullName.Length, dto.ApplicantName.Trim().Length);
                        double changePercentage = (double)distance / maxLength * 100;
                        if (changePercentage > 20)
                        {
                            return BadRequest(new { success = false, message = "Candidate name cannot be changed by more than 20%." });
                        }
                    }
                    userReg.FullName = dto.ApplicantName.Trim().ToUpper();
                    userRegUpdated = true;
                }

                if (!string.IsNullOrEmpty(dto.FatherName) && dto.FatherName.Trim().ToUpper() != userReg.FatherName.Trim().ToUpper())
                {
                    userReg.FatherName = dto.FatherName.Trim().ToUpper();
                    userRegUpdated = true;
                }

                if (userRegUpdated)
                {
                    _context.Users.Update(userReg);
                }


                var validationError = ValidateIdentityProof(dto.IdentityProof, dto.IdentityProofNo);
                if (validationError != null)
                {
                    return BadRequest(new { success = false, message = validationError });
                }

                if (dto.DOB == null)
                {
                    return BadRequest(new { success = false, message = "Date of Birth (जन्म तिथि) is required." });
                }
                else
                {
                    var dob = dto.DOB.Value.Date;

                    // Minimum Age: 19 years as of 01/07/2027 (DOB cannot be later than 01/07/2008)
                    var maxAllowedDob = new DateTime(2008, 7, 1);
                    if (dob > maxAllowedDob)
                    {
                        return BadRequest(new { success = false, message = "Minimum age must be 19 years as of 01/07/2027 (01/07/2027 को न्यूनतम आयु 19 वर्ष होनी चाहिए। जन्म तिथि 01/07/2008 के बाद की नहीं हो सकती)." });
                    }

                    string catUpper = (dto.Category ?? "").ToUpper();
                    bool isScStObc = catUpper.Contains("SC") || 
                                     catUpper.Contains("ST") || 
                                     catUpper.Contains("OBC") || 
                                     catUpper.Contains("SCHEDULED CASTE") || 
                                     catUpper.Contains("SCHEDULED TRIBE") || 
                                     catUpper.Contains("OTHER BACKWARD CLASS");

                    bool isPH = dto.IsPhysicallyHandicapped;

                    string subCatUpper = (dto.SubCategory ?? "").ToUpper();
                    bool isExServiceman = subCatUpper.Contains("EX-SERVICEMAN") || 
                                         subCatUpper.Contains("EX SERVICEMAN") || 
                                         subCatUpper.Contains("पूर्व सैनिक");

                    bool isDFF = subCatUpper.Contains("DFF") || subCatUpper.Contains("स्वतंत्रता");

                    int maxAge = 30;
                    string relaxationNote = "";

                    if (isPH && (isScStObc || isDFF))
                    {
                        maxAge = 45;
                        relaxationNote = isScStObc && isDFF 
                            ? " (including 10 years for PH and 5 years for SC/ST/OBC/DFF)" 
                            : (isScStObc ? " (including 10 years for PH and 5 years for SC/ST/OBC)" : " (including 10 years for PH and 5 years for DFF)");
                    }
                    else if (isPH)
                    {
                        maxAge = 40;
                        relaxationNote = " (including 10 years relaxation for PH)";
                    }
                    else if (isScStObc || isDFF)
                    {
                        maxAge = 35;
                        relaxationNote = isScStObc && isDFF 
                            ? " (including 5 years relaxation for SC/ST/OBC/DFF)" 
                            : (isScStObc ? " (including 5 years relaxation for SC/ST/OBC)" : " (including 5 years relaxation for DFF)");
                    }

                    // For Ex-Servicemen, there is NO upper age limit
                    if (!isExServiceman)
                    {
                        var minAllowedDob = new DateTime(2027 - maxAge, 7, 1);
                        if (dob < minAllowedDob)
                        {
                            string msg = $"Age must not be more than {maxAge} years{relaxationNote} as of 01/07/2027 (01/07/2027 को आयु {maxAge} वर्ष से अधिक नहीं होनी चाहिए। जन्म तिथि 01/07/{2027 - maxAge} से पूर्व की नहीं हो सकती).";
                            return BadRequest(new { success = false, message = msg });
                        }
                    }
                }

                if (dto.MotherName != null && dto.MotherName.Trim().Length > 50)
                {
                    return BadRequest(new { success = false, message = "Mother's Name cannot exceed 50 characters." });
                }

                bool isFemale = string.Equals(dto.Gender?.Trim(), "Female", StringComparison.OrdinalIgnoreCase);
                if (!isFemale && !string.IsNullOrWhiteSpace(dto.HusbandName))
                {
                    return BadRequest(new { success = false, message = "Husband's Name is only allowed for Female candidates (पति का नाम केवल महिला अभ्यर्थियों हेतु मान्य है)." });
                }

                if (isFemale && dto.HusbandName != null && dto.HusbandName.Trim().Length > 50)
                {
                    return BadRequest(new { success = false, message = "Husband's Name cannot exceed 50 characters." });
                }

                if (dto.MailingAddress != null && dto.MailingAddress.Trim().Length > 200)
                {
                    return BadRequest(new { success = false, message = "Mailing Address cannot exceed 200 characters." });
                }

                string subCategoryStr = (dto.SubCategory ?? "").ToUpper();
                bool isExServicemanCat = subCategoryStr.Contains("EX-SERVICEMAN") || 
                                         subCategoryStr.Contains("EX SERVICEMAN") || 
                                         subCategoryStr.Contains("पूर्व सैनिक");

                if (isExServicemanCat)
                {
                    if (dto.RetirementDate == null)
                    {
                        return BadRequest(new { success = false, message = "Retirement Date from Armed Forces (सेना से सेवा-निवृत्ति की तिथि) is required for Ex-Serviceman." });
                    }
                    var todayIst = DELED.Helpers.TimeHelper.GetIST().Date;
                    if (dto.RetirementDate.Value.Date >= todayIst)
                    {
                        return BadRequest(new { success = false, message = "Date of retirement cannot be today's date or a future date. It must be less than today's date (सेना से सेवा-निवृत्ति की तिथि आज की तिथि से पूर्व की होनी चाहिए)." });
                    }
                    if (dto.DOB != null && dto.RetirementDate.Value.Date <= dto.DOB.Value.Date)
                    {
                        return BadRequest(new { success = false, message = "Date of retirement must be after Date of Birth (सेना से सेवा-निवृत्ति की तिथि जन्म तिथि के बाद की होनी चाहिए)." });
                    }
                }

                if (dto.ExamCity1 <= 0)
                {
                    return BadRequest(new { success = false, message = "Please select a valid 1st Exam City preference." });
                }

                if (dto.ExamCity2 <= 0)
                {
                    return BadRequest(new { success = false, message = "Please select a valid 2nd Exam City preference." });
                }

                if (dto.ExamCity1 == dto.ExamCity2)
                {
                    return BadRequest(new { success = false, message = "1st and 2nd Exam City preferences cannot be the same." });
                }

                if (string.IsNullOrWhiteSpace(dto.GraduationCourse) || dto.GraduationCourse == "Select")
                {
                    return BadRequest(new { success = false, message = "Graduation Course (स्नातक परीक्षा का नाम) is required." });
                }

                if (string.IsNullOrWhiteSpace(dto.GraduationUniversity) || dto.GraduationUniversity == "Select")
                {
                    return BadRequest(new { success = false, message = "University Name (विश्वविद्यालय का नाम) is required." });
                }

                if (string.IsNullOrWhiteSpace(dto.GraduationDate))
                {
                    return BadRequest(new { success = false, message = "Graduation passing/completion date (स्नातक योग्यता प्राप्त करने की तिथि) is required." });
                }
                else
                {
                    if (DateTime.TryParse(dto.GraduationDate, out DateTime gradDate))
                    {
                        DateTime maxAllowedGradDate = new DateTime(2026, 10, 6);
                        if (gradDate.Date > maxAllowedGradDate)
                        {
                            return BadRequest(new { success = false, message = "Graduation completion date cannot be later than 06/10/2026 (स्नातक योग्यता प्राप्त करने की तिथि 06/10/2026 से अधिक नहीं हो सकती)." });
                        }
                    }
                }

                if (dto.IsPhysicallyHandicapped)
                {
                    if (string.IsNullOrWhiteSpace(dto.DisabilityType) || dto.DisabilityType == "Select" || dto.DisabilityType == "--Not Applicable--")
                    {
                        return BadRequest(new { success = false, message = "Disability Type (दिव्यांगता का प्रकार) is required when PH is YES." });
                    }
                    if (dto.DisabilityType == "Multi")
                    {
                        var multiItems = string.IsNullOrWhiteSpace(dto.MultiDisabilityType)
                            ? Array.Empty<string>()
                            : dto.MultiDisabilityType.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                        if (multiItems.Length < 2)
                        {
                            return BadRequest(new { success = false, message = "Please select two or more PH Types for Multi (Add two or more mentioned above)." });
                        }
                    }
                }

                if (string.IsNullOrWhiteSpace(dto.PinCode) || dto.PinCode.Trim().Length != 6 || !System.Text.RegularExpressions.Regex.IsMatch(dto.PinCode.Trim(), @"^\d{6}$"))
                {
                    return BadRequest(new { success = false, message = "Please enter a valid 6-digit PIN Code (पिन कोड 6 अंकों का होना चाहिए)." });
                }

                var idProofError = ValidateIdentityProof(dto.IdentityProof, dto.IdentityProofNo);
                if (idProofError != null)
                {
                    return BadRequest(new { success = false, message = idProofError });
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    return NotFound(new { success = false, message = "User not found." });
                }

                // Check if user has confirmed the application or payment is completed
                bool isLocked = await _context.UserStepProgresses
                    .AnyAsync(s => s.UserId == dto.UserId && s.StepNumber >= 4);

                if ((isLocked || isPaymentCompleted) && !(isCorrectionWindowOpen && isPaymentCompleted))
                {
                    return BadRequest(new { success = false, message = "Application is confirmed and locked. Edits are not allowed." });
                }

                var personal = await _context.UserPersonalDetails.FirstOrDefaultAsync(p => p.UserId == dto.UserId);
                bool isNew = false;
                if (personal == null)
                {
                    personal = new UserPersonalDetails();
                    personal.UserId = dto.UserId;
                    isNew = true;
                }

                if (isCorrectionWindowOpen && isPaymentCompleted && !isNew)
                {
                    if (personal.Category != dto.Category)
                    {
                        return BadRequest(new { success = false, message = "Category cannot be changed from the backend during correction mode." });
                    }
                    if (personal.ExamTypeId != dto.ExamTypeId)
                    {
                        return BadRequest(new { success = false, message = "Apply For (Exam Type) cannot be changed from the backend during correction mode." });
                    }
                    if (personal.IsPhysicallyHandicapped != dto.IsPhysicallyHandicapped)
                    {
                        return BadRequest(new { success = false, message = "PH status cannot be changed from the backend during correction mode." });
                    }
                    if (personal.SubCategory != dto.SubCategory)
                    {
                        return BadRequest(new { success = false, message = "Sub Category cannot be changed from the backend during correction mode." });
                    }
                    
                }

                // Log step progress in the tracking table
                int stepNum = completedStep;
                if (stepNum > 0)
                {
                    bool stepExists = await _context.UserStepProgresses
                        .AnyAsync(s => s.UserId == dto.UserId && s.StepNumber == stepNum);
                    if (!stepExists)
                    {
                        var progress = new UserStepProgress
                        {
                            UserId = dto.UserId,
                            StepNumber = stepNum,
                            CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                        };
                        _context.UserStepProgresses.Add(progress);
                    }
                }

                // Map DTO to Model, taking ApplicantName from the Users table as requested
                string appliedCat = dto.AppliedCategory ?? "";
                bool isScienceCat = appliedCat.Contains("1") || (appliedCat.Contains("विज्ञान") && !appliedCat.Contains("विज्ञानेत्तर"));
                bool isScStCat = !string.IsNullOrEmpty(dto.Category) &&
                                 (dto.Category.ToUpper().Contains("SC") ||
                                  dto.Category.ToUpper().Contains("ST") ||
                                  dto.Category.ToUpper().Contains("SCHEDULED CASTE") ||
                                  dto.Category.ToUpper().Contains("SCHEDULED TRIBE"));

                int resolvedExamTypeId = 1;
                if (isScienceCat)
                {
                    if (dto.IsPhysicallyHandicapped) resolvedExamTypeId = 3;
                    else if (isScStCat) resolvedExamTypeId = 2;
                    else resolvedExamTypeId = 1;
                }
                else
                {
                    if (dto.IsPhysicallyHandicapped) resolvedExamTypeId = 6;
                    else if (isScStCat) resolvedExamTypeId = 5;
                    else resolvedExamTypeId = 4;
                }

                personal.ExamTypeId = resolvedExamTypeId;
                personal.AppliedCategory = dto.AppliedCategory;
                personal.GraduationCourse = dto.GraduationCourse;
                personal.GraduationUniversity = dto.GraduationUniversity;
                personal.GraduationDate = dto.GraduationDate;
                personal.Gender = dto.Gender;
                personal.DOB = dto.DOB;
                personal.MotherName = dto.MotherName;
                personal.HusbandName = isFemale ? (string.IsNullOrWhiteSpace(dto.HusbandName) ? null : dto.HusbandName.Trim()) : null;
                personal.Category = dto.Category;
                personal.SubCategory = dto.SubCategory;
                personal.RetirementDate = dto.RetirementDate;
                
                bool isSportsCat = dto.SubCategory != null && dto.SubCategory.ToUpper().Contains("SPORTS");
                personal.SportsType = isSportsCat ? dto.SportsType : null;

                personal.IsPhysicallyHandicapped = dto.IsPhysicallyHandicapped;
                personal.DisabilityType = dto.IsPhysicallyHandicapped ? dto.DisabilityType : null;
                personal.MultiDisabilityType = (dto.IsPhysicallyHandicapped && dto.DisabilityType == "Multi") ? dto.MultiDisabilityType : null;
                personal.ScribeRequired = dto.IsPhysicallyHandicapped && dto.ScribeRequired;
                personal.ExamCity1 = dto.ExamCity1;
                personal.ExamCity2 = dto.ExamCity2;
                personal.MailingAddress = dto.MailingAddress;
                personal.StateId = dto.StateId;
                personal.District = dto.District;
                personal.PinCode = dto.PinCode;
                personal.IdentityProof = dto.IdentityProof;
                personal.IdentityProofNo = dto.IdentityProofNo;

                if (isNew)
                {
                    personal.CreatedOn = DELED.Helpers.TimeHelper.GetIST();
                    _context.UserPersonalDetails.Add(personal);
                }
                else
                {
                    personal.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                    _context.UserPersonalDetails.Update(personal);
                }

                await _context.SaveChangesAsync();
                return Ok(new { success = true, message = "Personal details saved successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        private int ComputeLevenshteinDistance(string s, string t)
        {
            if (string.IsNullOrEmpty(s)) return string.IsNullOrEmpty(t) ? 0 : t.Length;
            if (string.IsNullOrEmpty(t)) return s.Length;

            s = s.ToUpper().Trim();
            t = t.ToUpper().Trim();

            int n = s.Length;
            int m = t.Length;
            int[,] d = new int[n + 1, m + 1];

            for (int i = 0; i <= n; d[i, 0] = i++) { }
            for (int j = 0; j <= m; d[0, j] = j++) { }

            for (int i = 1; i <= n; i++)
            {
                for (int j = 1; j <= m; j++)
                {
                    int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                    d[i, j] = Math.Min(
                        Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                        d[i - 1, j - 1] + cost);
                }
            }
            return d[n, m];
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

        private int GetUserIdFromToken()
        {
            var nameClaim = User.Identity?.Name;
            if (string.IsNullOrEmpty(nameClaim) || !int.TryParse(nameClaim, out int userId))
            {
                throw new System.UnauthorizedAccessException("Invalid user identity in token.");
            }
            return userId;
        }

        // PATCH: api/UserPersonalDetails/correction-window
        [HttpPatch("correction-window")]
        public async Task<IActionResult> CorrectionWindow([FromBody] CorrectionWindowDto dto)
        {
            return Ok(new { success = true, message = "Correction window details received successfully." });
        }
    }
}
