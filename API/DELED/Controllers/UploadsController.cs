using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using DELED.Data;
using DELED.Models;

namespace DELED.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UploadsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly string _baseStoragePath;

        public UploadsController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
            
            string configuredPath = _configuration["FilePath"];
            bool pathExists = false;
            try
            {
                if (!string.IsNullOrEmpty(configuredPath) && Directory.Exists(configuredPath))
                {
                    pathExists = true;
                }
            }
            catch
            {
                // Fallback to wwwroot if path is inaccessible
            }

            _baseStoragePath = pathExists ? configuredPath : Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }

        // GET: api/Uploads
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Uploads>>> GetUploadss()
        {
            return await _context.Uploads.ToListAsync();
        }

        // GET: api/Uploads/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Uploads>> GetUploads(int id)
        {
            var uploads = await _context.Uploads.FindAsync(id);

            if (uploads == null)
            {
                return NotFound();
            }

            return uploads;
        }


        // GET: api/Uploads/user
        [HttpGet("user")]
        public async Task<ActionResult<IEnumerable<Uploads>>> GetUploadsbyUser()
        {
            int id = GetUserIdFromToken();
            // Find uploads for a specific user by userId
            var uploads = await _context.Uploads
                                        .Where(u => u.UserId == id)
                                        .ToListAsync();

            if (uploads == null || !uploads.Any())
            {
                return NotFound();
            }

            return Ok(uploads);
        }


        // PUT: api/Uploads/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUploads(int id, Uploads uploads)
        {
            if (id != uploads.UploadId)
            {
                return BadRequest();
            }

            _context.Entry(uploads).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UploadsExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Uploads
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754

        [HttpPost]
        public async Task<ActionResult<Uploads>> PostUploads([FromForm] UploadsDto uploadsDto)
        {
            var feeTimeline = await _context.RegistrationTimelines.FirstOrDefaultAsync(t => t.Key == "fee");
            if (feeTimeline != null && DateTime.TryParse($"{feeTimeline.DateValue} 23:59:59", out DateTime feeParsedDate))
            {
                if (DELED.Helpers.TimeHelper.GetIST() >= feeParsedDate)
                {
                    return BadRequest("Last date for amendments has passed. No further uploads can be made.");
                }
            }
            int tokenUserId = GetUserIdFromToken();
            uploadsDto.UserId = tokenUserId;
            // Check lock status
            bool isLocked = await _context.UserStepProgresses
                .AnyAsync(s => s.UserId == tokenUserId && s.StepNumber >= 4);
                
            bool isPaymentCompleted = await _context.PaymentTransactions
                .AnyAsync(p => p.UserId == tokenUserId && p.Status == "SUCCESS");
                
            if (isLocked || isPaymentCompleted)
            {
                return BadRequest("Application is confirmed and locked. Uploads cannot be modified.");
            }

            var photoError = ValidateUpload(uploadsDto.Photo, "Photo", 5, 100, 140, 170);
            if (photoError != null)
            {
                return BadRequest(photoError);
            }

            var sigError = ValidateUpload(uploadsDto.Signature, "Signature", 2, 50, 180, 70);
            if (sigError != null)
            {
                return BadRequest(sigError);
            }

            var thumbError = ValidateUpload(uploadsDto.Thumb, "Thumb", 10, 150, 250, 150);
            if (thumbError != null)
            {
                return BadRequest(thumbError);
            }

            // Define relative file paths based on UserId
            var photoFileName = $"{uploadsDto.UserId}_PassportSizePhoto.jpg";
            var signatureFileName = $"{uploadsDto.UserId}_SignaturePhoto.jpg";
            var thumbFileName = $"{uploadsDto.UserId}_ThumbPhoto.jpg";
            
            var photoFilePath = Path.Combine("photos", photoFileName).Replace("\\", "/");
            var signatureFilePath = Path.Combine("signatures", signatureFileName).Replace("\\", "/");
            var thumbFilePath = Path.Combine("thumbs", thumbFileName).Replace("\\", "/");

            // Ensure the target directories exist
            var photosDirectory = Path.Combine(_baseStoragePath, "photos");
            if (!Directory.Exists(photosDirectory))
            {
                Directory.CreateDirectory(photosDirectory);
            }

            var signaturesDirectory = Path.Combine(_baseStoragePath, "signatures");
            if (!Directory.Exists(signaturesDirectory))
            {
                Directory.CreateDirectory(signaturesDirectory);
            }

            var thumbsDirectory = Path.Combine(_baseStoragePath, "thumbs");
            if (!Directory.Exists(thumbsDirectory))
            {
                Directory.CreateDirectory(thumbsDirectory);
            }

            // Define the full paths for saving files to the server
            var photoFullPath = Path.Combine(_baseStoragePath, photoFilePath);
            var signatureFullPath = Path.Combine(_baseStoragePath, signatureFilePath);
            var thumbFullPath = Path.Combine(_baseStoragePath, thumbFilePath);

            // Save the photo file to the server
            using (var stream = new FileStream(photoFullPath, FileMode.Create))
            {
                await uploadsDto.Photo.CopyToAsync(stream);
            }

            // Save the signature file to the server
            using (var stream = new FileStream(signatureFullPath, FileMode.Create))
            {
                await uploadsDto.Signature.CopyToAsync(stream);
            }

            // Save the thumb impression file to the server
            using (var stream = new FileStream(thumbFullPath, FileMode.Create))
            {
                await uploadsDto.Thumb.CopyToAsync(stream);
            }

            // Create the Uploads object with relative paths
            var uploads = new Uploads
            {
                UserId = uploadsDto.UserId,
                PhotoFile = photoFilePath,
                SignatureFile = signatureFilePath,
                ThumbImp = thumbFilePath
            };

            // Save to database
            _context.Uploads.Add(uploads);
            
            // Log step progress for Step 2
            bool stepExists = await _context.UserStepProgresses
                .AnyAsync(s => s.UserId == uploadsDto.UserId && s.StepNumber == 2);
            if (!stepExists)
            {
                var progress = new UserStepProgress
                {
                    UserId = uploadsDto.UserId,
                    StepNumber = 2,
                    CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                };
                _context.UserStepProgresses.Add(progress);
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction("GetUploads", new { id = uploads.UploadId }, uploads);
        }


        // PATCH: api/Uploads/user
        [HttpPatch("user")]
        public async Task<IActionResult> UpdateUploadsByUserId([FromForm] UploadsDto uploadsDto)
        {
            int userId = GetUserIdFromToken();
            uploadsDto.UserId = userId;
            // Check lock status
            bool isLocked = await _context.UserStepProgresses
                .AnyAsync(s => s.UserId == userId && s.StepNumber >= 4);
                
            bool isPaymentCompleted = await _context.PaymentTransactions
                .AnyAsync(p => p.UserId == userId && p.Status == "SUCCESS");
                
            if (isLocked || isPaymentCompleted)
            {
                return BadRequest("Application is confirmed and locked. Uploads cannot be modified.");
            }

            // Fetch existing uploads for the user
            var existingUploads = await _context.Uploads
                                                .Where(u => u.UserId == userId)
                                                .FirstOrDefaultAsync();

            if (existingUploads == null)
            {
                return NotFound("No uploads found for the specified user.");
            }

            if (uploadsDto.Photo != null)
            {
                var photoError = ValidateUpload(uploadsDto.Photo, "Photo", 5, 100, 140, 170);
                if (photoError != null)
                {
                    return BadRequest(photoError);
                }

                // Define the relative file path and full path for the new photo
                var photoFileName = $"{userId}_PassportSizePhoto.jpg";
                var photoFilePath = Path.Combine("photos", photoFileName).Replace("\\", "/");

                var photosDirectory = Path.Combine(_baseStoragePath, "photos");
                if (!Directory.Exists(photosDirectory))
                {
                    Directory.CreateDirectory(photosDirectory);
                }

                var photoFullPath = Path.Combine(_baseStoragePath, photoFilePath);

                // Save the new photo file to the server
                using (var stream = new FileStream(photoFullPath, FileMode.Create))
                {
                    await uploadsDto.Photo.CopyToAsync(stream);
                }

                // Update the photo path in the existing upload record
                existingUploads.PhotoFile = photoFilePath;
            }

            if (uploadsDto.Signature != null)
            {
                var sigError = ValidateUpload(uploadsDto.Signature, "Signature", 2, 50, 180, 70);
                if (sigError != null)
                {
                    return BadRequest(sigError);
                }

                // Define the relative file path and full path for the new signature
                var signatureFileName = $"{userId}_SignaturePhoto.jpg";
                var signatureFilePath = Path.Combine("signatures", signatureFileName).Replace("\\", "/");

                var signaturesDirectory = Path.Combine(_baseStoragePath, "signatures");
                if (!Directory.Exists(signaturesDirectory))
                {
                    Directory.CreateDirectory(signaturesDirectory);
                }

                var signatureFullPath = Path.Combine(_baseStoragePath, signatureFilePath);

                // Save the new signature file to the server
                using (var stream = new FileStream(signatureFullPath, FileMode.Create))
                {
                    await uploadsDto.Signature.CopyToAsync(stream);
                }

                // Update the signature path in the existing upload record
                existingUploads.SignatureFile = signatureFilePath;
            }

            if (uploadsDto.Thumb != null)
            {
                var thumbError = ValidateUpload(uploadsDto.Thumb, "Thumb", 10, 150, 250, 150);
                if (thumbError != null)
                {
                    return BadRequest(thumbError);
                }

                // Define the relative file path and full path for the new thumb impression
                var thumbFileName = $"{userId}_ThumbPhoto.jpg";
                var thumbFilePath = Path.Combine("thumbs", thumbFileName).Replace("\\", "/");

                var thumbsDirectory = Path.Combine(_baseStoragePath, "thumbs");
                if (!Directory.Exists(thumbsDirectory))
                {
                    Directory.CreateDirectory(thumbsDirectory);
                }

                var thumbFullPath = Path.Combine(_baseStoragePath, thumbFilePath);

                // Save the new thumb impression file to the server
                using (var stream = new FileStream(thumbFullPath, FileMode.Create))
                {
                    await uploadsDto.Thumb.CopyToAsync(stream);
                }

                // Update the thumb path in the existing upload record
                existingUploads.ThumbImp = thumbFilePath;
            }

            // Mark the existing uploads record as modified
            _context.Entry(existingUploads).State = EntityState.Modified;

            try
            {
                // Log step progress for Step 2
                bool stepExists = await _context.UserStepProgresses
                    .AnyAsync(s => s.UserId == userId && s.StepNumber == 2);
                if (!stepExists)
                {
                    var progress = new UserStepProgress
                    {
                        UserId = userId,
                        StepNumber = 2,
                        CompletedOn = DELED.Helpers.TimeHelper.GetIST()
                    };
                    _context.UserStepProgresses.Add(progress);
                }

                // Save changes to the database
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UploadsExists(existingUploads.UploadId))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }



        /*[HttpPost]
        public async Task<ActionResult<Uploads>> PostUploads(Uploads uploads)
        {
            _context.Uploadss.Add(uploads);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetUploads", new { id = uploads.UploadId }, uploads);
        }*/

        // DELETE: api/Uploads/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUploads(int id)
        {
            var uploads = await _context.Uploads.FindAsync(id);
            if (uploads == null)
            {
                return NotFound();
            }

            _context.Uploads.Remove(uploads);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Uploads/user
        [HttpDelete("user")]
        public async Task<IActionResult> DeleteUploadsByUserId()
        {
            int userId = GetUserIdFromToken();
            // Find all uploads for the specified userId
            var uploads = await _context.Uploads
                                        .Where(u => u.UserId == userId)
                                        .ToListAsync();

            if (uploads == null || !uploads.Any())
            {
                return NotFound();
            }

            _context.Uploads.RemoveRange(uploads);
            await _context.SaveChangesAsync();

            return NoContent();
        }


        private bool UploadsExists(int id)
        {
            return _context.Uploads.Any(e => e.UploadId == id);
        }

        private static (int width, int height) GetImageDimensions(byte[] bytes)
        {
            if (bytes.Length < 8)
            {
                throw new ArgumentException("Invalid image file size.");
            }

            // Check PNG: 89 50 4E 47
            if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            {
                if (bytes.Length < 24)
                {
                    throw new ArgumentException("PNG header is corrupted.");
                }
                int width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
                int height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
                return (width, height);
            }

            // Check JPEG: FF D8
            if (bytes[0] == 0xFF && bytes[1] == 0xD8)
            {
                int i = 2;
                while (i < bytes.Length - 1)
                {
                    if (bytes[i] != 0xFF)
                    {
                        i++;
                        continue;
                    }

                    // Skip padding 0xFFs
                    while (i < bytes.Length && bytes[i] == 0xFF)
                    {
                        i++;
                    }

                    if (i >= bytes.Length) break;

                    byte markerType = bytes[i];
                    i++;

                    if (markerType == 0xDA || markerType == 0xD9)
                    {
                        break;
                    }

                    if (markerType == 0xD8 || (markerType >= 0xD0 && markerType <= 0xD7))
                    {
                        continue;
                    }

                    if (i + 1 >= bytes.Length) break;
                    int len = (bytes[i] << 8) | bytes[i + 1];

                    bool isSof = (markerType >= 0xC0 && markerType <= 0xC3) || 
                                 (markerType >= 0xC5 && markerType <= 0xC7) ||
                                 (markerType >= 0xC9 && markerType <= 0xCB) ||
                                 (markerType >= 0xCD && markerType <= 0xCF);

                    if (isSof)
                    {
                        if (i + 6 >= bytes.Length)
                        {
                            throw new ArgumentException("JPEG SOF marker is corrupted.");
                        }
                        int height = (bytes[i + 3] << 8) | bytes[i + 4];
                        int width = (bytes[i + 5] << 8) | bytes[i + 6];
                        return (width, height);
                    }

                    i += len;
                }
                throw new ArgumentException("JPEG SOF marker not found.");
            }

            throw new ArgumentException("Unsupported image format. Only JPEG and PNG images are supported.");
        }

        private string ValidateUpload(IFormFile file, string fieldName, int minSizeKB, int maxSizeKB, int expectedWidth, int expectedHeight)
        {
            var ext = Path.GetExtension(file.FileName).ToLower();
            if (ext != ".jpg" && ext != ".jpeg")
            {
                return $"{fieldName}: Only .jpg / .jpeg files are allowed.";
            }

            var contentType = file.ContentType.ToLower();
            if (contentType != "image/jpeg" && contentType != "image/jpg" && contentType != "image/pjpeg")
            {
                 return $"{fieldName}: Only .jpg / .jpeg files are allowed.";
            }

            long fileSizeKB = file.Length / 1024;
            if (fileSizeKB < minSizeKB || fileSizeKB > maxSizeKB)
            {
                return $"{fieldName}: File size must be between {minSizeKB} KB and {maxSizeKB} KB. Current size: {fileSizeKB} KB.";
            }

            try
            {
                byte[] fileBytes;
                using (var ms = new MemoryStream())
                {
                    using (var stream = file.OpenReadStream())
                    {
                        stream.CopyTo(ms);
                    }
                    fileBytes = ms.ToArray();
                }

                var (width, height) = GetImageDimensions(fileBytes);
                
                // Allow ±10px tolerance just like the UI
                const int tolerance = 10;
                bool isWidthValid = Math.Abs(width - expectedWidth) <= tolerance;
                bool isHeightValid = Math.Abs(height - expectedHeight) <= tolerance;

                if (!isWidthValid || !isHeightValid)
                {
                    return $"{fieldName}: Image dimensions must be close to {expectedWidth}×{expectedHeight} pixels (allowed tolerance: ±10px). Current: {width}×{height} pixels.";
                }
            }
            catch (Exception ex)
            {
                return $"{fieldName}: Invalid or corrupted image. Detail: {ex.Message}";
            }

            return null;
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
    }

    public class UploadsDto
    {
        public int UserId { get; set; }

        public IFormFile? Photo { get; set; }

        public IFormFile? Signature { get; set; }

        public IFormFile? Thumb { get; set; }
    }

}
