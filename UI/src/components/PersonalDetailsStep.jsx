import React, { useState, useEffect, useMemo } from "react";
import { Select } from "antd";

export default function PersonalDetailsStep({
  formData,
  states = [],
  districtOptions = ["Select"],
  examCityOptions = ["Select"],
  handleInputChange,
  handleNext,
  isLocked,
  isCorrectionMode = false,
}) {
  const [errorMsg, setErrorMsg] = useState("");

  // Universities list
  const universityOptions = [
    "Select",
    "DEV BHOOMI UTTARAKHAND UNIVERSITY",
    "HEMWATI NANDAN BAHUGUNA GARHWAL UNIVERSITY",
    "KUMAUN UNIVERSITY, NAINITAL",
    "SRI DEV SUMAN UTTARAKHAND UNIVERSITY",
    "UTTARAKHAND OPEN UNIVERSITY",
    "DOON UNIVERSITY, DEHRADUN",
    "G. B. PANT UNIVERSITY OF AGRICULTURE AND TECHNOLOGY",
    "GURUKULA KANGRI VISHWAVIDYALAYA, HARIDWAR",
    "GRAPHIC ERA UNIVERSITY, DEHRADUN",
    "UTTARANCHAL UNIVERSITY, DEHRADUN",
    "DIT UNIVERSITY, DEHRADUN",
    "SWAMI RAMA HIMALAYAN UNIVERSITY",
    "HIMALAYAN GARHWAL UNIVERSITY",
    "CH. CHARAN SINGH UNIVERSITY, MEERUT",
    "M. J. P. ROHILKHAND UNIVERSITY, BAREILLY",
    "DELHI UNIVERSITY (DU)",
    "IGNOU (INDIRA GANDHI NATIONAL OPEN UNIVERSITY)",
    "OTHER RECOGNIZED UNIVERSITY (अन्य मान्यता प्राप्त विश्वविद्यालय)",
  ];

  // Graduation Course Options based on Applied Category (प्रशिक्षण हेतु आवेदित वर्ग)
  const isScienceGroup = (formData.appliedCategory || "").includes("1") ||
    ((formData.appliedCategory || "").includes("विज्ञान वर्ग") && !(formData.appliedCategory || "").includes("विज्ञानेत्तर"));

  const scienceGraduationCourses = [
    "Select",
    "Bachelor of Science (B.Sc.)",
    "Bachelor of Agriculture Science(B.Sc.Agri.)",
    "Graduate Other than B.Sc./B.Sc.Agri./B.A./B.Com. and Intermediate with Science / Agri. Science",
  ];

  const nonScienceGraduationCourses = [
    "Select",
    "Bachelor of Arts (B.A.)",
    "Bachelor of Commerce (B.Com.)",
    "Graduate Other than B.A./B.Com. and Intermediate with Humanities / Commerce",
  ];

  const graduationCourses = isScienceGroup ? scienceGraduationCourses : nonScienceGraduationCourses;

  const catUpper = (formData.category || "").toUpperCase();
  const isScStObc = catUpper.includes("SC") ||
    catUpper.includes("ST") ||
    catUpper.includes("OBC") ||
    catUpper.includes("SCHEDULED CASTE") ||
    catUpper.includes("SCHEDULED TRIBE") ||
    catUpper.includes("OTHER BACKWARD CLASS");
  const isPH = formData.phyHandicapped === "YES";

  const subCatUpper = (formData.subCategory || "").toUpperCase();
  const isExServiceman = subCatUpper.includes("EX-SERVICEMAN") ||
    subCatUpper.includes("EX SERVICEMAN") ||
    subCatUpper.includes("पूर्व सैनिक");
  const isDFF = subCatUpper.includes("DFF") || subCatUpper.includes("स्वतंत्रता");
  const isSports = subCatUpper.includes("SPORTS");

  let maxAllowedAge = 30;
  let relaxationText = "";
  if (isPH && (isScStObc || isDFF)) {
    maxAllowedAge = 45;
    relaxationText = isScStObc && isDFF
      ? " (including 10 years for PH and 5 years for SC/ST/OBC/DFF)"
      : (isScStObc ? " (including 10 years for PH and 5 years for SC/ST/OBC)" : " (including 10 years for PH and 5 years for DFF)");
  } else if (isPH) {
    maxAllowedAge = 40;
    relaxationText = " (including 10 years relaxation for PH)";
  } else if (isScStObc || isDFF) {
    maxAllowedAge = 35;
    relaxationText = isScStObc && isDFF
      ? " (including 5 years relaxation for SC/ST/OBC/DFF)"
      : (isScStObc ? " (including 5 years relaxation for SC/ST/OBC)" : " (including 5 years relaxation for DFF)");
  }

  const minAllowedDobYear = isExServiceman ? 1950 : 2027 - maxAllowedAge;
  const minAllowedDob = isExServiceman ? "1950-01-01" : `${minAllowedDobYear}-07-01`;

  // Calculate Age (Years, Months, Days) from DOB to Reference Date: 1st July 2027 (01/07/2027)
  const calculatedAge = useMemo(() => {
    if (!formData.dateOfBirth) return "";
    const birthDate = new Date(formData.dateOfBirth);
    if (isNaN(birthDate.getTime())) return "";

    // Reference date: 1st July 2027
    const refDate = new Date(2027, 6, 1);
    if (birthDate > refDate) return "Invalid Date";

    let years = refDate.getFullYear() - birthDate.getFullYear();
    let months = refDate.getMonth() - birthDate.getMonth();
    let days = refDate.getDate() - birthDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return `${years} Years, ${months} Months and ${days} Days`;
  }, [formData.dateOfBirth]);

  const validateAndProceed = (e) => {
    e.preventDefault();
    setErrorMsg("");

    const triggerError = (msg) => {
      setErrorMsg(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Validation checks
    if (!formData.appliedCategory || formData.appliedCategory === "Select") {
      return triggerError("Please select Applied Training Category (प्रशिक्षण हेतु आवेदित वर्ग).");
    }

    if (!formData.graduationCourse || formData.graduationCourse === "Select") {
      return triggerError("Please select Graduation Course (स्नातक परीक्षा का नाम).");
    }

    if (!formData.graduationUniversity || formData.graduationUniversity === "Select") {
      return triggerError("Please select Name of University (विश्वविद्यालय का नाम).");
    }

    if (!formData.graduationDate) {
      return triggerError("Please enter Graduation Completion Date (स्नातक योग्यता प्राप्त करने की तिथि).");
    }

    if (formData.graduationDate > "2026-10-06") {
      return triggerError("Graduation completion date cannot be later than 06/10/2026 (स्नातक योग्यता प्राप्त करने की तिथि 06/10/2026 से अधिक नहीं हो सकती).");
    }

    if (!formData.gender || formData.gender === "Select") {
      return triggerError("Please select Gender (लिंग).");
    }

    if (!formData.category || formData.category === "Select") {
      return triggerError("Please select Category (वर्ग).");
    }

    if (!formData.dateOfBirth) {
      return triggerError("Please enter Date of Birth (जन्म तिथि).");
    }

    if (formData.dateOfBirth > "2008-07-01") {
      return triggerError("Minimum age must be 19 years as of 01/07/2027 (01/07/2027 को न्यूनतम आयु 19 वर्ष होनी चाहिए। जन्म तिथि 01/07/2008 के बाद की नहीं हो सकती).");
    }

    if (!isExServiceman && formData.dateOfBirth < minAllowedDob) {
      const msg = `Age must not be more than ${maxAllowedAge} years${relaxationText} as of 01/07/2027 (01/07/2027 को आयु ${maxAllowedAge} वर्ष से अधिक नहीं होनी चाहिए। जन्म तिथि 01/07/${minAllowedDobYear} से पूर्व की नहीं हो सकती).`;
      return triggerError(msg);
    }

    if (!formData.motherName || !formData.motherName.trim()) {
      return triggerError("Please enter Mother's Name (माता का नाम).");
    }

    const subCat = formData.subCategory && formData.subCategory !== "Select" ? formData.subCategory : "लागू/कोई नहीं";
    if (!subCat) {
      return triggerError("Please select Sub Category (उपवर्ग).");
    }

    if (isExServiceman) {
      if (!formData.retirementDate) {
        return triggerError("Please enter Retirement Date from Armed Forces (सेना से सेवा-निवृत्ति की तिथि).");
      }
      const todayStr = getTodayStr();
      if (formData.retirementDate >= todayStr) {
        return triggerError("Date of retirement cannot be today's date or a future date. It must be less than today's date (सेना से सेवा-निवृत्ति की तिथि आज की तिथि से पूर्व की होनी चाहिए).");
      }
      if (formData.dateOfBirth && formData.retirementDate <= formData.dateOfBirth) {
        return triggerError("Date of retirement must be after Date of Birth (सेना से सेवा-निवृत्ति की तिथि जन्म तिथि के बाद की होनी चाहिए).");
      }
    }

    if (!formData.phyHandicapped || formData.phyHandicapped === "Select") {
      return triggerError("Please select PH status (दिव्यांग हैं/नहीं हैं).");
    }

    if (formData.phyHandicapped === "YES" && (!formData.phyType || formData.phyType === "Select" || formData.phyType === "--Not Applicable--")) {
      return triggerError("Please select PH Type (नि:शक्तता का प्रकार).");
    }

    if (formData.phyHandicapped === "YES" && formData.phyType === "Multi") {
      const multiList = Array.isArray(formData.multiPhType)
        ? formData.multiPhType
        : (formData.multiPhType ? String(formData.multiPhType).split(",").map((s) => s.trim()).filter(Boolean) : []);
      if (multiList.length < 2) {
        return triggerError("Please select two or more PH Types for Multi (Add two or more mentioned above).");
      }
    }

    if (!formData.examCity1 || formData.examCity1 === "Select") {
      return triggerError("Please select 1st Exam City preference (प्रथम परीक्षा शहर).");
    }

    if (!formData.examCity2 || formData.examCity2 === "Select") {
      return triggerError("Please select 2nd Exam City preference (द्वितीय परीक्षा शहर).");
    }

    if (formData.examCity1 === formData.examCity2) {
      return triggerError("1st and 2nd Exam City preferences cannot be the same.");
    }

    if (!formData.address || !formData.address.trim()) {
      return triggerError("Please enter Complete Mailing Address (पत्र व्यवहार का पूर्ण पता).");
    }

    if (!formData.state || formData.state === "Select") {
      return triggerError("Please select State (प्रदेश).");
    }

    if (!formData.district || formData.district === "Select") {
      return triggerError("Please select District (जनपद).");
    }

    if (!formData.pincode || formData.pincode.trim().length !== 6) {
      return triggerError("Please enter a valid 6-digit PIN Code (पिन कोड).");
    }

    if (!formData.idProofType || formData.idProofType === "Select") {
      return triggerError("Please select Identity Proof (पहचान पत्र).");
    }

    if (!formData.idProofNo || !formData.idProofNo.trim()) {
      return triggerError("Please enter Identity Proof Number (पहचान पत्र संख्या).");
    }

    const idType = formData.idProofType;
    const idNo = formData.idProofNo.trim();
    if (idType === "Aadhar Card" && !/^\d{12}$/.test(idNo)) {
      return triggerError("Aadhar Card Number must be exactly 12 digits.");
    } else if (idType === "PAN Card" && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(idNo)) {
      return triggerError("Invalid PAN Card Number format (e.g. ABCDE1234F).");
    } else if (idType === "Voter ID Card" && !/^[A-Za-z0-9]+$/.test(idNo)) {
      return triggerError("Voter ID must contain only alphanumeric characters.");
    } else if (idType === "Passport" && !/^[A-Z][0-9]{7}$/.test(idNo)) {
      return triggerError("Invalid Passport Number format (e.g. A1234567).");
    } else if (idType === "Driving License" && !/^[A-Za-z0-9]+$/.test(idNo)) {
      return triggerError("Driving License must contain only alphanumeric characters.");
    }

    handleNext();
  };

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isPHYes = formData.phyHandicapped === "YES";
  const isFemale = (formData.gender || "").toUpperCase() === "FEMALE";

  const parseMultiDisabilities = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    const str = String(raw).trim();
    if (!str || str === "Select") return [];

    const options = [
      "VI (Visually Impaired)",
      "HI (Hearing Impaired)",
      "ORTHO/LOCOMOTOR",
    ];

    const matched = [];
    const parts = str.split(",").map((s) => s.trim()).filter(Boolean);

    for (const opt of options) {
      if (parts.includes(opt)) {
        matched.push(opt);
      } else if (
        (opt.startsWith("VI") && (str.includes("VI (Visually Impaired") || str.includes("VI (Visually Impaired)"))) ||
        (opt.startsWith("HI") && (str.includes("HI (Hearing Impaired") || str.includes("HI (Hearing Impaired)"))) ||
        (opt.startsWith("ORTHO") && str.toUpperCase().includes("ORTHO"))
      ) {
        if (!matched.includes(opt)) {
          matched.push(opt);
        }
      }
    }

    return matched.length > 0 ? matched : parts;
  };

  const selectedMultiPhTypes = useMemo(() => {
    const raw = formData.multiDisabilityType || formData.multiPhType;
    return parseMultiDisabilities(raw);
  }, [formData.multiDisabilityType, formData.multiPhType]);

  const handleMultiPhTypeChange = (values) => {
    handleInputChange({
      target: { name: "multiPhType", value: values || [] },
    });
    handleInputChange({
      target: { name: "multiDisabilityType", value: values && values.length > 0 ? values.join(", ") : null },
    });
  };

  return (
    <div className="w-full font-sans">
      <form autoComplete="off" onSubmit={validateAndProceed} className="space-y-3 sm:space-y-3.5">

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-2.5 sm:p-3 rounded-xs text-xs sm:text-[13px] font-semibold border border-red-200 flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* Row 1: प्रशिक्षण हेतु आवेदित वर्ग */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
            प्रशिक्षण हेतु आवेदित वर्ग <span className="text-red-600 font-bold">*</span>
          </label>
          <select
            name="appliedCategory"
            value={formData.appliedCategory || "Select"}
            onChange={handleInputChange}
            disabled={isLocked}
            className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
          >
            <option value="Select">--Select--</option>
            <option value="1-विज्ञान वर्ग">1-विज्ञान वर्ग</option>
            <option value="2-विज्ञानेत्तर वर्ग">2-विज्ञानेत्तर वर्ग</option>
          </select>
        </div>

        {/* Row 2: Graduation Course | Name of University */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Graduation Course स्नातक परीक्षा का नाम <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="graduationCourse"
              value={formData.graduationCourse || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              {graduationCourses.map((course) => (
                <option key={course} value={course}>
                  {course === "Select" ? "--Select--" : course}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Name of University (विश्वविद्यालय का नाम) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="graduationUniversity"
              value={formData.graduationUniversity || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              {universityOptions.map((uni) => (
                <option key={uni} value={uni}>
                  {uni}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: स्नातक योग्यता प्राप्त करने की तिथि | Applicant's Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              स्नातक योग्यता प्राप्त करने की तिथि (dd/mm/yyyy) <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              type="date"
              name="graduationDate"
              max="2026-10-06"
              value={formData.graduationDate || ""}
              onChange={handleInputChange}
              disabled={isLocked}
              required
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Applicant's Name (अभ्यर्थी/अभ्यर्थिनी का नाम)
            </label>
            <input
              type="text"
              name="applicantName"
              value={formData.applicantName || ""}
              onChange={handleInputChange}
              disabled={true}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-300 rounded bg-gray-100 text-gray-700 font-bold cursor-not-allowed uppercase"
            />
          </div>
        </div>

        {/* Row 4: Mobile No. | Email ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Mobile No. (मोबाइल नं.)
            </label>
            <input
              type="text"
              name="mobileNo"
              value={formData.mobileNo || ""}
              onChange={handleInputChange}
              disabled={true}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-300 rounded bg-gray-100 text-gray-700 font-bold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Email ID (ईमेल)
            </label>
            <input
              type="text"
              name="emailId"
              value={formData.emailId || ""}
              onChange={handleInputChange}
              disabled={true}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-300 rounded bg-gray-100 text-gray-700 font-bold cursor-not-allowed"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Row 5: Gender */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Gender (लिंग) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="gender"
              value={formData.gender || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              <option value="Select">--Select--</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Transgender">Transgender</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Father's Name (पिता का नाम) <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              type="text"
              name="fatherName"
              value={formData.fatherName || ""}
              onChange={handleInputChange}
              disabled={true}
              required
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-300 rounded bg-gray-100 uppercase text-gray-700 font-bold cursor-not-allowed"
            />
          </div>
        </div>
        {/* Row 6: Father's Name | Mother's Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Mother's Name (माता का नाम) <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              type="text"
              name="motherName"
              value={formData.motherName || ""}
              onChange={handleInputChange}
              disabled={isLocked}
              required
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white uppercase font-medium text-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Husband Name (विवाहित महिला के पति का नाम)
              
            </label>
            <input
              type="text"
              name="husbandName"
              value={isFemale ? (formData.husbandName || "") : ""}
              onChange={handleInputChange}
              disabled={isLocked || !isFemale}
              placeholder="यदि लागू हो तो पति का नाम दर्ज करें"
              className={`w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded uppercase font-medium ${!isFemale || isLocked
                ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                : "border-sky-400 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                }`}
            />
          </div>
        </div>
        {/* Row 8: Category | Sub Category | सेना से सेवा-निवृत्ति की तिथि | खेल का प्रकार */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Category (वर्ग) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="category"
              value={formData.category || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              <option value="Select">--Select--</option>
              <option value="General (GEN)">General (GEN)</option>
              <option value="Other Backward Class (OBC)">Other Backward Class (OBC)</option>
              <option value="Scheduled Caste (SC)">Scheduled Caste (SC)</option>
              <option value="Scheduled Tribe (ST)">Scheduled Tribe (ST)</option>
              <option value="Economically Weaker Section (EWS)">Economically Weaker Section (EWS)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Sub Category (उपवर्ग) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="subCategory"
              value={formData.subCategory || "लागू/कोई नहीं"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              <option value="लागू/कोई नहीं">लागू/कोई नहीं</option>
              <option value="DFF (स्वतंत्रता संग्राम सेनानी आश्रित)">DFF (स्वतंत्रता संग्राम सेनानी आश्रित)</option>
              <option value="EX-SERVICEMAN (भूतपूर्व सैनिक(स्वयं))">EX-SERVICEMAN (भूतपूर्व सैनिक(स्वयं))</option>
              <option value="SPORTS (खेलकूद)">SPORTS (खेलकूद)</option>
              <option value="राज्य आंदोलनकारी और उनके आश्रित">राज्य आंदोलनकारी और उनके आश्रित</option>
              <option value="Orphan (अनाथ)">Orphan (अनाथ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              सेना से सेवा-निवृत्ति की तिथि
            </label>
            <input
              type="date"
              name="retirementDate"
              max={getYesterdayStr()}
              value={formData.retirementDate ? formData.retirementDate.split("T")[0] : ""}
              onChange={handleInputChange}
              disabled={!isExServiceman || isLocked}
              className={`w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded ${isExServiceman ? "border-sky-400 bg-white font-medium text-gray-800" : "border-gray-300 bg-gray-100 cursor-not-allowed text-gray-400"
                }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              खेल का प्रकार
            </label>
            <select
              name="sportsType"
              value={formData.sportsType || "Select"}
              onChange={handleInputChange}
              disabled={!isSports || isLocked}
              className={`w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded ${isSports ? "border-sky-400 bg-white font-medium text-gray-800" : "border-gray-300 bg-gray-100 cursor-not-allowed text-gray-400"
                }`}
            >
              <option value="Select">--Select--</option>
              <option value="Olympic">ओलंपिक खेल - पदक विजेता/प्रतिभाग</option>
              <option value="Commonwealth/Asian">कामनवेल्थ खेल/एशियन चैंपियनशिप - पदक विजेता/प्रतिभाग</option>
              <option value="World Cup">विश्वकप/विश्व चैंपियनशिप/एशियन खेल - पदक विजेता/प्रतिभाग</option>
              <option value="Commonwealth Championship">कामनवेल्थ चैंपियनशिप/अंतरराष्ट्रीय विश्वविद्यालय खेल - पदक विजेता/प्रतिभाग</option>
            </select>
          </div>
        </div>

        {/* Row 9: PH YES/No | PH Type | Multi PH Type (if Multi) | Scribe Required */}
        <div className={`grid grid-cols-1 ${isPHYes && formData.phyType === "Multi" ? "sm:grid-cols-2 md:grid-cols-4" : "md:grid-cols-3"} gap-3 sm:gap-4`}>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-0.5">
              PH YES or No <span className="text-red-600 font-bold">*</span>
            </label>
            <p className="text-[11px] text-red-600 font-semibold mb-1">
              (दिव्यांग हैं/नहीं है 40 प्रतिशत या उससे अधिक दिव्यांगता वाले ही YES अंकित करें)
            </p>
            <select
              name="phyHandicapped"
              value={formData.phyHandicapped || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              <option value="Select">--Select--</option>
              <option value="NO">NO</option>
              <option value="YES">YES</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-0.5">
              If YES select PH Type
            </label>
            <p className="text-[11px] text-gray-600 font-medium mb-1">
              यदि हाँ तो निःशक्तता (दिव्यांगता) का प्रकार
            </p>
            <Select
              allowClear
              placeholder={isPHYes ? "--Select PH Type--" : "--Not Applicable--"}
              value={isPHYes && formData.phyType && formData.phyType !== "Select" && formData.phyType !== "--Not Applicable--" ? formData.phyType : undefined}
              onChange={(val) => {
                handleInputChange({
                  target: { name: "phyType", value: val || "Select" },
                });
                if (val !== "Multi") {
                  handleInputChange({
                    target: { name: "multiPhType", value: [] },
                  });
                }
              }}
              disabled={!isPHYes || isLocked}
              className="w-full min-h-[38px] text-xs sm:text-sm"
              options={[
                { label: "VI (Visually Impaired)", value: "VI (Visually Impaired)" },
                { label: "HI (Hearing Impaired)", value: "HI (Hearing Impaired)" },
                { label: "ORTHO/LOCOMOTOR", value: "ORTHO/LOCOMOTOR" },
                { label: "Multi", value: "Multi" }
              ]}
            />
          </div>

          {isPHYes && formData.phyType === "Multi" && (
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-0.5">
                Select Multi PH Type <span className="text-red-600 font-bold">*</span>
              </label>
              <p className="text-[11px] text-red-600 font-semibold mb-1">
                (Add two or more mentioned above)
              </p>
              <Select
                mode="multiple"
                allowClear
                placeholder="--Select PH Type(s)--"
                value={selectedMultiPhTypes}
                onChange={handleMultiPhTypeChange}
                disabled={isLocked}
                className="w-full min-h-[38px] text-xs sm:text-sm"
                options={[
                  { label: "VI (Visually Impaired)", value: "VI (Visually Impaired)" },
                  { label: "HI (Hearing Impaired)", value: "HI (Hearing Impaired)" },
                  { label: "ORTHO/LOCOMOTOR", value: "ORTHO/LOCOMOTOR" }
                ]}
              />
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-0.5">
              Scribe Required (श्रुतलेखक की आवश्यकता)
            </label>
            <p className="text-[11px] text-transparent select-none mb-1">
              Placeholder
            </p>
            <select
              name="scribeRequired"
              value={formData.scribeRequired || "--Select--"}
              onChange={handleInputChange}
              disabled={!isPHYes || isLocked}
              className={`w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded ${isPHYes ? "border-sky-400 bg-white font-medium text-gray-800" : "border-gray-300 bg-gray-100 cursor-not-allowed text-gray-400"
                }`}
            >
              <option value="--Select--">--Select--</option>
              <option value="NO">NO</option>
              <option value="YES">YES</option>
            </select>
          </div>
        </div>

        {/* Date of Birth | Age (placed after Scribe Box) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Date of Birth (dd/mm/yyyy) <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              type="date"
              name="dateOfBirth"
              min={minAllowedDob}
              max="2008-07-01"
              value={formData.dateOfBirth ? formData.dateOfBirth.split("T")[0] : ""}
              onChange={handleInputChange}
              disabled={isLocked}
              required
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Age (Year,Month,Days)
            </label>
            <input
              type="text"
              readOnly
              value={calculatedAge || ""}
              placeholder="Age will auto-calculate"
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-300 rounded bg-gray-50 text-gray-700 font-semibold"
            />
          </div>
        </div>

        {/* Row 10: Exam City 1st | Exam City 2nd */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Exam City 1ˢᵗ (परीक्षा में सम्मिलित होने हेतु वांछित प्रथम शहर) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="examCity1"
              value={formData.examCity1 || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              {examCityOptions
                .filter((opt) => opt === "Select" || opt !== formData.examCity2)
                .map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Exam City 2ⁿᵈ (परीक्षा में सम्मिलित होने हेतु वांछित द्वितीय शहर) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="examCity2"
              value={formData.examCity2 || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              {examCityOptions
                .filter((opt) => opt === "Select" || opt !== formData.examCity1)
                .map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Row 11: Complete Mailing Address */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
            Complete Mailing Address(पत्र व्यवहार का पूर्ण पता) <span className="text-red-600 font-bold">*</span>
          </label>
          <input
            type="text"
            name="address"
            value={formData.address || ""}
            onChange={handleInputChange}
            disabled={isLocked}
            placeholder="Complete Mailing Address"
            required
            className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white uppercase font-medium text-gray-800"
          />
        </div>

        {/* Row 12: State | District */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              State (प्रदेश) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="state"
              value={formData.state || "Uttarakhand"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              <option value="Select">--Select--</option>
              {states.map((s) => (
                <option key={s.id || s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              District (जनपद) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="district"
              value={formData.district || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              {districtOptions.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 13: PIN Code | Identity Proof */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              PIN Code (पिन कोड) <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              type="text"
              name="pincode"
              maxLength={6}
              value={formData.pincode || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                handleInputChange({ target: { name: "pincode", value: val } });
              }}
              disabled={isLocked}
              placeholder="6-digit PIN Code"
              required
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
              Identity Proof (पहचान पत्र) <span className="text-red-600 font-bold">*</span>
            </label>
            <select
              name="idProofType"
              value={formData.idProofType || "Select"}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-800"
            >
              <option value="Select">--Select--</option>
              <option value="Aadhar Card">Aadhar Card</option>
              <option value="Voter ID Card">Voter ID Card</option>
              <option value="PAN Card">PAN Card</option>
              <option value="Passport">Passport</option>
              <option value="Driving License">Driving License</option>
            </select>
          </div>
        </div>

        {/* Row 14: Identity Proof No. */}
        <div className="w-full md:w-1/2">
          <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1">
            Identity Proof No. (पहचान पत्र संख्या) <span className="text-red-600 font-bold">*</span>
          </label>
          <input
            type="text"
            name="idProofNo"
            value={formData.idProofNo || ""}
            onChange={handleInputChange}
            disabled={isLocked}
            placeholder="Identity Proof No."
            required
            className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-sky-400 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white uppercase font-medium text-gray-800"
          />
        </div>

        {/* Action Button: Save & Next */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isLocked}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold text-sm sm:text-base rounded-md shadow-sm transition cursor-pointer flex items-center gap-2"
          >
            Save & Next
          </button>
        </div>

      </form>
    </div>
  );
}
