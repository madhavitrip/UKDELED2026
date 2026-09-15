using DELED.Data;
using DELED.Models.NonDbModels;
using DELED.Models;
using DELED.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace DELED.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PaymentController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAtomPaymentService _paymentService;
        private readonly IConfiguration _configuration;
        private readonly EmailService _emailService;
        private readonly ILogger<PaymentController> _logger;
        private readonly DatabaseLoggerService _databaseLogger;

        public PaymentController(
            AppDbContext context,
            IAtomPaymentService paymentService,
            IConfiguration configuration,
            EmailService emailService,
            ILogger<PaymentController> logger,
            DatabaseLoggerService databaseLogger)
        {
            _context = context;
            _paymentService = paymentService;
            _configuration = configuration;
            _emailService = emailService;
            _logger = logger;
            _databaseLogger = databaseLogger;
        }


        [Authorize]
        [HttpPost("initiate")]
        public async Task<IActionResult> Initiate([FromBody] PaymentRequestDto dto)
        {
            try
            {
                var feeTimeline = await _context.RegistrationTimelines.FirstOrDefaultAsync(t => t.Key == "fee");
                if (feeTimeline != null && DateTime.TryParse($"{feeTimeline.DateValue} 23:59:59", out DateTime feeParsedDate))
                {
                    if (DELED.Helpers.TimeHelper.GetIST() >= feeParsedDate)
                    {
                        return BadRequest(new { success = false, message = "Last date for fee payment has passed. No payments can be initiated." });
                    }
                }

                int regId = GetUserIdFromToken();
                if (regId <= 0)
                {
                    return BadRequest(new { success = false, message = "Valid Registration ID is required." });
                }

                // Query user registration to get Email and Phone
                var user = await _context.Users.FindAsync(regId);
                if (user == null)
                {
                    return NotFound(new { success = false, message = "User not found." });
                }

                // ✅ PREVENT DUPLICATE PAYMENT: Check if payment already completed
                if (user.IsPaymentCompleted)
                {
                    return BadRequest(new { success = false, message = "Your payment has already been completed. Multiple payments are not allowed. You can proceed to submit your application.", alreadyPaid = true, isPaymentCompleted = true });
                }

                // Check if any transaction for this user is already SUCCESS
                var successTxn = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.UserId == regId && t.Status == "SUCCESS");
                if (successTxn != null)
                {
                    if (!user.IsPaymentCompleted)
                    {
                        user.IsPaymentCompleted = true;
                        user.PaymentDate = successTxn.UpdatedOn ?? DELED.Helpers.TimeHelper.GetIST();
                        _context.Users.Update(user);

                        bool stepExists = await _context.UserStepProgresses
                            .AnyAsync(s => s.UserId == regId && s.StepNumber == 4);
                        if (!stepExists)
                        {
                            _context.UserStepProgresses.Add(new UserStepProgress
                            {
                                UserId = regId,
                                StepNumber = 4,
                                CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                            });
                        }

                        await _context.SaveChangesAsync();
                    }

                    return BadRequest(new
                    {
                        success = false,
                        message = "Your payment transaction is successful. Multiple payments are not allowed. You can proceed to submit your application.",
                        alreadyPaid = true,
                        isPaymentCompleted = true
                    });
                }

                // Check any pending transactions via Requery to ensure user didn't just complete payment
                var pendingTxns = await _context.PaymentTransactions
                    .Where(t => t.UserId == regId && t.Status == "PENDING")
                    .ToListAsync();
                foreach (var pTxn in pendingTxns)
                {
                    try
                    {
                        string dateStr = pTxn.CreatedOn.ToString("yyyy-MM-dd");
                        var requeryResult = await _paymentService.RequeryPayment(pTxn.MerchantTxnId, dateStr, pTxn.Amount);
                        if (requeryResult.isPaid)
                        {
                            pTxn.Status = "SUCCESS";
                            if (!string.IsNullOrEmpty(requeryResult.atomTxnId))
                            {
                                pTxn.AtomTxnId = requeryResult.atomTxnId;
                            }
                            pTxn.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                            _context.PaymentTransactions.Update(pTxn);

                            user.IsPaymentCompleted = true;
                            user.PaymentDate = DELED.Helpers.TimeHelper.GetIST();
                            _context.Users.Update(user);

                            bool stepExists = await _context.UserStepProgresses
                                .AnyAsync(s => s.UserId == regId && s.StepNumber == 4);
                            if (!stepExists)
                            {
                                _context.UserStepProgresses.Add(new UserStepProgress
                                {
                                    UserId = regId,
                                    StepNumber = 4,
                                    CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                                });
                            }

                            await _context.SaveChangesAsync();

                            return BadRequest(new
                            {
                                success = false,
                                message = "Your payment transaction is successful. Multiple payments are not allowed. You can proceed to submit your application.",
                                alreadyPaid = true,
                                isPaymentCompleted = true
                            });
                        }
                    }
                    catch (Exception reqEx)
                    {
                        _logger.LogWarning("Initiate: Requery check on pending txn failed: {Message}", reqEx.Message);
                    }
                }

                // Validate email and phone
                if (string.IsNullOrEmpty(user.Email) || string.IsNullOrEmpty(user.PhoneNumber))
                {
                    return BadRequest(new { success = false, message = "User email and phone number are required." });
                }

                // Query personal details to get ExamTypeId
                var personal = await _context.UserPersonalDetails.FirstOrDefaultAsync(p => p.UserId == regId);
                if (personal == null)
                {
                    return BadRequest(new { success = false, message = "Personal details not found for this candidate." });
                }

                // Get exam type fee
                var examType = await _context.ExamTypes.FindAsync(personal.ExamTypeId);
                if (examType == null)
                {
                    return BadRequest(new { success = false, message = "Exam type fee details not found." });
                }

                // Calculate total amount = examType fee
                decimal totalAmount = (decimal)examType.Payment;

                var token = await _paymentService.GenerateToken(
                    regId,
                    totalAmount,
                    user.Email,
                    user.PhoneNumber);

                return Ok(new
                {
                    success = true,
                    atomTokenId = token,
                    merchantId = _configuration["NTTData:MerchantId"]
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpPost("callback")]
        public async Task<IActionResult> Callback()
        {
            try
            {
                var form = await Request.ReadFormAsync();
                var encData = form.ContainsKey("encData") ? form["encData"].ToString() : (form.ContainsKey("encdata") ? form["encdata"].ToString() : "");

                if (string.IsNullOrEmpty(encData))
                {
                    return BadRequest("Missing encData in NTT Data callback.");
                }

                // Decrypt the NTT response
                string decryptedResponse = _paymentService.Decrypt(encData);

                // Parse response JSON
                var responseObj = Newtonsoft.Json.JsonConvert.DeserializeObject<dynamic>(decryptedResponse);

                // Extract values with null safety
                string statusCode = responseObj?.payInstrument?.responseDetails?.statusCode?.ToString() ?? "";
                string statusMessage = responseObj?.payInstrument?.responseDetails?.message?.ToString() ?? "";
                string atomTxnId = responseObj?.payInstrument?.payDetails?.atomTxnId?.ToString() ?? "";
                string bankTxnId = responseObj?.payInstrument?.payDetails?.bankTxnId?.ToString() ?? "";
                string amountStr = responseObj?.payInstrument?.payDetails?.amount?.ToString() ?? "0";
                decimal.TryParse(amountStr, out decimal amount);

                string merchantTxnId = responseObj?.payInstrument?.merchDetails?.merchTxnId?.ToString() ?? "";
                string merchTxnDate = responseObj?.payInstrument?.merchDetails?.merchTxnDate?.ToString() ?? "";

                if (string.IsNullOrEmpty(merchantTxnId))
                {
                    return BadRequest("Missing merchantTxnId in callback response.");
                }

                // Find transaction in the DB
                var transaction = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.MerchantTxnId == merchantTxnId);

                bool isPaymentValid = false;

                if (transaction != null)
                {
                    if (transaction.Status == "SUCCESS")
                    {
                        if (string.IsNullOrEmpty(transaction.ResponseJson) || transaction.ResponseJson == "{}")
                        {
                            transaction.ResponseJson = decryptedResponse;
                            transaction.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                            _context.PaymentTransactions.Update(transaction);
                            await _context.SaveChangesAsync();
                        }
                        isPaymentValid = true;
                    }
                    else
                    {
                        transaction.AtomTxnId = atomTxnId;
                        transaction.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                        transaction.ResponseJson = decryptedResponse;
                        transaction.Amount = amount;

                        // Check if payment was successful from NTT response
                        bool paymentSuccessful = statusCode == "OTS0000" || statusCode == "OTS0002";

                        if (paymentSuccessful)
                        {
                            isPaymentValid = true;
                            transaction.Status = "SUCCESS";

                            try
                            {
                                string requeryDate = !string.IsNullOrEmpty(merchTxnDate)
                                    ? merchTxnDate
                                    : transaction.CreatedOn.ToString("yyyy-MM-dd HH:mm:ss");
                                var reqResult1 = await _paymentService.RequeryPayment(merchantTxnId, requeryDate, amount);
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Callback Requery warning: {ex.Message}");
                            }
                        }
                        else
                        {
                            transaction.Status = "FAILED";
                        }

                        // Update transaction status based on validation result
                        _context.PaymentTransactions.Update(transaction);
                        await _context.SaveChangesAsync();

                        // If payment is valid, update user registration and create payment record
                        if (isPaymentValid)
                        {
                            // Mark Registration Paid
                            var user = await _context.Users.FindAsync(transaction.UserId);
                            if (user != null)
                            {
                                user.IsPaymentCompleted = true;
                                user.PaymentDate = DELED.Helpers.TimeHelper.GetIST();
                                _context.Users.Update(user);
                            }
                          
                            // Save progress step
                            bool stepExists = await _context.UserStepProgresses
                                .AnyAsync(s => s.UserId == transaction.UserId && s.StepNumber == 4);
                            if (!stepExists)
                            {
                                var progress = new UserStepProgress
                                {
                                    UserId = transaction.UserId,
                                    StepNumber = 4,
                                    CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                                };
                                _context.UserStepProgresses.Add(progress);
                            }

                            await _context.SaveChangesAsync();
                            SendPaymentSuccessEmail(transaction.UserId, amount, merchantTxnId, atomTxnId);
                        }
                    }
                }

                // Redirect to UI page with payment outcome
                string redirectBase = (_configuration["NTTData:FrontendReturnUrl"] ?? "http://localhost:3000").TrimEnd('/');
                string redirectUrl = $"{redirectBase}/registration-form?step=4&status={(isPaymentValid ? "SUCCESS" : "FAILED")}&txnId={merchantTxnId}";

                return Redirect(redirectUrl);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Callback processing error: {ex.Message}");
            }
        }

        [HttpPost]
        [Route("response")]
        public async Task<IActionResult> PaymentResponse()
        {
            try
            {
                Console.WriteLine("Response received");
                var form = Request.Form;
                foreach (var key in form.Keys)
                {
                    Console.WriteLine($"FORM {key} = {form[key]}");
                }
                string encdata = form.ContainsKey("encData") ? form["encData"].ToString() : (form.ContainsKey("encdata") ? form["encdata"].ToString() : "");
                Console.WriteLine("ENC DATA:");
                Console.WriteLine(encdata);
                if (string.IsNullOrEmpty(encdata))
                    return BadRequest("Missing encdata");

                string decryptedJson = _paymentService.Decrypt(encdata);
                var result = Newtonsoft.Json.JsonConvert.DeserializeObject<dynamic>(decryptedJson);
                Console.WriteLine("===== DECRYPTED CALLBACK =====");
                Console.WriteLine(decryptedJson);
                string statusCode = result?.payInstrument?.responseDetails?.statusCode?.ToString() ?? "";
                string message = result?.payInstrument?.responseDetails?.message?.ToString() ?? "";
                string description = result?.payInstrument?.responseDetails?.description?.ToString() ?? "";
                string atomTxnId = result?.payInstrument?.payDetails?.atomTxnId?.ToString() ?? "";
                string amountStr = result?.payInstrument?.payDetails?.amount?.ToString() ?? "0";
                decimal.TryParse(amountStr, out decimal amount);
                string merchantTxnId = result?.payInstrument?.merchDetails?.merchTxnId?.ToString() ?? "";
                string merchTxnDate = result?.payInstrument?.merchDetails?.merchTxnDate?.ToString() ?? "";

                if (string.IsNullOrEmpty(merchantTxnId))
                    return BadRequest("Missing merchantTxnId in callback response.");

                // Find transaction in the DB
                var transaction = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.MerchantTxnId == merchantTxnId);

                bool isPaymentValid = false;

                if (transaction != null)
                {
                    if (transaction.Status == "SUCCESS")
                    {
                        Console.WriteLine("Transaction already marked as SUCCESS.");
                        if (string.IsNullOrEmpty(transaction.ResponseJson) || transaction.ResponseJson == "{}")
                        {
                            transaction.ResponseJson = decryptedJson;
                            transaction.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                            _context.PaymentTransactions.Update(transaction);
                            await _context.SaveChangesAsync();
                        }
                        return Ok("Already processed");
                    }

                    transaction.AtomTxnId = atomTxnId;
                    transaction.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                    transaction.ResponseJson = decryptedJson;
                    transaction.Amount = amount;

                    // Check if payment was successful from NTT response (OTS0000 = success, OTS0002 = force success)
                    if (statusCode == "OTS0000" || statusCode == "OTS0002")
                    {
                        Console.WriteLine("NTT response received success statusCode: " + statusCode);
                        isPaymentValid = true;
                        transaction.Status = "SUCCESS";

                        try
                        {
                            string requeryDate = !string.IsNullOrEmpty(merchTxnDate)
                                ? merchTxnDate
                                : transaction.CreatedOn.ToString("yyyy-MM-dd HH:mm:ss");

                            var reqResult2 = await _paymentService.RequeryPayment(
                                merchantTxnId,
                                requeryDate,
                                amount);

                            Console.WriteLine($"Requery Result = {reqResult2.isPaid}");
                        }
                        catch (Exception reqEx)
                        {
                            Console.WriteLine($"PaymentResponse Requery warning: {reqEx.Message}");
                        }
                    }
                    else
                    {
                        transaction.Status = "FAILED";
                    }
                    // Update transaction status based on validation result
                    _context.PaymentTransactions.Update(transaction);
                    await _context.SaveChangesAsync();

                    // If payment is valid, update user registration and create payment record
                    if (isPaymentValid)
                    {
                        // Mark Registration Paid
                        var user = await _context.Users.FindAsync(transaction.UserId);
                        if (user != null)
                        {
                            user.IsPaymentCompleted = true;
                            user.PaymentDate = DELED.Helpers.TimeHelper.GetIST();
                            _context.Users.Update(user);
                        }

                        // Save progress step
                        bool stepExists = await _context.UserStepProgresses
                            .AnyAsync(s => s.UserId == transaction.UserId && s.StepNumber == 4);
                        if (!stepExists)
                        {
                            var progress = new UserStepProgress
                            {
                                UserId = transaction.UserId,
                                StepNumber = 4,
                                CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                            };
                            _context.UserStepProgresses.Add(progress);
                        }

                        await _context.SaveChangesAsync();
                        SendPaymentSuccessEmail(transaction.UserId, amount, merchantTxnId, atomTxnId);
                    }
                }

                // Redirect to UI page with payment outcome
                string redirectBase = (_configuration["NTTData:FrontendReturnUrl"] ?? "http://localhost:3000").TrimEnd('/');
                string redirectUrl = $"{redirectBase}/registration-form?step=4&status={(isPaymentValid ? "SUCCESS" : "FAILED")}&txnId={merchantTxnId}";

                return Redirect(redirectUrl);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Payment response error: {ex.Message}");
            }
        }

        [Authorize]
        [HttpGet("check-status")]
        public async Task<IActionResult> CheckPaymentStatus()
        {
            int? parsedUserId = null;
            try
            {
                int userId = GetUserIdFromToken();
                parsedUserId = userId;

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    _logger.LogWarning("CheckPaymentStatus: User {UserId} not found", userId);
                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatus",
                        "User not found for payment status check",
                        userId.ToString(),
                        null,
                        "User lookup failed");
                    return NotFound(new { success = false, message = "User not found." });
                }

                if (user.IsPaymentCompleted)
                {
                    _logger.LogInformation("CheckPaymentStatus: Payment already completed for user {UserId}", userId);
                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatus",
                        "Payment already completed - returning success",
                        userId.ToString(),
                        null,
                        "User has already completed payment");
                    return Ok(new { success = true, isPaid = true });
                }

                var latestTxn = await _context.PaymentTransactions
                    .Where(t => t.UserId == userId)
                    .OrderByDescending(t => t.Id)
                    .FirstOrDefaultAsync();

                if (latestTxn != null)
                {
                    // Check local transaction status first
                    if (latestTxn.Status == "SUCCESS")
                    {
                        _logger.LogInformation("CheckPaymentStatus: Transaction already marked SUCCESS for user {UserId}, TxnId: {MerchantTxnId}",
                            userId, latestTxn.MerchantTxnId);

                        await _databaseLogger.LogPaymentEventAsync(
                            "CheckPaymentStatus",
                            "Transaction already marked SUCCESS",
                            userId.ToString(),
                            latestTxn.MerchantTxnId,
                            $"Amount: {latestTxn.Amount}, Status: SUCCESS");

                        user.IsPaymentCompleted = true;
                        user.PaymentDate = DELED.Helpers.TimeHelper.GetIST();
                        _context.Users.Update(user);
                        await _context.SaveChangesAsync();
                        return Ok(new { success = true, isPaid = true });
                    }

                    // Query Atom if status is PENDING
                    if (latestTxn.Status == "PENDING")
                    {
                        try
                        {
                            string dateStr = latestTxn.CreatedOn.ToString("yyyy-MM-dd");
                            var requeryResult = await _paymentService.RequeryPayment(latestTxn.MerchantTxnId, dateStr, latestTxn.Amount);

                            if (requeryResult.isPaid)
                            {
                                _logger.LogInformation("CheckPaymentStatus: Payment verified via requery for user {UserId}, TxnId: {MerchantTxnId}",
                                    userId, latestTxn.MerchantTxnId);

                                await _databaseLogger.LogPaymentEventAsync(
                                    "CheckPaymentStatus",
                                    "Requery successful - payment verified",
                                    userId.ToString(),
                                    latestTxn.MerchantTxnId,
                                    $"Amount: {latestTxn.Amount}, AtomTxnId: {latestTxn.AtomTxnId}");

                                if (!string.IsNullOrEmpty(requeryResult.atomTxnId))
                                {
                                    latestTxn.AtomTxnId = requeryResult.atomTxnId;
                                }

                                latestTxn.Status = "SUCCESS";
                                latestTxn.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                                _context.PaymentTransactions.Update(latestTxn);

                                user.IsPaymentCompleted = true;
                                user.PaymentDate = DELED.Helpers.TimeHelper.GetIST();
                                _context.Users.Update(user);

                                bool stepExists = await _context.UserStepProgresses
                                    .AnyAsync(s => s.UserId == userId && s.StepNumber == 4);
                                if (!stepExists)
                                {
                                    var progress = new UserStepProgress
                                    {
                                        UserId = userId,
                                        StepNumber = 4,
                                        CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                                    };
                                    _context.UserStepProgresses.Add(progress);
                                }

                                await _context.SaveChangesAsync();
                                return Ok(new { success = true, isPaid = true, message = "Payment verified and updated successfully." });
                            }
                            else
                            {
                                _logger.LogWarning("CheckPaymentStatus: Requery returned false for user {UserId}, TxnId: {MerchantTxnId}",
                                    userId, latestTxn.MerchantTxnId);

                                await _databaseLogger.LogPaymentEventAsync(
                                    "CheckPaymentStatus",
                                    "Payment still PENDING - requery failed or returned pending",
                                    userId.ToString(),
                                    latestTxn.MerchantTxnId,
                                    $"Amount: {latestTxn.Amount}, Status: PENDING");
                            }
                        }
                        catch (Exception requeryEx)
                        {
                            _logger.LogError(requeryEx, "CheckPaymentStatus: Requery failed for user {UserId}, TxnId: {MerchantTxnId}",
                                userId, latestTxn.MerchantTxnId);

                            await _databaseLogger.LogPaymentErrorAsync(
                                "CheckPaymentStatus",
                                $"Requery failed: {requeryEx.Message}",
                                userId.ToString(),
                                latestTxn.MerchantTxnId,
                                requeryEx.StackTrace,
                                500);
                        }
                    }
                    else
                    {
                        _logger.LogInformation("CheckPaymentStatus: Transaction status is {Status} for user {UserId}", latestTxn.Status, userId);
                        await _databaseLogger.LogPaymentEventAsync(
                            "CheckPaymentStatus",
                            "Transaction status checked",
                            userId.ToString(),
                            latestTxn.MerchantTxnId,
                            $"Amount: {latestTxn.Amount}, Status: {latestTxn.Status}");
                    }
                }
                else
                {
                    _logger.LogWarning("CheckPaymentStatus: No transaction found for user {UserId}", userId);
                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatus",
                        "No transaction found for user",
                        userId.ToString(),
                        null,
                        "User has no payment transactions");
                }

                return Ok(new { success = true, isPaid = user.IsPaymentCompleted });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CheckPaymentStatus: Error occurred. Message: {Message}", ex.Message);

                await _databaseLogger.LogPaymentErrorAsync(
                    "CheckPaymentStatus",
                    $"Unexpected error occurred: {ex.Message}",
                    parsedUserId?.ToString() ?? "Unknown",
                    null,
                    ex.StackTrace,
                    500);

                return StatusCode(500, new { success = false, message = $"Status check failed: {ex.Message}" });
            }
        }


        [Authorize]
        [HttpGet("check-status-advanced")]
        [HttpPost("check-status-advanced")]
        public async Task<IActionResult> CheckPaymentStatusAdvanced()
        {
            int? parsedUserId = null;
            try
            {
                int userId = GetUserIdFromToken();
                parsedUserId = userId;

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    _logger.LogWarning("CheckPaymentStatusAdvanced: User {UserId} not found", userId);
                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatusAdvanced",
                        "User not found for payment status check",
                        userId.ToString(),
                        null,
                        "User lookup failed");
                    return NotFound(new { success = false, message = "User not found." });
                }

                if (user.IsPaymentCompleted)
                {
                    _logger.LogInformation("CheckPaymentStatusAdvanced: User {UserId} payment already completed", userId);
                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatusAdvanced",
                        "Payment already completed - returning success",
                        userId.ToString(),
                        null,
                        "User has already completed payment");
                    return Ok(new { success = true, isPaid = true, message = "Payment already completed." });
                }

                var transactions = await _context.PaymentTransactions
                    .Where(t => t.UserId == userId)
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                if (!transactions.Any())
                {
                    _logger.LogWarning("CheckPaymentStatusAdvanced: No transaction found for user {UserId}", userId);
                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatusAdvanced",
                        "No transaction found for user",
                        userId.ToString(),
                        null,
                        "User has no payment transactions");
                    return NotFound(new { success = false, message = "No transaction found for this user." });
                }

                // Check if any transaction is ALREADY SUCCESS locally
                var successfulTxn = transactions.FirstOrDefault(t => t.Status == "SUCCESS");
                if (successfulTxn != null)
                {
                    _logger.LogInformation("CheckPaymentStatusAdvanced: Transaction already SUCCESS for user {UserId}, TxnId: {MerchantTxnId}",
                        userId, successfulTxn.MerchantTxnId);

                    if (!user.IsPaymentCompleted)
                    {
                        user.IsPaymentCompleted = true;
                        user.PaymentDate = successfulTxn.UpdatedOn ?? DELED.Helpers.TimeHelper.GetIST();
                        _context.Users.Update(user);

                        bool stepExists = await _context.UserStepProgresses
                            .AnyAsync(s => s.UserId == userId && s.StepNumber == 4);
                        if (!stepExists)
                        {
                            _context.UserStepProgresses.Add(new UserStepProgress
                            {
                                UserId = userId,
                                StepNumber = 4,
                                CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                            });
                        }

                        await _context.SaveChangesAsync();
                    }

                    await _databaseLogger.LogPaymentEventAsync(
                        "CheckPaymentStatusAdvanced",
                        "Transaction already marked SUCCESS",
                        userId.ToString(),
                        successfulTxn.MerchantTxnId,
                        $"Amount: {successfulTxn.Amount}, Status: SUCCESS");

                    return Ok(new
                    {
                        success = true,
                        isPaid = true,
                        message = "Payment verified successfully",
                        transactionId = successfulTxn.AtomTxnId,
                        amount = successfulTxn.Amount
                    });
                }

                // If no SUCCESS locally, check ALL PENDING transactions via Requery
                var pendingTxns = transactions.Where(t => t.Status == "PENDING").ToList();
                string debugAtomCode = "";
                string debugAtomMessage = "";
                var debugDetails = new System.Collections.Generic.List<object>();

                foreach (var pendingTxn in pendingTxns)
                {
                    string dateStr = pendingTxn.CreatedOn.ToString("yyyy-MM-dd");
                    _logger.LogInformation("CheckPaymentStatusAdvanced: Attempting requery for user {UserId}, TxnId: {MerchantTxnId}, Date: {Date}",
                        userId, pendingTxn.MerchantTxnId, dateStr);

                    try
                    {
                        var requeryResult = await _paymentService.RequeryPayment(pendingTxn.MerchantTxnId, dateStr, pendingTxn.Amount);
                        debugAtomCode = requeryResult.statusCode;
                        debugAtomMessage = requeryResult.message;

                        debugDetails.Add(new
                        {
                            txnId = pendingTxn.MerchantTxnId,
                            date = dateStr,
                            code = requeryResult.statusCode,
                            msg = requeryResult.message
                        });

                        if (requeryResult.isPaid)
                        {
                            _logger.LogInformation("CheckPaymentStatusAdvanced: Requery successful for user {UserId}, TxnId: {MerchantTxnId}",
                                userId, pendingTxn.MerchantTxnId);

                            await _databaseLogger.LogPaymentEventAsync(
                                "CheckPaymentStatusAdvanced",
                                "Requery successful - payment verified",
                                userId.ToString(),
                                pendingTxn.MerchantTxnId,
                                $"Amount: {pendingTxn.Amount}");

                            if (!string.IsNullOrEmpty(requeryResult.atomTxnId))
                            {
                                pendingTxn.AtomTxnId = requeryResult.atomTxnId;
                            }

                            pendingTxn.Status = "SUCCESS";
                            pendingTxn.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                            _context.PaymentTransactions.Update(pendingTxn);

                            user.IsPaymentCompleted = true;
                            user.PaymentDate = DELED.Helpers.TimeHelper.GetIST();
                            _context.Users.Update(user);

                            bool stepExists = await _context.UserStepProgresses
                                .AnyAsync(s => s.UserId == userId && s.StepNumber == 4);
                            if (!stepExists)
                            {
                                var progress = new UserStepProgress
                                {
                                    UserId = userId,
                                    StepNumber = 4,
                                    CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                                };
                                _context.UserStepProgresses.Add(progress);
                            }

                            await _context.SaveChangesAsync();

                            _logger.LogInformation("CheckPaymentStatusAdvanced: Payment verified and updated for user {UserId}", userId);

                            return Ok(new
                            {
                                success = true,
                                isPaid = true,
                                message = "Payment verified successfully",
                                transactionId = pendingTxn.AtomTxnId,
                                amount = pendingTxn.Amount
                            });
                        }
                        else
                        {
                            _logger.LogWarning("CheckPaymentStatusAdvanced: Requery returned false for user {UserId}, TxnId: {MerchantTxnId}",
                                userId, pendingTxn.MerchantTxnId);
                        }
                    }
                    catch (Exception requeryEx)
                    {
                        _logger.LogError(requeryEx, "CheckPaymentStatusAdvanced: Requery failed for user {UserId}, TxnId: {MerchantTxnId}, Error: {Message}",
                            userId, pendingTxn.MerchantTxnId, requeryEx.Message);
                    }
                }

                // If we reach here, ALL pending transactions failed the requery
                _logger.LogInformation("CheckPaymentStatusAdvanced: Returning PENDING status for user {UserId}", userId);

                await _databaseLogger.LogPaymentEventAsync(
                    "CheckPaymentStatusAdvanced",
                    "Payment still PENDING - requery failed for all pending transactions",
                    userId.ToString(),
                    null,
                    "Checked all pending transactions");

                return Ok(new
                {
                    success = true,
                    isPaid = false,
                    message = "Payment is still being verified. Please try again in a few moments.",
                    status = "PENDING",
                    debugAtomCode = debugAtomCode,
                    debugAtomMessage = debugAtomMessage,
                    debugHistory = debugDetails
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CheckPaymentStatusAdvanced: Unexpected error for user. Error: {Message}", ex.Message);

                await _databaseLogger.LogPaymentErrorAsync(
                    "CheckPaymentStatusAdvanced",
                    $"Unexpected error occurred: {ex.Message}",
                    parsedUserId?.ToString() ?? "Unknown",
                    null,
                    ex.StackTrace,
                    500);

                return StatusCode(500, new { success = false, message = $"Advanced status check failed: {ex.Message}" });
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

        [Authorize]
        [HttpPost("verify-success")]
        public async Task<IActionResult> VerifySuccessPayments([FromQuery] int hours = 96)
        {
            try
            {
                // Verify admin or just let it run (could restrict to admin role if needed)
                var timeThreshold = DELED.Helpers.TimeHelper.GetIST().AddHours(-hours);
                var successTxns = await _context.PaymentTransactions
                    .Where(t => t.Status == "SUCCESS" && t.CreatedOn >= timeThreshold)
                    .ToListAsync();

                if (!successTxns.Any())
                {
                    return Ok(new { success = true, message = "No successful transactions found to verify in the given timeframe.", count = 0 });
                }

                int verifiedCount = 0;
                int revertedCount = 0;
                var revertedDetails = new List<object>();

                foreach (var txn in successTxns)
                {
                    string dateStr = txn.CreatedOn.ToString("yyyy-MM-dd");
                    decimal amountToQuery = txn.Amount;

                    if (amountToQuery <= 0)
                    {
                        var personal = await _context.UserPersonalDetails.FirstOrDefaultAsync(p => p.UserId == txn.UserId);
                        if (personal != null)
                        {
                            var examType = await _context.ExamTypes.FindAsync(personal.ExamTypeId);
                            if (examType != null)
                            {
                                amountToQuery = (decimal)examType.Payment;
                            }
                        }
                    }

                    if (amountToQuery <= 0) continue;

                    var requeryResult = await _paymentService.RequeryPayment(txn.MerchantTxnId, dateStr, amountToQuery);

                    if (requeryResult.statusCode == "EXCEPTION" || requeryResult.statusCode == "HTTP_ERROR" || requeryResult.statusCode == "DECRYPT_ERROR" || requeryResult.statusCode == "UNKNOWN")
                    {
                        continue; // Skip on network/system errors
                    }

                    bool isConfirmedPaid = requeryResult.isPaid &&
                        (requeryResult.statusCode == "OTS0000" || requeryResult.statusCode == "OTS0002");

                    if (isConfirmedPaid)
                    {
                        verifiedCount++;
                    }
                    else
                    {
                        // REVERT to FAILED
                        txn.Status = "FAILED";
                        txn.UpdatedOn = DELED.Helpers.TimeHelper.GetIST();
                        _context.PaymentTransactions.Update(txn);

                        // Check if the user has any other successful transactions before reverting their status
                        bool hasOtherSuccess = await _context.PaymentTransactions
                            .AnyAsync(pt => pt.UserId == txn.UserId && pt.Status == "SUCCESS" && pt.Id != txn.Id);

                        if (!hasOtherSuccess)
                        {
                            var user = await _context.Users.FindAsync(txn.UserId);
                            if (user != null)
                            {
                                user.IsPaymentCompleted = false;
                                user.PaymentDate = null;
                                _context.Users.Update(user);
                            }
                        }

                        var payment = await _context.PaymentTransactions
                            .FirstOrDefaultAsync(p => p.UserId == txn.UserId && p.AtomTxnId == (txn.AtomTxnId ?? "REQUERY_AUTO"));

                        if (payment != null)
                        {
                            payment.Status = "FAILED";
                            _context.PaymentTransactions.Update(payment);
                        }
                        else
                        {
                            var fallbackPayment = await _context.PaymentTransactions
                                .FirstOrDefaultAsync(p => p.UserId == txn.UserId && p.Status == "SUCCESS");
                            if (fallbackPayment != null)
                            {
                                fallbackPayment.Status = "FAILED";
                                _context.PaymentTransactions.Update(fallbackPayment);
                            }
                        }

                        revertedCount++;
                        revertedDetails.Add(new { userId = txn.UserId, txnId = txn.MerchantTxnId, atomStatusCode = requeryResult.statusCode });
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Verification completed.",
                    totalChecked = successTxns.Count,
                    verifiedCount = verifiedCount,
                    revertedCount = revertedCount,
                    revertedTransactions = revertedDetails
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error verifying payments: {ex.Message}" });
            }
        }

        /// <summary>
        /// Sends payment success email to user
        /// </summary>
        private void SendPaymentSuccessEmail(int userId, decimal amount, string transactionId, string atomTxnId)
        {
            try
            {
                var user = _context.Users.FirstOrDefault(u => u.UserId == userId);
                if (user == null || string.IsNullOrEmpty(user.Email))
                {
                    Console.WriteLine($"[Email Warning] User {userId} not found or email not available for payment success notification.");
                    return;
                }

                string candidateName = user.FullName ?? "Candidate";
                string registrationNo = user.RegistrationNo ?? userId.ToString();
                var applicationUrl = _configuration["AppSettings:FrontendUrl"];
                // Build email subject
                string subject = "🎉 Payment Successful - UKDELED 2026 Application";

                // Build email body with professional HTML template
                string body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #0c5a30 0%, #127a43 100%); color: white; padding: 30px 20px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 28px; font-weight: bold; }}
        .content {{ padding: 30px 20px; }}
        .success-badge {{ display: inline-block; background: #4caf50; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; margin: 15px 0; }}
        .details {{ background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0c5a30; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }}
        .detail-row:last-child {{ border-bottom: none; }}
        .label {{ font-weight: bold; color: #333; }}
        .value {{ color: #0c5a30; font-weight: 600; }}
        .footer {{ background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0; }}
        .info-box {{ background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; border-radius: 4px; color: #1565c0; }}
        .button {{ display: inline-block; background: #0c5a30; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 15px 0; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <table style='width: 100%; border-collapse: collapse;'>
                <tr>
                    <td style='width: 70px; vertical-align: middle; text-align: left;'>
                        <img src='https://ukdeled.com/API/Logo/ubse_white.jpg' alt='Logo' style='width: 60px; height: 60px; border-radius: 50%; display: block;'>
                    </td>
                    <td style='vertical-align: middle; text-align: left; padding-left: 15px;'>
                        <h1 style='margin: 0; font-size: 24px; font-weight: bold;'>Payment Successful!</h1>
                        <p style='margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;'>UKDELED 2026 Application</p>
                    </td>
                </tr>
            </table>
        </div>
        <div class='content'>
            <p>Dear <strong>{candidateName}</strong>,</p>
            
            <div class='success-badge'>✓ Payment Confirmed</div>
            
            <p>We are pleased to confirm that your payment for UKDELED 2026 application has been successfully processed. Your application is now complete and locked for submission.</p>
            
            <div class='details'>
                <div class='detail-row'>
                    <span class='label'>Registration Number:</span>
                    <span class='value'>{registrationNo}</span>
                </div>
                <div class='detail-row'>
                    <span class='label'>Amount Paid:</span>
                    <span class='value'>₹ {amount:N2}</span>
                </div>
                <div class='detail-row'>
                    <span class='label'>Transaction ID:</span>
                    <span class='value'>{transactionId}</span>
                </div>
                <div class='detail-row'>
                    <span class='label'>Payment Reference:</span>
                    <span class='value'>{atomTxnId}</span>
                </div>
                <div class='detail-row'>
                    <span class='label'>Payment Date & Time:</span>
                    <span class='value'>{DELED.Helpers.TimeHelper.GetIST():dd MMM yyyy, hh:mm tt}</span>
                </div>
            </div>
            
            <div class='info-box'>
                <strong>📌 Important Information:</strong><br/>
                • Your application has been successfully submitted.<br/>
                • Keep this email for your records as proof of payment.<br/>
                • You will receive further updates regarding exam dates and admit card via email.<br/>
                • For any queries, contact: <a href='mailto:info@ukdeled.com' style='color: #1565c0;'>info@ukdeled.com</a>
            </div>
            
            <a href='{applicationUrl}' class='button'>View Your Application</a>
            
            <p>Thank you for registering with Uttarakhand Teacher Eligibility Test (UKDELED) 2026.<br/>
            We wish you all the best for the examination!</p>
            
            <p style='color: #999; font-size: 12px; margin-top: 20px;'>
                <strong>Uttarakhand Board of School Education</strong><br/>
                उत्तराखंड विद्यालयी शिक्षा परिषद्<br/>
                Ramnagar, Nainital
            </p>
        </div>
        <div class='footer'>
            <p>This is an automated email. Please do not reply to this email. For support, visit info@ukdeled.com</p>
            <p>&copy; 2026 UKDELED. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";

                // Send email
                _emailService.SendEmail(user.Email, subject, body);
                Console.WriteLine($"[Email Success] Payment confirmation email sent to {user.Email} for user {userId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Email Error] Failed to send payment success email for user {userId}: {ex.Message}");
                // Don't throw - email failure should not block payment processing
            }
        }
    }
}
