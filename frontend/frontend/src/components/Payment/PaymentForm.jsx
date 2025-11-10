import React, { useState, useContext, useEffect } from "react";
import {
  Card, CardContent, Typography, TextField, MenuItem, Button,
  Stepper, Step, StepLabel, Box, Alert, CircularProgress
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const steps = ["Enter Amount", "Choose Type & Merchant", "Enter Details & Verify"];

const PaymentForm = () => {
  const { token } = useContext(AuthContext);
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    amount: "",
    type: "UPI",
    pin: "",
    receiverId: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    saveCard: false,
    twoFactorCode: "",
    bankUsername: "",
    bankPassword: "",
    otp: ""
  });
  const [merchants, setMerchants] = useState([]);
  const [userCard, setUserCard] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDemoValue, setOtpDemoValue] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const navigate = useNavigate();

  // Helpers
  const amountValue = () => {
    const v = parseFloat(formData.amount);
    return Number.isFinite(v) ? v : 0;
  };
  const needs2FA = () => amountValue() > 5000 && twoFactorEnabled;

  // Fetch merchants
  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/merchants", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMerchants(res.data.merchants || []);
      } catch (err) {
        console.error("fetchMerchants", err);
      }
    };
    if (token) fetchMerchants();
  }, [token]);

  // Fetch user details for saved card and 2FA status
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = res.data;
        if (user) {
          setTwoFactorEnabled(Boolean(user.twoFactorEnabled));
          if (user.cardLast4) {
            setUserCard(user);
            setFormData(prev => ({
              ...prev,
              expiryMonth: user.cardExpiryMonth,
              expiryYear: user.cardExpiryYear,
              saveCard: true,
            }));
          }
        }
      } catch (err) {
        console.error("fetchUser", err);
      }
    };
    if (token) fetchUser();
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // Initiate bank OTP 
  const initiateBankOtp = async () => {
    setMessage(null);
    const { bankUsername, bankPassword, receiverId, amount } = formData;
    if (!bankUsername || !bankPassword || !receiverId || !amount) {
      return setMessage({ type: "error", text: "Enter bank username, password, amount and merchant." });
    }
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/payment/bank/initiate", {
        bankUsername,
        bankPassword,
        receiverId,
        amount
      }, { headers: { Authorization: `Bearer ${token}` } });

      setOtpSent(true);
      if (res.data.otp) setOtpDemoValue(res.data.otp);
      setMessage({ type: "info", text: "OTP sent (demo). Enter the OTP and, if required, your 2FA code." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to send bank OTP" });
    } finally {
      setLoading(false);
    }
  };

  // Verify bank OTP (also send 2FA code if present)
  const verifyBankOtp = async () => {
    setMessage(null);
    if (!formData.otp) return setMessage({ type: "error", text: "Enter OTP first." });
    if (needs2FA() && !formData.twoFactorCode) {
      return setMessage({ type: "warning", text: "Enter your 2FA code for high-value payments." });
    }
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/payment/bank/verify-otp", {
        otp: formData.otp,
        twoFactorCode: formData.twoFactorCode || ""
      }, { headers: { Authorization: `Bearer ${token}` } });

      setMessage({ type: "success", text: res.data.message || "Bank payment successful" });
      setTimeout(() => navigate("/transactions"), 1200);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "OTP verification failed" });
    } finally {
      setLoading(false);
    }
  };

  // Handle UPI/Card payment (and Card details validation minimally)
  const submitPay = async () => {
    // pre-check 2FA if needed
    if (needs2FA() && !formData.twoFactorCode) {
      return setMessage({ type: "warning", text: "Enter your 2FA code for high-value payments." });
    }

    // basic field checks (backend also validates)
    if (!formData.receiverId || !formData.amount) {
      return setMessage({ type: "error", text: "Amount and merchant are required." });
    }

    setLoading(true);
    try {
      const payload = { ...formData, amount: Number(formData.amount) };
      const res = await axios.post("http://localhost:5000/api/payment/pay", payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: "success", text: res.data.message || "Payment successful" });
      setTimeout(() => navigate("/transactions"), 1200);
    } catch (err) {
      const resp = err.response?.data;
      let text = "Payment failed";
      if (resp) {
        if (Array.isArray(resp.errors)) text = resp.errors.map(e => e.msg).join("; ");
        else if (resp.message) text = resp.message;
        else text = JSON.stringify(resp);
      }
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  // Next button behavior
  const handleNext = () => {
    setMessage(null);
    if (activeStep < steps.length - 1) {
      setActiveStep(s => s + 1);
      return;
    }

    // On final step:
    if (formData.type === "Bank") {
      // If OTP already sent, show verify; otherwise initiate
      if (!otpSent) {
        initiateBankOtp();
      } else {
        // If OTP already sent, instruct to click Verify OTP button (we use verifyBankOtp)
        setMessage({ type: "info", text: "Enter OTP and click Verify OTP." });
      }
      return;
    }

    // For UPI / Card, call /pay
    submitPay();
  };

  const handleBack = () => {
    setMessage(null);
    setActiveStep(s => Math.max(0, s - 1));
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Make a Payment</Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {/* Step 1: Amount */}
          {activeStep === 0 && (
            <TextField
              label="Amount (₹)"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
          )}

          {/* Step 2: Payment Type & Merchant */}
          {activeStep === 1 && (
            <>
              <TextField label="Payment Type" name="type" select value={formData.type}
                onChange={handleChange} fullWidth sx={{ mb: 2 }}>
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="Card">Card</MenuItem>
                <MenuItem value="Bank">Bank Transfer</MenuItem>
              </TextField>

              <TextField label="Select Merchant" name="receiverId" select value={formData.receiverId}
                onChange={handleChange} fullWidth required sx={{ mb: 2 }}>
                {merchants.length ? merchants.map(m => (
                  <MenuItem key={m._id} value={m._id}>{m.name} ({m.email})</MenuItem>
                )) : <MenuItem disabled>No merchants available</MenuItem>}
              </TextField>
            </>
          )}

          {/* Step 3: Details & verification */}
          {activeStep === 2 && (
            <>
              {/* UPI */}
              {formData.type === "UPI" && (
                <>
                  <TextField label="UPI PIN" name="pin" type="password" value={formData.pin}
                    onChange={handleChange} fullWidth required inputProps={{ maxLength: 4 }} sx={{ mb: 2 }} />
                  {needs2FA() && (
                    <TextField label="2FA Code (Google Authenticator)" name="twoFactorCode"
                      value={formData.twoFactorCode} onChange={handleChange}
                      fullWidth required inputProps={{ maxLength: 6 }} sx={{ mb: 2 }} />
                  )}
                </>
              )}

              {/* Card */}
              {formData.type === "Card" && (
                <>
                  <TextField label="Card Number" name="cardNumber" value={formData.cardNumber}
                    onChange={handleChange} fullWidth required sx={{ mb: 2 }} inputProps={{ maxLength: 16 }} />
                  <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                    <TextField label="Expiry Month" name="expiryMonth" value={formData.expiryMonth}
                      onChange={handleChange} type="number" sx={{ flex: 1 }} />
                    <TextField label="Expiry Year" name="expiryYear" value={formData.expiryYear}
                      onChange={handleChange} type="number" sx={{ flex: 1 }} />
                  </Box>
                  <TextField label="CVV" name="cvv" type="password" value={formData.cvv}
                    onChange={handleChange} fullWidth required sx={{ mb: 2 }} inputProps={{ maxLength: 3 }} />
                  <Box sx={{ mb: 2 }}>
                    <input type="checkbox" name="saveCard" checked={formData.saveCard} onChange={handleChange} /> Save card
                  </Box>
                  {needs2FA() && (
                    <TextField label="2FA Code (Google Authenticator)" name="twoFactorCode"
                      value={formData.twoFactorCode} onChange={handleChange}
                      fullWidth required inputProps={{ maxLength: 6 }} sx={{ mb: 2 }} />
                  )}
                </>
              )}

              {/* Bank */}
              {formData.type === "Bank" && (
                <>
                  {!otpSent ? (
                    <>
                      <TextField label="Bank Username" name="bankUsername" value={formData.bankUsername}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <TextField label="Bank Password" name="bankPassword" type="password"
                        value={formData.bankPassword} onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                        <Button variant="contained" onClick={initiateBankOtp} disabled={loading}>
                          {loading ? <CircularProgress size={20} /> : "Send OTP"}
                        </Button>
                        <Button onClick={() => setFormData(prev => ({ ...prev, bankUsername: "", bankPassword: "" }))}>
                          Clear
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        OTP sent (Demo OTP: {otpDemoValue ?? "hidden"}). Enter below.
                      </Alert>
                      <TextField label="Enter OTP" name="otp" value={formData.otp} onChange={handleChange}
                        fullWidth required sx={{ mb: 2 }} />
                      {needs2FA() && (
                        <TextField label="2FA Code (Google Authenticator)" name="twoFactorCode"
                          value={formData.twoFactorCode} onChange={handleChange}
                          fullWidth required inputProps={{ maxLength: 6 }} sx={{ mb: 2 }} />
                      )}
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Button variant="contained" onClick={verifyBankOtp} disabled={loading}>
                          {loading ? <CircularProgress size={20} /> : "Verify OTP"}
                        </Button>
                        <Button onClick={() => { setOtpSent(false); setOtpDemoValue(null); setFormData(prev => ({ ...prev, otp: "", twoFactorCode: "" })); }}>
                          Cancel
                        </Button>
                      </Box>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>Back</Button>
            <Button variant="contained" onClick={handleNext} disabled={loading}>
              {loading ? <CircularProgress size={24} sx={{ color: "white" }} /> :
                (activeStep === steps.length - 1 ? "Pay / Continue" : "Next")}
            </Button>
          </Box>

          {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentForm;