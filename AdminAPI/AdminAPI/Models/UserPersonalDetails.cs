using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DELED.Models
{
    public class UserPersonalDetails
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int PersonalDetailId { get; set; }

        public int UserId { get; set; }

        public int ExamTypeId { get; set; }

        public string? AppliedCategory { get; set; }

        public string? GraduationCourse { get; set; }

        public string? GraduationUniversity { get; set; }

        public string? GraduationDate { get; set; }

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

        public int ExamCity1 { get; set; } 

        public int ExamCity2 { get; set; } 

        public string MailingAddress { get; set; } = "";

        public int StateId { get; set; }

        public int District { get; set; }

        public string PinCode { get; set; } = "";

        public string IdentityProof { get; set; } = "";

        public string IdentityProofNo { get; set; } = "";

        public DateTime CreatedOn { get; set; } = DateTime.Now;

        public DateTime? UpdatedOn { get; set; }

        public bool IsActive { get; set; } = true;
    }
}