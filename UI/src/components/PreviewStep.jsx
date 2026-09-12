import React, { useState, useEffect } from "react";
import { api } from "../stores/apiStore";
import { QRCodeSVG as QRCode } from "qrcode.react";

export default function PreviewStep({
  formData,
  setFormData,
  handleNext,
  handlePrevious,
  isLocked,
  isCorrectionMode = false,
}) {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (isLocked && setFormData) {
      setFormData((prev) => ({ ...prev, agreedTerms: true }));
    }
  }, [isLocked, setFormData]);

  const formatDob = (dobStr) => {
    if (!dobStr) return "N/A";
    const cleanStr = String(dobStr).split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dobStr;
  };

  const getMediaUrl = (path, fallback) => {
    if (!path) return fallback || null;
    if (
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("blob:") ||
      path.startsWith("data:")
    ) {
      return path;
    }
    const baseUrl = api.defaults.baseURL || "";
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        let resultData = null;
        let uploadsObj = null;
        let encToken = "";

        // 1. Fetch complete applicant data via authenticated endpoint
        try {
          const res = await api.get("/api/UserPersonalDetails/complete/me");
          if (res.data && res.data.success && res.data.data) {
            resultData = res.data.data;
            uploadsObj = res.data.uploads || null;
            encToken = res.data.encryptedToken || "";
          }
        } catch (err) {
          console.warn("Could not fetch via complete/me, attempting applicant fallback...", err);
        }

        // 2. Fallback: Query applicant by registration number if needed
        const regNo = formData?.applicantId || formData?.registrationNo;
        if (!resultData && regNo) {
          try {
            const fallbackRes = await api.get(
              `/api/UserPersonalDetails/applicant/${encodeURIComponent(regNo)}`
            );
            if (fallbackRes.data && fallbackRes.data.success && fallbackRes.data.data) {
              resultData = fallbackRes.data.data;
              uploadsObj = fallbackRes.data.uploads || null;
              encToken = fallbackRes.data.encryptedToken || "";
            }
          } catch (fallbackErr) {
            console.warn("Could not fetch via applicant/regNo fallback", fallbackErr);
          }
        }

        // 3. Fallback for uploaded files if not returned above
        if (!uploadsObj) {
          try {
            const uRes = await api.get("/api/Uploads/user");
            if (uRes.data && uRes.data.length > 0) {
              uploadsObj = uRes.data[0] || uRes.data;
            }
          } catch (uErr) {
            // Uploads not found
          }
        }

        if (isMounted) {
          if (resultData) {
            const resolvedPhoto = getMediaUrl(
              uploadsObj?.photoFile,
              formData.photoFilePreview
            );
            const resolvedSign = getMediaUrl(
              uploadsObj?.signatureFile,
              formData.signatureFilePreview
            );
            const resolvedThumb = getMediaUrl(
              uploadsObj?.thumbImp,
              formData.thumbFilePreview
            );

            const isFemale =
              (resultData.gender || formData.gender || "").toUpperCase() === "FEMALE";

            const merged = {
              ...formData,
              ...resultData,
              applicantId: resultData.registrationNo || formData.applicantId || formData.registrationNo,
              registrationNo: resultData.registrationNo || formData.registrationNo,
              applicantName: resultData.fullName || resultData.applicantName || formData.applicantName,
              fatherName: resultData.fatherName || formData.fatherName,
              motherName: resultData.motherName || formData.motherName,
              husbandName: isFemale ? (resultData.husbandName || formData.husbandName || "") : "",
              mobileNo: resultData.phoneNumber || formData.mobileNo,
              emailId: resultData.email || formData.emailId,
              gender: resultData.gender || formData.gender,
              dateOfBirth: resultData.dob ? resultData.dob.split("T")[0] : formData.dateOfBirth,
              appliedCategory: resultData.appliedCategory || formData.appliedCategory,
              graduationCourse: resultData.graduationCourse || formData.graduationCourse,
              graduationUniversity: resultData.graduationUniversity || formData.graduationUniversity,
              graduationDate: resultData.graduationDate
                ? resultData.graduationDate.split("T")[0]
                : formData.graduationDate,
              category: resultData.category || formData.category,
              subCategory: resultData.subCategory || formData.subCategory,
              retirementDate: resultData.retirementDate
                ? resultData.retirementDate.split("T")[0]
                : formData.retirementDate,
              sportsType: resultData.sportsType || formData.sportsType,
              phyHandicapped:
                resultData.isPhysicallyHandicapped
                  ? "YES"
                  : resultData.personalDetailId
                    ? "NO"
                    : formData.phyHandicapped,
              phyType: resultData.disabilityType || formData.phyType,
              multiDisabilityType: resultData.multiDisabilityType || formData.multiDisabilityType || formData.multiPhType,
              multiPhType: resultData.multiDisabilityType || formData.multiPhType,
              scribeRequired:
                resultData.scribeRequired
                  ? "YES"
                  : resultData.personalDetailId
                    ? "NO"
                    : formData.scribeRequired,
              examCity1: resultData.examCity1 || formData.examCity1,
              examCity2: resultData.examCity2 || formData.examCity2,
              address: resultData.mailingAddress || formData.address,
              state: resultData.state || formData.state,
              district: resultData.district || formData.district,
              pincode: resultData.pinCode || formData.pincode,
              idProofType: resultData.identityProof || formData.idProofType,
              idProofNo: resultData.identityProofNo || formData.idProofNo,
              isPaymentCompleted:
                resultData.isPaymentCompleted ?? formData.isPaymentCompleted,
              photoFilePreview: resolvedPhoto,
              signatureFilePreview: resolvedSign,
              thumbFilePreview: resolvedThumb,
              encryptedToken: encToken || formData.encryptedToken,
            };

            setPreviewData(merged);
            if (setFormData) {
              setFormData((prev) => ({
                ...prev,
                ...merged,
              }));
            }
          } else {
            // Fallback to existing formData if backend returns no record
            setPreviewData(formData);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("PreviewStep API fetch error:", err);
        if (isMounted) {
          setPreviewData(formData);
          setLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatFullAddress = (addr, dist, st, pin) => {
    if (!addr && !dist && !st && !pin) return ".................................................";
    const parts = [];
    if (addr) parts.push(addr.trim());
    if (dist && (!addr || !addr.toLowerCase().includes(dist.toLowerCase()))) parts.push(dist.trim());
    if (st && (!addr || !addr.toLowerCase().includes(st.toLowerCase()))) parts.push(st.trim());
    if (pin && (!addr || !addr.includes(pin))) parts.push(pin.trim());
    return parts.join(", ") || ".................................................";
  };

  const data = previewData || formData;
  const isFemaleCandidate = (data.gender || "").toUpperCase() === "FEMALE";
  const declPlace = data.district || data.examCity1 || ".................";
  const declDate = data.paymentDate ? formatDob(data.paymentDate) : new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const declAddress = formatFullAddress(data.address || data.mailingAddress, data.district, data.state, data.pincode || data.pinCode);

  if (loading) {
    return (
      <div className="font-sans py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center space-y-1">
          <p className="text-base sm:text-lg font-bold text-gray-900">
            आवेदन पत्र का विवरण लोड हो रहा है...
          </p>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Fetching complete application details from database...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-xs sm:text-sm md:text-base text-gray-800 space-y-4 sm:space-y-5 md:space-y-6">
      {/* Header crest and title */}
      <div className="w-full border border-gray-300 mb-4 sm:mb-5 md:mb-6">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-[20%] border border-gray-300 p-2 sm:p-3 text-center align-middle">
                {api.defaults.baseURL ? (
                  <img
                    src={`${api.defaults.baseURL}/Logo/ubse_white.jpg`}
                    alt="UBSE Logo"
                    className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto bg-gray-100 flex items-center justify-center text-gray-500">
                    Logo
                  </div>
                )}
              </td>
              <td className="w-[60%] border border-gray-300 p-2 sm:p-3 text-center align-middle">
                <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-900 leading-tight mb-1 sm:mb-2">
                  उत्तराखण्ड विद्यालयी शिक्षा परिषद् रामनगर (नैनीताल)
                </h2>
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 leading-tight mb-1 sm:mb-2">
                  द्विवर्षीय डी०एल०एड० (D.El.Ed.) प्रवेश परीक्षा 2026
                </h3>
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 leading-tight">
                  आवेदन पत्र समीक्षा (Application Review)
                </h3>
                {!data.isPaymentCompleted && (
                  <div className="text-[10px] sm:text-xs md:text-sm font-bold text-red-600 mt-1 sm:mt-2">
                    (UNPAID APPLICATION PREVIEW)
                  </div>
                )}
              </td>
              <td className="w-[20%] border border-gray-300 p-2 sm:p-3 text-center align-middle">
                <div className="flex justify-center">
                  <QRCode
                    value={
                      data.encryptedToken
                        ? `https://ukdeled.com/verify?token=${data.encryptedToken}`
                        : `https://ukdeled.com/verify/${data.applicantId || data.registrationNo || 'N/A'}`
                    }
                    size={128}
                    level="M"
                    includeMargin={true}
                    className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!data.isPaymentCompleted && (
        <div className="text-center text-red-600 font-extrabold text-[13px] border border-red-200 bg-red-50/50 p-3 rounded-lg leading-relaxed mb-4">
          आवेदक ऑनलाइन रजिस्ट्रेशन के समय भरे गये विवरण, ऑनलाइन फीस पेमेंट रसीद
          का प्रिंट आउट तथा पूर्ण आवेदन का प्रिंट आउट अपने पास अवश्य सुरक्षित
          रखें। इनकी आवश्यकता इस प्रक्रिया के अगले चरणों में पड़ेगी।
        </div>
      )}

      {/* Review sheet with Photo / Sign / Thumb beside it */}
      <div className="flex flex-row gap-2 sm:gap-3 md:gap-4 items-start">
        <div className="flex-1 min-w-0 overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-left min-w-[320px] text-sm sm:text-base">
            <tbody>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold w-1/4 text-sm sm:text-base">
                  Registration No.
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-gray-900 w-1/4 text-sm sm:text-base">
                  {data.applicantId || data.registrationNo || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold w-1/4 text-sm sm:text-base">
                  प्रशिक्षण हेतु आवेदित वर्ग
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-gray-900 w-1/4 text-sm sm:text-base">
                  {data.appliedCategory || data.subjectCode || "2-विज्ञानेत्तर वर्ग"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Graduation Course
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.graduationCourse || data.deled1TrainingQualification || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  University Name
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.graduationUniversity || data.eligibilityCodeDELED1 || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Graduation Date
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {formatDob(data.graduationDate || data.deled1TrainingYear)}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Candidate's Name
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-gray-900">
                  {data.applicantName || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Mobile Number
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.mobileNo || data.phoneNumber || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Email ID
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold break-all">
                  {data.emailId || data.email || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Gender
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.gender || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Date of Birth
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {formatDob(data.dateOfBirth || data.dob)}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Father's Name
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.fatherName || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Mother's Name
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.motherName || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Husband's Name
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {isFemaleCandidate ? (data.husbandName || "N/A") : "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Category
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.category || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Sub Category
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.subCategory || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Retirement Date
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.retirementDate ? formatDob(data.retirementDate) : "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  खेल का प्रकार
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.sportsType || data.eligibilityCodeDELED2 || "None"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Physically Handicapped
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.phyHandicapped === "YES" || data.isPhysicallyHandicapped
                    ? `YES (${data.phyType === "Multi" && data.multiPhType
                      ? (Array.isArray(data.multiPhType)
                        ? (data.multiPhType.length > 0 ? `Multi (${data.multiPhType.join(", ")})` : "Multi")
                        : data.multiPhType)
                      : data.phyType || data.disabilityType || "N/A"
                    })`
                    : "NO"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Scribe Required
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.scribeRequired === true || data.scribeRequired === "YES"
                    ? "YES"
                    : data.scribeRequired === false || data.scribeRequired === "NO"
                      ? "NO"
                      : "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Exam City 1ˢᵗ
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.examCity1 || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Exam City 2ⁿᵈ
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.examCity2 || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Complete Mailing Address
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.address || data.mailingAddress || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  State
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.state || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  District
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.district || "N/A"}
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  PIN Code
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.pincode || data.pinCode || "N/A"}
                </td>
                <th className="border border-gray-300 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-sm sm:text-base">
                  Identity Proof
                </th>
                <td className="border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                  {data.idProofType || data.identityProof
                    ? `${data.idProofType || data.identityProof} (${data.idProofNo || data.identityProofNo || "N/A"
                    })`
                    : "N/A"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Profile photo + thumb + signature block */}
        <div className="w-28 sm:w-36 md:w-44 flex flex-col gap-3 sm:gap-4 shrink-0 items-center">
          {/* Photo */}
          <div className="flex flex-col items-center w-full gap-1">
            <div className="w-full h-32 sm:h-40 md:h-48 border-2 border-gray-300 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
              {data.photoFilePreview ? (
                <img
                  src={data.photoFilePreview}
                  alt="Candidate Photo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-400 text-xs">Photo</span>
              )}
            </div>
            <p className="text-xs text-gray-600 font-bold text-center leading-tight">
              Photo
            </p>
          </div>
          {/* Thumb */}
          <div className="flex flex-col items-center w-full gap-1">
            <div className="w-full h-16 sm:h-18 md:h-20 border-2 border-gray-300 bg-white flex items-center justify-center overflow-hidden">
              {data.thumbFilePreview ? (
                <img
                  src={data.thumbFilePreview}
                  alt="Left Thumb"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-gray-400">Thumb</span>
              )}
            </div>
            <p className="text-xs text-gray-600 font-bold text-center leading-tight">
              Left Thumb
            </p>
          </div>
          {/* Signature */}
          <div className="flex flex-col items-center w-full gap-1">
            <div className="w-full h-14 sm:h-16 md:h-18 border-2 border-gray-300 bg-white flex items-center justify-center overflow-hidden">
              {data.signatureFilePreview ? (
                <img
                  src={data.signatureFilePreview}
                  alt="Signature"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-gray-400">Sign</span>
              )}
            </div>
            <p className="text-xs text-gray-600 font-bold text-center leading-tight">
              Signature
            </p>
          </div>
        </div>
      </div>

      {/* Declaration */}
      <div
        className="font-utsaah border border-gray-300 p-4 sm:p-5 md:p-6 rounded-lg bg-gray-50 space-y-4 text-gray-900"
        style={{ fontFamily: "'Utsaah', 'Nirmala UI', 'Mangal', 'Segoe UI', sans-serif" }}
      >
        <h4 className="font-extrabold text-gray-900 text-base sm:text-lg md:text-xl text-center tracking-wide">
          घोषणा :
        </h4>
        <p className="font-medium text-gray-900 text-sm sm:text-base md:text-[17px] leading-relaxed">
          मैं{" "}
          <span className="font-bold underline">
            {data.applicantName || data.fullName || "............................................."}
          </span>{" "}
          पुत्र / पुत्री श्री{" "}
          <span className="font-bold underline">
            {data.fatherName || "......................................."}
          </span>{" "}
          शपथपूर्वक घोषणा करता / करती हूँ कि –
        </p>

        <ol className="list-decimal pl-6 space-y-2 text-xs sm:text-sm md:text-[15.5px] leading-relaxed text-gray-800 text-justify">
          <li>
            मैंने ‘‘प्रारंभिक शिक्षा में द्विवर्षीय डिप्लोमा (D.El.E.d.) प्रशिक्षण हेतु प्रवेश परीक्षा 2026 : सूचना विवरणिका’’ में अंकित अर्हताओं एवं दिशा-निर्देशों का भली-भाँति अध्ययन कर लिया है। मैं परीक्षा में सम्मिलित होने हेतु निर्धारित समस्त अर्हतायें पूर्ण करता/करती हूँ।
          </li>
          <li>
            मुझे ‘‘प्रारंभिक शिक्षा में द्विवर्षीय डिप्लोमा (D.El.E.d.) प्रशिक्षण हेतु प्रवेश परीक्षा 2026’’ हेतु जारी समस्त दिशा-निर्देश एवं शर्ते मान्य हैं।
          </li>
          <li>
            परीक्षा में सम्मिलित होने हेतु आवेदन पत्र में भरी गयी समस्त प्रविष्टियां मेरे मूल अभिलेखों पर आधारित हैं तथा मेरे संज्ञान में सही एवं सत्य हैं। मैंने कोई भी तथ्य नहीं छुपाया है। यदि परीक्षा के पूर्व अथवा बाद में जांच उपरान्त मेरे द्वारा दी गयी कोई भी सूचना असत्य अथवा त्रुटिपूर्ण पायी जाती है तो उत्तराखण्ड विद्यालयी शिक्षा परिषद् को मेरा अभ्यर्थन एवं परीक्षाफल निरस्त करने तथा मेरे विरूद्ध वैधानिक कार्यवाही करने का अधिकार होगा और उसका सम्पूर्ण उत्तरदायित्व मेरा होगा।
          </li>
          <li>
            आवेदन पत्र में अंकित सूचनाओं से सम्बन्धित सभी मूल अभिलेख/दस्तावेज (प्रमाण पत्र/अंक पत्र) आवेदन की अन्तिम तिथि के पूर्व से मेरे पास उपलब्ध हैं। इसमें किसी भी प्रकार की त्रुटि या कमी अथवा कोई तथ्य गलत पाये जाने अथवा तथ्य छुपाये जाने पर सम्पूर्ण उत्तरदायित्व मेरा होगा।
          </li>
          <li>
            निर्धारित तिथि तक नियत शुल्क जमा करने पर ही मेरा आवेदन ‘‘प्रारंभिक शिक्षा में द्विवर्षीय डिप्लोमा (D.El.E.d.) प्रशिक्षण हेतु प्रवेश परीक्षा 2026’’ हेतु विचारणीय होगा।
          </li>
          <li>
            मैं इस तथ्य से भली-भाँति अवगत हूँ कि द्विवर्षीय डी.एल.एड. प्रशिक्षण प्राप्त अभ्यर्थियों को प्रशिक्षणोपरांत राजकीय सेवा में सेवायोजित किये जाने की कोई बाध्यता नहीं है। तत्समय प्रचलित सेवा नियमावली में विहित न्यूनतम प्रशिक्षण/अन्य निर्धारित योग्यता धारित करने वाले अभ्यर्थियों को ही नियमानुसार सेवा में लिया जायेगा। शिक्षकों की नियुक्ति/चयन राज्य सरकार की संगत अध्यापक सेवा नियमावली तथा समय-समय पर जारी नियम/निर्देश के अन्तर्गत ही किया जाता है।
          </li>
          <li>
            मुझे परिषद् द्वारा पूर्व में किसी भी परीक्षा से प्रतिबन्धित (Debar) नहीं किया गया है।
          </li>
        </ol>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-300 text-xs sm:text-sm md:text-[15.5px]">
          <div className="space-y-1.5">
            <div>
              <span className="font-bold">स्थान : </span>
              <span className="font-semibold">{declPlace}</span>
            </div>
            <div>
              <span className="font-bold">दिनांक : </span>
              <span className="font-semibold">{declDate}</span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end">
            <div className="flex flex-col items-center mb-2">
              <div className="w-[140px] h-[55px] border border-gray-400 bg-white flex items-center justify-center overflow-hidden mb-1">
                {data.signatureFilePreview ? (
                  <img
                    src={data.signatureFilePreview}
                    alt="Signature Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-gray-400">
                    (हस्ताक्षर)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-900">
                आवेदक के हस्ताक्षर
              </p>
            </div>

            <div className="space-y-1 text-left sm:text-right w-full sm:max-w-[320px]">
              <div>
                <span className="font-bold">नाम : </span>
                <span className="font-semibold">{data.applicantName || data.fullName || "................................................."}</span>
              </div>
              <div>
                <span className="font-bold">पता : </span>
                <span className="font-semibold">{declAddress}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 flex items-center gap-3 border-t border-gray-200">
          <input
            type="checkbox"
            id="agreedTerms"
            checked={formData.agreedTerms || false}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, agreedTerms: e.target.checked }))
            }
            disabled={isLocked}
            className="w-5 h-5 text-blue-600 rounded cursor-pointer shrink-0"
          />
          <label
            htmlFor="agreedTerms"
            className="text-sm sm:text-base font-bold text-gray-900 cursor-pointer font-sans"
          >
            I accept all the terms and declare that the information provided is
            true to the best of my knowledge.
          </label>
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="flex justify-between items-center pt-5 border-t border-gray-200">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={isLocked}
          className="px-6 py-3 border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold text-base sm:text-lg rounded-lg transition cursor-pointer"
        >
          Previous
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!formData.agreedTerms}
          className="px-8 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white font-extrabold text-base sm:text-lg rounded-lg shadow-md transition cursor-pointer"
        >
          {isLocked ? "Proceed to Payment" : "Confirm & Proceed to Payment"}
        </button>
      </div>
    </div>
  );
}
