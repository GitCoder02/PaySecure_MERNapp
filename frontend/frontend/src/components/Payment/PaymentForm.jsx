import React, { useState, useContext, useEffect } from "react";
import {
  Card, CardContent, Typography, TextField, MenuItem, Button,
  Stepper, Step, StepLabel, Box, Alert, CircularProgress
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const steps = ["Enter Amount", "Choose Type & Merchant", "Enter PIN / Card / Bank Details"];

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
    twoFactorCode: "", // ✅ added for TOTP
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false); // ✅ track 2FA status

  const navigate = useNavigate();

  // 🔹 Fetch merchants
  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/merchants", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMerchants(res.data.merchants);
      } catch (err) {
        console.error(err);
      }
    };
    if (token) fetchMerchants();
  }, [token]);

  // 🔹 Fetch user details (to check if 2FA is enabled)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = res.data;
        if (user) {
          setTwoFactorEnabled(user.twoFactorEnabled); // ✅ save 2FA status
          if (user.cardLast4) {
            setUserCard(user);
            setFormData(prev => ({
              ...prev,
              expiryMonth: user.cardExpiryMonth,
              expiryYear: user.cardExpiryYear,
              saveCard: true
            }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (token) fetchUser();
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // 🔹 Bank OTP flow
  const initiateBankOtp = async () => {
    setMessage(null);
    if (!formData.bankUsername || !formData.bankPassword || !formData.receiverId || !formData.amount) {
      return setMessage({ type: 'error', text: 'Please fill bank username, password, amount and merchant' });
    }
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/payment/bank/initiate", {
        bankUsername: formData.bankUsername,
        bankPassword: formData.bankPassword,
        receiverId: formData.receiverId,
        amount: formData.amount
      }, { headers: { Authorization: `Bearer ${token}` } });
      setOtpSent(true);
      if (res.data.otp) setOtpDemoValue(res.data.otp);
      setMessage({ type: 'success', text: 'OTP sent (demo). Enter the OTP to confirm.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to initiate bank OTP' });
    } finally { setLoading(false); }
  };

  const verifyBankOtp = async () => {
    setMessage(null);
    if (!formData.otp) return setMessage({ type: 'error', text: 'Enter OTP' });
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/payment/bank/verify-otp", {
        otp: formData.otp
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage({ type: 'success', text: res.data.message || 'Bank payment successful' });
      setTimeout(() => navigate('/transactions'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'OTP verification failed' });
    } finally { setLoading(false); }
  };

  // 🔹 Main payment handler (UPI / Card)
  const handleNext = async () => {
    setMessage(null);

    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    // For Bank: show OTP flow instead
    if (formData.type === "Bank") {
      return setMessage({ type: "info", text: "Use Send OTP → Enter OTP → Verify OTP for bank payments." });
    }

    // ✅ If amount > 5000 and user has 2FA enabled → require TOTP
    if (parseFloat(formData.amount) > 5000 && twoFactorEnabled && !formData.twoFactorCode) {
      return setMessage({
        type: "warning",
        text: "Enter your 6-digit 2FA code from Google Authenticator to continue.",
      });
    }

    // 🔹 Proceed with normal payment
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/payment/pay", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({ type: "success", text: res.data.message });
      setTimeout(() => navigate("/transactions"), 1500);
    } catch (err) {
      // log full response to console for debugging
      console.error("Payment request error:", err?.response ?? err);

      const resp = err.response?.data;
      let text = "Payment failed";

      // prefer structured server messages and validation errors
      if (resp) {
        if (resp.message) text = resp.message;
        else if (Array.isArray(resp.errors)) text = resp.errors.map(e => e.msg || JSON.stringify(e)).join("; ");
        else text = typeof resp === "string" ? resp : JSON.stringify(resp);
      }

      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => { setMessage(null); setActiveStep(prev => prev - 1); };

  return (
    <Box sx={{ maxWidth: 600, margin: "auto", mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Make a Payment</Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {/* Step 1: Amount */}
          {activeStep === 0 && (
            <TextField label="Amount" name="amount" type="number"
              value={formData.amount} onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
          )}

          {/* Step 2: Type & Merchant */}
          {activeStep === 1 && (
            <>
              <TextField label="Payment Type" name="type" select value={formData.type}
                onChange={handleChange} fullWidth sx={{ mb: 2 }}>
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="Bank">Bank Transfer</MenuItem>
                <MenuItem value="Card">Card</MenuItem>
              </TextField>

              <TextField label="Select Merchant" name="receiverId" select value={formData.receiverId}
                onChange={handleChange} fullWidth required sx={{ mb: 2 }}>
                {merchants.length ? merchants.map(m => (
                  <MenuItem key={m._id} value={m._id}>{m.name} ({m.email})</MenuItem>
                )) : <MenuItem disabled>No merchants available</MenuItem>}
              </TextField>
            </>
          )}

          {/* Step 3: Details */}
          {activeStep === 2 && (
            <>
              {/* 🔹 UPI fields */}
              {formData.type === "UPI" && (
                <TextField label="PIN" name="pin" type="password" value={formData.pin}
                  onChange={handleChange} fullWidth required inputProps={{ maxLength: 4 }} sx={{ mb: 2 }} />
              )}

              {/* 🔹 Card fields */}
              {formData.type === "Card" && (
                <>
                  <TextField label="Card Number" name="cardNumber" type="text"
                    value={formData.cardNumber} onChange={handleChange} fullWidth required sx={{ mb: 2 }}
                    placeholder={userCard?.cardLast4 ? `**** **** **** ${userCard.cardLast4}` : ""} inputProps={{ maxLength: 16 }} />
                  <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                    <TextField label="Expiry Month" name="expiryMonth" type="number"
                      value={formData.expiryMonth} onChange={handleChange} required sx={{ flex: 1 }} inputProps={{ min: 1, max: 12 }} />
                    <TextField label="Expiry Year" name="expiryYear" type="number"
                      value={formData.expiryYear} onChange={handleChange} required sx={{ flex: 1 }} inputProps={{ min: new Date().getFullYear() }} />
                  </Box>
                  <TextField label="CVV" name="cvv" type="password" value={formData.cvv}
                    onChange={handleChange} fullWidth required inputProps={{ maxLength: 4 }} sx={{ mb: 2 }} />
                  <Box sx={{ mb: 2 }}>
                    <input type="checkbox" name="saveCard" checked={formData.saveCard} onChange={handleChange} /> Save this card
                  </Box>
                </>
              )}

              {/* 🔹 Bank fields */}
              {formData.type === "Bank" && (
                <>
                  {!otpSent ? (
                    <>
                      <TextField label="Bank Username" name="bankUsername" value={formData.bankUsername}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <TextField label="Bank Password" name="bankPassword" type="password" value={formData.bankPassword}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
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
                        OTP sent to your bank phone. (Demo OTP: {otpDemoValue ?? "hidden"})
                      </Alert>
                      <TextField label="Enter OTP" name="otp" value={formData.otp}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                        <Button variant="contained" onClick={verifyBankOtp} disabled={loading}>
                          {loading ? <CircularProgress size={20} /> : "Verify OTP"}
                        </Button>
                        <Button onClick={() => { setOtpSent(false); setOtpDemoValue(null); setFormData(prev => ({ ...prev, otp: "" })); }}>
                          Cancel
                        </Button>
                      </Box>
                    </>
                  )}
                </>
              )}

              {/* 🔹 2FA Input (only if > ₹5000) */}
              {parseFloat(formData.amount) > 5000 && twoFactorEnabled && (
                <TextField
                  label="2FA Code (Google Authenticator)"
                  name="twoFactorCode"
                  value={formData.twoFactorCode}
                  onChange={handleChange}
                  fullWidth
                  required
                  inputProps={{ maxLength: 6 }}
                  sx={{ mb: 2 }}
                />
              )}
            </>
          )}

          {/* Navigation Buttons */}
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
