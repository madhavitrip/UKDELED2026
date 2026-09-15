import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../stores/apiStore";
import { Spin, Button, Input, message } from "antd";
import {
  PrinterOutlined,
  SearchOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined
} from "@ant-design/icons";
import Layout from "../components/Layout";

export default function VerifyApplication() {
  const { registrationNo: routeRegNo } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialParam =
    routeRegNo ||
    searchParams.get("token") ||
    searchParams.get("enc") ||
    searchParams.get("regNo") ||
    "";

  const [searchInput, setSearchInput] = useState(initialParam);
  const [currentRegNo, setCurrentRegNo] = useState(initialParam);
  const [encryptedToken, setEncryptedToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [applicationData, setApplicationData] = useState(null);
  const [uploads, setUploads] = useState({
    photo: "",
    signature: "",
    thumb: ""
  });
  const [error, setError] = useState(null);

  const fetchApplicationDetails = async (inputParam) => {
    if (!inputParam || !inputParam.trim()) return;

    const cleanParam = inputParam.trim();
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(
        `/api/UserPersonalDetails/applicant/${encodeURIComponent(cleanParam)}`
      );

      if (response.data && response.data.success) {
        const data = response.data.data;
        const uploadObj = response.data.uploads || {};
        const encToken = response.data.encryptedToken || "";

        setApplicationData(data);
        setEncryptedToken(encToken);

        const baseUrl = api.defaults.baseURL || "";
        setUploads({
          photo: uploadObj.photoFile ? `${baseUrl}/${uploadObj.photoFile}` : "",
          signature: uploadObj.signatureFile ? `${baseUrl}/${uploadObj.signatureFile}` : "",
          thumb: uploadObj.thumbImp ? `${baseUrl}/${uploadObj.thumbImp}` : ""
        });
      } else {
        setError(`Candidate application not found for '${cleanParam}'.`);
      }
    } catch (err) {
      console.warn("Applicant DB record not found:", err);
      setError(`Candidate application not found for '${cleanParam}'.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const param =
      routeRegNo ||
      searchParams.get("token") ||
      searchParams.get("enc") ||
      searchParams.get("regNo");

    if (param) {
      setSearchInput(param);
      setCurrentRegNo(param);
      fetchApplicationDetails(param);
    }
  }, [routeRegNo, searchParams]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) {
      setError("Please enter a Registration Number or Security Token");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setCurrentRegNo(searchInput.trim());
    navigate(`/verify/${encodeURIComponent(searchInput.trim())}`);
  };

  const handlePrint = () => {
    window.print();
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

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const isDeled1 = (appFor) => {
    if (!appFor) return false;
    const clean = appFor.toUpperCase();
    return (
      clean.includes("DELED I") ||
      clean.includes("DELED-I") ||
      clean.includes("BOTH") ||
      clean === "1"
    );
  };

  const isDeled2 = (appFor) => {
    if (!appFor) return false;
    const clean = appFor.toUpperCase();
    return (
      clean.includes("DELED II") ||
      clean.includes("DELED-II") ||
      clean.includes("BOTH") ||
      clean === "2"
    );
  };

  // Secure QR value using encrypted token to prevent unauthorized URL manipulation
  const secureVerifyUrl = `https://ukdeled.com/verify?token=${encodeURIComponent(
    encryptedToken || applicationData?.registrationNo || currentRegNo || "N/A"
  )}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=10&data=${encodeURIComponent(
    secureVerifyUrl
  )}`;
  const logoUrl = `${api.defaults.baseURL || ""}/Logo/ubse_white.jpg`;

  const hasContent = !!applicationData;

  return (
    <Layout>
      {/* Printable Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-sheet, #printable-sheet * {
            visibility: visible;
          }
          #printable-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: 1px solid #111 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 8mm;
          }
        }
        .app-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .app-table th, .app-table td {
          border: 1px solid #c5c5c5;
          padding: 5px 8px;
          vertical-align: middle;
          text-align: left;
        }
        .app-table th {
          background-color: #f8fafc;
          color: #334155;
          font-weight: 600;
          width: 25%;
        }
        .app-table td {
          color: #0f172a;
          width: 25%;
        }
        .section-header-th {
          background-color: #f1f5f9 !important;
          color: #1e293b !important;
          font-weight: 700 !important;
          text-align: left !important;
          font-size: 12px !important;
          padding: 6px 8px !important;
        }
        .photo-box {
          border: 1px solid #c5c5c5;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #fafafa;
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 py-6 px-3 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Top Search & Action Bar (Hidden on Print) */}
          <div className="no-print bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <form
              onSubmit={handleSearch}
              className="flex-1 flex items-center gap-2 w-full sm:w-auto"
            >
              <Input
                placeholder="Enter Registration No. or Security Token"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                prefix={<SearchOutlined className="text-gray-400" />}
                className="w-full sm:max-w-xs"
                allowClear
              />
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="bg-blue-600"
              >
                Search
              </Button>
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {hasContent && (
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Print Application
                </Button>
              )}
              <Button icon={<HomeOutlined />} onClick={() => navigate("/")}>
                Home
              </Button>
            </div>
          </div>

          {/* Security & Verification Banner */}
          {hasContent && (
            <div className="no-print bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-blue-800 font-semibold">
                <SafetyCertificateOutlined className="text-base text-blue-600" />
                <span>
                  Verified Record: <strong>{applicationData.fullName}</strong> ({applicationData.registrationNo})
                </span>
              </div>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className="bg-white p-12 rounded-lg shadow-sm text-center">
              <Spin size="large" />
              <p className="mt-3 text-gray-500 font-medium">
                Verifying Candidate Details...
              </p>
            </div>
          )}

          {/* Error Message */}
          {!loading && error && (
            <div className="no-print bg-white p-8 rounded-lg shadow-sm border border-red-200 text-center">
              <CloseCircleOutlined className="text-red-500 text-5xl mb-3" />
              <h3 className="text-xl font-bold text-gray-800">
                Verification Failed
              </h3>
              <p className="text-red-600 mt-2 max-w-md mx-auto">{error}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => fetchApplicationDetails(searchInput)}
                >
                  Retry
                </Button>
                <Button
                  type="primary"
                  onClick={() => navigate("/")}
                  className="bg-blue-600"
                >
                  Return to Home
                </Button>
              </div>
            </div>
          )}

          {/* Prompt if no search done yet */}
          {!loading && !error && !hasContent && (
            <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
              <SearchOutlined className="text-blue-500 text-5xl mb-3" />
              <h3 className="text-xl font-bold text-gray-800">
                Secure QR &amp; Application Verification
              </h3>
              <p className="text-gray-500 mt-2 max-w-md mx-auto text-sm">
                Scan the QR code or enter the Registration Number to view verified details.
              </p>
            </div>
          )}

          {/* APPLICATION FORM (Printable Sheet) */}
          {!loading && applicationData && (
            <div id="printable-sheet" className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 border border-slate-300 rounded flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={logoUrl}
                      alt="UBSE"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                  <div>
                    <h1 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight uppercase">
                      Uttarakhand Board of School Education, Ramnagar (Nainital)
                    </h1>
                    <h2 className="text-xs sm:text-sm font-bold text-emerald-800">
                      DELED - 2026 Verification Portal
                    </h2>
                    <p className="text-[10px] text-gray-500">
                      Uttarakhand Teacher Eligibility Test
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 border border-slate-300 p-1 bg-white rounded flex items-center justify-center">
                    <img
                      src={qrCodeUrl}
                      alt="Secure QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono block mt-0.5">
                    Encrypted QR
                  </span>
                </div>
              </div>

              {/* Application Details Table */}
              <table className="app-table">
                <tbody>
                  {/* Registration Header */}
                  <tr>
                    <th colSpan="4" className="section-header-th">
                      Registration &amp; Examination Details
                    </th>
                  </tr>
                  <tr>
                    <th>Registration No.</th>
                    <td style={{ fontWeight: "bold", color: "#074b7c" }}>
                      {applicationData.registrationNo || "N/A"}
                    </td>
                    <th>प्रशिक्षण हेतु आवेदित वर्ग</th>
                    <td style={{ fontWeight: "bold" }}>
                      {applicationData.appliedCategory || applicationData.subjectCode || "2-विज्ञानेत्तर वर्ग"}
                    </td>
                  </tr>

                  {/* Graduation Details */}
                  <tr>
                    <th colSpan="4" className="section-header-th">
                      Graduation Qualification (स्नातक योग्यता का विवरण)
                    </th>
                  </tr>
                  <tr>
                    <th>Graduation Course</th>
                    <td>{applicationData.graduationCourse || applicationData.deled1TrainingQualification || "N/A"}</td>
                    <th>Name of University</th>
                    <td>{applicationData.graduationUniversity || applicationData.eligibilityCodeDELED1 || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>स्नातक योग्यता प्राप्त करने की तिथि</th>
                    <td>{formatDob(applicationData.graduationDate || applicationData.deled1TrainingYear)}</td>
                    <th>खेल का प्रकार</th>
                    <td>{applicationData.sportsType || applicationData.eligibilityCodeDELED2 || "None"}</td>
                  </tr>

                  {/* Personal Details */}
                  <tr>
                    <th colSpan="4" className="section-header-th">
                      Personal Details
                    </th>
                  </tr>
                  <tr>
                    <th>Applicant's Name</th>
                    <td style={{ fontWeight: "bold" }}>
                      {applicationData.fullName || "N/A"}
                    </td>
                    <th>Gender</th>
                    <td>{applicationData.gender || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Date of Birth</th>
                    <td style={{ fontWeight: "bold" }}>
                      {formatDob(applicationData.dob)}
                    </td>
                    <th>Father's Name</th>
                    <td>{applicationData.fatherName || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Mother's Name</th>
                    <td>{applicationData.motherName || "N/A"}</td>
                    <th>Husband's Name</th>
                    <td>{applicationData.husbandName || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Category</th>
                    <td>{applicationData.category || "N/A"}</td>
                    <th>Sub Category</th>
                    <td>{applicationData.subCategory || "N/A"}</td>
                  </tr>
                  {applicationData.retirementDate && (
                    <tr>
                      <th>सेना से सेवा-निवृत्ति की तिथि</th>
                      <td colSpan="3">{formatDob(applicationData.retirementDate)}</td>
                    </tr>
                  )}
                  <tr>
                    <th>Physically Handicapped</th>
                    <td>
                      {applicationData.isPhysicallyHandicapped ? "YES" : "NO"}
                    </td>
                    <th>Disability Type</th>
                    <td>{applicationData.isPhysicallyHandicapped ? (applicationData.disabilityType || "N/A") : "N/A"}</td>
                  </tr>
                  {applicationData.isPhysicallyHandicapped && (
                    <tr>
                      <th>Scribe Required</th>
                      <td colSpan="3">{applicationData.scribeRequired ? "YES" : "NO"}</td>
                    </tr>
                  )}

                  {/* Contact & Address Details */}
                  <tr>
                    <th colSpan="4" className="section-header-th">
                      Contact &amp; Examination Centers
                    </th>
                  </tr>
                  <tr>
                    <th>Mobile Number</th>
                    <td>{applicationData.phoneNumber || "N/A"}</td>
                    <th>Email ID</th>
                    <td>{applicationData.email || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Exam City 1ˢᵗ</th>
                    <td>{applicationData.examCity1 || "N/A"}</td>
                    <th>Exam City 2ⁿᵈ</th>
                    <td>{applicationData.examCity2 || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Mailing Address</th>
                    <td colSpan="3">
                      {applicationData.mailingAddress || "N/A"},{" "}
                      {applicationData.districtName || applicationData.district || ""},{" "}
                      {applicationData.stateName || applicationData.stateId || ""}{" "}
                      - {applicationData.pinCode || ""}
                    </td>
                  </tr>
                  <tr>
                    <th>Identity Proof</th>
                    <td>{applicationData.identityProof || "N/A"}</td>
                    <th>Identity Proof No.</th>
                    <td>{applicationData.identityProofNo || "N/A"}</td>
                  </tr>

                  {/* Uploaded Documents Preview */}
                  <tr>
                    <th colSpan="4" className="section-header-th">
                      Uploaded Documents
                    </th>
                  </tr>
                  <tr>
                    <th>Photograph</th>
                    <td>
                      <div className="photo-box w-20 h-24 sm:w-24 sm:h-28">
                        {uploads.photo ? (
                          <img
                            src={uploads.photo}
                            alt="Candidate"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            No Photo
                          </span>
                        )}
                      </div>
                    </td>
                    <th>Signature &amp; Thumb</th>
                    <td>
                      <div className="flex gap-2">
                        <div className="photo-box w-20 h-10 sm:w-24 sm:h-12">
                          {uploads.signature ? (
                            <img
                              src={uploads.signature}
                              alt="Signature"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-gray-400">
                              No Sign
                            </span>
                          )}
                        </div>
                        <div className="photo-box w-12 h-12 sm:w-14 sm:h-14">
                          {uploads.thumb ? (
                            <img
                              src={uploads.thumb}
                              alt="Thumb"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-gray-400">
                              No Thumb
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {applicationData.transactionId && (
                    <>
                      <tr>
                        <th colSpan="4" className="section-header-th">
                          Payment Details
                        </th>
                      </tr>
                      <tr>
                        <th>Transaction ID</th>
                        <td>{applicationData.transactionId || "N/A"}</td>
                        <th>Amount Paid (INR)</th>
                        <td>
                          {applicationData.transactionAmount
                            ? `₹${applicationData.transactionAmount}`
                            : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <th>Transaction Status</th>
                        <td>
                          <span
                            style={{
                              color:
                                applicationData.transactionStatus === "SUCCESS"
                                  ? "#085f9e"
                                  : "#dc2626",
                              fontWeight: "bold"
                            }}
                          >
                            {applicationData.transactionStatus || "N/A"}
                          </span>
                        </td>
                        <th>Transaction Date</th>
                        <td>{formatDate(applicationData.paymentDate || applicationData.transactionDate)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {/* Status Footer (On Screen) */}
              <div className="no-print mt-4 pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Application Status:</span>
                  {applicationData.isPaymentCompleted ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                      <CheckCircleOutlined className="mr-1" /> Paid on{" "}
                      {formatDate(applicationData.paymentDate)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                      Payment Pending / Form Submitted
                    </span>
                  )}
                </div>
                <div>Generated on: {new Date().toLocaleString("en-IN")}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
