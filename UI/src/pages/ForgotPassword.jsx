import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../stores/apiStore";
import Layout from "../components/Layout";
import { FaSyncAlt } from "react-icons/fa";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    phoneNumber: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaVal, setCaptchaVal] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");

  const generateCaptcha = () => {
    const val = Math.floor(10000 + Math.random() * 90000).toString();
    setCaptchaVal(val);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleInputChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "phoneNumber") {
      value = value.replace(/\D/g, ""); // Allow only numeric characters
    }
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const showForgotError = (msg) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!formData.email.trim()) return showForgotError("Email ID is required");
    if (!formData.phoneNumber.trim()) return showForgotError("Registered Mobile No. is required");

    setLoading(true);

    if (captchaInput !== captchaVal) {
      setLoading(false);
      showForgotError("Invalid Captcha Code. Please try again.");
      setCaptchaInput("");
      generateCaptcha();
      return;
    }

    try {
      await api.post("/api/UserRegistrations/ForgetPassword/Email", {
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        recaptchaToken: "",
      });

      setSuccess("Your new password has been sent to your registered Email ID.");
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err) {
      const errorMsg = err.response?.data || "Failed to retrieve password. Ensure the email and phone number are registered.";
      if (typeof errorMsg === 'object') {
        showForgotError(errorMsg.message || "An error occurred. Please try again.");
      } else {
        showForgotError(errorMsg);
      }
      setCaptchaInput("");
      generateCaptcha();
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className="min-h-screen flex flex-col bg-amber-50/20 font-sans">

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-2 sm:px-3 md:px-4 py-6 sm:py-8 md:py-10">
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Card Title */}
          <div className="bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 font-bold text-sm sm:text-base md:text-lg">
            <span>👤🔒</span> Retrieve Your Password
          </div>

          <form autoComplete="off" onSubmit={handleSubmit} className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-2 sm:px-3 py-2 sm:py-2.5 rounded-md text-xs sm:text-xs font-semibold border border-red-200">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="bg-blue-50 text-blue-700 px-2 sm:px-3 py-2 sm:py-2.5 rounded-md text-xs sm:text-xs font-semibold border border-blue-200">
                ✓ {success}
              </div>
            )}

            {/* Email ID */}
            <div>
              <label className="block text-xs sm:text-sm md:text-base font-bold text-gray-700 mb-1">
                Email ID <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter Email ID"
                required
                disabled={loading}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm md:text-base outline-hidden"
              />
            </div>

            {/* Mobile No */}
            <div>
              <label className="block text-xs sm:text-sm md:text-base font-bold text-gray-700 mb-1">
                Registered Mobile No. <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Enter Mobile No."
                required
                maxLength={10}
                disabled={loading}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm md:text-base outline-hidden"
              />
            </div>

            {/* Captcha Section */}
            <div className="pt-2">
              <label className="block text-xs sm:text-sm md:text-base font-bold text-gray-700 mb-1">
                Enter Captcha Code (कैप्चा कोड) <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                <input
                  type="text"
                  name="captchaInput"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="Captcha"
                  required
                  disabled={loading}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:border-blue-500 text-xs sm:text-sm md:text-base outline-hidden"
                />
                
                {/* Captcha Image Mock Box */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="bg-blue-200 border border-blue-300 select-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-md font-mono text-lg sm:text-xl tracking-wider font-extrabold text-blue-900 line-through decoration-double decoration-blue-800 whitespace-nowrap">
                    {captchaVal}
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    title="Reload Captcha"
                    disabled={loading}
                    className="p-2 border border-gray-300 rounded-md hover:bg-gray-100 text-sm flex items-center justify-center flex-shrink-0"
                  >
                    <FaSyncAlt className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-100 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate("/")}
                disabled={loading}
                className="w-full sm:flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-md font-semibold text-xs sm:text-sm md:text-base transition flex items-center justify-center gap-1.5"
              >
                <span>🔑</span> Log In
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md font-semibold text-xs sm:text-sm md:text-base transition shadow-md flex items-center justify-center gap-1.5"
              >
                <span>🔒</span> Get Password
              </button>
            </div>

            <p className="text-center font-semibold text-red-600 text-xs sm:text-sm pt-2">
              Your Login Details will be send on Your Email ID
            </p>
          </form>
        </div>
      </main>
    </Layout>
  );
}
