import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, userApi } from "../stores/apiStore";
import { useAuthStore } from "../stores/authStore";
import { notification } from "antd";
import {
  FaDownload,
  FaFileCsv,
  FaFilePdf,
  FaEye,
  FaEyeSlash,
  FaUser,
  FaSignOutAlt,
  FaChartBar,
  FaFileAlt,
  FaEnvelope,
  FaUserEdit,
  FaCreditCard,
  FaCalendarAlt,
  FaBullhorn,
  FaLock,
  FaFolder,
  FaEdit,
  FaSearch,
  FaInbox,
  FaPhone,
  FaPaperPlane,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaIdCard,
  FaGraduationCap,
  FaWheelchair,
  FaSave,
  FaPlus,
  FaPlayCircle,
  FaStopCircle,
  FaInfoCircle,
  FaClock,
  FaPrint,
  FaSpinner,
  FaSync,
  FaSchool,
  FaArrowRight
} from "react-icons/fa";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const username = sessionStorage.getItem("username") || "Admin";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [printingRegNo, setPrintingRegNo] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live Dynamic States
  const [stats, setStats] = useState({
    totalRegistration: "0000",
    paidApplications: "0000",
    finalExamCount: "0000"
  });
  const [allApplications, setAllApplications] = useState([]);
  const [applications, setApplications] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeFilterStatus, setActiveFilterStatus] = useState("all");

  // Utility to format date strings as DD-MM-YYYY
  const formatDateToDDMMYYYY = (dateStr) => {
    if (!dateStr) return "-";
    if (typeof dateStr === "string") {
      const cleanStr = dateStr.trim().split("T")[0].split(" ")[0];
      const parts = cleanStr.split(/[-/.]/);
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[0]}`;
      }
    }
    return dateStr;
  };

  const formatPaymentDate = (dateStr) => {
    if (!dateStr) return "Completed";
    if (typeof dateStr === "string") {
      const parts = dateStr.trim().replace("T", " ").split(" ");
      const dateParts = parts[0].split(/[-/.]/);
      if (dateParts.length === 3 && dateParts[0].length === 4) {
        const formattedDate = `${dateParts[2].padStart(2, "0")}-${dateParts[1].padStart(2, "0")}-${dateParts[0]}`;
        return parts[1] ? `${formattedDate} ${parts[1]}` : formattedDate;
      }
    }
    return dateStr;
  };

  // States for payment status search
  const [paymentRegNo, setPaymentRegNo] = useState("");
  const [paymentResultText, setPaymentResultText] = useState("");

  // States for Review Paid Application tab (with sessionStorage persistence)
  const getSavedPaidFilters = () => {
    try {
      const saved = sessionStorage.getItem("reviewPaid_filters");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };
  const savedPaidFilters = getSavedPaidFilters();

  const [paidAppsList, setPaidAppsList] = useState([]);
  const [paidAppsLoading, setPaidAppsLoading] = useState(false);
  const [paidSearchQuery, setPaidSearchQuery] = useState(savedPaidFilters?.search || "");
  const [paidSortBy, setPaidSortBy] = useState(savedPaidFilters?.sortBy || "regNo"); // "regNo" | "paymentDate"
  const [paidSortOrder, setPaidSortOrder] = useState(savedPaidFilters?.sortOrder || "asc"); // "asc" | "desc"
  const [paidCurrentPage, setPaidCurrentPage] = useState(savedPaidFilters?.page || 1);
  const [paidPageSize, setPaidPageSize] = useState(savedPaidFilters?.pageSize || 10);
  const [paidTotalCount, setPaidTotalCount] = useState(0);
  const [selectedPaidApp, setSelectedPaidApp] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const fetchPaidApplications = async (page = 1, size = 10, search = "", sort = "asc", sortBy = "regNo") => {
    setPaidAppsLoading(true);
    try {
      const response = await api.get("/api/UserRegistrations/admin/paid-applications", {
        params: {
          page,
          pageSize: size,
          searchRegNo: search,
          sortBy: sortBy,
          sortOrder: sort
        }
      });
      if (response.data && response.data.success) {
        setPaidAppsList(response.data.data || []);
        setPaidTotalCount(response.data.totalCount || 0);
      } else {
        setPaidAppsList([]);
        setPaidTotalCount(0);
      }
    } catch (error) {
      console.error("Error fetching paid applications:", error);
      notification.error({
        message: "Fetch Error",
        description: "Could not fetch paid applications data."
      });
      setPaidAppsList([]);
      setPaidTotalCount(0);
    } finally {
      setPaidAppsLoading(false);
    }
  };

  const handlePaidSearch = (e) => {
    if (e) e.preventDefault();
    setPaidCurrentPage(1);
    fetchPaidApplications(1, paidPageSize, paidSearchQuery, paidSortOrder, paidSortBy);
  };

  const handleNextPaidApp = () => {
    if (!selectedPaidApp || paidAppsList.length === 0) return;
    const currentIndex = paidAppsList.findIndex(
      (app) => app.registrationNo === selectedPaidApp.registrationNo
    );

    if (currentIndex !== -1 && currentIndex < paidAppsList.length - 1) {
      setSelectedPaidApp(paidAppsList[currentIndex + 1]);
    } else {
      const totalPages = Math.ceil(paidTotalCount / paidPageSize);
      if (paidCurrentPage < totalPages) {
        const nextPage = paidCurrentPage + 1;
        setPaidCurrentPage(nextPage);
        setPaidAppsLoading(true);
        api.get("/api/UserRegistrations/admin/paid-applications", {
          params: {
            page: nextPage,
            pageSize: paidPageSize,
            searchRegNo: paidSearchQuery,
            sortBy: paidSortBy,
            sortOrder: paidSortOrder
          }
        }).then((response) => {
          if (response.data && response.data.success && response.data.data?.length > 0) {
            setPaidAppsList(response.data.data);
            setPaidTotalCount(response.data.totalCount || 0);
            setSelectedPaidApp(response.data.data[0]);
          }
        }).catch((err) => {
          console.error("Error loading next page paid app:", err);
        }).finally(() => {
          setPaidAppsLoading(false);
        });
      } else {
        notification.info({
          message: "End of Records",
          description: "You have reached the last paid application record."
        });
      }
    }
  };


  // Change Password States
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New Password and Confirm Password do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    setPasswordSubmitting(true);

    try {
      const response = await api.put("/api/Admin/change-password", {
        oldPassword,
        newPassword
      });

      if (response.data && response.data.success) {
        setPasswordSuccess("Password changed successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowOldPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        setPasswordError(response.data?.message || "Failed to change password.");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || "An error occurred while changing password.";
      setPasswordError(errMsg);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Broadcast Message Modal States
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastToEmails, setBroadcastToEmails] = useState("");
  const [broadcastCcEmails, setBroadcastCcEmails] = useState("");
  const [broadcastBccEmails, setBroadcastBccEmails] = useState("");
  const [broadcastMessageBody, setBroadcastMessageBody] = useState("");
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState("");
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);

  // CMS / Timelines States
  const [cmsTimelines, setCmsTimelines] = useState([]);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsSaving, setCmsSaving] = useState(false);
  const [showEmailReportPdf, setShowEmailReportPdf] = useState(false);
  const [pdfReportUrl, setPdfReportUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [reportDateWise, setReportDateWise] = useState([]);
  const [reportCityWise, setReportCityWise] = useState([]);
  const [reportStats, setReportStats] = useState({ deled1: 0, deled2: 0, both: 0 });
  const [reportLoading, setReportLoading] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [newTimelineKey, setNewTimelineKey] = useState("");
  const [newTimelineLabel, setNewTimelineLabel] = useState("");
  const [newTimelineDate, setNewTimelineDate] = useState("");
  const [newTimelineSubLabel, setNewTimelineSubLabel] = useState("");

  const handleAddTimeline = (e) => {
    if (e) e.preventDefault();
    const key = newTimelineKey.trim().toLowerCase();
    if (!key) {
      notification.error({
        message: "Validation Error",
        description: "Timeline key is required."
      });
      return;
    }

    if (cmsTimelines.some(t => t.key === key)) {
      notification.error({
        message: "Duplicate Key",
        description: `A timeline with key "${key}" already exists.`
      });
      return;
    }

    const newTimeline = {
      key,
      label: newTimelineLabel.trim() || key.toUpperCase(),
      dateValue: newTimelineDate.trim() || "",
      subLabel: newTimelineSubLabel.trim() || ""
    };

    setCmsTimelines([...cmsTimelines, newTimeline]);
    setNewTimelineKey("");
    setNewTimelineLabel("");
    setNewTimelineDate("");
    setNewTimelineSubLabel("");

    notification.success({
      message: "Timeline Card Added",
      description: `Timeline card "${key}" has been added. Click "Save CMS Settings" to save to the database.`
    });
  };

  // System Alerts CMS States
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [newAlertText, setNewAlertText] = useState("");
  const [newAlertIsActive, setNewAlertIsActive] = useState(true);
  const [editingAlert, setEditingAlert] = useState(null);

  const fetchSystemAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await api.get("/api/SystemAlerts");
      if (res.data && Array.isArray(res.data)) {
        setSystemAlerts(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch system alerts:", err);
      notification.error({
        message: "Alerts Fetch Error",
        description: "Could not load system alerts."
      });
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    if (!newAlertText.trim()) return;
    setAlertsSaving(true);
    try {
      if (editingAlert) {
        // Edit mode (PUT)
        const updatedAlert = {
          id: editingAlert.id,
          text: newAlertText.trim(),
          isActive: newAlertIsActive
        };
        await api.put(`/api/SystemAlerts/${editingAlert.id}`, updatedAlert);
        notification.success({
          message: "Alert Updated",
          description: "The alert has been successfully updated."
        });
        setEditingAlert(null);
        setNewAlertText("");
        setNewAlertIsActive(true);
        fetchSystemAlerts();
      } else {
        // Create mode (POST)
        const res = await api.post("/api/SystemAlerts", {
          text: newAlertText.trim(),
          isActive: newAlertIsActive
        });
        if (res.data) {
          notification.success({
            message: "Alert Created",
            description: "The alert has been successfully added."
          });
          setNewAlertText("");
          fetchSystemAlerts();
        }
      }
    } catch (err) {
      console.error("Failed to save alert:", err);
      notification.error({
        message: editingAlert ? "Error Updating Alert" : "Error Creating Alert",
        description: err.response?.data?.message || "Failed to save alert."
      });
    } finally {
      setAlertsSaving(false);
    }
  };

  const handleToggleAlertStatus = async (alert) => {
    try {
      const updatedAlert = {
        id: alert.id,
        text: alert.text,
        isActive: !alert.isActive
      };
      await api.put(`/api/SystemAlerts/${alert.id}`, updatedAlert);
      notification.success({
        message: "Alert Updated",
        description: "Alert status has been updated."
      });
      fetchSystemAlerts();
    } catch (err) {
      console.error("Failed to toggle alert status:", err);
      notification.error({
        message: "Error Updating Alert",
        description: err.response?.data?.message || "Failed to update alert."
      });
    }
  };

  const handleDeleteAlert = async (id) => {
    if (!window.confirm("Are you sure you want to delete this alert?")) return;
    try {
      await api.delete(`/api/SystemAlerts/${id}`);
      notification.success({
        message: "Alert Deleted",
        description: "Alert has been deleted successfully."
      });
      fetchSystemAlerts();
    } catch (err) {
      console.error("Failed to delete alert:", err);
      notification.error({
        message: "Error Deleting Alert",
        description: err.response?.data?.message || "Failed to delete alert."
      });
    }
  };

  useEffect(() => {
    if (activeTab === "alerts") {
      fetchSystemAlerts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "reviewPaid") {
      fetchPaidApplications(paidCurrentPage, paidPageSize, paidSearchQuery, paidSortOrder, paidSortBy);
    }
  }, [activeTab, paidCurrentPage, paidPageSize, paidSortOrder, paidSortBy]);

  // Persist Review Paid filters & pagination to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem("reviewPaid_filters", JSON.stringify({
        page: paidCurrentPage,
        pageSize: paidPageSize,
        search: paidSearchQuery,
        sortBy: paidSortBy,
        sortOrder: paidSortOrder
      }));
    } catch (e) {
      console.error("Failed to save reviewPaid filters to sessionStorage", e);
    }
  }, [paidCurrentPage, paidPageSize, paidSearchQuery, paidSortBy, paidSortOrder]);

  const fetchSubmissionReportData = async (start = "", end = "") => {
    setReportLoading(true);
    try {
      let url = "/api/UserRegistrations/admin/submission-report-data";
      const params = [];
      if (start) params.push(`startDate=${encodeURIComponent(start)}`);
      if (end) params.push(`endDate=${encodeURIComponent(end)}`);
      if (params.length > 0) {
        url += "?" + params.join("&");
      }
      const res = await api.get(url);
      if (res.data && res.data.success) {
        setReportDateWise(res.data.dateWise || []);
        setReportCityWise(res.data.cityWise || []);
        setReportStats({
          deled1: res.data.deled1Count || 0,
          deled2: res.data.deled2Count || 0,
          both: res.data.bothCount || 0
        });
      }
    } catch (err) {
      console.error("Failed to fetch submission report data:", err);
      notification.error({
        message: "Fetch Error",
        description: "Could not load submission report statistics."
      });
    } finally {
      setReportLoading(false);
    }
  };

  const fetchEmailReportPdf = async () => {
    setLoadingPdf(true);
    try {
      const response = await userApi.get("/api/UserRegistrations/admin/daily-report-pdf", {
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfReportUrl(url);
    } catch (error) {
      console.error("Error fetching daily report PDF:", error);
      notification.error({
        message: "Error",
        description: "Failed to load the PDF report from the email service."
      });
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleToggleEmailReportPdf = () => {
    if (!showEmailReportPdf) {
      setShowEmailReportPdf(true);
      if (!pdfReportUrl) {
        fetchEmailReportPdf();
      }
    } else {
      setShowEmailReportPdf(false);
    }
  };

  const handleDownloadEmailReportPdf = () => {
    if (pdfReportUrl) {
      const link = document.createElement("a");
      link.href = pdfReportUrl;
      link.download = `DELED_Daily_Report_${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleApplyDateFilter = () => {
    fetchSubmissionReportData(filterStartDate, filterEndDate);
  };

  const handleClearDateFilter = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    fetchSubmissionReportData("", "");
  };

  useEffect(() => {
    if (activeTab === "submission") {
      fetchSubmissionReportData("", "");
    }
  }, [activeTab]);


  const fetchCmsTimelines = async () => {
    setCmsLoading(true);
    try {
      const res = await api.get("/api/RegistrationTimeline");
      if (res.data && Array.isArray(res.data)) {
        const normalized = res.data.map(item => ({
          id: item.id || item.Id,
          key: item.key || item.Key,
          label: item.label || item.Label,
          dateValue: item.dateValue || item.DateValue,
          subLabel: item.subLabel || item.SubLabel
        }));
        setCmsTimelines(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch CMS timelines:", err);
      notification.error({
        message: "CMS Fetch Error",
        description: "Could not load registration timelines."
      });
    } finally {
      setCmsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "cms") {
      fetchCmsTimelines();
    }
  }, [activeTab]);

  const handleCmsSave = async (e) => {
    e.preventDefault();
    setCmsSaving(true);
    try {
      const response = await api.put("/api/RegistrationTimeline", cmsTimelines);
      if (response.data && response.data.success) {
        notification.success({
          message: "CMS Settings Saved",
          description: "Registration timelines have been successfully updated."
        });
      } else {
        notification.error({
          message: "CMS Save Failed",
          description: response.data?.message || "Failed to update timelines."
        });
      }
    } catch (err) {
      console.error("Failed to save CMS timelines:", err);
      notification.error({
        message: "CMS Save Failed",
        description: err.response?.data?.message || err.response?.data || "An error occurred while saving."
      });
    } finally {
      setCmsSaving(false);
    }
  };

  const handleBroadcastTrigger = async () => {
    setBroadcastSubmitting(true);
    try {
      const response = await api.post("/api/UserRegistrations/admin/create-broadcast");

      if (response.data && response.data.success) {
        notification.success({
          message: "Broadcast Sent",
          description: "Daily report email has been triggered and sent successfully to all recipients (including CC/BCC)!"
        });

        // Refresh dashboard logs
        setTimeout(() => {
          fetchDashboardData(currentPage, pageSize, activeSearchQuery, activeFilterStatus);
        }, 1500);
      } else {
        notification.error({
          message: "Broadcast Failed",
          description: response.data?.message || "Failed to trigger daily email broadcast."
        });
      }
    } catch (err) {
      notification.error({
        message: "Trigger Error",
        description: err.response?.data?.message || err.response?.data || "An error occurred while triggering broadcast."
      });
    } finally {
      setBroadcastSubmitting(false);
    }
  };

  // Update / Correction Tab States
  const [updateRegNo, setUpdateRegNo] = useState("");
  const [foundApplicant, setFoundApplicant] = useState(null);
  const [foundApplicantUploads, setFoundApplicantUploads] = useState(null);
  const [isSearchingApplicant, setIsSearchingApplicant] = useState(false);
  const [isSavingApplicant, setIsSavingApplicant] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [saveMessage, setSaveMessage] = useState({ text: "", type: "" });

  // Full Form States for Candidate Details
  const [editFullName, setEditFullName] = useState("");
  const [editFatherName, setEditFatherName] = useState("");
  const [editMotherName, setEditMotherName] = useState("");
  const [editHusbandName, setEditHusbandName] = useState("");
  const [editGender, setEditGender] = useState("MALE");
  const [editDOB, setEditDOB] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editIsPaymentCompleted, setEditIsPaymentCompleted] = useState(false);

  const [editAppliedCategory, setEditAppliedCategory] = useState("1-विज्ञान वर्ग");
  const [editGraduationCourse, setEditGraduationCourse] = useState("");
  const [editGraduationUniversity, setEditGraduationUniversity] = useState("");
  const [editGraduationDate, setEditGraduationDate] = useState("");

  const [editCategory, setEditCategory] = useState("GENERAL");
  const [editSubCategory, setEditSubCategory] = useState("NONE");
  const [editRetirementDate, setEditRetirementDate] = useState("");
  const [editSportsType, setEditSportsType] = useState("");
  const [editIsPhysicallyHandicapped, setEditIsPhysicallyHandicapped] = useState(false);
  const [editDisabilityType, setEditDisabilityType] = useState("");
  const [editMultiDisabilityType, setEditMultiDisabilityType] = useState("");
  const [editScribeRequired, setEditScribeRequired] = useState(false);

  const [editExamCity1, setEditExamCity1] = useState(0);
  const [editExamCity2, setEditExamCity2] = useState(0);

  const [editMailingAddress, setEditMailingAddress] = useState("");
  const [editStateId, setEditStateId] = useState(0);
  const [editDistrict, setEditDistrict] = useState(0);
  const [editPinCode, setEditPinCode] = useState("");
  const [editIdentityProof, setEditIdentityProof] = useState("Aadhar Card");
  const [editIdentityProofNo, setEditIdentityProofNo] = useState("");

  // States for metadata dropdowns
  const [examTypesList, setExamTypesList] = useState([]);
  const [ukCitiesList, setUkCitiesList] = useState([]);
  const [examCitiesList, setExamCitiesList] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [districtCitiesList, setDistrictCitiesList] = useState([]);

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
    "OTHER RECOGNIZED UNIVERSITY (अन्य मान्यता प्राप्त विश्वविद्यालय)"
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = ["Select", ...Array.from({ length: 45 }, (_, i) => (currentYear - i).toString())];

  const fetchDistrictCities = async (stateId) => {
    if (!stateId) {
      setDistrictCitiesList([]);
      return;
    }
    try {
      const response = await api.get(`/api/State_City/stateId?stateId=${stateId}`);
      setDistrictCitiesList(response.data || []);
    } catch (error) {
      console.error("Failed to fetch cities for state:", error);
      setDistrictCitiesList([]);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [statesRes, examCitiesRes] = await Promise.all([
          api.get("/api/State_City/states").catch(() => ({ data: [] })),
          api.get("/api/State_City/examCities").catch(() => ({ data: [] }))
        ]);
        if (statesRes.data) setStatesList(statesRes.data);
        if (examCitiesRes.data) setExamCitiesList(examCitiesRes.data);
      } catch (err) {
        console.error("Failed to load metadata dropdowns:", err);
      }
    };
    fetchMetadata();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get("/api/UserRegistrations/count");
      if (response.data && response.data.success) {
        const totalReg = response.data.totalRegistration !== undefined
          ? response.data.totalRegistration
          : (response.data.TotalRegistration !== undefined
            ? response.data.TotalRegistration
            : (response.data.count !== undefined ? response.data.count : 0));

        const paidReg = response.data.paidCount !== undefined
          ? response.data.paidCount
          : (response.data.PaidCount !== undefined
            ? response.data.PaidCount
            : (response.data.paidApplications !== undefined ? response.data.paidApplications : 0));

        setStats(prev => ({
          ...prev,
          totalRegistration: String(totalReg).padStart(4, "0"),
          paidApplications: String(paidReg).padStart(4, "0")
        }));
      }
    } catch (error) {
      console.error("Failed to fetch registration count:", error);
    }
  };

  const fetchDashboardData = async (page = currentPage, size = pageSize, search = activeSearchQuery, status = activeFilterStatus) => {
    setIsSearching(true);
    try {
      const response = await api.get(`/api/UserRegistrations/admin/dashboard-data?page=${page}&pageSize=${size}&searchQuery=${encodeURIComponent(search)}&filterStatus=${status}`);
      if (response.data && response.data.success) {
        const data = response.data;
        setStats(prev => ({
          ...prev,
          finalExamCount: data.stats?.finalExamCount || prev.finalExamCount
        }));
        setAllApplications(data.applications || []);
        setApplications(data.applications || []);
        setTotalApplicationsCount(data.totalApplicationsCount || 0);
        setEmailLogs(data.emailLogs || []);
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error("Failed to fetch admin dashboard data:", error);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchDashboardData(currentPage, pageSize, activeSearchQuery, activeFilterStatus);
  }, [currentPage, pageSize, activeSearchQuery, activeFilterStatus]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // Fetch Exam Types
        const examTypesRes = await api.get("/api/State_City/examTypes");
        setExamTypesList(examTypesRes.data || []);

        // Fetch States to find Uttarakhand and get cities
        const statesRes = await api.get("/api/State_City");
        const list = statesRes.data || [];
        setStatesList(list);
        const ukState = list.find(s => s.name.toLowerCase().includes("uttarakhand"));
        const ukId = ukState ? ukState.id : (list[0]?.id || 35); // Default to 35 if not found

        // Fetch Cities
        const citiesRes = await api.get(`/api/State_City/stateId?stateId=35`);
        setUkCitiesList(citiesRes.data || []);

        // Fetch Exam Cities
        try {
          const examCitiesRes = await api.get("/api/State_City/examCities");
          setExamCitiesList(examCitiesRes.data || []);
        } catch (e) {
          console.error("Failed to load exam cities", e);
        }
      } catch (error) {
        console.error("Failed to fetch metadata:", error);
      }
    };
    fetchMetadata();
  }, []);

  const totalRegCount = stats.totalRegistration;
  const paidRegCount = stats.paidApplications;

  // Compute Submission counts dynamically
  const deled1SubmissionsCount = String(reportStats.deled1).padStart(4, "0");
  const deled2SubmissionsCount = String(reportStats.deled2).padStart(4, "0");
  const bothSubmissionsCount = String(reportStats.both).padStart(4, "0");

  // Compute Recent Submissions dynamically
  const recentSubmissionsList = allApplications.length > 0
    ? allApplications
      .filter(app => app.appliedFor !== "Not Selected")
      .slice(0, 5)
      .map(app => ({
        regNo: app.regNo,
        message: `${app.name} registered for ${app.appliedFor}`,
        time: app.date
      }))
    : [];

  if (recentSubmissionsList.length === 0 && allApplications.length > 0) {
    // Fallback if none have filled details yet
    allApplications.slice(0, 5).forEach(app => {
      recentSubmissionsList.push({
        regNo: app.regNo,
        message: `${app.name} created user registration`,
        time: app.date
      });
    });
  }

  const handleExportCSV = async () => {
    try {
      notification.info({
        message: "Generating Export",
        description: "Fetching matching records for export, please wait...",
        duration: 2
      });
      const response = await api.get(`/api/UserRegistrations/admin/dashboard-data?searchQuery=${encodeURIComponent(activeSearchQuery)}&filterStatus=${filterStatus}`);
      if (response.data && response.data.success) {
        const exportApps = response.data.applications || [];
        if (exportApps.length === 0) {
          notification.warning({
            message: "Export Failed",
            description: "No data available to export."
          });
          return;
        }

        const headers = [
          "Registration No",
          "Candidate Name",
          "Mobile Number",
          "Email Address",
          "Applied For",
          "Clear Pass",
          "Payment Status",
          "Gateway Status",
          "Paid Amount",
          "Registration Date"
        ];

        const rows = exportApps.map(app => [
          app.regNo || "",
          app.name || "",
          app.mobile || "",
          app.email || "",
          app.appliedFor || "",
          app.clearPass || "",
          app.status || "",
          app.txnStatus || "PENDING",
          app.amount || "",
          app.date || ""
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map(row =>
            row.map(value => {
              const escaped = String(value).replace(/"/g, '""');
              return escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")
                ? `"${escaped}"`
                : escaped;
            }).join(",")
          )
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `DELED_Submission_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Export failed:", err);
      notification.error({
        message: "Export Error",
        description: "Could not generate export file."
      });
    }
  };

  const handleExportPDF = () => {
    const printWindow = window.open("", "", "width=1000,height=800");
    if (!printWindow) {
      notification.error({
        message: "Pop-up Blocked",
        description: "Please allow pop-ups for this site to export the PDF."
      });
      return;
    }

    const cityGrandTotal = reportCityWise.reduce((acc, row) => acc + (row.deled || row.Deled || row.total || row.Total || 0), 0);
    const totalRegReportCount = reportDateWise.reduce((acc, row) => acc + (row.regNo || row.RegNo || 0), 0);
    const totalFeesReportCount = reportDateWise.reduce((acc, row) => acc + (row.feesNo || row.FeesNo || 0), 0);

    const filterInfo = (filterStartDate || filterEndDate)
      ? `Filter Period: ${filterStartDate || 'Start'} to ${filterEndDate || 'End'}`
      : "Consolidated Report (All-Time)";

    const logoHtml = userApi.defaults.baseURL
      ? `<img src="${userApi.defaults.baseURL}/Logo/ubse_white.jpg" alt="Logo" class="logo" onerror="this.style.display='none'">`
      : '';

    const dateRowsHtml = reportDateWise.length === 0
      ? `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">No report data found for the selected period.</td></tr>`
      : reportDateWise.map((row, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${row.date || row.Date || ""}</td>
          <td style="text-align: center;">${row.regNo || row.RegNo || 0}</td>
          <td style="text-align: center; font-weight: 600;">${row.regCumm || row.RegCumm || 0}</td>
          <td style="text-align: center;">${row.feesNo || row.FeesNo || 0}</td>
          <td style="text-align: center; font-weight: 600; color: #047857;">${row.feesCumm || row.FeesCumm || 0}</td>
        </tr>
      `).join('');

    const cityRowsHtml = reportCityWise.length === 0
      ? `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8;">No report data found.</td></tr>`
      : `${reportCityWise.map((row, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${row.cityName || row.CityName || ""}</td>
          <td style="text-align: center; font-weight: bold;">${row.deled || row.Deled || row.total || row.Total || 0}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td></td>
        <td>TOTAL</td>
        <td style="text-align: center; font-size: 12px;">${cityGrandTotal}</td>
      </tr>`;

    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Submission Report Summary - DELED 2026</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 15mm; line-height: 1.4; background: white; color: #333; }
    @page { size: A4; margin: 10mm; }
    @media print { 
      body { margin: 0; padding: 10mm; } 
      .no-print { display: none !important; }
    }
    
    .header { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 20px; }
    .header table { width: 100%; border: none; border-collapse: collapse; }
    .header td { border: none; padding: 4px; }
    .logo { width: 70px; height: 70px; object-fit: contain; }
    .header h2 { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0; }
    .header h3 { font-size: 14px; font-weight: bold; color: #334155; margin: 4px 0; }
    .header p { font-size: 11px; color: #64748b; margin-top: 4px; }
    
    .report-meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 15px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
    .summary-card { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; }
    .summary-label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
    .summary-value { font-size: 20px; font-weight: bold; color: #1e293b; }
    
    .section-title { font-size: 12px; font-weight: bold; color: #1e293b; text-transform: uppercase; margin-bottom: 8px; border-left: 3px solid #0f766e; padding-left: 8px; }
    
    table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
    table.data-table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold; color: #334155; }
    table.data-table td { border: 1px solid #cbd5e1; padding: 8px; color: #475569; }
    table.data-table tr.total-row { font-weight: bold; background: #f8fafc; }
    table.data-table tr.total-row td { color: #1e293b; border-top: 2px solid #94a3b8; }
    
    .footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>

  <!-- TOOLBAR -->
  <div class="no-print" style="background: #f8f9fa; padding: 12px 20px; display: flex; justify-content: flex-end; gap: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 14px;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0f766e; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px;">
      🖨️ Print / Save PDF
    </button>
    <button onclick="window.close()" style="padding: 8px 16px; background: #64748b; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px;">
      Close
    </button>
  </div>

  <!-- HEADER -->
  <div class="header">
    <table>
      <tr>
        <td style="width: 15%; text-align: left; vertical-align: middle;">
          ${logoHtml}
        </td>
        <td style="width: 85%; text-align: left; padding-left: 10px;">
          <h2>उत्तराखण्ड विद्यालयी शिक्षा परिषद् रामनगर (नैनीताल)</h2>
          <h3> (DELED) 2026</h3>
          <p style="font-size: 13px; font-weight: bold; color: #0f766e; margin-top: 5px;">SUBMISSION REPORT SUMMARY</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- METADATA -->
  <div class="report-meta">
    <span><strong>Report Range:</strong> ${filterInfo}</span>
    <span><strong>Generated On:</strong> ${new Date().toLocaleString()}</span>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="summary-grid">
    <div class="summary-card">
      <span class="summary-label">Total Registrations</span>
      <span class="summary-value">${String(totalRegReportCount).padStart(4, "0")}</span>
    </div>
    <div class="summary-card">
      <span class="summary-label">Total Fees Paid</span>
      <span class="summary-value">${String(totalFeesReportCount).padStart(4, "0")}</span>
    </div>
    <div class="summary-card">
      <span class="summary-label">DELED Paid Applications</span>
      <span class="summary-value">${String(cityGrandTotal).padStart(4, "0")}</span>
    </div>
  </div>

  <!-- DATE WISE SUBMISSION REPORT -->
  <div class="section-title">Date Wise Form Submission Report</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: center; width: 80px;">Sr. No.</th>
        <th>Date</th>
        <th style="text-align: center;">Reg. No.</th>
        <th style="text-align: center;">Reg. Cumm.</th>
        <th style="text-align: center;">Fees Paid No.</th>
        <th style="text-align: center;">Fees Paid Cumm.</th>
      </tr>
    </thead>
    <tbody>
      ${dateRowsHtml}
    </tbody>
  </table>

  <!-- EXAM CITY WISE SUBMISSION REPORT -->
  <div class="section-title">Exam City Wise Application Count Report</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: center; width: 80px;">Sr. No.</th>
        <th>Exam City Code/Name</th>
        <th style="text-align: center;">DELED</th>
      </tr>
    </thead>
    <tbody>
      ${cityRowsHtml}
    </tbody>
  </table>

  <!-- FOOTER -->
  <div class="footer">
    <p>© Uttarakhand Board of School Education - DELED 2026. This is a computer-generated administrative report.</p>
  </div>

</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setActiveSearchQuery(searchQuery);
    setActiveFilterStatus(filterStatus);
  };

  const handlePrintApplicant = async (regNo) => {
    if (printingRegNo) return;
    setPrintingRegNo(regNo);
    try {
      const response = await userApi.get(`/api/UserRegistrations/admin/applicant-complete/${regNo}`);
      if (response.data && response.data.success) {
        const applicantData = response.data.data;
        const uploadsData = response.data.uploads;
        generateAndPrintPDF(applicantData, uploadsData);
      } else {
        notification.error({
          message: "Error",
          description: "Failed to fetch candidate details."
        });
      }
    } catch (error) {
      console.error("Print fetch error:", error);
      notification.error({
        message: "Error",
        description: error.response?.data?.message || "Failed to retrieve candidate print data."
      });
    } finally {
      setPrintingRegNo(null);
    }
  };

  const generateAndPrintPDF = (profile, uploadsData) => {
    const printWindow = window.open("", "", "width=1000,height=800");

    const uploads = {
      photoFilePreview: uploadsData?.photoFile ? `${userApi.defaults.baseURL}/${uploadsData.photoFile}` : "",
      signatureFilePreview: uploadsData?.signatureFile ? `${userApi.defaults.baseURL}/${uploadsData.signatureFile}` : "",
      thumbFilePreview: uploadsData?.thumbImp ? `${userApi.defaults.baseURL}/${uploadsData.thumbImp}` : "",
    };

    const isNotDeled1 = (applyFor) => {
      const val = (applyFor || "").toUpperCase().replace(/\s+/g, "").replace(/[-_]/g, "");
      return val !== "DELEDI" && val !== "DELED1";
    };

    const isNotDeled2 = (applyFor) => {
      const val = (applyFor || "").toUpperCase().replace(/\s+/g, "").replace(/[-_]/g, "");
      return val !== "DELEDII" && val !== "DELED2";
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

    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Application Form - ${profile.registrationNo || "DELED 2026"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Utsaah', Arial, sans-serif; padding: 10mm; line-height: 1.3; background: white; }
    @page { size: A4; margin: 10mm; }
    @media print { 
      body { margin: 0; padding: 10mm; } 
      .no-print { display: none !important; }
    }
    
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .logo-header { display: flex; justify-content: center; align-items: center; gap: 15px; }
    .logo { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #333; object-fit: cover; }
    .header h2 { font-size: 14px; font-weight: bold; line-height: 1.2; margin: 0; }
    .header h3 { font-size: 13px; font-weight: bold; line-height: 1.2; margin: 3px 0; }
    .header p { font-size: 10px; color: #666; margin: 2px 0; }
    
    .main-content { display: flex; gap: 15px; margin-bottom: 12px; }
    .table-section { flex: 1; }
    .photo-section { display: flex; flex-direction: column; gap: 12px; width: auto; flex-shrink: 0; }
    .photo-item { display: flex; flex-direction: column; gap: 4px; align-items: center; }
    .photo-box { border: 1px solid #000; background: #f0f0f0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .photo-box.large { width: 130px; height: 140px; }
    .photo-box.medium { width: 90px; height: 70px; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .photo-label { font-size: 8px; text-align: center; color: #666; }
    
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
    th { background: #e8e8e8; border: 1px solid #000; padding: 6px; text-align: left; font-weight: bold; }
    td { border: 1px solid #000; padding: 6px; }
    
    .warning { border: 2px solid #d32f2f; background: #ffebee; padding: 10px; margin: 12px 0; font-size: 10px; color: #b71c1c; text-align: center; }
    
    .declarations { border: 1px solid #000; padding: 12px; margin: 15px 0; }
    .declarations h3 { text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 8px; }
    .declarations p { font-size: 10px; text-align: center; margin-bottom: 8px; line-height: 1.3; }
    .declarations ol { margin: 0 0 0 18px; font-size: 10px; line-height: 1.4; }
    .declarations li { margin-bottom: 6px; }
    
    .signature { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; gap: 10px; }
    .sig-box { flex: 1; display: flex; flex-direction: column; align-items: center; }
    .sig-img { width: 80px; height: 50px; border: 1px solid #000; background: white; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; overflow: hidden; }
    .sig-img img { width: 100%; height: 100%; object-fit: contain; }
    .sig-label { font-size: 9px; text-align: center; color: #666; }
    
    .footer { text-align: center; font-size: 10px; color: #1d4ed8; font-weight: bold; margin-top: 10px; }
  </style>
</head>
<body>

  <!-- TOOLBAR -->
  <div class="no-print" style="background: #f8f9fa; padding: 12px 20px; display: flex; justify-content: flex-end; gap: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px; font-family: 'Utsaah', Arial, sans-serif; font-size: 14px;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #1e40af; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px;">
      🖨️ Print PDF
    </button>
    <button onclick="window.close()" style="padding: 8px 16px; background: #64748b; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px;">
      Close
    </button>
  </div>

  <!-- HEADER -->
  <div class="header" style="border-bottom: none; margin-bottom: 20px;">
    <table style="width: 100%; border-collapse: collapse; text-align: center;">
      <tr>
        <td style="width: 20%; border: 1px solid #ccc; padding: 10px;">
          ${userApi.defaults.baseURL ? `<img src="${userApi.defaults.baseURL}/Logo/ubse_white.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain;" onerror="this.style.display='none'">` : ''}
        </td>
        <td style="width: 60%; border: 1px solid #ccc; padding: 10px;">
          <h2 style="font-size: 16px; margin: 0 0 5px 0;">उत्तराखण्ड विद्यालयी शिक्षा परिषद् रामनगर (नैनीताल)</h2>
          <h3 style="font-size: 14px; margin: 0 0 5px 0;"> (DELED) 2026</h3>
          <h3 style="font-size: 14px; margin: 0;">आवेदन पत्र समीक्षा</h3>
          ${!profile.isPaymentCompleted ? `<div style="font-size: 12px; font-weight: bold; color: #d32f2f; margin-top: 5px;">(UNPAID APPLICATION PREVIEW)</div>` : ''}
        </td>
        <td style="width: 20%; border: 1px solid #ccc; padding: 10px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=10&data=${encodeURIComponent(`Reg No: ${profile.registrationNo || 'N/A'}\nName: ${profile.fullName || 'N/A'}\nDOB: ${formatDob(profile.dob)}\nExam: ${profile.applicationFor || 'N/A'}\nStatus: ${profile.isPaymentCompleted ? 'Paid' : 'Unpaid'}`)}" alt="QR Code" style="width: 90px; height: 90px; object-fit: contain;">
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
          <th>Registration ID</th><td><b>${profile.registrationNo || "N/A"}</b></td>
          <th>Applied Category</th><td>${profile.appliedCategory || profile.applicationFor || "N/A"}</td>
        </tr>
        <tr>
          <th>Candidate's Name</th><td>${profile.fullName || "N/A"}</td>
          <th>Gender</th><td>${profile.gender || "N/A"}</td>
        </tr>
        <tr>
          <th>Father's Name</th><td>${profile.fatherName || "N/A"}</td>
          <th>Mother's Name</th><td>${profile.motherName || "N/A"}</td>
        </tr>
        <tr>
          <th>Date of Birth</th><td>${formatDob(profile.dob)}</td>
          <th>Mobile Number</th><td>${profile.phoneNumber || "N/A"}</td>
        </tr>
        <tr>
          <th>Email ID</th><td>${profile.email || "N/A"}</td>
          <th>Husband's Name</th><td>${profile.husbandName || "N/A"}</td>
        </tr>
        <tr>
          <th>Category</th><td>${profile.category || "N/A"}</td>
          <th>Sub Category</th><td>${profile.subCategory || "N/A"}${profile.subCategory === 'EX-SERVICEMAN (Self)' && profile.retirementDate ? ` (Retirement Date: ${formatDob(profile.retirementDate)})` : ''}${profile.subCategory === 'SPORTS' && profile.sportsType ? ` (${profile.sportsType})` : ''}</td>
        </tr>
        <tr>
          <th>Physically Handicapped</th><td>${profile.isPhysicallyHandicapped ? `YES (${profile.disabilityType || "N/A"}${profile.disabilityType === 'Multiple Disabilities' && profile.multiDisabilityType ? ` - ${profile.multiDisabilityType}` : ''})` : "NO"}</td>
          <th>Scribe Required</th><td>${profile.scribeRequired ? "YES" : "NO"}</td>
        </tr>
        <tr>
          <th>Mailing Address</th><td colspan="3">${profile.mailingAddress || "N/A"}, ${profile.district || "N/A"}, ${profile.state || "N/A"} - ${profile.pinCode || "N/A"}</td>
        </tr>
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
          ${uploads.thumbFilePreview ? `<img src="${uploads.thumbFilePreview}" alt="Thumb">` : '<span style="color: #999; font-size: 8px;">Thumb Impression</span>'}
        </div>
        <div class="photo-label">Thumb Impression</div>
      </div>
      <div class="photo-item">
        <div class="photo-box medium">
          ${uploads.signatureFilePreview ? `<img src="${uploads.signatureFilePreview}" alt="Signature">` : '<span style="color: #999; font-size: 8px;">Signature</span>'}
        </div>
        <div class="photo-label">Signature</div>
      </div>
    </div>
  </div>

  <!-- ACADEMIC & GRADUATION TABLE -->
  <table>
    <tr style="background: #f0f0f0;">
      <th colspan="4">प्रशिक्षण हेतु आवेदित वर्ग एवं स्नातक योग्यता विवरण (Academic & Graduation Details)</th>
    </tr>
    <tr>
      <th>Applied Category (आवेदित वर्ग)</th><td>${profile.appliedCategory || profile.applicationFor || "N/A"}</td>
      <th>Graduation Course (स्नातक परीक्षा)</th><td>${profile.graduationCourse || "N/A"}</td>
    </tr>
    <tr>
      <th>University Name (विश्वविद्यालय)</th><td>${profile.graduationUniversity || "N/A"}</td>
      <th>Graduation Date (उत्तीर्ण तिथि)</th><td>${formatDob(profile.graduationDate)}</td>
    </tr>
    <tr style="background: #f0f0f0;">
      <th colspan="4">Exam Centers & Identification</th>
    </tr>
    <tr>
      <th>Exam City 1</th><td>${profile.examCity1 || "N/A"}</td>
      <th>Exam City 2</th><td>${profile.examCity2 || "N/A"}</td>
    </tr>
    <tr>
      <th>Identity Proof</th><td>${profile.identityProof || "N/A"}</td>
      <th>Identity Proof No.</th><td>${profile.identityProofNo || "N/A"}</td>
    </tr>
     <tr>
      <th>Transaction ID</th><td>${profile.transactionId || "N/A"}</td>
      <th>Amount Paid (INR)</th><td>${profile.transactionAmount || "N/A"}</td>
    </tr>
     <tr>
      <th>Transaction Status</th><td>${profile.transactionStatus || "N/A"}</td>
      <th>Transaction Date</th><td>${profile.transactionDate || "N/A"}</td>
    </tr>
  </table>

  <!-- DECLARATIONS -->
  <div class="declarations">
    <h3>घोषणा</h3>
    <p>मैं <b>${profile.fullName}</b> पुत्र/पुत्री श्री <b>${profile.fatherName}</b> शपथपूर्वक घोषणा करता/करती हूँ कि :</p>
    <ol>
      <li>
              मैंने "उत्तराखंड  प्रथम एवं द्वितीय (DELED I & II) 2026: सूचना विवरणिका" में   अंकित अर्हताओं एवं दिशा - निर्देशों का भली - भाँति अध्ययन कर लिया है । मैं परीक्षा में सम्मिलित होने हेतु निर्धारित समस्त अर्हतायें पूर्ण करता/करती हूँ।
            </li>
            <li>
              मुझे "उत्तराखंड  प्रथम एवं द्वितीय 2026 हेतु जारी समस्त दिशा-निर्देश एवं शर्तें मान्य हैं।
            </li>
            <li>
परीक्षा में सम्मिलित होने हेतु आवेदन पत्र में भरी गयी समस्त प्रविष्टियाँ मेरे मूल अभिलेखों  पर आधारित हैं तथा मेरे संज्ञान में सही एवं सत्य हैं। मैंने कोई भी तथ्य नहीं छुपाया है। यदि परीक्षा के पूर्व अथवा बाद में जांचोपरान्त मेरे द्वारा दी गयी कोई भी सूचना असत्य अथवा त्रुटिपूर्ण पायी जाती है तो उत्तराखंड विद्यालयी शिक्षा परिषद को मेरा अभ्यर्थन एवं परीक्षाफल निरस्त करने तथा मेरे विरुद्ध वैधानिक कार्यवाही करने का अधिकार होगा और उसका सम्पूर्ण उत्तरदायित्व मेरा होगा।            </li>
            <li>
आवेदन पत्र में अंकित सूचनाओं से सम्बन्धित सभी मूल अभिलेख / दस्तावेज (प्रमाण / अंक पत्र ). आवेदन की तिथि से पूर्व से मेरे पास उपलब्ध हैं। इसमें किसी भी प्रकार की त्रुटि या कमी अथवा कोई तथ्य गलत पाये जाने पर सम्पूर्ण उत्तरदायित्व मेरा होगा।
            </li>
            <li>
निर्धारित तिथि तक नियत शुल्क जमा करने पर ही मेरा आवेदन उत्तराखंड  (DELED) 2026 हेतु विचारणीय होगा।            </li>
            <li>
मैं इस तथ्य से भली-भाँति अवगत हूँ कि  (TET) उत्तीर्ण अभ्यर्थी का नियुक्ति / चयन हेतु दावा/अधिकार नहीं होता है। यह परीक्षा नियुक्ति / चयन हेतु निर्धारित अर्हताओं में से मात्र एक अनिवार्य अर्हता है। शिक्षकों की नियुक्ति / चयन  राज्य सरकार की संगत अध्यापक सेवा नियमावली तथा समय-समय पर जारी नियम / निर्देश के अन्तर्गत ही किया जाता है।            </li>
            <li>
मुझे पूर्व में किसी भी केन्द्रीय या राज्य  (TET) से प्रतिबंधित (Debar) नहीं किया गया है।            </li>
    </ol>
  </div>
  </script>
</body>
</html>`;

    printWindow.document.write(htmlDoc);
    printWindow.document.close();
  };

  const generateApplicantFormHtml = (profile, uploadsData = null) => {
    if (!profile) return "";
    const uploads = {
      photoFilePreview: uploadsData?.photoFile ? `${userApi.defaults.baseURL}/${uploadsData.photoFile}` : "",
      signatureFilePreview: uploadsData?.signatureFile ? `${userApi.defaults.baseURL}/${uploadsData.signatureFile}` : "",
      thumbFilePreview: uploadsData?.thumbImp ? `${userApi.defaults.baseURL}/${uploadsData.thumbImp}` : "",
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

    const pd = profile.personalDetails || profile;

    const districtName = isNaN(pd.district) ? pd.district : (districtCitiesList.find(c => Number(c.id) === Number(pd.district))?.name || ukCitiesList.find(c => Number(c.id) === Number(pd.district))?.name || pd.district || "N/A");
    const stateName = isNaN(pd.stateId) ? pd.state : (statesList.find(s => Number(s.id) === Number(pd.stateId))?.name || pd.state || "N/A");
    const examCity1Name = isNaN(pd.examCity1) ? pd.examCity1 : (examCitiesList.find(c => Number(c.cityId) === Number(pd.examCity1))?.cityName || pd.examCity1 || "N/A");
    const examCity2Name = isNaN(pd.examCity2) ? pd.examCity2 : (examCitiesList.find(c => Number(c.cityId) === Number(pd.examCity2))?.cityName || pd.examCity2 || "N/A");

    const displayProfile = {
      registrationNo: profile.registrationNo || "N/A",
      appliedCategory: pd.appliedCategory || profile.appliedCategory || profile.applicationFor || "1-विज्ञान वर्ग",
      fullName: profile.fullName || "N/A",
      gender: pd.gender || "N/A",
      fatherName: profile.fatherName || "N/A",
      motherName: pd.motherName || "N/A",
      dob: pd.dob || null,
      phoneNumber: profile.phoneNumber || "N/A",
      email: profile.email || "N/A",
      husbandName: pd.husbandName || "N/A",
      category: pd.category || "N/A",
      subCategory: pd.subCategory || "N/A",
      retirementDate: pd.retirementDate || null,
      sportsType: pd.sportsType || "",
      isPhysicallyHandicapped: pd.isPhysicallyHandicapped || false,
      disabilityType: pd.disabilityType || "N/A",
      multiDisabilityType: pd.multiDisabilityType || "",
      scribeRequired: pd.scribeRequired || false,
      mailingAddress: pd.mailingAddress || "N/A",
      state: stateName || "N/A",
      district: districtName || "N/A",
      pinCode: pd.pinCode || "N/A",
      identityProof: pd.identityProof || "N/A",
      identityProofNo: pd.identityProofNo || "N/A",

      graduationCourse: pd.graduationCourse || "N/A",
      graduationUniversity: pd.graduationUniversity || "N/A",
      graduationDate: pd.graduationDate || null,

      examCity1: examCity1Name || "N/A",
      examCity2: examCity2Name || "N/A",

      isPaymentCompleted: profile.isPaymentCompleted || false,
      transactionId: profile.transactionId || "N/A",
      transactionAmount: profile.transactionAmount || "N/A",
      transactionStatus: profile.transactionStatus || "N/A",
      transactionDate: profile.transactionDate || "N/A",
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Application Form - ${displayProfile.registrationNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 12px; line-height: 1.3; background: white; color: #1e293b; font-size: 11px; }
    
    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
    .header h2 { font-size: 13px; font-weight: bold; margin: 0; color: #0f172a; }
    .header h3 { font-size: 11px; font-weight: bold; margin: 2px 0; color: #0369a1; }
    
    .main-content { display: flex; gap: 10px; margin-bottom: 10px; }
    .table-section { flex: 1; }
    .photo-section { display: flex; flex-direction: column; gap: 8px; width: 100px; flex-shrink: 0; }
    .photo-item { display: flex; flex-direction: column; gap: 2px; align-items: center; }
    .photo-box { border: 1px solid #cbd5e1; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; }
    .photo-box.large { width: 95px; height: 105px; }
    .photo-box.medium { width: 85px; height: 50px; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .photo-label { font-size: 8px; text-align: center; color: #64748b; font-weight: 600; text-transform: uppercase; }
    
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 10px; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-weight: 600; color: #334155; width: 25%; }
    td { border: 1px solid #cbd5e1; padding: 4px 6px; color: #0f172a; }
    .section-header { background: #e0f2fe; color: #0369a1; font-weight: bold; text-align: center; }
    
    .declarations { border: 1px solid #cbd5e1; padding: 8px; margin: 8px 0; border-radius: 4px; background: #fafafa; }
    .declarations h3 { text-align: center; font-size: 9.5px; font-weight: bold; margin-bottom: 4px; color: #1e293b; }
    .declarations p { font-size: 8.5px; text-align: center; margin-bottom: 4px; color: #475569; }
    .declarations ol { margin: 0 0 0 12px; font-size: 8px; line-height: 1.25; color: #475569; }
    .declarations li { margin-bottom: 3px; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <table style="width: 100%; border: none; margin-bottom: 4px;">
      <tr style="border: none;">
        <td style="width: 15%; border: none; padding: 0;">
          ${userApi.defaults.baseURL ? `<img src="${userApi.defaults.baseURL}/Logo/ubse_white.jpg" alt="Logo" style="width: 45px; height: 45px; object-fit: contain;">` : ''}
        </td>
        <td style="width: 70%; border: none; padding: 0; text-align: center;">
          <h2>उत्तराखण्ड विद्यालयी शिक्षा परिषद् रामनगर (नैनीताल)</h2>
          <h3>द्विवर्षीय डी.एल.एड. प्रवेश परीक्षा 2026</h3>
          <h3 style="font-weight: normal; margin-top: 1px; color: #64748b; font-size: 9px;">Application Form Preview</h3>
        </td>
        <td style="width: 15%; border: none; padding: 0; text-align: right;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=5&data=${encodeURIComponent(`Reg No: ${displayProfile.registrationNo}\nName: ${displayProfile.fullName}\nDOB: ${formatDob(displayProfile.dob)}`)}" alt="QR Code" style="width: 45px; height: 45px;">
        </td>
      </tr>
    </table>
  </div>

  <!-- MAIN CONTENT WITH PHOTOS -->
  <div class="main-content">
    <div class="table-section">
      <table>
        <tr>
          <th>Registration ID</th><td><b>${displayProfile.registrationNo}</b></td>
          <th>Applied Category</th><td><b>${displayProfile.appliedCategory}</b></td>
        </tr>
        <tr>
          <th>Candidate's Name</th><td>${displayProfile.fullName}</td>
          <th>Gender</th><td>${displayProfile.gender}</td>
        </tr>
        <tr>
          <th>Father's Name</th><td>${displayProfile.fatherName}</td>
          <th>Mother's Name</th><td>${displayProfile.motherName}</td>
        </tr>
        <tr>
          <th>Date of Birth</th><td>${formatDob(displayProfile.dob)}</td>
          <th>Mobile Number</th><td>${displayProfile.phoneNumber}</td>
        </tr>
        <tr>
          <th>Email ID</th><td>${displayProfile.email}</td>
          <th>Husband's Name</th><td>${displayProfile.husbandName}</td>
        </tr>
        <tr>
          <th>Category</th><td>${displayProfile.category}</td>
          <th>Sub Category</th><td>${displayProfile.subCategory}${displayProfile.subCategory === 'EX-SERVICEMAN (Self)' && displayProfile.retirementDate ? ` (RetDate: ${formatDob(displayProfile.retirementDate)})` : ''}${displayProfile.subCategory === 'SPORTS' && displayProfile.sportsType ? ` (${displayProfile.sportsType})` : ''}</td>
        </tr>
        <tr>
          <th>Physically Handicapped</th><td>${displayProfile.isPhysicallyHandicapped ? `YES (${displayProfile.disabilityType}${displayProfile.disabilityType === 'Multiple Disabilities' && displayProfile.multiDisabilityType ? ` - ${displayProfile.multiDisabilityType}` : ''})` : "NO"}</td>
          <th>Scribe Required</th><td>${displayProfile.scribeRequired ? "YES" : "NO"}</td>
        </tr>
        <tr>
          <th>Mailing Address</th><td colspan="3">${displayProfile.mailingAddress}, ${displayProfile.district}, ${displayProfile.state} - ${displayProfile.pinCode}</td>
        </tr>
      </table>
    </div>
    
    <div class="photo-section">
      <div class="photo-item">
        <div class="photo-box large">
          ${uploads.photoFilePreview ? `<img src="${uploads.photoFilePreview}" alt="Photo">` : '<span style="color: #94a3b8; font-size: 8px;">No Photo</span>'}
        </div>
        <div class="photo-label">Photo</div>
      </div>
      <div class="photo-item">
        <div class="photo-box medium">
          ${uploads.thumbFilePreview ? `<img src="${uploads.thumbFilePreview}" alt="Thumb">` : '<span style="color: #94a3b8; font-size: 8px;">No Thumb</span>'}
        </div>
        <div class="photo-label">Thumb</div>
      </div>
      <div class="photo-item">
        <div class="photo-box medium">
          ${uploads.signatureFilePreview ? `<img src="${uploads.signatureFilePreview}" alt="Signature">` : '<span style="color: #94a3b8; font-size: 8px;">No Sig</span>'}
        </div>
        <div class="photo-label">Signature</div>
      </div>
    </div>
  </div>

  <!-- GRADUATION & ACADEMIC TABLE -->
  <table>
    <tr class="section-header">
      <th colspan="4" style="text-align: center;">स्नातक योग्यता विवरण (Graduation Details)</th>
    </tr>
    <tr>
      <th>Applied Category (वर्ग)</th><td>${displayProfile.appliedCategory}</td>
      <th>Graduation Course (स्नातक परीक्षा)</th><td>${displayProfile.graduationCourse}</td>
    </tr>
    <tr>
      <th>University (विश्वविद्यालय)</th><td>${displayProfile.graduationUniversity}</td>
      <th>Passing Date (उत्तीर्ण तिथि)</th><td>${formatDob(displayProfile.graduationDate)}</td>
    </tr>
    <tr class="section-header">
      <th colspan="4" style="text-align: center;">Exam Centers & Identification</th>
    </tr>
    <tr>
      <th>Exam City 1</th><td>${displayProfile.examCity1}</td>
      <th>Exam City 2</th><td>${displayProfile.examCity2}</td>
    </tr>
    <tr>
      <th>Identity Proof</th><td>${displayProfile.identityProof}</td>
      <th>Identity Proof No.</th><td>${displayProfile.identityProofNo}</td>
    </tr>
    <tr>
      <th>Payment Status</th><td>${displayProfile.isPaymentCompleted ? `<span style="color: #16a34a; font-weight: bold;">PAID</span>` : `<span style="color: #dc2626; font-weight: bold;">UNPAID</span>`}</td>
      <th>Transaction ID</th><td>${displayProfile.transactionId}</td>
    </tr>
  </table>

  <!-- DECLARATION -->
  <div class="declarations">
    <h3>घोषणा</h3>
    <p>मैं <b>${displayProfile.fullName}</b> पुत्र/पुत्री श्री <b>${displayProfile.fatherName}</b> शपथपूर्वक घोषणा करता/करती हूँ कि आवेदन पत्र में भरी गयी समस्त प्रविष्टियाँ मेरे मूल अभिलेखों पर आधारित हैं तथा मेरे संज्ञान में सत्य एवं सही हैं।</p>
  </div>
</body>
</html>`;
  };

  const handleSearchPayment = async (e) => {
    if (e) e.preventDefault();
    if (!paymentRegNo.trim()) return;

    setIsSearchingPayment(true);
    setPaymentResultText("Searching...");

    try {
      const response = await api.get(`/api/UserRegistrations/admin/payment-status/${paymentRegNo.trim()}`);
      if (response.data && response.data.success) {
        setPaymentResultText(response.data.output || "");
      } else {
        setPaymentResultText("Registration number not found or error occurred.");
      }
    } catch (error) {
      console.error("Payment status check error:", error);
      if (error.response && error.response.data && error.response.data.message) {
        setPaymentResultText(error.response.data.message);
      } else {
        setPaymentResultText("Candidate registration number not found.");
      }
    } finally {
      setIsSearchingPayment(false);
    }
  };

  const handleFindApplicant = async (e) => {
    if (e) e.preventDefault();
    if (!updateRegNo.trim()) return;

    setIsSearchingApplicant(true);
    setSearchError("");
    setSaveMessage({ text: "", type: "" });
    setFoundApplicant(null);
    setFoundApplicantUploads(null);

    try {
      const response = await api.get(`/api/UserRegistrations/admin/applicant/${updateRegNo.trim()}`);
      const previewResponse = await api.get(`/api/UserRegistrations/admin/applicant-complete/${updateRegNo.trim()}`);

      if (response.data && response.data.success) {
        const applicant = response.data.data;
        setFoundApplicant(applicant);
        if (previewResponse.data && previewResponse.data.success) {
          setFoundApplicantUploads(previewResponse.data.uploads || null);
        }

        setEditFullName((applicant.fullName || "").toUpperCase());
        setEditFatherName((applicant.fatherName || "").toUpperCase());
        setEditPhoneNumber(applicant.phoneNumber || "");
        setEditEmail(applicant.email || "");
        setEditIsPaymentCompleted(applicant.isPaymentCompleted || false);

        // Populate personal details fields if available, else set defaults
        const pd = applicant.personalDetails;
        if (pd) {
          setEditGender(pd.gender || "MALE");
          setEditDOB(pd.dob ? pd.dob.split("T")[0] : "");
          setEditMotherName((pd.motherName || "").toUpperCase());
          setEditHusbandName((pd.husbandName || "").toUpperCase());
          setEditAppliedCategory(pd.appliedCategory || "1-विज्ञान वर्ग");
          setEditGraduationCourse(pd.graduationCourse || "");
          setEditGraduationUniversity(pd.graduationUniversity || "Select");
          setEditGraduationDate(pd.graduationDate ? pd.graduationDate.split("T")[0] : "");

          setEditCategory(pd.category || "GENERAL");
          setEditSubCategory(pd.subCategory || "NONE");
          setEditRetirementDate(pd.retirementDate ? pd.retirementDate.split("T")[0] : "");
          setEditSportsType(pd.sportsType || "");
          setEditIsPhysicallyHandicapped(Boolean(pd.isPhysicallyHandicapped));
          setEditDisabilityType(pd.disabilityType || "");
          setEditMultiDisabilityType(pd.multiDisabilityType || "");
          setEditScribeRequired(Boolean(pd.scribeRequired));

          setEditExamCity1(Number(pd.examCity1) || 0);
          setEditExamCity2(Number(pd.examCity2) || 0);
          setEditMailingAddress(pd.mailingAddress || "");
          setEditStateId(Number(pd.stateId) || 0);
          setEditDistrict(Number(pd.district) || 0);
          setEditPinCode(pd.pinCode || "");
          setEditIdentityProof(pd.identityProof || "Aadhar Card");
          setEditIdentityProofNo(pd.identityProofNo || "");

          if (pd.stateId) {
            fetchDistrictCities(pd.stateId);
          } else {
            setDistrictCitiesList([]);
          }
        } else {
          // Defaults if no personal details record exists yet
          setEditGender("MALE");
          setEditDOB("");
          setEditMotherName("");
          setEditHusbandName("");
          setEditAppliedCategory("1-विज्ञान वर्ग");
          setEditGraduationCourse("");
          setEditGraduationUniversity("Select");
          setEditGraduationDate("");
          setEditCategory("GENERAL");
          setEditSubCategory("NONE");
          setEditRetirementDate("");
          setEditSportsType("");
          setEditIsPhysicallyHandicapped(false);
          setEditDisabilityType("");
          setEditMultiDisabilityType("");
          setEditScribeRequired(false);
          setEditExamCity1(0);
          setEditExamCity2(0);
          setEditMailingAddress("");
          setEditStateId(0);
          setEditDistrict(0);
          setEditPinCode("");
          setEditIdentityProof("Aadhar Card");
          setEditIdentityProofNo("");
          setDistrictCitiesList([]);
        }
      } else {
        setSearchError("Applicant not found.");
      }
    } catch (error) {
      console.error("Error finding applicant:", error);
      if (error.response && error.response.data && error.response.data.message) {
        setSearchError(error.response.data.message);
      } else {
        setSearchError("Candidate registration number not found.");
      }
    } finally {
      setIsSearchingApplicant(false);
    }
  };

  const handleUpdateApplicant = async (e) => {
    if (e) e.preventDefault();
    if (!foundApplicant) return;

    setIsSavingApplicant(true);
    setSaveMessage({ text: "", type: "" });

    if (editSubCategory === "EX-SERVICEMAN (Self)") {
      if (!editRetirementDate) {
        setSaveMessage({ text: "Please enter Retirement Date.", type: "error" });
        setIsSavingApplicant(false);
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const retirement = new Date(editRetirementDate);
      retirement.setHours(0, 0, 0, 0);
      if (retirement >= today) {
        setSaveMessage({ text: "Date of retirement cannot be today's date or a future date. It must be less than today's date.", type: "error" });
        setIsSavingApplicant(false);
        return;
      }
    }

    try {
      const payload = {
        fullName: editFullName.trim().toUpperCase(),
        fatherName: editFatherName.trim().toUpperCase(),
        phoneNumber: editPhoneNumber.trim(),
        email: editEmail.trim(),
        isPaymentCompleted: editIsPaymentCompleted,
        personalDetails: {
          gender: editGender,
          dob: editDOB || null,
          motherName: editMotherName.trim().toUpperCase(),
          husbandName: editGender?.toUpperCase() === "MALE" ? null : (editHusbandName ? editHusbandName.trim().toUpperCase() : null),
          appliedCategory: editAppliedCategory,
          graduationCourse: editGraduationCourse,
          graduationUniversity: editGraduationUniversity !== "Select" ? editGraduationUniversity : null,
          graduationDate: editGraduationDate || null,
          category: editCategory,
          subCategory: editSubCategory,
          retirementDate: editSubCategory === "EX-SERVICEMAN (Self)" && editRetirementDate ? editRetirementDate : null,
          sportsType: editSubCategory === "SPORTS" ? editSportsType : null,
          isPhysicallyHandicapped: editIsPhysicallyHandicapped,
          disabilityType: editIsPhysicallyHandicapped ? editDisabilityType : null,
          multiDisabilityType: editIsPhysicallyHandicapped && editDisabilityType === "Multiple Disabilities" ? editMultiDisabilityType : null,
          scribeRequired: editIsPhysicallyHandicapped ? editScribeRequired : false,
          examCity1: Number(editExamCity1),
          examCity2: Number(editExamCity2),
          mailingAddress: editMailingAddress.trim(),
          stateId: Number(editStateId),
          district: Number(editDistrict),
          pinCode: editPinCode.trim(),
          identityProof: editIdentityProof !== "Select" ? editIdentityProof : "",
          identityProofNo: editIdentityProofNo.trim()
        }
      };

      const response = await api.put(`/api/UserRegistrations/admin/applicant/${foundApplicant.registrationNo}`, payload);
      if (response.data && response.data.success) {
        setSaveMessage({ text: "Applicant and complete application form details updated successfully!", type: "success" });
        setFoundApplicant(prev => ({
          ...prev,
          fullName: payload.fullName,
          fatherName: payload.fatherName,
          phoneNumber: payload.phoneNumber,
          email: payload.email,
          isPaymentCompleted: payload.isPaymentCompleted,
          personalDetails: {
            ...(prev?.personalDetails || {}),
            ...payload.personalDetails
          }
        }));

        // Refresh the main applications list in the background
        fetchDashboardData(currentPage, pageSize, activeSearchQuery, activeFilterStatus);
      } else {
        setSaveMessage({ text: "Failed to update record.", type: "error" });
      }
    } catch (error) {
      console.error("Error updating applicant:", error);
      if (error.response && error.response.data && error.response.data.message) {
        setSaveMessage({ text: error.response.data.message, type: "error" });
      } else {
        setSaveMessage({ text: "Error saving changes. Please check input values.", type: "error" });
      }
    } finally {
      setIsSavingApplicant(false);
    }
  };

  // Active / Reactive Search and Status Filter
  const filteredApplications = applications;

  return (
    <div className="h-screen w-screen bg-slate-50 flex font-sans text-gray-800 antialiased overflow-hidden">
      {/* Sidebar Panel */}
      <aside className="w-80 h-full bg-white text-slate-800 flex flex-col justify-between shadow-lg shrink-0 border-r border-slate-200/80 overflow-y-auto">
        <div>
          {/* Profile Section */}
          <div className="p-6 flex flex-col items-center border-b border-slate-100 bg-slate-50/50">
            <div className="w-20 h-20 rounded-full border-4 border-slate-100 overflow-hidden shadow-md bg-slate-100 flex items-center justify-center text-2xl mb-3 relative group text-slate-400">
              <FaUser className="text-3xl" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center text-xs font-medium text-white cursor-pointer">
                EDIT
              </div>
            </div>
            <h2 className="font-extrabold text-lg text-slate-900 capitalize">{username}</h2>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mt-0.5">Senior Administrator</p>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: FaChartBar },
              { id: "reviewPaid", label: "Review Paid Application", icon: FaCheckCircle },
              { id: "submission", label: "Submission Report", icon: FaFileAlt },
              { id: "email", label: "Email Report", icon: FaEnvelope },
              { id: "update", label: "Update / Correction", icon: FaUserEdit },
              { id: "payment", label: "Payment Status", icon: FaCreditCard },
              { id: "cms", label: "CMS / Timelines", icon: FaCalendarAlt },
              { id: "alerts", label: "Manage Alerts", icon: FaBullhorn },
              { id: "password", label: "Change Password", icon: FaLock },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base font-bold tracking-wide transition duration-150 cursor-pointer ${isActive
                      ? "bg-slate-100 text-slate-900 border-l-4 border-slate-800 rounded-l-none"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-base font-extrabold tracking-wider uppercase transition shadow-md cursor-pointer"
          >
            <FaSignOutAlt className="w-4 h-4" /> Logout System
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white h-20 px-8 flex items-center justify-between border-b border-slate-200 shadow-xs">
          <div className="flex items-center gap-3 text-base font-bold text-slate-500">
            <span className="hover:text-slate-800 cursor-pointer transition">Home</span>
            <span>/</span>
            <span className="text-slate-900 capitalize font-extrabold text-lg">{activeTab}</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-850 disabled:text-slate-400 font-extrabold text-base rounded-xl transition duration-200 shadow-xs border border-slate-200 cursor-pointer select-none"
            title="Refresh dashboard data"
          >
            <FaSync className={`w-4 h-4 ${isRefreshing ? "animate-spin text-slate-400" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </header>

        {/* Content Body */}
        <div className="p-8 space-y-8 overflow-y-auto flex-1">

          {/* STATS PANEL */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Stat Box 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex items-center justify-between relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Total Registration</span>
                <span className="block text-4xl font-black text-slate-900">{totalRegCount}</span>
              </div>
              <div className="bg-slate-100 text-slate-700 p-5 rounded-2xl text-3xl group-hover:scale-110 transition duration-300 flex items-center justify-center">
                <FaFolder />
              </div>
            </div>

            {/* Stat Box 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex items-center justify-between relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">PAID Applications</span>
                <span className="block text-4xl font-black text-slate-900">{paidRegCount}</span>
              </div>
              <div className="bg-slate-100 text-slate-700 p-5 rounded-2xl text-3xl group-hover:scale-110 transition duration-300 flex items-center justify-center">
                <FaCreditCard />
              </div>
            </div>

            {/* Stat Box 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex items-center justify-between relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Final Exam Count (I+II)</span>
                <span className="block text-4xl font-black text-slate-900">{stats.finalExamCount}</span>
              </div>
              <div className="bg-slate-100 text-slate-700 p-5 rounded-2xl text-3xl group-hover:scale-110 transition duration-300 flex items-center justify-center">
                <FaEdit />
              </div>
            </div>

          </section>

          {/* MAIN DYNAMIC CONTENT */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Dashboard Tab */}
            {activeTab === "dashboard" && (
              <div className="p-8 space-y-7">
                <div className="border-b border-slate-150 pb-5 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Search Applicant Database</h3>
                    <p className="text-base text-slate-500 font-medium mt-1">Query and filter live candidate records instantly.</p>
                  </div>
                  <span className="text-base font-bold text-slate-800 bg-slate-100 px-5 py-2.5 rounded-full border border-slate-200">
                    Total Records: <strong className="text-slate-950 font-black">{totalApplicationsCount}</strong>
                  </span>
                </div>

                {/* Filter and Search Bar */}
                <form onSubmit={handleSearch} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-center bg-slate-50/80 p-6 rounded-2xl border border-slate-200">
                  <div className="xl:col-span-6">
                    <input
                      type="text"
                      placeholder="Enter Registration No. / Name / Mobile No."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-5 py-3.5 text-lg font-medium text-slate-900 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-600 outline-hidden transition shadow-sm placeholder:text-slate-400"
                    />
                  </div>

                  <div className="xl:col-span-4 flex items-center justify-center gap-8">
                    <label className="flex items-center gap-3 text-lg font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={filterStatus === "all"}
                        onChange={() => setFilterStatus("all")}
                        className="text-slate-800 focus:ring-slate-500 w-5 h-5 cursor-pointer accent-slate-800"
                      />
                      All
                    </label>
                    <label className="flex items-center gap-3 text-lg font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={filterStatus === "paid"}
                        onChange={() => setFilterStatus("paid")}
                        className="text-slate-800 focus:ring-slate-500 w-5 h-5 cursor-pointer accent-slate-800"
                      />
                      Paid
                    </label>
                    <label className="flex items-center gap-3 text-lg font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={filterStatus === "unpaid"}
                        onChange={() => setFilterStatus("unpaid")}
                        className="text-slate-800 focus:ring-slate-500 w-5 h-5 cursor-pointer accent-slate-800"
                      />
                      Unpaid
                    </label>
                  </div>

                  <div className="xl:col-span-2">
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-base font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer border-none"
                    >
                      {isSearching ? "Searching..." : (
                        <>
                          <FaSearch className="w-4 h-4" />
                          <span>Search</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Table of Results */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full min-w-[1400px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-base font-extrabold uppercase text-slate-800 tracking-wider">
                        <th className="px-6 py-4.5 whitespace-nowrap">Reg No.</th>
                        <th className="px-6 py-4.5 whitespace-nowrap">Applicant Name</th>
                        <th className="px-6 py-4.5 whitespace-nowrap">Clear Pass</th>
                        <th className="px-6 py-4.5 whitespace-nowrap">Contact Info</th>
                        <th className="px-6 py-4.5 whitespace-nowrap min-w-[220px]">Exam Option</th>
                        <th className="px-6 py-4.5 whitespace-nowrap">Status</th>
                        <th className="px-6 py-4.5 whitespace-nowrap">Gateway Status</th>
                        <th className="px-6 py-4.5 whitespace-nowrap">Date</th>
                        <th className="px-6 py-4.5 text-center whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-base font-medium text-slate-800">
                      {filteredApplications.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center py-14 text-slate-500 bg-slate-50/50">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <FaInbox className="text-4xl text-slate-300" />
                              <span className="text-lg font-semibold">No matching records found in the candidate database.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredApplications.map((app) => (
                          <tr key={app.regNo} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4.5 font-extrabold text-slate-950 text-lg whitespace-nowrap">{app.regNo}</td>
                            <td className="px-6 py-4.5 font-bold text-slate-900 text-lg whitespace-nowrap" title={app.name}>{app.name}</td>
                            <td className="px-6 py-4.5 font-mono text-base font-extrabold text-slate-800 whitespace-nowrap">
                              <span className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/80">{app.clearPass || "-"}</span>
                            </td>
                            <td className="px-6 py-4.5 space-y-1.5 text-base font-semibold whitespace-nowrap">
                              <div className="flex items-center gap-2 text-slate-800"><FaPhone className="text-slate-400 text-sm shrink-0" /> {app.mobile}</div>
                              <div className="text-slate-600 flex items-center gap-2 max-w-[250px] truncate text-sm" title={app.email}>
                                <FaEnvelope className="text-slate-400 text-xs shrink-0" /> {app.email}
                              </div>
                            </td>
                            <td className="px-6 py-4.5 font-bold text-slate-800 text-base whitespace-nowrap min-w-[220px]">
                              {app.appliedFor}
                            </td>
                            <td className="px-6 py-4.5 whitespace-nowrap">
                              <span className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${app.status === "Paid" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-red-50 text-red-700 border border-red-200"
                                }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="px-6 py-4.5 whitespace-nowrap">
                              <span className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${app.txnStatus === "SUCCESS"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : (app.txnStatus === "FAILED" || app.txnStatus === "FAIL")
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}>
                                {app.txnStatus || "PENDING"}
                              </span>
                            </td>
                            <td className="px-6 py-4.5 font-semibold text-slate-700 text-base whitespace-nowrap">{app.date}</td>
                            <td className="px-6 py-4.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => handlePrintApplicant(app.regNo)}
                                disabled={!!printingRegNo}
                                className={`p-3 rounded-xl transition duration-150 flex items-center justify-center mx-auto cursor-pointer ${printingRegNo === app.regNo
                                    ? "bg-slate-100 text-slate-400"
                                    : "text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs"
                                  }`}
                                title="Print Preview PDF"
                              >
                                {printingRegNo === app.regNo ? (
                                  <FaSpinner className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FaPrint className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalApplicationsCount > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-150">
                    <div className="flex items-center gap-3">
                      <span className="text-base text-slate-600 font-semibold">Show</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-base text-slate-900 font-bold focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden transition cursor-pointer"
                      >
                        {[10, 25, 50, 100].map((size) => (
                          <option key={size} value={size}>{size} entries</option>
                        ))}
                      </select>
                      <span className="text-base text-slate-600 font-medium">
                        Showing {totalApplicationsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(totalApplicationsCount, currentPage * pageSize)} of {totalApplicationsCount} entries
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-sans">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 text-slate-800 rounded-xl text-base font-bold shadow-xs transition duration-150 cursor-pointer disabled:cursor-not-allowed select-none"
                      >
                        Previous
                      </button>

                      {/* Render page numbers */}
                      {(() => {
                        const totalPages = Math.ceil(totalApplicationsCount / pageSize);
                        const pages = [];

                        // Sliding window calculation
                        let startPage = Math.max(1, currentPage - 2);
                        let endPage = Math.min(totalPages, currentPage + 2);

                        if (startPage > 1) {
                          pages.push(1);
                          if (startPage > 2) pages.push("...");
                        }

                        for (let p = startPage; p <= endPage; p++) {
                          pages.push(p);
                        }

                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) pages.push("...");
                          pages.push(totalPages);
                        }

                        return pages.map((p, idx) => {
                          if (p === "...") {
                            return (
                              <span key={`dots-${idx}`} className="px-2.5 text-base text-slate-400 font-bold">
                                ...
                              </span>
                            );
                          }
                          const isCurrent = p === currentPage;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`w-10 h-10 rounded-xl text-base font-extrabold transition duration-150 flex items-center justify-center cursor-pointer ${isCurrent
                                  ? "bg-slate-800 text-white shadow-md border-none"
                                  : "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300"
                                }`}
                            >
                              {p}
                            </button>
                          );
                        });
                      })()}

                      <button
                        type="button"
                        disabled={currentPage === Math.ceil(totalApplicationsCount / pageSize)}
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalApplicationsCount / pageSize), prev + 1))}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 text-slate-800 rounded-xl text-base font-bold shadow-xs transition duration-150 cursor-pointer disabled:cursor-not-allowed select-none"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review Paid Application Tab */}
            {activeTab === "reviewPaid" && (
              <div className="p-8 space-y-7">
                <div className="border-b border-slate-150 pb-5 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
                      <FaCheckCircle className="text-blue-600" />
                      Review Paid Applications
                    </h3>
                    <p className="text-base text-slate-500 font-medium mt-1">
                      Review Name, Gender, Father's Name, DOB, Photo, Thumb Impression, and Signature for paid candidates (ispaymentcompleted = 1).
                    </p>
                  </div>
                  <span className="text-base font-bold text-blue-700 bg-blue-50 border border-blue-200 px-5 py-2.5 rounded-full">
                    Paid Count: <strong className="font-black">{paidTotalCount}</strong>
                  </span>
                </div>

                {/* Filter and Search Bar */}
                <form onSubmit={handlePaidSearch} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-center bg-slate-50/80 p-6 rounded-2xl border border-slate-200">
                  <div className="xl:col-span-6 flex gap-3">
                    <input
                      type="text"
                      placeholder="Search by Registration Number..."
                      value={paidSearchQuery}
                      onChange={(e) => setPaidSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-5 py-3.5 text-lg font-medium text-slate-900 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-600 outline-hidden transition shadow-sm placeholder:text-slate-400"
                    />
                    {paidSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaidSearchQuery("");
                          setPaidCurrentPage(1);
                          fetchPaidApplications(1, paidPageSize, "", paidSortOrder);
                        }}
                        className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-bold rounded-xl transition border-none cursor-pointer shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="xl:col-span-4 flex items-center justify-end gap-3.5">
                    <span className="text-sm font-extrabold text-slate-600 uppercase tracking-wider">Sort By:</span>
                    <select
                      value={`${paidSortBy}_${paidSortOrder}`}
                      onChange={(e) => {
                        const [by, order] = e.target.value.split("_");
                        setPaidSortBy(by);
                        setPaidSortOrder(order);
                        setPaidCurrentPage(1);
                      }}
                      className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-base font-bold text-slate-850 focus:outline-none cursor-pointer shadow-sm"
                    >
                      <option value="regNo_asc">Reg No. (1-9 Ascending)</option>
                      <option value="regNo_desc">Reg No. (9-1 Descending)</option>
                      <option value="paymentDate_desc">Payment Date (Newest First)</option>
                      <option value="paymentDate_asc">Payment Date (Oldest First)</option>
                    </select>
                  </div>

                  <div className="xl:col-span-2">
                    <button
                      type="submit"
                      disabled={paidAppsLoading}
                      className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-base font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer border-none"
                    >
                      {paidAppsLoading ? (
                        <FaSpinner className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <FaSearch className="w-4 h-4" />
                          <span>Search</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Grid Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-sm font-extrabold uppercase text-slate-800 tracking-wider">
                        <th
                          className="px-3 py-3.5 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap w-32"
                          onClick={() => {
                            if (paidSortBy === "regNo") {
                              setPaidSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
                            } else {
                              setPaidSortBy("regNo");
                              setPaidSortOrder("asc");
                            }
                            setPaidCurrentPage(1);
                          }}
                        >
                          Reg No. {paidSortBy === "regNo" ? (paidSortOrder === "asc" ? "↑" : "↓") : ""}
                        </th>
                        <th className="px-3 py-3.5 whitespace-nowrap w-24">Gender</th>
                        <th className="px-3 py-3.5">Applicant Name</th>
                        <th className="px-2 py-3.5 whitespace-nowrap w-28">Signature</th>
                        <th className="px-2 py-3.5 text-left whitespace-nowrap">Photo & Thumb</th>
                        <th className="px-3 py-3.5 whitespace-nowrap">DOB</th>
                        <th className="px-3 py-3.5 whitespace-nowrap">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-normal text-slate-700">
                      {paidAppsLoading ? (
                        <tr>
                          <td colSpan="7" className="text-center py-12 text-slate-400 bg-slate-50/50">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <FaSpinner className="text-2xl text-slate-400 animate-spin" />
                              <span className="text-sm font-medium">Loading paid applications...</span>
                            </div>
                          </td>
                        </tr>
                      ) : paidAppsList.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-12 text-slate-400 bg-slate-50/50">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <FaInbox className="text-2xl text-slate-300" />
                              <span className="text-sm font-medium">No paid application records found.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paidAppsList.map((app) => (
                          <tr
                            key={app.registrationNo}
                            onClick={() => {
                              setSelectedPaidApp(app);
                              setIsReviewModalOpen(true);
                            }}
                            className="hover:bg-indigo-50/40 transition cursor-pointer"
                          >
                            {/* 1. Registration Number */}
                            <td className="px-3 py-3 text-base font-bold text-slate-900 whitespace-nowrap">{app.registrationNo}</td>

                            {/* 2. Gender */}
                            <td className="px-3 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{app.gender || "-"}</td>

                            {/* 3. Applicant Name */}
                            <td className="px-3 py-3 max-w-[200px]">
                              <div className="text-base font-bold text-slate-900 truncate" title={app.name}>{app.name || "-"}</div>
                              {app.fatherName && (
                                <div className="text-xs text-slate-500 font-medium truncate" title={app.fatherName}>S/O, D/O: {app.fatherName}</div>
                              )}
                            </td>

                            {/* 4. Signature */}
                            <td className="px-2 py-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                              <div className="w-24 h-11 bg-white border border-slate-200 rounded-md overflow-hidden flex items-center justify-center shadow-xs">
                                {app.signatureFile ? (
                                  <img
                                    src={`${userApi.defaults.baseURL}/${app.signatureFile}`}
                                    alt="Signature"
                                    className="w-full h-full object-contain p-0.5"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="text-xs text-slate-400 italic">No Sign</span>
                                )}
                              </div>
                            </td>

                            {/* 5. Photo & Thumb (Moved right after Signature) */}
                            <td className="px-2 py-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-start gap-2">
                                {/* Photo */}
                                <div className="w-11 h-13 bg-white border border-slate-200 rounded-md overflow-hidden flex items-center justify-center shadow-xs shrink-0" title="Candidate Photo">
                                  {app.photoFile ? (
                                    <img
                                      src={`${userApi.defaults.baseURL}/${app.photoFile}`}
                                      alt="Photo"
                                      className="w-full h-full object-cover select-none pointer-events-none"
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <span className="text-[9px] text-slate-400">Photo</span>
                                  )}
                                </div>

                                {/* Thumb */}
                                <div className="w-20 h-13 bg-white border border-slate-200 rounded-md overflow-hidden flex items-center justify-center shadow-xs shrink-0" title="Thumb Impression">
                                  {app.thumbImp ? (
                                    <img
                                      src={`${userApi.defaults.baseURL}/${app.thumbImp}`}
                                      alt="Thumb"
                                      className="w-full h-full object-contain p-0.5 select-none pointer-events-none"
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <span className="text-[9px] text-slate-400">Thumb</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 6. DOB */}
                            <td className="px-3 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{formatDateToDDMMYYYY(app.dob)}</td>

                            {/* 7. Payment Status */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                                <FaCheckCircle className="text-blue-600 text-[10px]" /> Paid
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {paidTotalCount > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-150">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Show</span>
                      <select
                        value={paidPageSize}
                        onChange={(e) => {
                          setPaidPageSize(Number(e.target.value));
                          setPaidCurrentPage(1);
                        }}
                        className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-1.5 font-medium outline-hidden"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-xs text-slate-500 font-medium">per page</span>
                    </div>

                    <span className="text-xs font-medium text-slate-500">
                      Showing {Math.min((paidCurrentPage - 1) * paidPageSize + 1, paidTotalCount)} to{" "}
                      {Math.min(paidCurrentPage * paidPageSize, paidTotalCount)} of {paidTotalCount} records
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={paidCurrentPage === 1}
                        onClick={() => setPaidCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-xs font-semibold shadow-xs transition duration-150 cursor-pointer disabled:cursor-not-allowed select-none border-none"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={paidCurrentPage === Math.ceil(paidTotalCount / paidPageSize)}
                        onClick={() =>
                          setPaidCurrentPage((prev) =>
                            Math.min(Math.ceil(paidTotalCount / paidPageSize), prev + 1)
                          )
                        }
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-xs font-semibold shadow-xs transition duration-150 cursor-pointer disabled:cursor-not-allowed select-none border-none"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submission Report Tab */}
            {activeTab === "submission" && (
              <div className="p-8 space-y-6">
                <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Submission Report Summary</h3>
                    <p className="text-xs text-slate-400 font-normal mt-0.5">Filter, export, and generate consolidated candidate registration reports.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleToggleEmailReportPdf}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5 border-none ${showEmailReportPdf ? 'bg-indigo-650 hover:bg-indigo-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                      <FaFilePdf className="w-3.5 h-3.5" />
                      <span>{showEmailReportPdf ? "Show Dashboard Stats" : "Show Email PDF Report"}</span>
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5 border-none"
                    >
                      <FaFileCsv className="w-3.5 h-3.5" />
                      <span>EXPORT REPORT (CSV)</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5 border-none"
                    >
                      <FaFilePdf className="w-3.5 h-3.5" />
                      <span>EXPORT REPORT (PDF)</span>
                    </button>
                  </div>
                </div>

                {showEmailReportPdf ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Email PDF Report Preview (QuestPDF)
                      </span>
                      <button
                        onClick={handleDownloadEmailReportPdf}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-none flex items-center gap-1.5"
                      >
                        <FaFilePdf className="w-3.5 h-3.5" />
                        <span>Download PDF Report</span>
                      </button>
                    </div>
                    {loadingPdf ? (
                      <div className="py-20 flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-650"></div>
                        <span className="text-xs text-slate-450 font-medium">Generating and downloading consolidated PDF report...</span>
                      </div>
                    ) : pdfReportUrl ? (
                      <iframe
                        src={pdfReportUrl}
                        className="w-full h-[750px] border border-slate-200 rounded-lg shadow-inner bg-slate-50"
                        title="Consolidated Email PDF Report"
                      />
                    ) : (
                      <div className="py-20 text-center text-slate-400 text-sm">
                        Failed to load PDF report. Please verify connection to the email service API.
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-semibold uppercase text-slate-450 tracking-wider">DELED I Submissions</span>
                        <span className="block text-2xl font-bold text-slate-800">{deled1SubmissionsCount}</span>
                      </div>
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-semibold uppercase text-slate-450 tracking-wider">DELED II Submissions</span>
                        <span className="block text-2xl font-bold text-slate-800">{deled2SubmissionsCount}</span>
                      </div>
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-semibold uppercase text-slate-450 tracking-wider">Both Papers Submissions</span>
                        <span className="block text-2xl font-bold text-slate-800">{bothSubmissionsCount}</span>
                      </div>
                    </div>

                    {/* Date Filter Panel */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Date From</span>
                          <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-slate-450 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Date To</span>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-slate-450 bg-white"
                          />
                        </div>
                        <button
                          onClick={handleApplyDateFilter}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-none h-[34px]"
                        >
                          Apply Filter
                        </button>
                        <button
                          onClick={handleClearDateFilter}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-none h-[34px]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Date Wise Form Submission Report */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Date Wise Form Submission Report
                        </span>
                        {reportLoading && <span className="text-xs text-slate-400">Loading...</span>}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm text-slate-650">
                          <thead>
                            <tr className="bg-slate-50/55 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-semibold">
                              <th className="px-6 py-3 border-r border-slate-200 text-center w-16" rowSpan={2}>Sr. No.</th>
                              <th className="px-6 py-3 border-r border-slate-200 text-left" rowSpan={2}>Date</th>
                              <th className="px-6 py-3 border-r border-slate-200 text-center" colSpan={2}>Registration</th>
                              <th className="px-6 py-3 text-center" colSpan={2}>Fees Paid</th>
                            </tr>
                            <tr className="bg-slate-50/55 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-semibold">
                              <th className="px-6 py-2 border-r border-slate-200 text-center">No.</th>
                              <th className="px-6 py-2 border-r border-slate-200 text-center">Cumm.</th>
                              <th className="px-6 py-2 border-r border-slate-200 text-center">No.</th>
                              <th className="px-6 py-2 text-center">Cumm.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportDateWise.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-450">No report data found.</td>
                              </tr>
                            ) : (
                              reportDateWise.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/30 transition">
                                  <td className="px-6 py-3 border-r border-slate-200 text-center">{idx + 1}</td>
                                  <td className="px-6 py-3 border-r border-slate-200 text-slate-800 font-medium">{row.date || row.Date}</td>
                                  <td className="px-6 py-3 border-r border-slate-200 text-center text-slate-700">{row.regNo || row.RegNo}</td>
                                  <td className="px-6 py-3 border-r border-slate-200 text-center font-semibold text-slate-800">{row.regCumm || row.RegCumm}</td>
                                  <td className="px-6 py-3 border-r border-slate-200 text-center text-slate-700">{row.feesNo || row.FeesNo}</td>
                                  <td className="px-6 py-3 text-center font-semibold text-blue-700">{row.feesCumm || row.FeesCumm}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Exam City Wise Application count Report */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Exam City Wise Application count Report
                        </span>
                        {reportLoading && <span className="text-xs text-slate-400">Loading...</span>}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm text-slate-650">
                          <thead>
                            <tr className="bg-slate-50/55 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-semibold">
                              <th className="px-6 py-3 border-r border-slate-200 text-center w-16">Sr. No.</th>
                              <th className="px-6 py-3 border-r border-slate-200 text-left">Exam City Code/Name</th>
                              <th className="px-6 py-3 text-center">DELED</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportCityWise.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-450">No report data found.</td>
                              </tr>
                            ) : (
                              <>
                                {reportCityWise.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/30 transition">
                                    <td className="px-6 py-3 border-r border-slate-200 text-center">{idx + 1}</td>
                                    <td className="px-6 py-3 border-r border-slate-200 text-slate-800 font-medium">{row.cityName || row.CityName}</td>
                                    <td className="px-6 py-3 text-center font-bold text-slate-800">{row.deled || row.Deled || row.total || row.Total || 0}</td>
                                  </tr>
                                ))}
                                {/* Totals row */}
                                <tr className="bg-slate-50/20 border-t border-slate-200 text-sm font-bold">
                                  <td className="px-6 py-3 border-r border-slate-200 text-center"></td>
                                  <td className="px-6 py-3 border-r border-slate-200 text-left text-slate-800 uppercase tracking-wider">Total</td>
                                  <td className="px-6 py-3 text-center text-slate-900 font-extrabold">
                                    {reportCityWise.reduce((acc, row) => acc + (row.deled || row.Deled || row.total || row.Total || 0), 0)}
                                  </td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Email Report Tab */}
            {activeTab === "email" && (
              <div className="p-8 space-y-6">
                <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Email Delivery Log</h3>
                    <p className="text-xs text-slate-400 font-normal mt-0.5">Monitor system notification delivery emails sent to users.</p>
                  </div>
                  <button
                    onClick={handleBroadcastTrigger}
                    disabled={broadcastSubmitting}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-none"
                  >
                    {broadcastSubmitting ? (
                      <>
                        <FaPaperPlane className="w-3 h-3 animate-pulse" />
                        <span>Broadcasting...</span>
                      </>
                    ) : (
                      <>
                        <FaPaperPlane className="w-3 h-3" />
                        <span>Broadcast Email Now</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-450 tracking-wider">
                        <th className="px-6 py-4">Recipient</th>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Time Sent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-normal text-slate-700">
                      {emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-12 text-slate-400 bg-slate-50/50">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <FaInbox className="text-2xl text-slate-300" />
                              <span>No email logs found in the database.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 font-normal text-slate-800">{item.recipient}</td>
                            <td className="px-6 py-4">{item.subject}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${item.status === "Delivered" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-red-50 text-red-700 border border-red-200"
                                }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-normal text-slate-400">{item.timeSent}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Update / Correction Tab */}
            {activeTab === "update" && (
              <div className="p-8 space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black text-slate-850">Full Application Form Correction & Review</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Search candidate by registration number, correct complete form entries across all 5 sections, and preview the final application live.</p>
                </div>

                <div className="space-y-6">
                  {/* Search Form */}
                  <form onSubmit={handleFindApplicant} className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 shadow-xs max-w-4xl">
                    <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">Enter Candidate Registration Number</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="e.g. 2601000123"
                        value={updateRegNo}
                        onChange={(e) => setUpdateRegNo(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-5 py-3 text-base font-semibold text-slate-900 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-600 outline-none transition shadow-sm placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingApplicant}
                        className="px-8 py-3 bg-blue-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-sm font-black uppercase tracking-wider shadow-md transition duration-200 cursor-pointer min-w-[140px] flex items-center justify-center border-none"
                      >
                        {isSearchingApplicant ? "Searching..." : "Find Candidate"}
                      </button>
                    </div>
                  </form>

                  {searchError && (
                    <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-bold flex items-center gap-2 max-w-4xl">
                      <span>❌</span> <span>{searchError}</span>
                    </div>
                  )}

                  {!foundApplicant && !isSearchingApplicant && !searchError && (
                    <div className="p-12 bg-slate-50/60 rounded-2xl border border-dashed border-slate-300 text-center text-base font-bold text-slate-400 py-16">
                      🔍 Enter a candidate registration number above to load and edit their complete DELED 2026 application form.
                    </div>
                  )}

                  {foundApplicant && (() => {
                    const activePreviewCandidate = {
                      ...foundApplicant,
                      fullName: editFullName,
                      fatherName: editFatherName,
                      phoneNumber: editPhoneNumber,
                      email: editEmail,
                      isPaymentCompleted: editIsPaymentCompleted,
                      personalDetails: {
                        ...(foundApplicant.personalDetails || {}),
                        gender: editGender,
                        dob: editDOB,
                        motherName: editMotherName,
                        husbandName: editHusbandName,
                        appliedCategory: editAppliedCategory,
                        graduationCourse: editGraduationCourse,
                        graduationUniversity: editGraduationUniversity,
                        graduationDate: editGraduationDate,
                        category: editCategory,
                        subCategory: editSubCategory,
                        retirementDate: editRetirementDate,
                        sportsType: editSportsType,
                        isPhysicallyHandicapped: editIsPhysicallyHandicapped,
                        disabilityType: editDisabilityType,
                        multiDisabilityType: editMultiDisabilityType,
                        scribeRequired: editScribeRequired,
                        examCity1: editExamCity1,
                        examCity2: editExamCity2,
                        mailingAddress: editMailingAddress,
                        stateId: editStateId,
                        district: editDistrict,
                        pinCode: editPinCode,
                        identityProof: editIdentityProof,
                        identityProofNo: editIdentityProofNo
                      }
                    };

                    const currentGraduationList = (editAppliedCategory || "").includes("1") || ((editAppliedCategory || "").includes("विज्ञान") && !(editAppliedCategory || "").includes("विज्ञानेत्तर"))
                      ? scienceGraduationCourses
                      : nonScienceGraduationCourses;

                    return (
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Full Form Controls */}
                        <div className="xl:col-span-7 space-y-6">
                          <form onSubmit={handleUpdateApplicant} className="bg-white border border-slate-200 rounded-2xl p-7 space-y-8 shadow-sm">

                            {/* Header & Reg No info */}
                            <div className="border-b border-slate-200 pb-4 flex flex-wrap justify-between items-center gap-3">
                              <div>
                                <h4 className="text-lg font-black text-slate-900 uppercase tracking-wider">Candidate Correction Form</h4>
                                <span className="text-xs font-bold text-slate-500">Registration No: <strong className="text-slate-950 font-black">{foundApplicant.registrationNo}</strong> | User ID: {foundApplicant.userId}</span>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${editIsPaymentCompleted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                {editIsPaymentCompleted ? "Paid Application" : "Unpaid Application"}
                              </span>
                            </div>

                            {saveMessage.text && (
                              <div className={`p-4 rounded-xl text-sm font-bold border flex items-center gap-2.5 ${saveMessage.type === "success"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                                }`}>
                                {saveMessage.type === "success" ? <FaCheckCircle className="shrink-0 text-lg" /> : <FaExclamationTriangle className="shrink-0 text-lg" />}
                                <span>{saveMessage.text}</span>
                              </div>
                            )}

                            {/* Section 1: Personal & Contact Details */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FaUser className="text-slate-500 text-sm" />
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider">1. Candidate Personal & Contact Details</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Full Name *</label>
                                  <input
                                    type="text"
                                    required
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value.toUpperCase())}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none uppercase"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Father's Name *</label>
                                  <input
                                    type="text"
                                    required
                                    value={editFatherName}
                                    onChange={(e) => setEditFatherName(e.target.value.toUpperCase())}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none uppercase"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Mother's Name *</label>
                                  <input
                                    type="text"
                                    required
                                    value={editMotherName}
                                    onChange={(e) => setEditMotherName(e.target.value.toUpperCase())}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none uppercase"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Gender *</label>
                                  <select
                                    value={editGender}
                                    onChange={(e) => {
                                      setEditGender(e.target.value);
                                      if (e.target.value === "MALE") {
                                        setEditHusbandName("");
                                      }
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value="MALE">MALE</option>
                                    <option value="FEMALE">FEMALE</option>
                                    <option value="TRANSGENDER">TRANSGENDER</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                                    Husband Name
                                    {editGender === "MALE" && <span className="text-slate-400 font-normal lowercase ml-1">(not applicable)</span>}
                                  </label>
                                  <input
                                    type="text"
                                    disabled={editGender === "MALE"}
                                    value={editGender === "MALE" ? "" : editHusbandName}
                                    onChange={(e) => setEditHusbandName(e.target.value.toUpperCase())}
                                    placeholder={editGender === "MALE" ? "Disabled for Male" : "Enter Husband Name"}
                                    className={`w-full border rounded-xl px-4 py-2.5 text-sm font-semibold uppercase outline-none ${editGender === "MALE"
                                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                        : "bg-white border-slate-300 text-slate-900 focus:border-slate-800"
                                      }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Date of Birth *</label>
                                  <input
                                    type="date"
                                    required
                                    value={editDOB}
                                    onChange={(e) => setEditDOB(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Mobile Number *</label>
                                  <input
                                    type="tel"
                                    required
                                    maxLength={10}
                                    value={editPhoneNumber}
                                    onChange={(e) => setEditPhoneNumber(e.target.value.replace(/\D/g, ""))}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Email ID *</label>
                                  <input
                                    type="email"
                                    required
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  />
                                </div>

                                <div className="md:col-span-2 pt-2">
                                  <label className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition">
                                    <input
                                      type="checkbox"
                                      checked={editIsPaymentCompleted}
                                      onChange={(e) => setEditIsPaymentCompleted(e.target.checked)}
                                      className="w-5 h-5 accent-emerald-600 cursor-pointer rounded"
                                    />
                                    <span className="text-sm font-bold text-slate-800">Application Payment Completed (Mark Paid Status)</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            {/* Section 2: Applied Training & Graduation Details */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FaGraduationCap className="text-slate-500 text-sm" />
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider">2. Applied Training & Graduation Details (DELED 2026)</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Applied Category (प्रशिक्षण हेतु आवेदित वर्ग) *</label>
                                  <select
                                    value={editAppliedCategory}
                                    onChange={(e) => {
                                      setEditAppliedCategory(e.target.value);
                                      setEditGraduationCourse("Select");
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value="1-विज्ञान वर्ग">1-विज्ञान वर्ग (Science)</option>
                                    <option value="2-विज्ञानेत्तर वर्ग">2-विज्ञानेत्तर वर्ग (Non-Science / Arts / Commerce)</option>
                                  </select>
                                </div>

                                <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Graduation Course (स्नातक परीक्षा का नाम) *</label>
                                  <select
                                    value={editGraduationCourse}
                                    onChange={(e) => setEditGraduationCourse(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    {currentGraduationList.map((c, i) => (
                                      <option key={i} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Graduation University (विश्वविद्यालय का नाम) *</label>
                                  <select
                                    value={editGraduationUniversity}
                                    onChange={(e) => setEditGraduationUniversity(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    {universityOptions.map((u, i) => (
                                      <option key={i} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Graduation Passing Date (उत्तीर्ण तिथि)</label>
                                  <input
                                    type="date"
                                    value={editGraduationDate}
                                    onChange={(e) => setEditGraduationDate(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Section 3: Reservation & Special Categories */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FaShieldAlt className="text-slate-500 text-sm" />
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider">3. Reservation & Special Categories</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Category *</label>
                                  <select
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value="GENERAL">GENERAL</option>
                                    <option value="OBC">OBC</option>
                                    <option value="SC">SC</option>
                                    <option value="ST">ST</option>
                                    <option value="EWS">EWS</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Sub Category *</label>
                                  <select
                                    value={editSubCategory}
                                    onChange={(e) => {
                                      setEditSubCategory(e.target.value);
                                      if (e.target.value !== "EX-SERVICEMAN (Self)") {
                                        setEditRetirementDate("");
                                      }
                                      if (e.target.value !== "SPORTS") {
                                        setEditSportsType("");
                                      }
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value="NONE">NONE</option>
                                    <option value="EX-SERVICEMAN (Self)">EX-SERVICEMAN (Self)</option>
                                    <option value="D.F.F.">D.F.F. (Dependent of Freedom Fighter)</option>
                                    <option value="ORPHAN">ORPHAN</option>
                                    <option value="WOMEN">WOMEN</option>
                                    <option value="SPORTS">SPORTS (खेल प्रमाण-पत्र धारक)</option>
                                  </select>
                                </div>

                                {editSubCategory === "EX-SERVICEMAN (Self)" && (
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Retirement Date *</label>
                                    <input
                                      type="date"
                                      required
                                      value={editRetirementDate}
                                      onChange={(e) => setEditRetirementDate(e.target.value)}
                                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                    />
                                  </div>
                                )}

                                {editSubCategory === "SPORTS" && (
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Sports Certificate Level *</label>
                                    <select
                                      value={editSportsType}
                                      onChange={(e) => setEditSportsType(e.target.value)}
                                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                    >
                                      <option value="">Select Sports Level</option>
                                      <option value="National Level">National Level (राष्ट्रीय स्तर)</option>
                                      <option value="State Level">State Level (राज्य स्तर)</option>
                                      <option value="Inter University">Inter University (अन्तर विश्वविद्यालय)</option>
                                    </select>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Physically Handicapped (PH) *</label>
                                  <select
                                    value={editIsPhysicallyHandicapped ? "YES" : "NO"}
                                    onChange={(e) => {
                                      const isPh = e.target.value === "YES";
                                      setEditIsPhysicallyHandicapped(isPh);
                                      if (!isPh) {
                                        setEditDisabilityType("");
                                        setEditMultiDisabilityType("");
                                        setEditScribeRequired(false);
                                      }
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value="NO">NO</option>
                                    <option value="YES">YES</option>
                                  </select>
                                </div>

                                {editIsPhysicallyHandicapped && (
                                  <>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Disability Type *</label>
                                      <select
                                        value={editDisabilityType}
                                        onChange={(e) => setEditDisabilityType(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                      >
                                        <option value="">Select Disability</option>
                                        <option value="Locomotor Disability">Locomotor Disability</option>
                                        <option value="Visual Impairment">Visual Impairment</option>
                                        <option value="Hearing Impairment">Hearing Impairment</option>
                                        <option value="Speech and Language">Speech and Language</option>
                                        <option value="Multiple Disabilities">Multiple Disabilities</option>
                                        <option value="Others">Others</option>
                                      </select>
                                    </div>

                                    {editDisabilityType === "Multiple Disabilities" && (
                                      <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Multiple Disability Details</label>
                                        <input
                                          type="text"
                                          value={editMultiDisabilityType}
                                          onChange={(e) => setEditMultiDisabilityType(e.target.value)}
                                          placeholder="Specify multiple disabilities"
                                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                        />
                                      </div>
                                    )}

                                    <div>
                                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Scribe Required *</label>
                                      <select
                                        value={editScribeRequired ? "YES" : "NO"}
                                        onChange={(e) => setEditScribeRequired(e.target.value === "YES")}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                      >
                                        <option value="NO">NO</option>
                                        <option value="YES">YES</option>
                                      </select>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Section 4: Examination Centers */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FaBuilding className="text-slate-500 text-sm" />
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider">4. Examination Center Preference</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">1st Choice Exam City *</label>
                                  <select
                                    value={editExamCity1}
                                    onChange={(e) => setEditExamCity1(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value={0}>Select 1st Choice</option>
                                    {examCitiesList.map((c) => (
                                      <option key={c.cityId || c.cityCode} value={c.cityId || c.cityCode}>
                                        {c.cityCode} - {c.cityName}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">2nd Choice Exam City *</label>
                                  <select
                                    value={editExamCity2}
                                    onChange={(e) => setEditExamCity2(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value={0}>Select 2nd Choice</option>
                                    {examCitiesList.map((c) => (
                                      <option key={c.cityId || c.cityCode} value={c.cityId || c.cityCode}>
                                        {c.cityCode} - {c.cityName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Section 5: Mailing Address & ID Proof */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FaMapMarkerAlt className="text-slate-500 text-sm" />
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider">5. Mailing Address & ID Proof</h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Mailing Address *</label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={editMailingAddress}
                                    onChange={(e) => setEditMailingAddress(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">State *</label>
                                  <select
                                    value={editStateId}
                                    onChange={(e) => {
                                      const sId = Number(e.target.value);
                                      setEditStateId(sId);
                                      fetchDistrictCities(sId);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value={0}>Select State</option>
                                    {statesList.map((s) => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">District *</label>
                                  {districtCitiesList.length > 0 ? (
                                    <select
                                      value={editDistrict}
                                      onChange={(e) => setEditDistrict(Number(e.target.value))}
                                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                    >
                                      <option value={0}>Select District</option>
                                      {districtCitiesList.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="number"
                                      value={editDistrict || ""}
                                      onChange={(e) => setEditDistrict(Number(e.target.value))}
                                      placeholder="District ID"
                                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                    />
                                  )}
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Pin Code *</label>
                                  <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={editPinCode}
                                    onChange={(e) => setEditPinCode(e.target.value.replace(/\D/g, ""))}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Identity Proof *</label>
                                  <select
                                    value={editIdentityProof}
                                    onChange={(e) => setEditIdentityProof(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none"
                                  >
                                    <option value="Aadhar Card">Aadhar Card</option>
                                    <option value="PAN Card">PAN Card</option>
                                    <option value="Voter ID Card">Voter ID Card</option>
                                    <option value="Driving License">Driving License</option>
                                    <option value="Passport">Passport</option>
                                    <option value="Government ID">Government ID</option>
                                  </select>
                                </div>

                                <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Identity Proof Number *</label>
                                  <input
                                    type="text"
                                    required
                                    value={editIdentityProofNo}
                                    onChange={(e) => setEditIdentityProofNo(e.target.value.toUpperCase())}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-slate-800 outline-none uppercase"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-6 border-t border-slate-200 flex justify-end">
                              <button
                                type="submit"
                                disabled={isSavingApplicant}
                                className="px-10 py-4 bg-slate-850 hover:bg-slate-950 disabled:bg-slate-400 text-white rounded-xl text-base font-black uppercase tracking-wider shadow-lg transition duration-200 cursor-pointer flex items-center justify-center min-w-[200px] border-none"
                              >
                                {isSavingApplicant ? "Saving Changes..." : "💾 Save All Corrections"}
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* Right Column: HTML Live Preview */}
                        <div className="xl:col-span-5 xl:sticky xl:top-6 space-y-4">
                          <div className="bg-white border border-slate-200 shadow-md rounded-2xl overflow-hidden flex flex-col h-[780px] transition duration-300">
                            <div className="bg-slate-850 px-6 py-4 flex items-center justify-between border-b border-slate-900">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-xs font-black uppercase tracking-wider">Application Live Preview</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => generateAndPrintPDF(activePreviewCandidate, foundApplicantUploads)}
                                className="px-4 py-2 bg-blue-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-none cursor-pointer flex items-center gap-2 shadow-sm"
                              >
                                🖨️ Print Form
                              </button>
                            </div>
                            <iframe
                              srcDoc={generateApplicantFormHtml(activePreviewCandidate, foundApplicantUploads)}
                              className="w-full flex-1 border-none bg-white"
                              title="Applicant Form Preview"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Payment Status Tab */}
            {activeTab === "payment" && (
              <div className="p-8 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Payment Status Reconciliation</h3>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Lookup transaction logs and check real-time candidate receipt details.</p>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col transition duration-300">
                  {/* Header */}
                  <div className="bg-slate-800 px-6 py-4 flex items-center gap-3 border-b border-slate-900">
                    <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                    </svg>
                    <span className="text-white text-xs font-semibold uppercase tracking-wider">Get Payment Status</span>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-5">
                    <form onSubmit={handleSearchPayment} className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Enter Reg. No."
                        value={paymentRegNo}
                        onChange={(e) => setPaymentRegNo(e.target.value)}
                        className="bg-slate-50/50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-normal text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 transition outline-none w-80 shadow-inner"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingPayment}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider shadow-md transition duration-200 cursor-pointer flex items-center justify-center border-none"
                      >
                        {isSearchingPayment ? "Searching..." : "Search Payment"}
                      </button>
                    </form>

                    <textarea
                      readOnly
                      rows={12}
                      value={paymentResultText}
                      placeholder="Report details will be generated here after searching..."
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 transition resize-y shadow-inner min-h-[300px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Change Password Tab */}
            {activeTab === "password" && (
              <div className="p-8 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Admin Password Configuration</h3>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Secure your administrator account by changing your login password.</p>
                </div>

                <form onSubmit={handlePasswordChangeSubmit} className="max-w-md space-y-4">
                  {passwordError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-lg flex items-center gap-2 animate-shake">
                      <FaExclamationTriangle className="text-red-500 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3.5 bg-blue-50 border border-emerald-200 text-blue-600 text-xs font-medium rounded-lg flex items-center gap-2">
                      <FaCheckCircle className="text-emerald-500 shrink-0" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-655 mb-1.5 uppercase">Old Password</label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? "text" : "password"}
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 pr-10 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                        disabled={passwordSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 text-base cursor-pointer select-none focus:outline-none"
                      >
                        {showOldPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-655 mb-1.5 uppercase">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 pr-10 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                        disabled={passwordSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 text-base cursor-pointer select-none focus:outline-none"
                      >
                        {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-655 mb-1.5 uppercase">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 pr-10 text-xs font-normal text-slate-850 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                        disabled={passwordSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base cursor-pointer select-none focus:outline-none"
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={passwordSubmitting}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold tracking-wider uppercase transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
                  >
                    {passwordSubmitting ? "Saving Changes..." : "Save Changes"}
                  </button>
                </form>
              </div>
            )}

            {/* CMS / Timelines Tab */}
            {activeTab === "cms" && (
              <div className="p-8 space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Registration Timelines CMS</h3>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Manage key registration milestones displayed on the public landing page.</p>
                </div>

                {cmsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loading CMS Data...</span>
                  </div>
                ) : (
                  <form onSubmit={handleCmsSave} className="space-y-8">

                    {/* Live Preview Panel */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6">
                      <h4 className="text-xs font-semibold text-slate-550 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <FaEye className="text-slate-400" /> Public Portal Preview (Live)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Starts Box */}
                        {(() => {
                          const item = cmsTimelines.find(t => t.key === "starts") || { label: "REGISTRATION STARTS", dateValue: "", subLabel: "11:00 AM onwards" };
                          return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden">
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label || "REGISTRATION STARTS"}</span>
                              <span className="block text-lg font-bold text-slate-800 mt-1">{item.dateValue}</span>
                              <span className="block text-xs font-medium text-slate-600 mt-0.5">{item.subLabel || "11:00 AM onwards"}</span>
                              <FaCalendarAlt className="absolute right-3 bottom-2 text-2xl opacity-10 text-slate-400" />
                            </div>
                          );
                        })()}

                        {/* Closes Box */}
                        {(() => {
                          const item = cmsTimelines.find(t => t.key === "closes") || { label: "REGISTRATION CLOSES", dateValue: "", subLabel: "Till 11:59 PM" };
                          return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden">
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label || "REGISTRATION CLOSES"}</span>
                              <span className="block text-lg font-bold text-slate-800 mt-1">{item.dateValue}</span>
                              <span className="block text-xs font-medium text-slate-600 mt-0.5">{item.subLabel || "Till 11:59 PM"}</span>
                              <FaClock className="absolute right-3 bottom-2 text-2xl opacity-10 text-slate-400" />
                            </div>
                          );
                        })()}

                        {/* Fee Box */}
                        {(() => {
                          const item = cmsTimelines.find(t => t.key === "fee") || { label: "LAST DATE FOR FEE", dateValue: "", subLabel: "Till 11:59 PM" };
                          return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden">
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label || "LAST DATE FOR FEE"}</span>
                              <span className="block text-lg font-bold text-slate-800 mt-1">{item.dateValue}</span>
                              <span className="block text-xs font-medium text-slate-600 mt-0.5">{item.subLabel || "Till 11:59 PM"}</span>
                              <FaCreditCard className="absolute right-3 bottom-2 text-2xl opacity-10 text-slate-400" />
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Add New Timeline Panel */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6 space-y-4">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <FaPlus className="text-slate-400" /> Add New Timeline Card
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Key (Unique identifier)</label>
                          <input
                            type="text"
                            placeholder="e.g. starts, closes, fee"
                            value={newTimelineKey}
                            onChange={(e) => setNewTimelineKey(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Card Header Label</label>
                          <input
                            type="text"
                            placeholder="e.g. REGISTRATION STARTS"
                            value={newTimelineLabel}
                            onChange={(e) => setNewTimelineLabel(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Date Text</label>
                          <input
                            type="text"
                            placeholder="e.g. 23 May 2026"
                            value={newTimelineDate}
                            onChange={(e) => setNewTimelineDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Sub-label Text</label>
                          <input
                            type="text"
                            placeholder="e.g. 11:00 AM onwards"
                            value={newTimelineSubLabel}
                            onChange={(e) => setNewTimelineSubLabel(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddTimeline}
                          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow-md transition cursor-pointer flex items-center gap-1.5 border-none"
                        >
                          <FaPlus className="w-3.5 h-3.5" />
                          <span>Add Timeline</span>
                        </button>
                      </div>
                    </div>

                    {/* Inputs Forms */}
                    <div className="grid grid-cols-1 gap-6">
                      {cmsTimelines.map((item, index) => {
                        let colorTheme = "border-l-4 border-l-slate-400 bg-slate-50/10";
                        if (item.key === "starts") colorTheme = "border-l-4 border-l-emerald-500 bg-blue-50/10";
                        if (item.key === "closes") colorTheme = "border-l-4 border-l-red-500 bg-red-50/10";
                        if (item.key === "fee") colorTheme = "border-l-4 border-l-blue-500 bg-blue-50/10";

                        return (
                          <div key={item.key} className={`p-6 border border-slate-200 rounded-xl space-y-4 shadow-sm ${colorTheme}`}>
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                {item.key === "starts" ? <FaPlayCircle className="text-emerald-500" /> : item.key === "closes" ? <FaStopCircle className="text-red-500" /> : item.key === "fee" ? <FaInfoCircle className="text-blue-500" /> : <FaCalendarAlt className="text-slate-500" />}
                                {item.key === "starts" ? "Registration Starts Card" : item.key === "closes" ? "Registration Closes Card" : item.key === "fee" ? "Last Date for Fee Card" : `${item.label || item.key.toUpperCase()} Card`}
                              </h4>
                              <div className="flex items-center gap-2.5">
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold uppercase">KEY: {item.key}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to remove the "${item.key}" timeline?`)) {
                                      setCmsTimelines(cmsTimelines.filter(t => t.key !== item.key));
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition border-none bg-transparent cursor-pointer flex items-center justify-center"
                                  title="Delete Timeline"
                                >
                                  <FaTimesCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Card Header Label</label>
                                <input
                                  type="text"
                                  required
                                  value={item.label}
                                  onChange={(e) => {
                                    const updated = [...cmsTimelines];
                                    updated[index].label = e.target.value;
                                    setCmsTimelines(updated);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Date Text</label>
                                <input
                                  type="text"
                                  required
                                  value={item.dateValue}
                                  onChange={(e) => {
                                    const updated = [...cmsTimelines];
                                    updated[index].dateValue = e.target.value;
                                    setCmsTimelines(updated);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Sub-label Text</label>
                                <input
                                  type="text"
                                  required
                                  value={item.subLabel}
                                  onChange={(e) => {
                                    const updated = [...cmsTimelines];
                                    updated[index].subLabel = e.target.value;
                                    setCmsTimelines(updated);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={cmsSaving}
                        className="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-none"
                      >
                        {cmsSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Saving CMS Changes...
                          </>
                        ) : (
                          <>
                            <FaSave className="w-3.5 h-3.5" />
                            <span>Save CMS Settings</span>
                          </>
                        )}
                      </button>
                    </div>

                  </form>
                )}
              </div>
            )}

            {activeTab === "alerts" && (
              <div className="p-8 space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Manage System Alerts</h3>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Create, delete, and configure multiple scrolling alert messages on the public portal.</p>
                </div>

                {/* Create/Edit Alert Form */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <FaBullhorn className="text-slate-400" /> {editingAlert ? "Edit Alert Message" : "Add New Alert Message"}
                  </h4>
                  <form onSubmit={handleAlertSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1.5 uppercase">Alert Message Text</label>
                      <textarea
                        required
                        required
                        rows={2}
                        value={newAlertText}
                        onChange={(e) => setNewAlertText(e.target.value)}
                        placeholder="Enter the alert text to display in the scrolling ticker..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-normal text-slate-800 focus:ring-2 focus:ring-slate-500/10 focus:border-slate-500 outline-hidden font-sans"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="newAlertIsActive"
                          checked={newAlertIsActive}
                          onChange={(e) => setNewAlertIsActive(e.target.checked)}
                          className="w-4 h-4 text-slate-800 border-gray-300 rounded focus:ring-slate-500/10 cursor-pointer"
                        />
                        <label htmlFor="newAlertIsActive" className="text-xs font-medium text-slate-600 select-none cursor-pointer">
                          Activate Immediately
                        </label>
                      </div>
                      <div className="flex gap-2.5">
                        {editingAlert && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAlert(null);
                              setNewAlertText("");
                              setNewAlertIsActive(true);
                            }}
                            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer border-none"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={alertsSaving}
                          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-none"
                        >
                          {alertsSaving ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>{editingAlert ? "Saving..." : "Creating..."}</span>
                            </>
                          ) : (
                            <>
                              {editingAlert ? <FaSave /> : <FaPlus />}
                              <span>{editingAlert ? "Save Alert" : "Add Alert"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Alerts List */}
                {alertsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loading System Alerts...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Active and Inactive Alerts ({systemAlerts.length})
                    </h4>
                    {systemAlerts.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs font-normal text-slate-400 uppercase tracking-wider">
                        No alert messages found. Create one above!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {systemAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`p-5 border rounded-xl flex items-start justify-between gap-4 shadow-sm ${alert.isActive
                                ? "border-slate-200 bg-slate-50/50"
                                : "border-slate-200 bg-slate-50/10"
                              }`}
                          >
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${alert.isActive
                                      ? "bg-slate-100 text-slate-800"
                                      : "bg-slate-100 text-slate-500"
                                    }`}
                                >
                                  {alert.isActive ? "Active" : "Inactive"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ID: {alert.id} • Created: {new Date(alert.createdOn || alert.CreatedOn).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs font-normal text-slate-700 leading-relaxed font-sans">{alert.text}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingAlert(alert);
                                  setNewAlertText(alert.text);
                                  setNewAlertIsActive(alert.isActive);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleAlertStatus(alert)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${alert.isActive
                                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                    : "bg-blue-600 hover:bg-emerald-700 text-white border-transparent"
                                  }`}
                              >
                                {alert.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => handleDeleteAlert(alert.id)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium transition cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Review Application Modal */}
          {isReviewModalOpen && selectedPaidApp && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">

                {/* Modal Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <FaCheckCircle className="text-emerald-400 text-xl" />
                    <div>
                      <h3 className="text-base font-semibold tracking-wide">Application Review - Paid</h3>
                      <p className="text-xs text-slate-400 font-mono">Reg No: {selectedPaidApp.registrationNo}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewModalOpen(false);
                      setSelectedPaidApp(null);
                    }}
                    className="text-slate-400 hover:text-white text-xl font-bold p-1 rounded-lg transition cursor-pointer border-none bg-transparent"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto bg-slate-50/30">

                  {/* Candidate Info Table */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <FaUser className="text-slate-500" /> Candidate Personal Details
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-normal">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Applicant Name</span>
                        <span className="block text-base font-semibold text-slate-800 mt-0.5">{selectedPaidApp.name || "N/A"}</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Father's Name</span>
                        <span className="block text-base font-semibold text-slate-800 mt-0.5">{selectedPaidApp.fatherName || "N/A"}</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Gender</span>
                        <span className="block text-base font-semibold text-slate-800 mt-0.5">{selectedPaidApp.gender || "N/A"}</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date of Birth (DOB)</span>
                        <span className="block text-base font-semibold text-slate-800 mt-0.5">{formatDateToDDMMYYYY(selectedPaidApp.dob) || "N/A"}</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Applied For</span>
                        <span className="block text-sm font-semibold text-slate-800 mt-0.5">{selectedPaidApp.appliedFor || "N/A"}</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Payment Timestamp</span>
                        <span className="block text-sm font-semibold text-slate-800 mt-0.5">{formatPaymentDate(selectedPaidApp.paymentDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Uploads Section: Photo, Thumb, Signature */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
                      <FaFolder className="text-slate-500" /> Candidate Uploaded Media (Photo, Thumb & Signature)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">

                      {/* Photo */}
                      <div className="flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Photo</span>
                        <div className="w-36 h-44 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                          {selectedPaidApp.photoFile ? (
                            <img
                              src={`${userApi.defaults.baseURL}/${selectedPaidApp.photoFile}`}
                              alt="Candidate Photo"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://via.placeholder.com/150?text=No+Photo";
                              }}
                            />
                          ) : (
                            <span className="text-xs text-slate-400 italic">No Photo Uploaded</span>
                          )}
                        </div>
                      </div>

                      {/* Thumb Impression */}
                      <div className="flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Thumb Impression</span>
                        <div className="w-36 h-44 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                          {selectedPaidApp.thumbImp ? (
                            <img
                              src={`${userApi.defaults.baseURL}/${selectedPaidApp.thumbImp}`}
                              alt="Thumb Impression"
                              className="w-full h-full object-contain p-2"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://via.placeholder.com/150?text=No+Thumb";
                              }}
                            />
                          ) : (
                            <span className="text-xs text-slate-400 italic">No Thumb Uploaded</span>
                          )}
                        </div>
                      </div>

                      {/* Signature */}
                      <div className="flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Signature</span>
                        <div className="w-44 h-24 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center shadow-inner my-auto">
                          {selectedPaidApp.signatureFile ? (
                            <img
                              src={`${userApi.defaults.baseURL}/${selectedPaidApp.signatureFile}`}
                              alt="Candidate Signature"
                              className="w-full h-full object-contain p-2"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://via.placeholder.com/150?text=No+Signature";
                              }}
                            />
                          ) : (
                            <span className="text-xs text-slate-400 italic">No Signature Uploaded</span>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* Modal Footer */}
                <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => handlePrintApplicant(selectedPaidApp.registrationNo)}
                    disabled={!!printingRegNo}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow-sm transition flex items-center gap-2 border-none cursor-pointer"
                  >
                    {printingRegNo === selectedPaidApp.registrationNo ? (
                      <FaSpinner className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FaPrint className="w-3.5 h-3.5" />
                    )}
                    <span>Print Full Application</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextPaidApp}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow-md transition border-none cursor-pointer flex items-center gap-2"
                  >
                    <span>Next</span>
                    <FaArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}

