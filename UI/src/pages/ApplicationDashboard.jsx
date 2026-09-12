import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { notification, Spin } from "antd";
import { api } from "../stores/apiStore";
import { useAuthStore } from "../stores/authStore";
import Layout from "../components/Layout";
import {
  FaUser,
  FaEye,
  FaEyeSlash,
  FaHome,
  FaTimes,
} from "react-icons/fa";
import { QRCodeSVG as QRCode } from "qrcode.react";

export default function ApplicationDashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [timelines, setTimelines] = useState([]);
  const [uploads, setUploads] = useState({
    photoFilePreview: "",
    signatureFilePreview: "",
    thumbFilePreview: "",
  });

  const [imageError, setImageError] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (
      !passwordData.oldPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordError("All fields are required.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      await api.post("/api/UserRegistrations/ChangePassword", {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordSuccess("Password changed successfully.");
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || "Failed to change password.",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const isNotDeled1 = (applyFor) => {
    const val = (applyFor || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[-_]/g, "");
    return val !== "DELEDI" && val !== "DELED1";
  };

  const isNotDeled2 = (applyFor) => {
    const val = (applyFor || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[-_]/g, "");
    return val !== "DELEDII" && val !== "DELED2";
  };

  const isCorrectionWindowOpen = () => {
    if (!timelines || timelines.length === 0) return false;
    const starts = timelines.find((t) => t.label === "CORRECTION WINDOW" && t.key === "starts");
    const closes = timelines.find((t) => t.label === "CORRECTION WINDOW" && t.key === "closes");

    if (starts && closes) {
      const now = new Date();
      const startDate = new Date(`${starts.dateValue} 00:00:00`);
      const closeDate = new Date(`${closes.dateValue} 23:59:59`);
      return now >= startDate && now <= closeDate;
    }
    return false;
  };

  const formatDob = (dobStr) => {
    if (!dobStr) return "N/A";
    const cleanStr = dobStr.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dobStr;
  };

  const formatFullAddress = (addr, dist, st, pin) => {
    if (!addr && !dist && !st && !pin) return ".................................................";
    const parts = [];
    if (addr) parts.push(addr.trim());
    if (dist && (!addr || !addr.toLowerCase().includes(dist.toLowerCase()))) parts.push(dist.trim());
    if (st && (!addr || !addr.toLowerCase().includes(st.toLowerCase()))) parts.push(st.trim());
    if (pin && (!addr || !addr.includes(pin))) parts.push(pin.trim());
    return parts.join(", ") || ".................................................";
  };

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Trigger self-healing payment check
        try {
          await api.get("/api/Payment/check-status-advanced");
        } catch (e) {
          console.error("Automatic payment check failed", e);
        }

        const res = await api.get(`/api/UserPersonalDetails/complete/me`);
        if (res.data && res.data.success && res.data.data) {
          setProfile(res.data.data);

          // Fetch uploaded files if available
          try {
            const uploadsRes = await api.get(`/api/Uploads/user`);
            if (uploadsRes.data && uploadsRes.data.length > 0) {
              const uploadObj = uploadsRes.data[0] || uploadsRes.data;
              setUploads({
                photoFilePreview: uploadObj.photoFile
                  ? `${api.defaults.baseURL}/${uploadObj.photoFile}`
                  : "",
                signatureFilePreview: uploadObj.signatureFile
                  ? `${api.defaults.baseURL}/${uploadObj.signatureFile}`
                  : "",
                thumbFilePreview: uploadObj.thumbImp
                  ? `${api.defaults.baseURL}/${uploadObj.thumbImp}`
                  : "",
              });
            }
          } catch (e) {
            console.log("No uploads found yet");
          }

          try {
            const timelinesRes = await api.get(`/api/RegistrationTimeline`);
            if (timelinesRes.data) {
              setTimelines(timelinesRes.data);
            }
          } catch (e) {
            console.error("Error fetching timelines", e);
          }
        }
      } catch (err) {
        console.error("Error loading dashboard data", err);
        notification.error({
          message: "Error",
          description: "Failed to load dashboard data. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=1000,height=800");

    const todayFormatted = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const candidateDate = profile?.paymentDate ? formatDob(profile.paymentDate) : todayFormatted;
    const candidatePlace = profile?.district || profile?.examCity1 || ".................";
    const candidateAddress = formatFullAddress(profile?.mailingAddress, profile?.district, profile?.state, profile?.pinCode);

    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Application Form - ${profile.registrationNo || "DELED 2026"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 5mm 10mm; line-height: 1.35; background: white; font-size: 13px; }
    @page { size: A4; margin: 2mm 5mm; }
    @media print { body { margin: 0; padding: 2mm 5mm; } }
    
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; }
    .logo-header { display: flex; justify-content: center; align-items: center; gap: 15px; }
    .logo { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #333; object-fit: cover; }
    .header h2 { font-size: 14px; font-weight: bold; line-height: 1.2; margin: 0; }
    .header h3 { font-size: 13px; font-weight: bold; line-height: 1.2; margin: 3px 0; }
    .header p { font-size: 10px; color: #666; margin: 2px 0; }
    
    .main-content { display: flex; gap: 15px; margin-bottom: 8px; margin-top: 0; align-items: stretch; }
    .table-section { flex: 1; display: flex; flex-direction: column; }
    .photo-section { display: flex; flex-direction: column; gap: 12px; width: auto; flex-shrink: 0; }
    .photo-item { display: flex; flex-direction: column; gap: 4px; align-items: center; }
    .photo-box { border: 1px solid #000; background: #f0f0f0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .photo-box.large { width: 130px; height: 150px; }
    .photo-box.large img { width: 100%; height: 100%; object-fit: cover; }
    .photo-box.medium { width: 130px; height: 60px; background: white; }
    .photo-box.medium img { width: 100%; height: 100%; object-fit: contain; }
    .photo-label { font-size: 10px; text-align: center; color: #666; font-weight: bold; }
    
    table { width: 100%; height: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 0; }
    th { background: #e8e8e8; border: 1px solid #000; padding: 6px; text-align: left; font-weight: bold; }
    td { border: 1px solid #000; padding: 6px; }
    
    .declarations {
      border: 1px solid #000;
      padding: 10px 14px;
      margin: 10px 0;
      font-family: 'Utsaah', 'Nirmala UI', 'Mangal', 'Segoe UI', sans-serif !important;
    }
    .declarations h3 {
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .declarations .decl-intro {
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 8px;
      text-align: left;
    }
    .declarations ol {
      margin: 0 0 0 22px;
      font-size: 13px;
      line-height: 1.5;
    }
    .declarations li {
      margin-bottom: 5px;
      text-align: justify;
    }
    .decl-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #999;
      font-size: 13.5px;
      line-height: 1.6;
    }
    .decl-footer-left {
      flex: 1;
    }
    .decl-footer-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }
    .decl-sig-box {
      width: 130px;
      height: 50px;
      border: 1px solid #000;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
      overflow: hidden;
    }
    .decl-sig-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .field-val {
      font-weight: bold;
    }
    
    .signature { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; gap: 10px; }
    .sig-box { flex: 1; display: flex; flex-direction: column; align-items: center; }
    .sig-img { width: 80px; height: 50px; border: 1px solid #000; background: white; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; overflow: hidden; }
    .sig-img img { width: 100%; height: 100%; object-fit: contain; }
    .sig-label { font-size: 9px; text-align: center; color: #666; }
    
    .footer { text-align: center; font-size: 10px; color: #1d4ed8; font-weight: bold; margin-top: 10px; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header" style="border-bottom: none; margin-bottom: 5px;">
    <table style="width: 100%; border-collapse: collapse; text-align: center;">
      <tr>
        <td style="width: 20%; border: 1px solid #ccc; padding: 10px;">
          ${api.defaults.baseURL ? `<img src="${api.defaults.baseURL}/Logo/ubse_white.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain;" onerror="this.style.display='none'">` : ''}
        </td>
        <td style="width: 60%; border: 1px solid #ccc; padding: 10px;">
          <h2 style="font-size: 16px; margin: 0 0 5px 0;">उत्तराखण्ड विद्यालयी शिक्षा परिषद् रामनगर (नैनीताल)</h2>
          <h3 style="font-size: 14px; margin: 0 0 5px 0;">अध्यापक पात्रता परीक्षा (DELED) 2026</h3>
          <h3 style="font-size: 14px; margin: 0;">आवेदन पत्र समीक्षा</h3>
          ${!profile.isPaymentCompleted ? `<div style="font-size: 12px; font-weight: bold; color: #d32f2f; margin-top: 5px;">(UNPAID APPLICATION PREVIEW)</div>` : ''}
        </td>
        <td style="width: 20%; border: 1px solid #ccc; padding: 10px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=10&data=${encodeURIComponent(`https://ukdeled.com/verify/${profile?.registrationNo || 'N/A'}`)}" alt="QR Code" style="width: 90px; height: 90px; object-fit: contain;">
        </td>
      </tr>
    </table>
  </div>

  <!-- WARNING -->
  ${!profile.isPaymentCompleted ? `<div class="warning">आवेदक ऑनलाइन रजिस्ट्रेशन के समय भरे गये विवरण, ऑनलाइन फीस पेमेंट रसीद का प्रिंट आउट तथा पूर्ण आवेदन का प्रिंट आउट अपने पास अवश्य सुरक्षित रखें।</div>` : ''}

  <!-- MAIN CONTENT WITH PHOTOS -->
  <div class="main-content">
    <div class="table-section">
      <table>
        <tr>
          <th>Registration ID</th><td>${profile.registrationNo || "N/A"}</td>
          <th>प्रशिक्षण हेतु आवेदित वर्ग</th><td>${profile.appliedCategory || profile.subjectCode || "2-विज्ञानेत्तर वर्ग"}</td>
        </tr>
        <tr>
          <th>Graduation Course</th><td>${profile.graduationCourse || profile.deled1TrainingQualification || "N/A"}</td>
          <th>Name of University</th><td>${profile.graduationUniversity || profile.eligibilityCodeDELED1 || "N/A"}</td>
        </tr>
        <tr>
          <th>Graduation Date</th><td>${formatDob(profile.graduationDate || profile.deled1TrainingYear)}</td>
          <th>Candidate's Name</th><td>${profile.fullName || "N/A"}</td>
        </tr>
        <tr>
          <th>Mobile Number</th><td>${profile.phoneNumber || "N/A"}</td>
          <th>Email ID</th><td>${profile.email || "N/A"}</td>
        </tr>
        <tr>
          <th>Gender</th><td>${profile.gender || "N/A"}</td>
          <th>Date of Birth</th><td>${formatDob(profile.dob)}</td>
        </tr>
        <tr>
          <th>Father's Name</th><td>${profile.fatherName || "N/A"}</td>
          <th>Mother's Name</th><td>${profile.motherName || "N/A"}</td>
        </tr>
        <tr>
          <th>Husband's Name</th><td>${profile.husbandName || "N/A"}</td>
          <th>Category</th><td>${profile.category || "N/A"}</td>
        </tr>
        <tr>
          <th>Sub Category</th><td>${profile.subCategory || "N/A"}</td>
          <th>Retirement Date</th><td>${profile.retirementDate ? formatDob(profile.retirementDate) : "N/A"}</td>
        </tr>
        <tr>
          <th>खेल का प्रकार</th><td>${profile.sportsType || profile.eligibilityCodeDELED2 || "None"}</td>
          <th>Physically Handicapped</th><td>${profile.isPhysicallyHandicapped ? `YES (${profile.disabilityType || "N/A"})` : "NO"}</td>
        </tr>
        <tr>
          <th>Scribe Required</th><td>${profile.scribeRequired ? "YES" : "NO"}</td>
          <th>Exam City 1ˢᵗ</th><td>${profile.examCity1 || "N/A"}</td>
        </tr>
        <tr>
          <th>Exam City 2ⁿᵈ</th><td>${profile.examCity2 || "N/A"}</td>
          <th>Complete Mailing Address</th><td>${profile.mailingAddress || "N/A"}</td>
        </tr>
        <tr>
          <th>State</th><td>${profile.state || "N/A"}</td>
          <th>District</th><td>${profile.district || "N/A"}</td>
        </tr>
        <tr>
          <th>PIN Code</th><td>${profile.pinCode || "N/A"}</td>
          <th>Identity Proof</th><td>${profile.identityProof ? `${profile.identityProof} (${profile.identityProofNo || "N/A"})` : "N/A"}</td>
        </tr>
        ${profile.isPaymentCompleted ? `
        <tr>
          <th>Transaction ID</th><td>${profile.transactionId || "N/A"}</td>
          <th>Amount Paid (INR)</th><td>${profile.transactionAmount || "N/A"}</td>
        </tr>
        <tr>
          <th>Transaction Status</th><td>${profile.transactionStatus || "SUCCESS"}</td>
          <th>Transaction Date</th><td>${profile.paymentDate ? formatDob(profile.paymentDate) : "N/A"}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div class="photo-section">
      <div class="photo-item">
        <div class="photo-box large">
          ${uploads.photoFilePreview ? `<img src="${uploads.photoFilePreview}" alt="Photo">` : '<span style="color: #999; font-size: 10px;">Photo</span>'}
        </div>
        <div class="photo-label">Candidate Photo</div>
      </div>
      <div class="photo-item">
        <div class="photo-box medium">
          ${uploads.thumbFilePreview ? `<img src="${uploads.thumbFilePreview}" alt="Thumb">` : '<span style="color: #999; font-size: 8px;">Thumb</span>'}
        </div>
        <div class="photo-label">Left Hand Thumb</div>
      </div>
      <div class="photo-item">
        <div class="photo-box medium">
          ${uploads.signatureFilePreview ? `<img src="${uploads.signatureFilePreview}" alt="Signature">` : '<span style="color: #999; font-size: 8px;">Signature</span>'}
        </div>
        <div class="photo-label">Signature</div>
      </div>
    </div>
  </div>

  <!-- DECLARATIONS -->
  <div class="declarations">
    <h3>घोषणा :</h3>
    <p class="decl-intro">मैं <b><u>${profile.fullName || '.............................................'}</u></b> पुत्र / पुत्री श्री <b><u>${profile.fatherName || '.......................................'}</u></b> शपथपूर्वक घोषणा करता / करती हूँ कि –</p>
    <ol>
      <li>मैंने ‘‘प्रारंभिक शिक्षा में द्विवर्षीय डिप्लोमा (D.El.E.d.) प्रशिक्षण हेतु प्रवेश परीक्षा 2026 : सूचना विवरणिका’’ में अंकित अर्हताओं एवं दिशा-निर्देशों का भली-भाँति अध्ययन कर लिया है। मैं परीक्षा में सम्मिलित होने हेतु निर्धारित समस्त अर्हतायें पूर्ण करता/करती हूँ।</li>
      <li>मुझे ‘‘प्रारंभिक शिक्षा में द्विवर्षीय डिप्लोमा (D.El.E.d.) प्रशिक्षण हेतु प्रवेश परीक्षा 2026’’ हेतु जारी समस्त दिशा-निर्देश एवं शर्ते मान्य हैं।</li>
      <li>परीक्षा में सम्मिलित होने हेतु आवेदन पत्र में भरी गयी समस्त प्रविष्टियां मेरे मूल अभिलेखों पर आधारित हैं तथा मेरे संज्ञान में सही एवं सत्य हैं। मैंने कोई भी तथ्य नहीं छुपाया है। यदि परीक्षा के पूर्व अथवा बाद में जांच उपरान्त मेरे द्वारा दी गयी कोई भी सूचना असत्य अथवा त्रुटिपूर्ण पायी जाती है तो उत्तराखण्ड विद्यालयी शिक्षा परिषद् को मेरा अभ्यर्थन एवं परीक्षाफल निरस्त करने तथा मेरे विरूद्ध वैधानिक कार्यवाही करने का अधिकार होगा और उसका सम्पूर्ण उत्तरदायित्व मेरा होगा।</li>
      <li>आवेदन पत्र में अंकित सूचनाओं से सम्बन्धित सभी मूल अभिलेख/दस्तावेज (प्रमाण पत्र/अंक पत्र) आवेदन की अन्तिम तिथि के पूर्व से मेरे पास उपलब्ध हैं। इसमें किसी भी प्रकार की त्रुटि या कमी अथवा कोई तथ्य गलत पाये जाने अथवा तथ्य छुपाये जाने पर सम्पूर्ण उत्तरदायित्व मेरा होगा।</li>
      <li>निर्धारित तिथि तक नियत शुल्क जमा करने पर ही मेरा आवेदन ‘‘प्रारंभिक शिक्षा में द्विवर्षीय डिप्लोमा (D.El.E.d.) प्रशिक्षण हेतु प्रवेश परीक्षा 2026’’ हेतु विचारणीय होगा।</li>
      <li>मैं इस तथ्य से भली-भाँति अवगत हूँ कि द्विवर्षीय डी.एल.एड. प्रशिक्षण प्राप्त अभ्यर्थियों को प्रशिक्षणोपरांत राजकीय सेवा में सेवायोजित किये जाने की कोई बाध्यता नहीं है। तत्समय प्रचलित सेवा नियमावली में विहित न्यूनतम प्रशिक्षण/अन्य निर्धारित योग्यता धारित करने वाले अभ्यर्थियों को ही नियमानुसार सेवा में लिया जायेगा। शिक्षकों की नियुक्ति/चयन राज्य सरकार की संगत अध्यापक सेवा नियमावली तथा समय-समय पर जारी नियम/निर्देश के अन्तर्गत ही किया जाता है।</li>
      <li>मुझे परिषद् द्वारा पूर्व में किसी भी परीक्षा से प्रतिबन्धित (Debar) नहीं किया गया है।</li>
    </ol>

    <div class="decl-footer">
      <div class="decl-footer-left">
        <div><strong>स्थान :</strong> <span class="field-val">${candidatePlace}</span></div>
        <div><strong>दिनांक :</strong> <span class="field-val">${candidateDate}</span></div>
      </div>
      <div class="decl-footer-right">
        <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 6px;">
          ${uploads.signatureFilePreview ? `
            <div class="decl-sig-box">
              <img src="${uploads.signatureFilePreview}" alt="Signature">
            </div>
          ` : '<div style="width: 130px; height: 45px; border: 1px dashed #666; margin-bottom: 4px;"></div>'}
          <div style="font-weight: bold; font-size: 13px;">आवेदक के हस्ताक्षर</div>
        </div>
        <div style="text-align: left; width: 100%; max-width: 320px;">
          <div><strong>नाम :</strong> <span class="field-val">${profile.fullName || '.................................................'}</span></div>
          <div><strong>पता :</strong> <span class="field-val">${candidateAddress}</span></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(htmlDoc);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Spin size="large" tip="Loading application details..." />
        </div>
      </Layout>
    );
  }

  // Determine application states
  const hasApplied = profile && profile.personalDetailId;
  const isLocked = profile && profile.completedStep >= 4;
  const isPaymentCompleted = profile && profile.isPaymentCompleted;

  let isFeeClosed = false;
  if (timelines && timelines.length > 0) {
    const feeTimeline = timelines.find(t => t.key === "fee");
    if (feeTimeline && feeTimeline.dateValue) {
      const feeDate = new Date(`${feeTimeline.dateValue} 23:59:59`);
      if (new Date() >= feeDate) {
        isFeeClosed = true;
      }
    }
  }

  return (
    <Layout className="min-h-screen flex flex-col bg-amber-50/20 font-sans print:bg-white print:min-h-0">
      {/* Print Header - Shows only when printing */}
      
      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 print:p-0">
        {/* Dashboard Title & Welcome - Hidden when printing */}

        {/* Eye-catching status tracker at the top spanning full width */}
        {!showPreview && (
          <div className="mb-5 bg-white rounded-xl shadow-sm border-t-4 border-t-blue-700 border-x border-b border-gray-200 overflow-hidden print:hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-white px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 md:gap-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <span className="text-sm md:text-base">⚙️</span>
                  <span className="font-extrabold text-blue-700 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider">
                    Application Status Tracker
                  </span>
                  <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[7px] sm:text-[8px] md:text-[8px] uppercase font-bold tracking-widest animate-pulse">
                    LIVE
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5">
                  Please check your current progress and complete any pending
                  steps.
                </p>
              </div>

              {/* Quick Status Badges */}
              <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
                <span
                  className={`flex items-center gap-1 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-xs ${isLocked
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-orange-100 text-orange-800 border border-orange-200"
                    }`}
                >
                  {isLocked ? "🔒 Locked" : "✍️ Draft"}
                </span>
                <span
                  className={`flex items-center gap-1 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-xs ${isPaymentCompleted
                    ? "bg-blue-600 text-white border border-blue-700"
                    : "bg-red-500 text-white border border-red-600"
                    }`}
                >
                  {isPaymentCompleted ? "✅ Paid" : "⚠️ Unpaid"}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 items-center">
              {/* Visual Stepper / Progress Tracking */}
              <div className="md:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 md:gap-5 bg-[#fffef0]/60 p-2.5 sm:p-3 md:p-4 rounded-lg border border-amber-100/50">
                {/* Step 1: Registered & Application */}
                <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm shrink-0 ${hasApplied
                      ? "bg-blue-600 text-white"
                      : "bg-blue-700 text-white"
                      }`}
                  >
                    1
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] md:text-xs font-bold text-gray-800">
                      Application Form
                    </div>
                    <div
                      className={`text-[8px] sm:text-[9px] md:text-[9px] font-black uppercase tracking-wider ${hasApplied ? "text-blue-700" : "text-gray-400"
                        }`}
                    >
                      {hasApplied ? "COMPLETED" : "NOT STARTED"}
                    </div>
                  </div>
                </div>

                {/* Line connector for large screens */}
                <div className="hidden sm:block flex-1 h-[1.5px] bg-gray-200"></div>

                {/* Step 2: Lock Status */}
                <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm shrink-0 ${isLocked
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                      }`}
                  >
                    2
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] md:text-xs font-bold text-gray-800">
                      Lock Submission
                    </div>
                    <div
                      className={`text-[8px] sm:text-[9px] md:text-[9px] font-black uppercase tracking-wider ${isLocked ? "text-blue-700" : "text-gray-400"
                        }`}
                    >
                      {isLocked ? "LOCKED" : "PENDING"}
                    </div>
                  </div>
                </div>

                {/* Line connector for large screens */}
                <div className="hidden sm:block flex-1 h-[1.5px] bg-gray-200"></div>

                {/* Step 3: Fee Payment */}
                <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm shrink-0 ${isPaymentCompleted
                      ? "bg-blue-600 text-white"
                      : isLocked
                        ? "bg-amber-500 text-white animate-bounce"
                        : "bg-gray-200 text-gray-600"
                      }`}
                  >
                    3
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] md:text-xs font-bold text-gray-800">
                      Fee Payment
                    </div>
                    <div
                      className={`text-[8px] sm:text-[9px] md:text-[9px] font-black uppercase tracking-wider ${isPaymentCompleted
                        ? "text-blue-700"
                        : isLocked
                          ? "text-amber-600 animate-pulse font-bold"
                          : "text-gray-400"
                        }`}
                    >
                      {isPaymentCompleted ? "SUCCESS" : "PENDING"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Details & Action */}
              <div className="flex flex-col sm:flex-row md:flex-col justify-between sm:items-center md:items-stretch gap-2.5 sm:gap-3 md:gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                {profile && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-x-4 gap-y-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-semibold">
                    <div>
                      <span className="font-bold text-gray-400">Mobile:</span>{" "}
                      {profile.phoneNumber}
                    </div>
                    <div>
                      <span className="font-bold text-gray-400">Email:</span>{" "}
                      {profile.email}
                    </div>
                    {isPaymentCompleted && profile.paymentDate ? (
                      <div className="sm:col-span-2 md:col-span-1">
                        <span className="font-bold text-blue-700">
                          Paid:
                        </span>{" "}
                        <span className="font-mono text-gray-700">
                          {new Date(profile.paymentDate).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <div className="text-red-500 font-bold flex items-center gap-1 sm:col-span-2 md:col-span-1">
                        ⚠️ Payment Required
                      </div>
                    )}
                  </div>
                )}
                {isLocked && !isPaymentCompleted && !isFeeClosed && (
                  <button
                    onClick={() => navigate("/registration-form")}
                    className="py-1.5 sm:py-2 md:py-2.5 px-3 sm:px-4 md:px-5 bg-amber-600 hover:bg-amber-700 text-white text-[9px] sm:text-[10px] md:text-xs font-extrabold rounded shadow hover:scale-[1.01] transition duration-150 uppercase tracking-wider border-0 cursor-pointer text-center"
                  >
                    💳 Pay Fee
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Content Grid - Hidden when printing if preview is open */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 ${showPreview ? "print:hidden" : ""}`}
        >
          {/* Status Sidebar */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6 print:hidden">
            {/* My Profile Card */}
            <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white shadow-md h-fit font-sans">
              <div className="bg-blue-700 text-white text-center py-2 sm:py-2.5 md:py-3 font-extrabold text-xs sm:text-sm md:text-base tracking-wider uppercase">
                My Profile
              </div>

              <div className="bg-[#fffef0] p-4 sm:p-5 md:p-6 text-center border-b border-gray-200 flex flex-col items-center">
                <div className="w-24 h-24 mb-4 rounded-full bg-[#22c55e] flex items-center justify-center overflow-hidden shadow-sm border border-blue-100 shrink-0">
                  {uploads.photoFilePreview && !imageError ? (
                    <img
                      src={uploads.photoFilePreview}
                      alt="Applicant Photo"
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <FaUser className="w-10 sm:w-11 md:w-12 h-10 sm:h-11 md:h-12 text-[#6f42c1]" />
                  )}
                </div>
                <div className="text-red-600 font-extrabold text-base sm:text-lg md:text-xl tracking-wide mb-1">
                  {profile?.registrationNo || "Pending"}
                </div>
                <div className="text-gray-800 font-black text-xs sm:text-sm md:text-base uppercase tracking-wide">
                  {profile?.fullName || "Applicant"}
                </div>
              </div>

              <div className="bg-blue-700 text-white flex flex-col text-[10px] sm:text-xs md:text-sm font-bold divide-y divide-blue-800">
                <button
                  onClick={() => navigate("/application")}
                  className="flex items-center gap-2.5 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 hover:bg-blue-800 transition text-left w-full cursor-pointer text-white border-0"
                >
                  <FaHome className="w-3 sm:w-4 md:w-5 h-3 sm:h-4 md:h-5 text-amber-400" /> HOMEPAGE
                </button>
                <button
                  onClick={() => {
                    setPasswordError("");
                    setPasswordSuccess("");
                    setPasswordData({
                      oldPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setShowOldPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setShowPasswordModal(true);
                  }}
                  className="flex items-center gap-2.5 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 hover:bg-blue-800 transition text-left w-full cursor-pointer text-white border-0"
                >
                  <span>🔑</span> CHANGE PASSWORD
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 hover:bg-blue-800 transition text-left w-full cursor-pointer text-white border-0"
                >
                  <span>⏻</span> LOG OUT
                </button>
              </div>
            </div>
          </div>

          {/* Action Card Column */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6 print:hidden">
            {/* Application Menu */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-blue-600 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 flex items-center justify-between font-bold text-xs sm:text-sm md:text-base">
                <span>📝 Application Menu</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] sm:text-[9px] md:text-[10px] uppercase font-mono tracking-wider">
                  DELED 2026
                </span>
              </div>
              <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-600 font-medium">
                  Please fill out the application details step-by-step. Once
                  locked, you can preview and print your application form.
                </p>

                <div className={`grid grid-cols-1 ${isPaymentCompleted ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-3 sm:gap-4 md:gap-5 pt-2`}>
                  {/* Fill/Edit Button */}
                  {!isLocked && !isFeeClosed ? (
                    <button
                      onClick={() => navigate("/registration-form")}
                      className="flex items-center justify-center gap-2 p-3 sm:p-4 md:p-5 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs sm:text-sm md:text-base rounded-lg transition duration-200 shadow-md hover:scale-[1.01] cursor-pointer"
                    >
                      <span>✍️</span>{" "}
                      {hasApplied
                        ? "Edit / Complete Application"
                        : "Apply for DELED 2026"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 p-3 sm:p-4 md:p-5 bg-gray-100 text-gray-400 font-extrabold text-xs sm:text-sm md:text-base rounded-lg border border-gray-200 cursor-not-allowed"
                    >
                      <span>🔒</span> {isFeeClosed ? "Deadline Passed" : "Application Form Locked"}
                    </button>
                  )}

                  {/* Make Corrections Button */}
                  {isCorrectionWindowOpen() && profile?.isPaymentCompleted && (
                    <button
                      onClick={() => navigate("/correction")}
                      className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center justify-center gap-2 p-3 sm:p-4 md:p-5 bg-yellow-500 hover:bg-yellow-600 text-white font-extrabold text-xs sm:text-sm md:text-base rounded-lg transition duration-200 shadow-md hover:scale-[1.01] cursor-pointer"
                    >
                      <span>✏️</span> Make Corrections to Application
                    </button>
                  )}

                  {/* Print / Preview Button */}
                  {hasApplied ? (
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center justify-center gap-2 p-3 sm:p-4 md:p-5 bg-white hover:bg-gray-50 text-gray-700 font-extrabold text-xs sm:text-sm md:text-base rounded-lg border border-gray-300 transition duration-150 shadow-xs cursor-pointer"
                    >
                      <span>👁️</span>{" "}
                      {showPreview
                        ? "Hide Preview"
                        : "Preview & Print Application"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 p-3 sm:p-4 md:p-5 bg-gray-100 text-gray-400 font-extrabold text-xs sm:text-sm md:text-base rounded-lg border border-gray-200 cursor-not-allowed"
                    >
                      <span>🖨️</span> Print Application (Apply First)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Instruction Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gray-100 text-gray-800 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-bold text-[10px] sm:text-xs md:text-sm border-b border-gray-200">
                📌 Key Instructions
              </div>
              <div className="p-3 sm:p-4 md:p-5 text-[9px] sm:text-[10px] md:text-xs text-gray-600 space-y-2 sm:space-y-3 md:space-y-4 leading-relaxed">
                <p>
                  • Make sure all uploaded details match your original mark
                  sheets/documents.
                </p>
                <p>
                  • After confirming and locking the application, editing will
                  not be allowed.
                </p>
                <p>
                  • Ensure your payment is completed successfully. Only paid
                  applications will be considered for the examination.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Preview / Print Section */}
        {showPreview && profile && (
          <div className="mt-6 sm:mt-7 md:mt-8 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-5 md:p-6 print:border-none print:shadow-none print:p-0">
            {/* Preview Page Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 sm:pb-5 md:pb-6 mb-6 sm:mb-7 md:mb-8 border-b border-gray-200 print:hidden gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm md:text-base font-extrabold text-gray-800">
                📄 Application Form Preview
              </span>
              <div className="flex gap-2 sm:gap-3 md:gap-4">
                <button
                  onClick={handlePrint}
                  className="px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] sm:text-xs md:text-sm rounded-md shadow-xs transition"
                >
                  🖨️ Print Page
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 bg-gray-500 hover:bg-gray-600 text-white font-bold text-[9px] sm:text-xs md:text-sm rounded-md shadow-xs transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Print Styling Helper */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
              @media print {
                body {
                  background-color: white !important;
                  color: black !important;
                }
                .print-hidden, header, footer, nav, button {
                  display: none !important;
                }
                .print-full-width {
                  width: 100% !important;
                  max-width: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
              }
            `,
              }}
            />

            {/* Application Document Sheet */}
            <div className="print-full-width text-[9px] sm:text-xs md:text-sm text-gray-800 space-y-4 sm:space-y-5 md:space-y-6">
              {/* Header crest and title */}
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
                          अध्यापक पात्रता परीक्षा (DELED) 2026
                        </h3>
                        <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 leading-tight">
                          आवेदन पत्र समीक्षा
                        </h3>
                        {!profile.isPaymentCompleted && (
                          <div className="text-[10px] sm:text-xs md:text-sm font-bold text-red-600 mt-1 sm:mt-2">
                            (UNPAID APPLICATION PREVIEW)
                          </div>
                        )}
                      </td>
                      <td className="w-[20%] border border-gray-300 p-2 sm:p-3 text-center align-middle">
                        <div className="flex justify-center">
                          <QRCode
                            value={`https://ukdeled.com/verify/${profile.registrationNo}`}
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
              {!profile.isPaymentCompleted && (
                <div className="text-center text-red-600 font-extrabold text-[13px] border border-red-200 bg-red-50/50 p-3 rounded-lg leading-relaxed mb-4">
                  आवेदक ऑनलाइन रजिस्ट्रेशन के समय भरे गये विवरण, ऑनलाइन फीस
                  पेमेंट रसीद का प्रिंट आउट तथा पूर्ण आवेदन का प्रिंट आउट अपने
                  पास अवश्य सुरक्षित रखें। इनकी आवश्यकता इस प्रक्रिया के अगले
                  चरणों में पड़ेगी।
                </div>
              )}

              {/* Two-column review sheet with Photo */}
              <div className="flex flex-col md:flex-row print:flex-row gap-3 sm:gap-4 md:gap-5 items-start">
                <div className="flex-1 w-full overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-left min-w-[600px] text-[9px] sm:text-[10px] md:text-xs">
                    <tbody>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold w-1/4">
                          Registration ID
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-semibold text-gray-700 w-1/4">
                          {profile.registrationNo || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold w-1/4">
                          प्रशिक्षण हेतु आवेदित वर्ग
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-semibold text-gray-700 w-1/4">
                          {profile.appliedCategory || profile.subjectCode || "2-विज्ञानेत्तर वर्ग"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Graduation Course
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.graduationCourse || profile.deled1TrainingQualification || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Name of University
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.graduationUniversity || profile.eligibilityCodeDELED1 || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          स्नातक योग्यता प्राप्त करने की तिथि
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {formatDob(profile.graduationDate || profile.deled1TrainingYear)}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Applicant's Name
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          {profile.fullName || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Mobile No.
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.phoneNumber || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Email ID
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.email || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Gender
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.gender || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Date of Birth
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {formatDob(profile.dob)}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Father's Name
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.fatherName || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Mother's Name
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.motherName || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Husband Name
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.husbandName || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Category
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.category || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Sub Category
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.subCategory || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          सेना से सेवा-निवृत्ति की तिथि
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.retirementDate ? formatDob(profile.retirementDate) : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          खेल का प्रकार
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.sportsType || profile.eligibilityCodeDELED2 || "None"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Physically Handicapped
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.isPhysicallyHandicapped
                            ? `YES (${profile.disabilityType || "N/A"})`
                            : "NO"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Scribe Required
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.scribeRequired ? "YES" : "NO"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Exam City 1ˢᵗ
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.examCity1 || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Exam City 2ⁿᵈ
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.examCity2 || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Complete Mailing Address
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.mailingAddress || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          State
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.state || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          District
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.district || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          PIN Code
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.pinCode || "N/A"}
                        </td>
                        <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                          Identity Proof
                        </th>
                        <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                          {profile.identityProof
                            ? `${profile.identityProof} (${profile.identityProofNo || "N/A"})`
                            : "N/A"}
                        </td>
                      </tr>
                      {profile.isPaymentCompleted && (
                        <>
                          <tr>
                            <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                              Transaction ID
                            </th>
                            <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-mono">
                              {profile.transactionId || "N/A"}
                            </td>
                            <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                              Amount Paid (INR)
                            </th>
                            <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold text-blue-700">
                              {profile.transactionAmount || "N/A"}
                            </td>
                          </tr>
                          <tr>
                            <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                              Transaction Status
                            </th>
                            <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold text-emerald-600">
                              {profile.transactionStatus || "SUCCESS"}
                            </td>
                            <th className="border border-gray-300 bg-gray-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 font-bold">
                              Payment Date
                            </th>
                            <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                              {profile.paymentDate ? formatDob(profile.paymentDate) : "N/A"}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Profile photo block */}
                {/* Photo, Thumb & Signature */}
                <div className="w-full md:w-36 flex flex-row md:flex-col gap-3 shrink-0 items-center print:w-36">

                  {/* Photo */}
                  <div className="w-24 sm:w-28 md:w-32 h-32 sm:h-40 md:h-44 border border-gray-300 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                    {uploads.photoFilePreview ? (
                      <img
                        src={uploads.photoFilePreview}
                        alt="Candidate"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-[10px]">Photo</span>
                    )}
                  </div>

                  {/* Thumb */}
                  <div className="w-24 h-16 border border-gray-300 bg-white flex items-center justify-center overflow-hidden">
                    {uploads.thumbFilePreview ? (
                      <img
                        src={uploads.thumbFilePreview}
                        alt="Thumb"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[9px] text-gray-400">Thumb</span>
                    )}
                  </div>

                  {/* Signature */}
                  <div className="w-28 h-12 border border-gray-300 bg-white flex items-center justify-center overflow-hidden">
                    {uploads.signatureFilePreview ? (
                      <img
                        src={uploads.signatureFilePreview}
                        alt="Signature"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[9px] text-gray-400">Signature</span>
                    )}
                  </div>

                </div>
              </div>

              {/* Declarations (घोषणा) section */}
              <div
                className="font-utsaah border border-red-300 rounded-sm bg-red-50/50 p-4 sm:p-5 md:p-6 space-y-4 print:border-gray-300 print:bg-white text-gray-900"
                style={{ fontFamily: "'Utsaah', 'Nirmala UI', 'Mangal', 'Segoe UI', sans-serif" }}
              >
                <h3 className="text-center font-bold text-red-700 text-base sm:text-lg md:text-xl tracking-wide print:text-black">
                  घोषणा :
                </h3>
                <p className="font-medium text-gray-900 text-sm sm:text-base md:text-[17px] leading-relaxed">
                  मैं{" "}
                  <span className="font-bold underline">
                    {profile.fullName || "............................................."}
                  </span>{" "}
                  पुत्र / पुत्री श्री{" "}
                  <span className="font-bold underline">
                    {profile.fatherName || "......................................."}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-red-200 print:border-gray-300 text-xs sm:text-sm md:text-[15.5px]">
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-bold">स्थान : </span>
                      <span className="font-semibold">{profile?.district || profile?.examCity1 || "................."}</span>
                    </div>
                    <div>
                      <span className="font-bold">दिनांक : </span>
                      <span className="font-semibold">{profile?.paymentDate ? formatDob(profile.paymentDate) : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end">
                    <div className="flex flex-col items-center mb-2">
                      <div className="w-[140px] h-[55px] border border-gray-400 bg-white flex items-center justify-center overflow-hidden mb-1">
                        {uploads.signatureFilePreview ? (
                          <img
                            src={uploads.signatureFilePreview}
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
                        <span className="font-semibold">{profile.fullName || "................................................."}</span>
                      </div>
                      <div>
                        <span className="font-bold">पता : </span>
                        <span className="font-semibold">{formatFullAddress(profile?.mailingAddress, profile?.district, profile?.state, profile?.pinCode)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="font-extrabold text-base tracking-wide">
                CHANGE PASSWORD
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-white/80 hover:text-white text-xl font-bold cursor-pointer bg-transparent border-0"
              >
                ×
              </button>
            </div>
            <form autoComplete="off" onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded text-xs font-bold border border-red-200">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded text-xs font-bold border border-blue-200">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">
                  Old Password
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={passwordData.oldPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        oldPassword: e.target.value,
                      }))
                    }
                    className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 pr-10 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-700 focus:border-blue-700 outline-hidden bg-white text-gray-900"
                    placeholder="Enter old password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base cursor-pointer select-none focus:outline-hidden bg-transparent border-0"
                  >
                    {showOldPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 pr-10 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-700 focus:border-blue-700 outline-hidden bg-white text-gray-900"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base cursor-pointer select-none focus:outline-hidden bg-transparent border-0"
                  >
                    {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 pr-10 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-700 focus:border-blue-700 outline-hidden bg-white text-gray-900"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base cursor-pointer select-none focus:outline-hidden bg-transparent border-0"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer bg-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer border-0"
                >
                  {passwordLoading ? "CHANGING..." : "CHANGE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}


