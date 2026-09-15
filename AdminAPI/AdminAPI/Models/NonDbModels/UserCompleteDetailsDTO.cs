using System;

namespace DELED.Models.NonDbModels
{
    public class UserCompleteDetailsDTO
    {
        // User Registration Details
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string FatherName { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public string Email { get; set; } = "";
        public DateTime CreatedOn { get; set; }
        public bool IsOTPVerified { get; set; }
        public string RegistrationNo { get; set; } = "";

        // User Personal Details (Mapped to the 29 target columns)
        public int? PersonalDetailId { get; set; }
        public int? ExamTypeId { get; set; }
        public string ApplicationFor { get; set; } = "";
        public string? AppliedCategory { get; set; }
        public string? GraduationCourse { get; set; }
        public string? GraduationUniversity { get; set; }
        public string? GraduationDate { get; set; }
        public string ApplicantName { get; set; } = "";
        public string Gender { get; set; } = "";
        public DateTime? DOB { get; set; }
        public string MotherName { get; set; } = "";
        public string? HusbandName { get; set; }
        public string Category { get; set; } = "";
        public string SubCategory { get; set; } = "";
        public DateTime? RetirementDate { get; set; }
        public string? SportsType { get; set; }
        public bool IsPhysicallyHandicapped { get; set; }
        public string? DisabilityType { get; set; }
        public string? MultiDisabilityType { get; set; }
        public bool ScribeRequired { get; set; }
        public string ExamCity1 { get; set; } = "";
        public string ExamCity2 { get; set; } = "";
        public string MailingAddress { get; set; } = "";
        public int StateId { get; set; }
        public string State { get; set; } = "";
        public int DistrictId { get; set; }
        public string District { get; set; } = "";
        public string PinCode { get; set; } = "";
        public string IdentityProof { get; set; } = "";
        public string IdentityProofNo { get; set; } = "";
        public DateTime? PersonalDetailsCreatedOn { get; set; }
        public DateTime? PersonalDetailsUpdatedOn { get; set; }
        public bool PersonalDetailsIsActive { get; set; }
        public int CompletedStep { get; set; }
        public bool IsPaymentCompleted { get; set; }
        public DateTime? PaymentDate { get; set; }

        public string? TransactionId { get; set; }
        public DateTime? TransactionDate { get; set; }
        public decimal? TransactionAmount { get; set; }
        public string? TransactionStatus { get; set; }
    }
}
