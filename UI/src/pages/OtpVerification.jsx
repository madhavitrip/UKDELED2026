import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApiStore, api } from "../stores/apiStore";
import Layout from "../components/Layout";

export default function OtpVerification() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp, resendOtp, loading, error: apiError } = useApiStore();
  
  // Retrieve form data passed from registration screen
  const regData = location.state || {
    fullName: "",
    fatherName: "",
    phoneNumber: "",
    email: "",
    userId: null,
  };

  const [mobileOtp, setMobileOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Persist timer end timestamp across refreshes
  const [timer, setTimer] = useState(() => {
    const savedExpiry = sessionStorage.getItem("otp_timer_expiry");
    if (savedExpiry) {
      const remaining = Math.max(0, Math.floor((parseInt(savedExpiry, 10) - Date.now()) / 1000));
      return remaining;
    }
    const newExpiry = Date.now() + 120 * 1000;
    sessionStorage.setItem("otp_timer_expiry", newExpiry.toString());
    return 120;
  });

  useEffect(() => {
    if (!regData.email) {
      navigate("/");
      return;
    }

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
  }, [regData, navigate]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            sessionStorage.removeItem("otp_timer_expiry");
          }
          return nextVal;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const showOtpError = (msg) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!mobileOtp.trim() || mobileOtp.length < 4) {
      return showOtpError("Please enter a valid 6-digit Mobile OTP (कृपया मोबाइल पर प्राप्त वैध 6-अंकीय ओटीपी दर्ज करें)");
    }

    if (!emailOtp.trim() || emailOtp.length < 4) {
      return showOtpError("Please enter a valid 6-digit Email OTP (कृपया ईमेल पर प्राप्त वैध 6-अंकीय ओटीपी दर्ज करें)");
    }

    const result = await verifyOtp(regData.userId, mobileOtp, emailOtp);
    if (result.success) {
      setSuccess("OTP Verified successfully! Registration completed. An email and SMS have been sent containing your password and registration details. Redirecting...");
      sessionStorage.removeItem("otp_timer_expiry");
      setTimeout(() => {
        navigate("/application", { replace: true });
      }, 3500);
    } else {
      showOtpError(result.error || "Invalid OTP or OTP has expired.");
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");

    const showOtpError = (msg) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!regData.userId) {
      showOtpError("User session expired. Please register again.");
      return;
    }

    const result = await resendOtp(regData.userId);

    if (result.success) {
      setSuccess("New OTPs have been sent separately to your Mobile and Email.");
      setMobileOtp("");
      setEmailOtp("");
      const newExpiry = Date.now() + 120 * 1000;
      sessionStorage.setItem("otp_timer_expiry", newExpiry.toString());
      setTimer(120);
    } else {
      showOtpError(result.error || "Failed to resend OTP. Please try again.");
    }
  };

  return (
    <Layout className="min-h-screen flex flex-col bg-amber-50/20 font-sans">

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-2 sm:px-4 py-6 sm:py-8 md:py-10">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Card Title */}
          <div className="bg-blue-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 font-bold text-sm sm:text-base md:text-lg">
            <span>🛡️</span> Dual OTP Verification / ओटीपी सत्यापन
          </div>

          <form autoComplete="off" onSubmit={handleVerify} className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
            <div className="text-center bg-blue-50/60 p-3 rounded-lg border border-blue-100">
              <p className="font-semibold text-gray-800 text-xs sm:text-sm">
                Distinct OTPs have been sent to your registered Mobile Number and Email Address.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                आपके मोबाइल नंबर एवं ईमेल आईडी पर अलग-अलग ओटीपी भेजे गए हैं।
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-2.5 sm:p-3 rounded-md text-xs sm:text-sm font-semibold border border-red-200">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="bg-blue-50 text-blue-700 p-2.5 sm:p-3 rounded-md text-xs sm:text-sm font-semibold border border-blue-200">
                ✓ {success}
              </div>
            )}

            {/* Mobile OTP Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs sm:text-sm font-bold text-gray-800">
                  📱 Mobile OTP (मोबाइल ओटीपी) <span className="text-red-600 font-bold">*</span>
                </label>
                <span className="text-xs text-gray-500 font-medium">
                  Sent to: <strong className="text-gray-800">{regData.phoneNumber || "Mobile"}</strong>
                </span>
              </div>
              <input
                type="text"
                value={mobileOtp}
                onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit Mobile OTP"
                required
                maxLength={6}
                disabled={loading}
                className="w-full text-center tracking-widest font-mono text-lg sm:text-xl px-3 py-2 sm:py-2.5 border border-gray-300 rounded-md shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-gray-50/30"
              />
              <p className="text-[11px] text-gray-500">
                Enter the 6-digit code received via SMS on your mobile
              </p>
            </div>

            {/* Email OTP Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs sm:text-sm font-bold text-gray-800">
                  ✉️ Email OTP (ईमेल ओटीपी) <span className="text-red-600 font-bold">*</span>
                </label>
                <span className="text-xs text-gray-500 font-medium truncate max-w-[200px]" title={regData.email}>
                  Sent to: <strong className="text-gray-800">{regData.email || "Email"}</strong>
                </span>
              </div>
              <input
                type="text"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit Email OTP"
                required
                maxLength={6}
                disabled={loading}
                className="w-full text-center tracking-widest font-mono text-lg sm:text-xl px-3 py-2 sm:py-2.5 border border-gray-300 rounded-md shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-gray-50/30"
              />
              <p className="text-[11px] text-gray-500">
                Enter the 6-digit code received via Email (also check Spam/Junk folder)
              </p>
            </div>

            {/* Timer / Resend */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold text-gray-500 pt-1">
              <span>
                {timer > 0 ? (
                  <span>Resend OTPs in: <strong className="text-red-600">{timer}s</strong></span>
                ) : (
                  <span className="text-blue-600">OTPs ready to resend</span>
                )}
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={timer > 0 || loading}
                className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 hover:underline transition text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Resend OTPs (पुनः ओटीपी भेजें)
              </button>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate("/new-registration", { state: regData })}
                disabled={loading}
                className="w-full sm:flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md font-semibold text-xs sm:text-sm transition text-center cursor-pointer"
              >
                Back / वापस
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:flex-1 px-3 sm:px-5 py-2 sm:py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md font-semibold text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? "Verifying..." : "Verify & Proceed / सत्यापित करें"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </Layout>
  );
}
