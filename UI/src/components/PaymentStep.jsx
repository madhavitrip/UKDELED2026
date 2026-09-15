import { useState, useEffect } from 'react'
import { api } from '../stores/apiStore'
import { notification } from 'antd'
import { checkAtomPaymentStatus } from '../utils/atomPaymentUtils'

export default function PaymentStep({ formData = {}, onProceedPayment, onBackToPreview, examTypes = [], isLocked }) {
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isFeeLoading, setIsFeeLoading] = useState(true)
  const [feeData, setFeeData] = useState(null)
  const [error, setError] = useState(null)
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false) // Track payment state
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  // ✅ NEW: Check if payment already completed
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false)

  // Fetch verified payment fee breakdown directly from backend API
  useEffect(() => {
    setAgreeTerms(true);
    
    // Check if formData indicates payment already completed
    if (formData?.isPaymentCompleted) {
      setIsAlreadyPaid(true);
    }

    const fetchFeeDetails = async () => {
      setIsFeeLoading(true);
      try {
        const response = await api.get('/api/Payment/fee');
        if (response.data && response.data.success) {
          setFeeData(response.data);
          if (response.data.isPaymentCompleted) {
            setIsAlreadyPaid(true);
            notification.success({
              message: "Payment Already Completed",
              description: "Your payment has been successfully processed. You can now proceed to submit your application.",
              duration: 5
            });
          }
        }
      } catch (err) {
        console.error('[PaymentStep] Error fetching fee from backend:', err);
      } finally {
        setIsFeeLoading(false);
      }
    };

    fetchFeeDetails();
  }, [formData?.isPaymentCompleted]);

  // Disable back button and prevent navigation on the payment page
  useEffect(() => {
    // Prevent back button
    const handlePopState = (event) => {
      event.preventDefault()
      notification.warning({
        message: "Navigation Disabled",
        description: isPaymentInProgress 
          ? "A payment request is being processed. Please wait for the response from the payment gateway."
          : "Please complete the payment or close this page. Use the back button within the form to return to preview."
      })
      window.history.pushState(null, '', window.location.href)
    }

    // Add history entry to intercept back button
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handlePopState)

    // Cleanup event listeners when component unmounts
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isPaymentInProgress])

  const getFallbackApplicationFee = () => {
    const phyHandicapped = formData.phyHandicapped;
    const isPH =
      phyHandicapped === "YES" ||
      phyHandicapped === true ||
      phyHandicapped === "1" ||
      formData.isPhysicallyHandicapped === true;
      
    const catStr = (formData.category || "").toUpperCase();
    const isScSt =
      catStr.includes("SCHEDULED CASTE") ||
      catStr.includes("SCHEDULED TRIBE") ||
      catStr.includes("(SC)") ||
      catStr.includes("(ST)") ||
      catStr.includes("SC") ||
      catStr.includes("ST");

    if (isPH) return 150;
    if (isScSt) return 300;
    return 600;
  };

  const applicationFee = feeData?.applicationFee ?? getFallbackApplicationFee();
  const processingFee = feeData?.processingFee ?? 0;
  const totalAmount = feeData?.totalAmount ?? (applicationFee + processingFee);
  const triggerPaymentError = (msg) => {
    setError(msg);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applicantId = feeData?.applicantId || formData.applicantId || formData.registrationNo || 'N/A';
  const applicantName = feeData?.applicantName || formData.applicantName || 'N/A';

  const handleProceedPayment = async () => {
    console.log('[Payment] Button clicked!');
    console.log('[Payment] agreeTerms:', agreeTerms);
    console.log('[Payment] isLoading:', isLoading);
    
    if (!agreeTerms) {
      triggerPaymentError("Please agree to the terms and conditions before proceeding.");
      return;
    }

    if (isAlreadyPaid) {
      triggerPaymentError("Your payment has already been completed. Multiple payments are not allowed.");
      return;
    }

    console.log('[Payment] Checking AtomPaynetz...');
    if (!window.AtomPaynetz) {
      const errorMsg = 'Payment gateway script not loaded. The external payment service may be temporarily unavailable. Please try again in a moment or check your internet connection.';
      console.error('[Payment]', errorMsg);
      triggerPaymentError(errorMsg);
      setIsLoading(false);
      return;
    }

    // Validate required fields
    if (!formData.emailId || !formData.mobileNo) {
      setError('Email and mobile number are required for payment.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Call check-status-advanced API first
      console.log('[Payment] Step 1: Checking status advanced before initiating...');
      try {
        const checkRes = await api.get('/api/Payment/check-status-advanced');
        console.log('[Payment] check-status-advanced response:', checkRes.data);
        if (checkRes.data && (checkRes.data.isPaid || (checkRes.data.success && checkRes.data.isPaid))) {
          setIsAlreadyPaid(true);
          setIsLoading(false);
          setIsPaymentInProgress(false);
          notification.success({
            message: "Payment Already Completed",
            description: checkRes.data.message || `Your payment is already verified. Transaction ID: ${checkRes.data.transactionId || 'N/A'}. You cannot make another payment.`,
            duration: 5
          });
          if (onProceedPayment) {
            onProceedPayment();
          }
          return;
        }
      } catch (checkErr) {
        console.log('[Payment] check-status-advanced response/error:', checkErr?.response?.status, checkErr?.response?.data);
        if (checkErr.response?.data?.isPaid || checkErr.response?.data?.alreadyPaid) {
          setIsAlreadyPaid(true);
          setIsLoading(false);
          setIsPaymentInProgress(false);
          notification.success({
            message: "Payment Already Completed",
            description: checkErr.response?.data?.message || "Your payment has already been verified. You cannot make another payment.",
            duration: 5
          });
          if (onProceedPayment) {
            onProceedPayment();
          }
          return;
        }
        // 404 or other status is normal when no transactions exist yet; continue to initiate
      }

      // Step 2: Call payment initiate API
      console.log('[Payment] Step 2: Calling /api/payment/initiate');
      console.log('[Payment] API Base URL:', api.defaults.baseURL);
      
      // Set payment in progress BEFORE sending request to gateway
      setIsPaymentInProgress(true);
      
      const response = await api.post(
        "/api/payment/initiate",
        {}
      );
      
      console.log('[Payment] API Response:', response.data);

      // If initiate API returns that user transaction is already success or already paid, don't allow to pay
      if (response.data?.alreadyPaid || response.data?.isPaymentCompleted || response.data?.isPaid) {
        setIsAlreadyPaid(true);
        setIsLoading(false);
        setIsPaymentInProgress(false);
        triggerPaymentError(response.data.message || "Your payment transaction is successful. Multiple payments are not allowed.");
        if (onProceedPayment) {
          onProceedPayment();
        }
        return;
      }
      
      if (response.data && response.data.atomTokenId) {
        const token = response.data.atomTokenId;
        const MERCHANT_ID = response.data.merchantId || "MOCK_MERCH";
        
        console.log('Payment Details:', {
          token,
          MERCHANT_ID,
          email: formData.emailId,
          mobile: formData.mobileNo
        });

        const options = {
           atomTokenId: token,
           merchId: MERCHANT_ID,
           custEmail: formData.emailId,
           custMobile: formData.mobileNo,
           returnUrl: `https://ukdeled.com/API/api/Payment/response`
        };

        // Set loading to false immediately since AtomPaynetz.open() doesn't block
        setIsLoading(false);
        new window.AtomPaynetz(options, "prod");
        // Note: isPaymentInProgress stays true until user returns from payment gateway
      } else {
        setError('Failed to initiate payment. Please try again.');
        setIsLoading(false);
        setIsPaymentInProgress(false); // Allow navigation again if payment initiation fails
      }
    } catch (err) {
      console.error('[Payment] Full error object:', err);
      console.error('[Payment] Error response:', err.response);
      console.error('[Payment] Error message:', err.message);
      console.error('[Payment] Error status:', err.response?.status);
      console.error('[Payment] Error data:', err.response?.data);
      
      const errorMsg = err.response?.data?.message || err.message || '';
      const isDuplicateOrSuccess = 
        err.response?.data?.alreadyPaid ||
        err.response?.data?.isPaymentCompleted ||
        err.response?.data?.isPaid ||
        (typeof errorMsg === 'string' && (
          errorMsg.toLowerCase().includes('already completed') ||
          errorMsg.toLowerCase().includes('already been completed') ||
          errorMsg.toLowerCase().includes('transaction is successful') ||
          errorMsg.toLowerCase().includes('multiple payments are not allowed')
        ));

      if (isDuplicateOrSuccess) {
        setIsAlreadyPaid(true);
        triggerPaymentError(errorMsg || "Your payment has already been processed. You cannot make another payment.");
      } else {
        triggerPaymentError(
          errorMsg ||
          'Failed to initiate payment. Please try again.'
        );
      }
      
      setIsLoading(false);
      setIsPaymentInProgress(false); // Allow navigation again if payment initiation fails
    }
  }

  const handleCheckPaymentStatus = async () => {
    setIsCheckingStatus(true)
    setError(null)
    
    try {
      // First, try simple status check
      const result = await checkAtomPaymentStatus()
      
      if (result.success) {
        if (result.isPaid) {
          notification.success({
            message: "Payment Confirmed",
            description: "Your payment has been successfully verified. You can now proceed.",
            duration: 3
          })
          // Trigger callback or redirect
          if (onProceedPayment) {
            onProceedPayment()
          }
        } else {
          notification.info({
            message: "Payment Pending",
            description: "Your payment is still being processed. Please wait or check again later.",
            duration: 3
          })
        }
      } else {
        setError(result.message || 'Failed to check payment status. Please try again.')
      }
    } catch (err) {
      console.error('[CheckStatus] Error:', err)
      setError('Failed to check payment status. Please try again.')
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleCheckPaymentStatusAdvanced = async () => {
    setIsCheckingStatus(true)
    setError(null)
    
    try {
      // Use advanced status check endpoint
      console.log('[PaymentStep] Calling advanced status check endpoint...')
      
      const response = await api.get('/api/payment/check-status-advanced')
      
      console.log('[PaymentStep] Advanced check response:', response.data)
      
      if (response.data.success) {
        if (response.data.isPaid) {
          notification.success({
            message: "Payment Confirmed",
            description: `Your payment has been successfully verified. Transaction ID: ${response.data.transactionId || 'N/A'}`,
            duration: 4
          })
          // Trigger callback or redirect
          if (onProceedPayment) {
            onProceedPayment()
          }
        } else {
          notification.info({
            message: "Payment Pending",
            description: response.data.message || "Your payment is still being processed. Please wait or check again later.",
            duration: 3
          })
        }
      } else {
        setError(response.data.message || 'Failed to check payment status. Please try again.')
      }
    } catch (err) {
      console.error('[CheckStatusAdvanced] Error:', err)
      setError(err.response?.data?.message || 'Failed to check payment status. Please try again.')
    } finally {
      setIsCheckingStatus(false)
    }
  }

  return (
    <div className="bg-gray-50 py-2 sm:py-3 md:py-4">
      <div className="max-w-2xl mx-auto px-2 sm:px-3 md:px-4">
        {/* Top Error Banner */}
        {error && (
          <div className="mb-3 sm:mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-xs flex items-center justify-between">
            <p className="text-red-700 font-bold text-sm sm:text-base">❌ {error}</p>
            <button
              onClick={() => setError(null)}
              className="text-gray-400 hover:text-gray-600 font-bold ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <p className="text-blue-800 font-bold text-sm sm:text-base flex items-start gap-2">
            <span className="text-xl">ℹ️</span>
            <span><strong>Disclaimer:</strong> Do not refresh the page or press the Back button.</span>
          </p>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-blue-700 mb-3">Payment Details</h1>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 text-sm sm:text-base">
            <div>
              <p className="text-gray-600 font-semibold text-sm">Applicant ID</p>
              <p className="font-extrabold text-lg sm:text-xl md:text-2xl text-gray-900">{applicantId}</p>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto">
              <p className="text-gray-600 font-semibold text-sm">Applicant</p>
              <p className="font-extrabold text-base sm:text-lg md:text-xl break-words text-gray-900">{applicantName}</p>
            </div>
          </div>
        </div>

        {/* Amount Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 mb-3 sm:mb-4">
          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-blue-200">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">Amount Breakdown</h2>
            {feeData?.categoryName && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs sm:text-sm font-semibold rounded-full">
                Category: {feeData.categoryName}
              </span>
            )}
          </div>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm sm:text-base">
              <span className="font-semibold text-gray-700">📋 Application Fee</span>
              <span className="font-bold text-gray-900 text-base sm:text-lg">₹{applicationFee}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm sm:text-base">
              <span className="font-semibold text-gray-700">⚙️ Processing Fee</span>
              <span className="font-bold text-gray-900 text-base sm:text-lg">₹{processingFee}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300">
            <span className="font-bold text-base sm:text-lg text-gray-800">Total Amount</span>
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-blue-700">₹{totalAmount}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onBackToPreview}
            disabled={isPaymentInProgress || isLoading}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg font-bold transition-all text-base sm:text-lg ${
              isPaymentInProgress || isLoading
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gray-400 text-white hover:bg-gray-500 cursor-pointer'
            }`}
            title={isPaymentInProgress ? "Back button disabled while payment is processing" : "Go back to preview"}
          >
            ← Back {isPaymentInProgress && "(Processing...)"}
          </button>
          <button
            onClick={handleProceedPayment}
            disabled={!agreeTerms || isLoading || isAlreadyPaid}
            className={`w-full sm:w-auto px-8 py-3 rounded-lg font-bold transition-all text-white flex items-center justify-center gap-2 text-base sm:text-lg cursor-pointer ${
              !isAlreadyPaid && agreeTerms && !isLoading
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
            title={isAlreadyPaid ? "Payment already completed. Multiple payments are not allowed." : "Click to proceed with payment"}
          >
            {isAlreadyPaid ? (
              <>
                ✅ Payment Completed
              </>
            ) : isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              <>
                💳 Pay ₹{totalAmount}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
