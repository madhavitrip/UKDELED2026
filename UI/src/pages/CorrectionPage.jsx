import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { notification, Modal } from "antd";
import { api } from "../stores/apiStore";
import { useAuthStore } from "../stores/authStore";
import Layout from "../components/Layout";
import { FaEye, FaEyeSlash, FaUser, FaHome } from "react-icons/fa";

// Step Components
import PersonalDetailsStep from "../components/PersonalDetailsStep";
import UploadDocumentsStep from "../components/UploadDocumentsStep";
import PreviewStep from "../components/PreviewStep";
import PaymentStep from "../components/PaymentStep";

export default function CorrectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [step, setStep] = useState(1);
  const [pageError, setPageError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [validatingFile, setValidatingFile] = useState(false);

  const showTopError = (msg) => {
    setPageError(msg);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [formData, setFormData] = useState(() => {
    const stateData = location.state || {};
    return {
      appliedCategory: "2-विज्ञानेत्तर वर्ग",
      graduationCourse: "Select",
      graduationUniversity: "Select",
      graduationDate: "",
      applicantName: stateData.fullName || "",
      mobileNo: stateData.phoneNumber || "",
      emailId: stateData.email || "",
      gender: "Select",
      dateOfBirth: "",
      fatherName: stateData.fatherName || "",
      motherName: "",
      husbandName: "",
      category: "Select",
      subCategory: "लागू/कोई नहीं",
      retirementDate: "",
      sportsType: "Select",
      phyHandicapped: "NO",
      phyType: "Select",
      multiPhType: [],
      scribeRequired: "NO",
      examCity1: "Select",
      examCity2: "Select",
      address: "",
      state: "Select",
      district: "Select",
      pincode: "",
      idProofType: "Select",
      idProofNo: "",
      registrationNo: stateData.registrationNo || "",
      applicantId: stateData.registrationNo || "",
      applyFor: "DELED",
    };
  });

  useEffect(() => {
    setImageError(false);
  }, [formData.photoFilePreview]);

  // Scroll to top on step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const [completedSteps, setCompletedSteps] = useState({});
  const [isNewRecord, setIsNewRecord] = useState(true);
  const [states, setStates] = useState([]);
  const [districtOptions, setDistrictOptions] = useState(["Select"]);
  const [examCityOptions, setExamCityOptions] = useState(["Select"]);
  const [examTypes, setExamTypes] = useState([]);
  const [ukCitiesList, setUkCitiesList] = useState([]);
  const [examCitiesList, setExamCitiesList] = useState([]);
  const [stateCitiesList, setStateCitiesList] = useState([]);

  // Change Password Modal States
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

  // Route Guard: Redirect to Home if token is not in sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      navigate("/");
    }
  }, [navigate]);

  // Route Guard: Redirect to Application Dashboard if fee deadline has passed
  useEffect(() => {
    const checkFeeDeadline = async () => {
      try {
        const timelinesRes = await api.get("/api/RegistrationTimeline");
        const timelines = timelinesRes.data;
        if (timelines && timelines.length > 0) {
          const feeTimeline = timelines.find(t => t.key === "fee");
          if (feeTimeline && feeTimeline.dateValue) {
            const feeDate = new Date(`${feeTimeline.dateValue} 23:59:59`);
            if (new Date() >= feeDate) {
              notification.error({
                message: "Deadline Passed",
                description: "The last date for fee payment and amendments has passed.",
              });
              navigate("/application");
            }
          }
        }
      } catch (err) {
        console.error("Error checking fee deadline", err);
      }
    };
    checkFeeDeadline();
  }, [navigate]);

  // Handle payment redirect query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const txnId = params.get("txnId");
    if (status === "SUCCESS") {
      notification.success({
        message: "Payment Successful",
        description: `Transaction ID: ${txnId}`,
      });
      setCompletedSteps((prev) => ({
        ...prev,
        1: true,
        2: true,
        3: true,
        4: true,
      }));
      setStep(4);
      navigate("/application", { replace: true });
    } else if (status === "FAILED") {
      notification.error({
        message: "Payment Failed",
        description: `Transaction ID: ${txnId}`,
      });
      setStep(4);
      navigate("/application", { replace: true });
    }
  }, [location, navigate]);

  // Fetch last completed step from UserStepProgress and set current step
  useEffect(() => {
    const fetchUserStepProgress = async () => {
      const token = sessionStorage.getItem("token");
      if (token) {
        try {
          const res = await api.get(`/api/UserStepProgresses`);
          if (res.data && res.data.length > 0) {
            // Get the last (highest) step number
            const lastStep = Math.max(...res.data.map((s) => s.stepNumber));
            const nextStep = lastStep + 1;

            // Mark all steps up to lastStep as completed
            const completed = {};
            for (let i = 1; i <= lastStep; i++) {
              completed[i] = true;
            }
            setCompletedSteps(completed);

            // In correction mode, we DO NOT lock the form if they completed step 4
            // But we can check if they have paid in the user profile fetch

            // Set to next step (but cap at step 4)
            setStep(Math.min(nextStep, 4));
          }
        } catch (err) {
          console.error("Error fetching step progress:", err);
        }
      }
    };

    fetchUserStepProgress();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = sessionStorage.getItem("token");
      if (token) {
        try {
          const res = await api.get(`/api/UserPersonalDetails/complete/me`);
          if (res.data && res.data.success && res.data.data) {
            const d = res.data.data;
            if (d.personalDetailId) {
              setIsNewRecord(false);
            }
              setFormData((prev) => {
                const stateVal = d.state || prev.state || "Select";
                let distVal = d.district || prev.district || "Select";
                if (stateVal.toLowerCase().includes("uttarakhand") && (distVal.toUpperCase() === "OTHERS" || distVal.toUpperCase() === "OTHER")) {
                  distVal = "Select";
                }
                return {
                  ...prev,
                  applicantName: d.fullName || "",
                  fatherName: d.fatherName || "",
                  mobileNo: d.phoneNumber || "",
                  emailId: d.email || "",
                  originalEmail: d.email || "",
                  registrationNo: d.registrationNo || "",
                  applicantId: d.registrationNo || "",

                  // Load DELED personal details
                  appliedCategory: d.appliedCategory || d.subjectCode || "2-विज्ञानेत्तर वर्ग",
                  graduationCourse: d.graduationCourse || d.deled1TrainingQualification || "Select",
                  graduationUniversity: d.graduationUniversity || d.eligibilityCodeDELED1 || "Select",
                  graduationDate: d.graduationDate ? d.graduationDate.split("T")[0] : (d.deled1TrainingYear || ""),
                  sportsType: d.sportsType || d.eligibilityCodeDELED2 || "Select",

                  applyFor: d.applicationFor || "DELED",
                  isPaymentCompleted: d.isPaymentCompleted || false,
                  gender: d.gender || prev.gender || "Select",
                  dateOfBirth: d.dob ? d.dob.split("T")[0] : prev.dateOfBirth || "",
                  motherName: d.motherName || prev.motherName || "",
                  husbandName: (d.gender || prev.gender || "").toUpperCase() === "FEMALE" ? (d.husbandName || prev.husbandName || "") : "",
                  category: d.category || prev.category || "Select",
                  subCategory: d.subCategory || prev.subCategory || "लागू/कोई नहीं",
                  retirementDate: d.retirementDate ? d.retirementDate.split("T")[0] : prev.retirementDate || "",
                  phyHandicapped: d.personalDetailId
                    ? d.isPhysicallyHandicapped
                      ? "YES"
                      : "NO"
                    : "NO",
                  phyType: d.disabilityType
                    ? (d.disabilityType.startsWith("Multi") || d.disabilityType.includes(",") ? "Multi" : d.disabilityType)
                    : prev.phyType || "Select",
                  multiPhType: d.multiDisabilityType
                    ? (Array.isArray(d.multiDisabilityType) ? d.multiDisabilityType : d.multiDisabilityType.split(",").map((s) => s.trim()).filter(Boolean))
                    : (d.disabilityType?.startsWith("Multi")
                        ? (d.disabilityType.match(/Multi\s*\((.*?)\)/i)?.[1]?.split(",")?.map((s) => s.trim())?.filter(Boolean) || [])
                        : (prev.multiPhType || [])),
                  scribeRequired: d.personalDetailId
                    ? d.scribeRequired
                      ? "YES"
                      : "NO"
                    : "NO",
                  examCity1: d.examCity1 || prev.examCity1 || "Select",
                  examCity2: d.examCity2 || prev.examCity2 || "Select",
                  address: d.mailingAddress || prev.address || "",
                  state: stateVal,
                  district: distVal,
                  pincode: d.pinCode || prev.pincode || "",
                  idProofType: d.identityProof || prev.idProofType || "Select",
                  idProofNo: d.identityProofNo || prev.idProofNo || "",
                };
              });

            // Enforce payment check for Correction Mode
            if (!d.isPaymentCompleted && d.completedStep < 4) {
              notification.error({
                message: "Correction Not Allowed",
                description: "Corrections are only allowed for users who have completed their payment.",
              });
              navigate("/application");
              return;
            }

            // In correction mode, we don't lock the form, but we set steps as complete
            if (d.completedStep >= 4) {
              setCompletedSteps((prev) => ({
                ...prev,
                1: true,
                2: true,
                3: true,
              }));
            } else {
              // Otherwise set individual progress marks
              if (d.completedStep >= 1)
                setCompletedSteps((prev) => ({ ...prev, 1: true }));
              if (d.completedStep >= 2)
                setCompletedSteps((prev) => ({ ...prev, 2: true }));
            }

            // Fetch districts for user's saved state if it exists
            if (d.state && d.state !== "Select") {
              const stateListRes = await api.get("/api/State_City");
              const savedState = (stateListRes.data || []).find(
                (s) => s.name === d.state,
              );
              if (savedState) {
                const distsRes = await api.get(
                  `/api/State_City/stateId?stateId=${savedState.id}`,
                );
                const citiesData = distsRes.data || [];
                setStateCitiesList(citiesData);
                let districtNames = [
                  "Select",
                  ...citiesData.map((c) => c.name),
                ];
                if (d.state.toLowerCase().includes("uttarakhand")) {
                  districtNames = districtNames.filter(
                    (name) => name.toUpperCase() !== "OTHERS" && name.toUpperCase() !== "OTHER"
                  );
                }
                setDistrictOptions(districtNames);
              }
            }

            // Check if Step 2 is completed by querying files
            try {
              const uploadsRes = await api.get(`/api/Uploads/user`);
              if (uploadsRes.data && uploadsRes.data.length > 0) {
                const uploadObj = uploadsRes.data[0] || uploadsRes.data;
                if (
                  uploadObj.photoFile &&
                  uploadObj.signatureFile &&
                  uploadObj.thumbImp
                ) {
                  setFormData((prev) => ({
                    ...prev,
                    photoFile: {
                      name: uploadObj.photoFile.split(/[/\\]/).pop(),
                    },
                    signatureFile: {
                      name: uploadObj.signatureFile.split(/[/\\]/).pop(),
                    },
                    thumbFile: {
                      name: uploadObj.thumbImp.split(/[/\\]/).pop(),
                    },
                    photoFilePreview: `${api.defaults.baseURL}/${uploadObj.photoFile}`,
                    signatureFilePreview: `${api.defaults.baseURL}/${uploadObj.signatureFile}`,
                    thumbFilePreview: `${api.defaults.baseURL}/${uploadObj.thumbImp}`,
                  }));
                  setCompletedSteps((prev) => ({ ...prev, 1: true, 2: true }));
                }
              }
            } catch (e) {
              // No files uploaded yet
            }
          }
        } catch (err) {
          console.error("Failed to fetch complete user profile", err);
        }
      }
    };
    fetchUserProfile();
  }, [states]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

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

  useEffect(() => {
    const fetchStatesAndExamCities = async () => {
      try {
        const res = await api.get("/api/State_City");
        const statesList = res.data || [];
        setStates(statesList);

        // Fetch Exam Types
        try {
          const examTypesRes = await api.get("/api/State_City/examTypes");
          setExamTypes(examTypesRes.data || []);
        } catch (e) {
          console.error("Failed to load exam types", e);
        }

        // Find Uttarakhand
        const ukState = statesList.find((s) =>
          s.name.toLowerCase().includes("uttarakhand"),
        );
        const ukId = ukState ? ukState.id : statesList[0]?.id || 1;

        // Fetch exam cities (Uttarakhand cities for home district, stateId = 35)
        const citiesRes = await api.get(`/api/State_City/stateId?stateId=35`);
        const citiesData = citiesRes.data || [];
        setUkCitiesList(citiesData);

        // Fetch exam cities from the new ExamCity table endpoint
        try {
          const examCitiesRes = await api.get("/api/State_City/examCities");
          const examCitiesData = examCitiesRes.data || [];
          setExamCitiesList(examCitiesData);
          const cityNames = [
            "Select",
            ...examCitiesData.map((c) => `${c.cityCode}/${c.cityName}`),
          ];
          setExamCityOptions(cityNames);
        } catch (e) {
          console.error("Failed to load exam cities", e);
          const cityNames = ["Select", ...citiesData.map((c) => c.name)];
          setExamCityOptions(cityNames);
        }
      } catch (err) {
        console.error("Failed to load states/cities", err);
      }
    };
    fetchStatesAndExamCities();
  }, []);
  const getExamTypeId = (category, phyHandicapped, appliedCategory) => {
    const isPH =
      phyHandicapped === "YES" ||
      phyHandicapped === true ||
      phyHandicapped === "1";
    const catStr = (category || "").toUpperCase();
    const isScSt =
      catStr.includes("SCHEDULED CASTE") ||
      catStr.includes("SCHEDULED TRIBE") ||
      catStr.includes("(SC)") ||
      catStr.includes("(ST)") ||
      catStr.includes("SC") ||
      catStr.includes("ST");

    const isScience =
      (appliedCategory || "").includes("1") ||
      ((appliedCategory || "").includes("विज्ञान") && !(appliedCategory || "").includes("विज्ञानेत्तर"));

    if (isScience) {
      if (isPH) return 3;
      if (isScSt) return 2;
      return 1;
    } else {
      // 2-विज्ञानेत्तर वर्ग
      if (isPH) return 6;
      if (isScSt) return 5;
      return 4;
    }
  };

  const handleInputChange = (e) => {
    let value = e.target.value;
    if (
      ["applicantName", "fatherName", "motherName", "husbandName"].includes(
        e.target.name,
      )
    ) {
      value = value.toUpperCase().replace(/[^A-Z\s.]/g, "");
    } else if (e.target.name === "mobileNo" || e.target.name === "pincode") {
      value = value.replace(/\D/g, "");
    } else if (e.target.name === "idProofNo") {
      const idType = formData.idProofType;
      if (idType === "Aadhar Card") {
        value = value.replace(/\D/g, "").substring(0, 12);
      } else if (idType === "PAN Card") {
        value = value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 10);
      } else if (idType === "Passport") {
        value = value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8);
      } else if (idType === "Voter ID Card" || idType === "Driving License") {
        value = value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 20);
      }
    }

    if (e.target.name === "gender") {
      const isFemale = value?.toUpperCase() === "FEMALE";
      setFormData((prev) => ({ ...prev, gender: value, husbandName: isFemale ? prev.husbandName : "" }));
      return;
    }

    if (e.target.name === "state") {
      const selectedStateName = value;
      const selectedState = states.find((s) => s.name === selectedStateName);
      if (selectedState) {
        api
          .get(`/api/State_City/stateId?stateId=${selectedState.id}`)
          .then((res) => {
            const citiesData = res.data || [];
            setStateCitiesList(citiesData);
            let districtNames = ["Select", ...citiesData.map((c) => c.name)];
            if (selectedStateName.toLowerCase().includes("uttarakhand")) {
              districtNames = districtNames.filter(
                (name) => name.toUpperCase() !== "OTHERS" && name.toUpperCase() !== "OTHER"
              );
            }
            setDistrictOptions(districtNames);
          })
          .catch((err) => {
            console.error("Failed to load districts", err);
          });
      } else {
        setStateCitiesList([]);
        setDistrictOptions(["Select"]);
      }
      setFormData((prev) => ({ ...prev, state: value, district: "Select" }));
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev, [e.target.name]: value };
      if (e.target.name === "appliedCategory") {
        const isScience = value.includes("1") || (value.includes("विज्ञान वर्ग") && !value.includes("विज्ञानेत्तर"));
        const scienceCourses = [
          "Bachelor of Science (B.Sc.)",
          "Bachelor of Agriculture Science(B.Sc.Agri.)",
          "Graduate Other than B.Sc./B.Sc.Agri./B.A./B.Com. and Intermediate with Science / Agri. Science",
        ];
        const nonScienceCourses = [
          "Bachelor of Arts (B.A.)",
          "Bachelor of Commerce (B.Com.)",
          "Graduate Other than B.A./B.Com. and Intermediate with Humanities / Commerce",
        ];
        const allowed = isScience ? scienceCourses : nonScienceCourses;
        if (!allowed.includes(updated.graduationCourse)) {
          updated.graduationCourse = "Select";
        }
      }
      if (["category", "subCategory", "phyHandicapped"].includes(e.target.name)) {
        updated.dateOfBirth = "";
        updated.age = "";
      }
      if (e.target.name === "phyHandicapped" && value !== "YES") {
        updated.phyType = "Select";
        updated.multiPhType = [];
        updated.scribeRequired = "NO";
      }
      if (e.target.name === "phyType" && value !== "Multi") {
        updated.multiPhType = [];
      }
      if (e.target.name === "subCategory") {
        const valUpper = (value || "").toUpperCase();
        const isExServ = valUpper.includes("EX-SERVICEMAN") || valUpper.includes("EX SERVICEMAN") || (value || "").includes("पूर्व सैनिक") || (value || "").includes("भूतपूर्व सैनिक");
        if (!isExServ) {
          updated.retirementDate = "";
        }
        if (!valUpper.includes("SPORTS")) {
          updated.sportsType = "Select";
        }
      }
      return updated;
    });
  };

  // Validation specs for each file type
  const fileValidationSpecs = {
    photoFile: {
      name: "Colour Photograph",
      minSizeKB: 5,
      maxSizeKB: 100,
      width: 140,
      height: 170,
    },
    signatureFile: {
      name: "Signature",
      minSizeKB: 2,
      maxSizeKB: 50,
      width: 180,
      height: 70,
    },
    thumbFile: {
      name: "Left Hand Thumb Impression",
      minSizeKB: 10,
      maxSizeKB: 150,
      width: 250,
      height: 150,
    },
  };

  // Function to validate image dimensions
  const validateImageDimensions = (file, spec) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        const width = img.width;
        const height = img.height;

        // Allow a small tolerance of ±10 pixels to accommodate minor cropping differences
        const tolerance = 10;
        const isWidthValid = Math.abs(width - spec.width) <= tolerance;
        const isHeightValid = Math.abs(height - spec.height) <= tolerance;

        if (isWidthValid && isHeightValid) {
          resolve({ valid: true });
        } else {
          resolve({
            valid: false,
            message: `Image dimensions must be close to ${spec.width}×${spec.height} pixels (allowed tolerance: ±10px). Current: ${width}×${height} pixels.`,
          });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ valid: false, message: "Failed to read image file." });
      };

      img.src = url;
    });
  };

  const handleFileChange = async (e, fileKey) => {
    const file = e?.target?.files ? e.target.files[0] : (e instanceof File ? e : e?.file);
    if (!file) return;

    setValidatingFile(true);

    const spec = fileValidationSpecs[fileKey];
    if (!spec) {
      showTopError(`Upload Error: Unknown file type: ${fileKey}`);
      setValidatingFile(false);
      return;
    }

    // Check file format
    const validFormats = ["image/jpeg", "image/jpg"];
    if (!validFormats.includes(file.type)) {
      showTopError(`${spec.name}: Only .jpg / .jpeg files are allowed.`);
      if (e?.target && "value" in e.target) e.target.value = "";
      setValidatingFile(false);
      return;
    }

    // Check file size
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < spec.minSizeKB || fileSizeKB > spec.maxSizeKB) {
      showTopError(`${spec.name}: File size must be between ${spec.minSizeKB} KB and ${spec.maxSizeKB} KB. Current size: ${fileSizeKB.toFixed(2)} KB.`);
      if (e?.target && "value" in e.target) e.target.value = "";
      setValidatingFile(false);
      return;
    }

    // Check image dimensions
    const dimensionValidation = await validateImageDimensions(file, spec);
    if (!dimensionValidation.valid) {
      showTopError(`${spec.name}: ${dimensionValidation.message}`);
      if (e?.target && "value" in e.target) e.target.value = "";
      setValidatingFile(false);
      return;
    }

    // Clear any previous error on valid file selection
    setPageError("");

    // All validations passed, update form data
    setFormData((prev) => ({
      ...prev,
      [fileKey]: file,
      [`${fileKey}Preview`]: URL.createObjectURL(file),
    }));

    setValidatingFile(false);
  };

  const validateStep1 = () => {
    if (formData.originalEmail) {
      const originalLocal = formData.originalEmail.split('@')[0];
      const newLocal = (formData.emailId || "").split('@')[0];
      if (originalLocal !== newLocal) {
        return { isValid: false, message: "In correction mode, you can only correct the domain part (e.g. gmail.com) of your email. The part before @ must remain unchanged." };
      }
    }

    if (formData.applicantName && formData.applicantName.trim().length > 50) {
      return { isValid: false, message: "Candidate's Full Name cannot exceed 50 characters." };
    }
    if (formData.fatherName && formData.fatherName.trim().length > 50) {
      return { isValid: false, message: "Father's Name cannot exceed 50 characters." };
    }
    if (formData.motherName && formData.motherName.trim().length > 50) {
      return { isValid: false, message: "Mother's Name cannot exceed 50 characters." };
    }
    if (formData.husbandName && formData.gender?.toUpperCase() === "FEMALE" && formData.husbandName.trim().length > 50) {
      return { isValid: false, message: "Husband's Name cannot exceed 50 characters." };
    }
    if (formData.address && formData.address.trim().length > 200) {
      return { isValid: false, message: "Mailing Address cannot exceed 200 characters." };
    }

    if (!formData.appliedCategory || formData.appliedCategory === "Select") {
      return { isValid: false, message: "Please select Applied Training Category (प्रशिक्षण हेतु आवेदित वर्ग)." };
    }
    if (!formData.graduationCourse || formData.graduationCourse === "Select") {
      return { isValid: false, message: "Please select Graduation Course (स्नातक परीक्षा का नाम)." };
    }
    if (!formData.graduationUniversity || formData.graduationUniversity === "Select") {
      return { isValid: false, message: "Please select University Name (विश्वविद्यालय का नाम)." };
    }
    if (!formData.graduationDate) {
      return { isValid: false, message: "Please enter Graduation Completion Date (स्नातक योग्यता प्राप्त करने की तिथि)." };
    }
    if (formData.graduationDate > "2026-10-06") {
      return { isValid: false, message: "Graduation completion date cannot be later than 06/10/2026 (स्नातक योग्यता प्राप्त करने की तिथि 06/10/2026 से अधिक नहीं हो सकती)." };
    }
    if (!formData.dateOfBirth) {
      return { isValid: false, message: "Please enter your Date of Birth (जन्म तिथि)." };
    }

    // Age / Date of Birth Validation
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

    if (formData.dateOfBirth > "2008-07-01") {
      return { isValid: false, message: "Minimum age must be 19 years as of 01/07/2027 (01/07/2027 को न्यूनतम आयु 19 वर्ष होनी चाहिए। जन्म तिथि 01/07/2008 के बाद की नहीं हो सकती)." };
    }

    if (!isExServiceman && formData.dateOfBirth < minAllowedDob) {
      const msg = `Age must not be more than ${maxAllowedAge} years${relaxationText} as of 01/07/2027 (01/07/2027 को आयु ${maxAllowedAge} वर्ष से अधिक नहीं होनी चाहिए। जन्म तिथि 01/07/${minAllowedDobYear} से पूर्व की नहीं हो सकती).`;
      return { isValid: false, message: msg };
    }

    if (!formData.gender || formData.gender === "Select") {
      return { isValid: false, message: "Please select gender." };
    }
    if (!formData.motherName || !formData.motherName.trim()) {
      return { isValid: false, message: "Please enter Mother's Name." };
    }
    if (!formData.category || formData.category === "Select") {
      return { isValid: false, message: "Please select Category." };
    }
    const subCat = formData.subCategory && formData.subCategory !== "Select" ? formData.subCategory : "लागू/कोई नहीं";
    if (!subCat) {
      return { isValid: false, message: "Please select Sub Category." };
    }
    if (isExServiceman) {
      if (!formData.retirementDate) {
        return { isValid: false, message: "Please enter Retirement Date from Armed Forces (सेना से सेवा-निवृत्ति की तिथि)." };
      }
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (formData.retirementDate >= todayStr) {
        return { isValid: false, message: "Date of retirement cannot be today's date or a future date. It must be less than today's date (सेना से सेवा-निवृत्ति की तिथि आज की तिथि से पूर्व की होनी चाहिए)." };
      }
      if (formData.dateOfBirth && formData.retirementDate <= formData.dateOfBirth) {
        return { isValid: false, message: "Date of retirement must be after Date of Birth (सेना से सेवा-निवृत्ति की तिथि जन्म तिथि के बाद की होनी चाहिए)." };
      }
    }
    if (!formData.phyHandicapped || formData.phyHandicapped === "Select") {
      return {
        isValid: false,
        message: "Please select if Physically Handicapped (YES/NO).",
      };
    }
    if (formData.phyHandicapped === "YES") {
      if (!formData.phyType || formData.phyType === "Select" || formData.phyType === "--Not Applicable--") {
        return { isValid: false, message: "Please select disability type." };
      }
      if (formData.phyType === "Multi") {
        const multiList = Array.isArray(formData.multiPhType)
          ? formData.multiPhType
          : (formData.multiPhType ? String(formData.multiPhType).split(",").map((s) => s.trim()).filter(Boolean) : []);
        if (multiList.length < 2) {
          return { isValid: false, message: "Please select two or more PH Types for Multi (Add two or more mentioned above)." };
        }
      }
    }

    if (!formData.examCity1 || formData.examCity1 === "Select") {
      return {
        isValid: false,
        message: "Please select 1st Exam City preference.",
      };
    }
    if (!formData.examCity2 || formData.examCity2 === "Select") {
      return {
        isValid: false,
        message: "Please select 2nd Exam City preference.",
      };
    }
    if (formData.examCity1 === formData.examCity2) {
      return {
        isValid: false,
        message: "1st and 2nd Exam City preferences cannot be the same.",
      };
    }
    if (!formData.address || !formData.address.trim()) {
      return {
        isValid: false,
        message: "Please enter complete mailing address.",
      };
    }
    
    if (!formData.state || formData.state === "Select") {
      return {
        isValid: false,
        message: "Please select mailing address State.",
      };
    }
    if (districtOptions && districtOptions.length > 1) {
      if (!formData.district || formData.district === "Select") {
        return {
          isValid: false,
          message: "Please select mailing address District.",
        };
      }
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      return {
        isValid: false,
        message: "Please enter a valid 6-digit PIN Code.",
      };
    }
    if (!formData.idProofType || formData.idProofType === "Select") {
      return { isValid: false, message: "Please select Identity Proof Type." };
    }
    if (!formData.idProofNo || !formData.idProofNo.trim()) {
      return { isValid: false, message: "Please enter Identity Proof number." };
    }

    const idType = formData.idProofType;
    const idNo = formData.idProofNo.trim();
    if (idType === "Aadhar Card" && !/^\d{12}$/.test(idNo)) {
      return { isValid: false, message: "Aadhar Card Number must be exactly 12 digits." };
    } else if (idType === "PAN Card" && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(idNo)) {
      return { isValid: false, message: "Invalid PAN Card Number format (e.g. ABCDE1234F)." };
    } else if (idType === "Voter ID Card" && !/^[A-Za-z0-9]+$/.test(idNo)) {
      return { isValid: false, message: "Voter ID must contain only alphanumeric characters." };
    } else if (idType === "Passport" && !/^[A-Z][0-9]{7}$/.test(idNo)) {
      return { isValid: false, message: "Invalid Passport Number format (e.g. A1234567)." };
    } else if (idType === "Driving License" && !/^[A-Za-z0-9]+$/.test(idNo)) {
      return { isValid: false, message: "Driving License must contain only alphanumeric characters." };
    }

    return { isValid: true };
  };

  const validateStep2 = () => {
    if (!formData.photoFile || !formData.signatureFile || !formData.thumbFile) {
      return false;
    }
    return true;
  };

  const buildPersonalDetailsPayload = () => {
    const getStateId = (stateName) => {
      const stateObj = states.find((s) => s.name === stateName);
      return stateObj ? stateObj.id : 0;
    };

    const getDistrictId = (districtName) => {
      const distObj = stateCitiesList.find((c) => c.name === districtName);
      return distObj ? distObj.id : 0;
    };

    const getExamCity1Id = (displayStr) => {
      const cityObj = examCitiesList.find(
        (c) => `${c.cityCode}/${c.cityName}` === displayStr,
      );
      return cityObj ? cityObj.cityId : 0;
    };

    const getExamCity2Id = (displayStr) => {
      const cityObj = examCitiesList.find(
        (c) => `${c.cityCode}/${c.cityName}` === displayStr,
      );
      return cityObj ? cityObj.cityId : 0;
    };

    const typeId = getExamTypeId(formData.category, formData.phyHandicapped, formData.appliedCategory);

    return {
      examTypeId: typeId,
      appliedCategory: formData.appliedCategory || "2-विज्ञानेत्तर वर्ग",
      graduationCourse: formData.graduationCourse || "",
      graduationUniversity: formData.graduationUniversity || "",
      graduationDate: formData.graduationDate || "",
      sportsType: formData.sportsType !== "Select" ? formData.sportsType : null,

      // Database column mappings
      subjectCode: formData.appliedCategory || "2-विज्ञानेत्तर वर्ग",
      deled1TrainingQualification: formData.graduationCourse || "",
      eligibilityCodeDELED1: formData.graduationUniversity || "",
      deled1TrainingYear: formData.graduationDate || "",
      eligibilityCodeDELED2: formData.sportsType !== "Select" ? formData.sportsType : null,

      gender: formData.gender || "",
      dob: formData.dateOfBirth || null,
      motherName: formData.motherName || "",
      husbandName: formData.gender?.toUpperCase() === "FEMALE" ? (formData.husbandName?.trim() || null) : null,
      category: formData.category || "",
      subCategory: formData.subCategory || "लागू/कोई नहीं",
      retirementDate: (
        (formData.subCategory || "").toUpperCase().includes("EX-SERVICEMAN") ||
        (formData.subCategory || "").toUpperCase().includes("EX SERVICEMAN") ||
        (formData.subCategory || "").includes("पूर्व सैनिक") ||
        (formData.subCategory || "").includes("भूतपूर्व सैनिक")
      ) && formData.retirementDate ? formData.retirementDate : null,
      isPhysicallyHandicapped: formData.phyHandicapped === "YES",
      disabilityType:
        formData.phyHandicapped === "YES" && formData.phyType !== "Select" && formData.phyType !== "--Not Applicable--"
          ? formData.phyType
          : null,
      multiDisabilityType:
        formData.phyHandicapped === "YES" && formData.phyType === "Multi" && formData.multiPhType && (Array.isArray(formData.multiPhType) ? formData.multiPhType.length > 0 : String(formData.multiPhType).trim())
          ? (Array.isArray(formData.multiPhType) ? formData.multiPhType.join(", ") : formData.multiPhType)
          : null,
      scribeRequired: formData.phyHandicapped === "YES" && formData.scribeRequired === "YES",
      examCity1: getExamCity1Id(formData.examCity1),
      examCity2: getExamCity2Id(formData.examCity2),
      mailingAddress: formData.address || "",
      stateId: getStateId(formData.state),
      district: getDistrictId(formData.district),
      pinCode: formData.pincode || "",
      identityProof: formData.idProofType || "",
      identityProofNo: formData.idProofNo || "",
    };
  };

  const handleNext = async () => {
    if (step === 1) {
      if (isLocked) {
        setStep(2);
        return;
      }
      const validation = validateStep1();
      if (!validation.isValid) {
        showTopError(validation.message);
        return;
      }

      try {
        const payload = buildPersonalDetailsPayload();

        if (isNewRecord) {
          await api.post("/api/UserPersonalDetails?completedStep=1", payload);
          setIsNewRecord(false);
        } else {
          await api.put("/api/UserPersonalDetails?completedStep=1", payload);
        }
      } catch (err) {
        console.error("Failed to save personal details", err);
        showTopError(
          (typeof err.response?.data === 'string' 
            ? err.response.data 
            : err.response?.data?.title || err.response?.data?.message) ||
          "Could not save personal details. Please try again."
        );
        return;
      }
    }
    if (step === 2) {
      if (isLocked) {
        setPageError("");
        setStep(3);
        return;
      }
      if (!validateStep2()) {
        showTopError("Please upload Photo, Signature, and Left Hand Thumb Impression.");
        return;
      }
      try {
        // Check if any files have changed (are File instances)
        const hasFileChanges =
          formData.photoFile instanceof File ||
          formData.signatureFile instanceof File ||
          formData.thumbFile instanceof File;

        // Only call upload API if there are actual file changes
        if (hasFileChanges) {
          const fData = new FormData();

          if (formData.photoFile instanceof File) {
            fData.append("Photo", formData.photoFile);
          }
          if (formData.signatureFile instanceof File) {
            fData.append("Signature", formData.signatureFile);
          }
          if (formData.thumbFile instanceof File) {
            fData.append("Thumb", formData.thumbFile);
          }

          let exist = false;
          try {
            const checkRes = await api.get(`/api/Uploads/user`);
            if (checkRes.data && checkRes.data.length > 0) {
              exist = true;
            }
          } catch (e) {
            // Empty means no upload
          }

          if (exist) {
            // Only update files that have changed - PATCH allows partial updates
            await api.patch(`/api/Uploads/user`, fData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } else {
            // First upload - all files must be provided
            if (
              !(formData.photoFile instanceof File) ||
              !(formData.signatureFile instanceof File) ||
              !(formData.thumbFile instanceof File)
            ) {
              showTopError("All files must be freshly chosen for the first upload.");
              return;
            }
            await api.post("/api/Uploads", fData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          }
        }
      } catch (err) {
        console.error("Failed to upload files", err);
        showTopError(
          (typeof err.response?.data === 'string' 
            ? err.response.data 
            : err.response?.data?.title || err.response?.data?.message) ||
          "Could not upload files. Please ensure files are within 200KB limit and correct format."
        );
        return;
      }
      // If we made it here without returning (either skipped uploads because no changes, or successfully uploaded)
      // UploadsController now logs Step 2 completion, so we just proceed to next step
    }
    if (step === 3) {
      if (!formData.agreedTerms) {
        showTopError("Please agree to the Terms & Conditions (घोषणा) to proceed.");
        return;
      }
      
      try {
        await api.post("/api/UserStepProgresses/3");
      } catch (err) {
        console.error("Failed to update step 3 progress", err);
      }

      notification.success({
        message: "Correction Saved",
        description: "Your application details have been successfully updated.",
      });
      navigate("/application");
      return;
    }
    setPageError("");
    setCompletedSteps((prev) => ({ ...prev, [step]: true }));
    setStep(step + 1);
  };


  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Layout className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <main className="flex-1 flex justify-center p-3 sm:p-5 md:p-6 py-4 sm:py-6">
        <div className="w-full max-w-[1550px] grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {/* Profile Sidebar */}
          <div className="md:col-span-3 lg:col-span-3 flex flex-col border border-gray-300 rounded-xs overflow-hidden bg-white shadow-xs h-fit font-sans">
            <div className="bg-[#085f9e] text-white text-center py-2.5 px-4 font-black text-sm md:text-base tracking-wider uppercase">
              MY PROFILE
            </div>

            <div className="bg-[#fffde6] p-5 text-center border-b border-gray-200 flex flex-col items-center">
              <div className="w-28 h-28 mb-3 flex items-center justify-center overflow-hidden shrink-0">
                {formData.photoFilePreview && !imageError ? (
                  <img
                    src={formData.photoFilePreview}
                    alt="Applicant Photo"
                    className="w-full h-full object-cover rounded shadow-xs"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-24 h-24 bg-[#64b5f6] rounded-full flex items-center justify-center text-white text-4xl shadow-inner">
                    <FaUser className="w-16 h-16 text-[#aed581]" />
                  </div>
                )}
              </div>
              <div className="text-[#d9381e] font-black text-lg md:text-xl tracking-wide mb-1 break-words">
                {formData.registrationNo || "26200001"}
              </div>
              <div className="text-gray-900 font-extrabold text-sm md:text-base uppercase tracking-wide break-words line-clamp-2">
                {formData.applicantName || "SARVAGYA SINGH"}
              </div>
            </div>

            <div className="bg-[#085f9e] text-white flex flex-col text-sm md:text-base font-bold divide-y divide-[#074b7c]">
              <button
                onClick={() => navigate("/application")}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#074b7c] transition text-left w-full cursor-pointer text-white border-0"
              >
                <FaHome className="w-4 h-4 text-white shrink-0" /> <span>MY HOME PAGE</span>
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
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#074b7c] transition text-left w-full cursor-pointer"
              >
                <span className="text-base">🔑</span> <span>CHANGE PASSWORD</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#074b7c] transition text-left w-full cursor-pointer"
              >
                <span className="text-base">⏻</span> <span>LOG OUT</span>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="md:col-span-9 lg:col-span-9 flex flex-col border border-gray-300 rounded-xs overflow-hidden bg-white shadow-xs">
            <div className="bg-[#0872a4] text-white px-4 py-2.5 flex items-center gap-2.5">
              <span className="text-lg">📄</span>
              <h1 className="text-base md:text-lg font-bold tracking-wide">Application Correction</h1>
            </div>

            {/* Chevron Wizard Steps */}
            <div className="bg-[#f0f0f0] p-2 flex flex-col sm:flex-row w-full select-none gap-1 sm:gap-2 border-b border-gray-200">
              {[
                { id: 1, label: "1. Application Form" },
                { id: 2, label: "2. Upload Photo" },
                { id: 3, label: "3. Preview & Submit" },
              ].map((item, idx) => {
                const isActive = step === item.id;
                const isCompleted = completedSteps[item.id] || item.id < step;

                let bgClass = "bg-[#d9d9d9] text-gray-700 hover:bg-[#cfcfcf]";
                if (isActive) {
                  bgClass = "bg-[#0084b4] text-white font-bold shadow-xs";
                } else if (isCompleted) {
                  bgClass = "bg-[#085f9e] text-white font-semibold";
                }

                return (
                  <button
                    key={item.id}
                    disabled={
                      !(item.id === 1 || completedSteps[item.id - 1]) ||
                      (isLocked && item.id < 3)
                    }
                    onClick={() => {
                      setPageError("");
                      setStep(item.id);
                    }}
                    className={`flex-1 text-center py-2 px-3 text-sm md:text-[15px] transition duration-150 rounded-xs ${bgClass} cursor-pointer disabled:cursor-not-allowed border border-black/10`}
                  >
                    <span>{item.label}</span>
                    {isCompleted && " ✓"}
                  </button>
                );
              })}
            </div>

            <div className="bg-white p-4 sm:p-6 md:p-8 overflow-x-hidden">
              {pageError && (
                <div className="bg-red-50 text-red-700 p-3 sm:p-4 rounded-md text-xs sm:text-sm font-semibold border-l-4 border-red-500 shadow-sm flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base sm:text-lg shrink-0">⚠️</span>
                    <span className="break-words">{pageError}</span>
                  </div>
                  <button
                    onClick={() => setPageError("")}
                    className="text-gray-400 hover:text-gray-600 font-bold ml-2 text-sm"
                  >
                    ✕
                  </button>
                </div>
              )}
              {step === 1 && (
                <PersonalDetailsStep
                  formData={formData}
                  states={states}
                  districtOptions={districtOptions}
                  examCityOptions={examCityOptions}
                  ukCitiesList={ukCitiesList}
                  handleInputChange={handleInputChange}
                  handleNext={handleNext}
                  isLocked={isLocked}
                  examTypes={examTypes}
                  isCorrectionMode={true}
                />
              )}

              {step === 2 && (
                <UploadDocumentsStep
                  formData={formData}
                  handleFileChange={handleFileChange}
                  handleNext={handleNext}
                  handlePrevious={handlePrevious}
                  isLocked={isLocked}
                  isValidatingFile={validatingFile}
                />
              )}

              {step === 3 && (
                <PreviewStep
                  formData={formData}
                  setFormData={setFormData}
                  handleNext={handleNext}
                  handlePrevious={handlePrevious}
                  isLocked={isLocked}
                  isCorrectionMode={true}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs font-sans p-2 sm:p-3 md:p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-700 text-white px-2 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 flex justify-between items-center gap-2 sticky top-0 z-10">
              <h2 className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide">
                CHANGE PASSWORD
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-white/80 hover:text-white text-lg sm:text-xl font-bold cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>
            <form autoComplete="off" onSubmit={handlePasswordSubmit} className="p-2 sm:p-3 md:p-4 lg:p-6 space-y-2 sm:space-y-3 md:space-y-4">
              {passwordError && (
                <div className="bg-red-50 text-red-600 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-bold border border-red-200">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-blue-50 text-blue-700 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-bold border border-blue-200">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5 uppercase">
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
                    className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 pr-8 sm:pr-10 border border-gray-300 rounded text-xs sm:text-sm focus:ring-1 focus:ring-blue-700 focus:border-blue-700 outline-hidden"
                    placeholder="Enter old password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm sm:text-base cursor-pointer select-none focus:outline-none"
                  >
                    {showOldPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5 uppercase">
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
                    className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 pr-8 sm:pr-10 border border-gray-300 rounded text-xs sm:text-sm focus:ring-1 focus:ring-blue-700 focus:border-blue-700 outline-hidden"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm sm:text-base cursor-pointer select-none focus:outline-none"
                  >
                    {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5 uppercase">
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
                    className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 pr-8 sm:pr-10 border border-gray-300 rounded text-xs sm:text-sm focus:ring-1 focus:ring-blue-700 focus:border-blue-700 outline-hidden"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm sm:text-base cursor-pointer select-none focus:outline-none"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 pt-2 md:pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-4 border border-gray-300 rounded text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-4 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs sm:text-sm font-bold transition disabled:opacity-50 cursor-pointer"
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
