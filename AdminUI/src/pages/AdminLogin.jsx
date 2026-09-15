import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { FaEye, FaEyeSlash, FaUser, FaExclamationTriangle } from "react-icons/fa";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { adminLogin, loading, error } = useAuthStore();

  // Redirect if already logged in as admin
  useEffect(() => {
    const expiredMsg = sessionStorage.getItem("session_expired_message");
    if (expiredMsg) {
      setLocalError(expiredMsg);
      sessionStorage.removeItem("session_expired_message");
    }

    const token = sessionStorage.getItem("token");
    const isAdmin = sessionStorage.getItem("isAdmin");
    if (token && isAdmin === "true") {
      navigate("/admin");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!username.trim() || !password.trim()) {
      setLocalError("Please enter both username and password.");
      return;
    }

    const result = await adminLogin(username.trim(), password);
    if (result.success) {
      navigate("/admin");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 font-sans p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-lg rounded-2xl p-8 transition-all duration-300">
        
        {/* Profile Header (matches Admin Dashboard avatar style) */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full border-4 border-slate-100 overflow-hidden shadow-md bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <FaUser className="text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Login</h2>
          <p className="text-sm font-normal text-slate-500 mt-1">Provide your administrative credentials</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-sm font-semibold border border-red-200 mb-6 flex items-center gap-2">
            <FaExclamationTriangle className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {localError && (
          <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-sm font-semibold border border-red-200 mb-6 flex items-center gap-2">
            <FaExclamationTriangle className="shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Username */}
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-500/10 rounded-xl text-base font-medium text-slate-900 outline-none transition duration-200"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-500/10 rounded-xl text-base font-medium text-slate-900 outline-none pr-11 transition duration-200"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-lg cursor-pointer select-none focus:outline-none"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm tracking-wider uppercase rounded-xl transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Logging in...</span>
              </>
            ) : (
              <span>Sign In to Dashboard</span>
            )}
          </button>
        </form>

        {/* Back link */}
        <div className="mt-6 pt-4 border-t border-slate-150 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            ← Back to Portal Home
          </button>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;
