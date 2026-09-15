import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApiStore, api } from "../stores/apiStore";
import Layout from "../components/Layout";
import { FaSyncAlt } from "react-icons/fa";

export default function NewRegistration() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sendOtp, loading, error: apiError } = useApiStore();
  const stateData = location.state || {};
  
  const [formData, setFormData] = useState({
    fullName: stateData.fullName || "",
    fatherName: stateData.fatherName || "",
    phoneNumber: stateData.phoneNumber || "",
    email: stateData.email || "",
  });
  const [userId, setUserId] = useState(stateData.userId || null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captchaVal, setCaptchaVal] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");

  const generateCaptcha = () => {
    const val = Math.floor(10000 + Math.random() * 90000).toString();
    setCaptchaVal(val);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get("/api/RegistrationTimeline/status");
        if (res.data && !res.data.isOpen) {
          navigate("/");
        }
      } catch (err) {
        console.error("Failed to fetch registration status:", err);
      }
    };
    checkStatus();
  }, [navigate]);

  const handleInputChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "fullName" || e.target.name === "fatherName") {
      value = value.toUpperCase().replace(/[^A-Z\s.]/g, "");
    } else if (e.target.name === "phoneNumber") {
      value = value.replace(/\D/g, "");
    }
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleClear = () => {
    setFormData({
      fullName: "",
      fatherName: "",
      phoneNumber: "",
      email: "",
    });
    setUserId(null);
    setError("");
    setSuccess("");
    setCaptchaInput("");
    generateCaptcha();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const showRegError = (msg) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!formData.fullName.trim()) return showRegError("Name is required");
    if (formData.fullName.trim().length > 50)
      return showRegError("Name cannot exceed 50 characters");
    if (!formData.fatherName.trim())
      return showRegError("Father's Name is required");
    if (formData.fatherName.trim().length > 50)
      return showRegError("Father's Name cannot exceed 50 characters");
    if (!formData.phoneNumber.trim())
      return showRegError("Mobile number is required");
    if (!formData.email.trim()) return showRegError("Email ID is required");
    
    if (formData.phoneNumber && !/^\d{10}$/.test(formData.phoneNumber.trim())) {
      return showRegError("Mobile Number must be exactly 10 digits.");
    }

    if (
      formData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      return showRegError("Please enter a valid Email ID.");
    }

    if (captchaInput !== captchaVal) {
      showRegError("Invalid Captcha Code. Please try again.");
      setCaptchaInput("");
      generateCaptcha();
      return;
    }

    try {
      const result = await sendOtp(
        formData.fullName,
        formData.fatherName,
        formData.phoneNumber,
        formData.email,
        "",
        userId
      );

      if (result.success) {
        setSuccess("OTP sent successfully.");
        setTimeout(() => {
          navigate("/verify-otp", { state: { ...formData, userId: result.userId } });
        }, 1000);
      } else {
        const errorMessage = result.error || "Registration failed";
        showRegError(errorMessage);
        setCaptchaInput("");
        generateCaptcha();
      }
    } catch (err) {
      console.error("Registration error:", err);
      showRegError("Registration failed. Please try again.");
      setCaptchaInput("");
      generateCaptcha();
    }
  };

  return (
    <Layout className="min-h-screen flex flex-col bg-amber-50/20 font-sans">

      {/* Main Registration Container */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-3 md:p-4 py-6 sm:py-8 md:py-10">
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-lg bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Card Title */}
          <div className="bg-blue-600 text-white px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 flex items-center gap-2 font-bold text-sm sm:text-base md:text-lg">
            <span className="text-base sm:text-lg md:text-xl">ℹ️</span> <span className="truncate">New user Registration</span>
          </div>

          <form autoComplete="off" onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            {/* Form Tagline */}
            <p className="text-center font-bold text-red-600 text-xs sm:text-sm md:text-base border-b border-gray-100 pb-2 sm:pb-3">
              अभ्यर्थी अपना व्यक्तिगत मोबाइल एवं ईमेल अंकित करें।
            </p>

            {error && (
              <div className="bg-red-50 text-red-700 p-2 sm:p-3 md:p-4 rounded-md text-xs sm:text-sm font-semibold border-l-4 border-red-500 shadow-sm">
                <p className="flex items-start gap-2">
                  <span className="text-base sm:text-lg shrink-0">⚠️</span>
                  <span className="break-words">{error}</span>
                </p>
                {error && (error.toLowerCase().includes("already exist") || error.toLowerCase().includes("already registered")) && (
                  <p className="mt-1.5 sm:mt-2 text-xs text-red-600 ml-6 sm:ml-7 break-words">
                    💡 Try registering with different email or phone number, or contact support if this is an error.
                  </p>
                )}
              </div>
            )}

            {success && (
              <div className="bg-blue-50 text-blue-700 p-2 sm:p-3 md:p-4 rounded-md text-xs sm:text-sm font-semibold border-l-4 border-blue-500 shadow-sm">
                <p className="flex items-start gap-2">
                  <span className="text-base sm:text-lg shrink-0">✓</span>
                  <span className="break-words">{success}</span>
                </p>
              </div>
            )}

            {/* Inputs */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5">
                Name (नाम) <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Your Name"
                required
                maxLength={50}
                disabled={loading}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-xs focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5">
                Father's Name (पिता का नाम) <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                type="text"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleInputChange}
                placeholder="Father's Name"
                required
                maxLength={50}
                disabled={loading}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-xs focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5">
                Mobile No. (मोबाइल नं.) <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Mobile No"
                required
                maxLength={10}
                disabled={loading}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-xs focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5">
                Email ID (ईमेल आईडी) <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter Email Id"
                required
                disabled={loading}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-xs focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm outline-hidden"
              />
            </div>

            {/* Captcha Section */}
            <div className="pt-1 sm:pt-2">
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-1.5">
                Enter Captcha Code (कैप्चा कोड) <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="text"
                  name="captchaInput"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="Captcha"
                  required
                  disabled={loading}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-xs focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm outline-hidden"
                />
                
                {/* Captcha Image Mock Box */}
                <div className="flex items-center gap-1 sm:gap-2 justify-center sm:justify-start">
                  <div className="bg-blue-200 border border-blue-300 select-none px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-md font-mono text-base sm:text-lg md:text-xl tracking-wider font-extrabold text-blue-900 line-through decoration-double decoration-blue-800 shrink-0">
                    {captchaVal}
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    title="Reload Captcha"
                    disabled={loading}
                    className="p-1.5 sm:p-2 border border-gray-300 rounded-md hover:bg-gray-100 text-xs sm:text-sm flex items-center justify-center shrink-0"
                  >
                    <FaSyncAlt className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-between items-stretch sm:items-center pt-2 sm:pt-3 md:pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md font-semibold text-xs sm:text-sm transition order-2 sm:order-1"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-md font-semibold text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-1 sm:gap-2 order-1 sm:order-2"
              >
                {loading ? (
                  <>
                    <FaSyncAlt className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </Layout>
  );
}
