import React, { useState, useEffect } from "react";
import { api } from "../stores/apiStore";
import { FaPhoneAlt, FaEnvelope } from "react-icons/fa";

export default function Header() {
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const baseUrl = api.defaults.baseURL;
    if (baseUrl) {
      setLogoUrl(`${baseUrl}/Logo/ubse_white.jpg`);
    }
  }, []);

  return (
    <header className="w-full bg-[#ffffff] border-b border-gray-200 px-4 sm:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center gap-4 w-full md:w-auto">
        {logoUrl && (
          <img
            src={logoUrl}
            alt="UBSE Logo"
            className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-red-800 shrink-0 object-cover shadow-xs"
            onError={(e) => {
              console.error("Failed to load logo:", logoUrl);
              e.target.style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#025091] tracking-tight leading-tight uppercase font-sans">
            UTTARAKHAND BOARD OF SCHOOL EDUCATION
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl lg:text-[23px] font-black text-[#0066cc] mt-1 leading-snug">
            उत्तराखण्ड विद्यालयी शिक्षा परिषद्
          </p>
          <p className="text-base sm:text-lg md:text-xl lg:text-[21px] font-black text-[#cc0000] mt-1 leading-snug">
            द्विवर्षीय डी० एल० एड० (D.El.Ed.) प्रशिक्षण प्रवेश परीक्षा 2026
          </p>
        </div>
      </div>

      <div className="bg-[#f0f7ff] border border-[#b9d5fc] rounded-2xl px-6 py-4 shadow-xs shrink-0 flex flex-col justify-center gap-2.5">
        <div className="flex items-center gap-3">
          <FaPhoneAlt className="w-5 h-5 text-[#047857] shrink-0" />
          <span className="text-[#0369a1] font-bold text-base sm:text-lg md:text-[18px] tracking-tight">
            Ph1: 9125877583
          </span>
        </div>
        <div className="flex items-center gap-3">
          <FaPhoneAlt className="w-5 h-5 text-[#047857] shrink-0" />
          <span className="text-[#0369a1] font-bold text-base sm:text-lg md:text-[18px] tracking-tight">
            Ph2: 8853817583
          </span>
        </div>
        <div className="flex items-center gap-3">
          <FaEnvelope className="w-5 h-5 text-[#dc2626] shrink-0" />
          <a
            href="mailto:info@ukdeled.com"
            className="text-[#dc2626] font-bold text-base sm:text-lg md:text-[18px] hover:underline"
          >
            info@ukdeled.com
          </a>
        </div>
      </div>
    </header>
  );
}
