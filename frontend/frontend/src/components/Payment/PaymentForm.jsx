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
    // Bank specific
    bankUsername: "",
    bankPassword: "",
    otp: ""
  });
  const [merchants, setMerchants] = useState([]);
  const [userCard, setUserCard] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otpDemoValue, setOtpDemoValue] = useState(null); // display OTP for demo if backend returns it

  const navigate = useNavigate();

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/merchants", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMerchants(res.data.merchants);
      } catch (err) { console.error(err); }
    };
    if (token) fetchMerchants();
  }, [token]);

  // Prefill saved card info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = res.data.user;
        if (user?.cardLast4) {
          setUserCard(user);
          setFormData(prev => ({
            ...prev,
            expiryMonth: user.cardExpiryMonth,
            expiryYear: user.cardExpiryYear,
            saveCard: true
          }));
        }
      } catch (err) { console.error(err); }
    };
    if (token) fetchUser();
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // Start bank OTP (called when user clicks "Send OTP" during bank flow)
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
      // backend returns otp for demo; show if present
      if (res.data.otp) setOtpDemoValue(res.data.otp);
      setMessage({ type: 'success', text: 'OTP sent (demo). Enter the OTP to confirm.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to initiate bank OTP' });
    } finally { setLoading(false); }
  };

  // Verify OTP and finalize
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

  const handleNext = async () => {
    setMessage(null);
    // If Bank flow and we're on final step, do OTP initiation/verification flow instead of single /pay
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      return;
    }

    // Final step for UPI/Card: call /api/payment/pay
    if (formData.type === 'UPI' || formData.type === 'Card') {
      setLoading(true);
      try {
        const res = await axios.post("http://localhost:5000/api/payment/pay", formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage({ type: 'success', text: res.data.message });
        setTimeout(() => navigate("/transactions"), 1500);
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Payment failed' });
      } finally { setLoading(false); }
    } else if (formData.type === 'Bank') {
      // For Bank, we expect the user to use the dedicated "Send OTP" button then "Verify OTP"
      setMessage({ type: 'info', text: 'For Bank payments click "Send OTP" then enter OTP and click "Verify OTP".' });
    } else {
      setMessage({ type: 'error', text: 'Invalid payment type' });
    }
  };

  const handleBack = () => { setMessage(null); setActiveStep(prev => prev - 1); };

  return (
    <Box sx={{ maxWidth: 600, margin: "auto", mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Make a Payment</Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {/* Step 1: Amount */}
          {activeStep === 0 && (
            <TextField label="Amount" name="amount" type="number"
              value={formData.amount} onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
          )}

          {/* Step 2: Payment Type & Merchant */}
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

          {/* Step 3: details */}
          {activeStep === 2 && (
            <>
              {(formData.type === 'UPI') && (
                <TextField label="PIN" name="pin" type="password" value={formData.pin}
                  onChange={handleChange} fullWidth required inputProps={{ maxLength: 4 }} sx={{ mb: 2 }} />
              )}

              {(formData.type === 'Card') && (
                <>
                  <TextField label="Card Number" name="cardNumber" type="text"
                    value={formData.cardNumber} onChange={handleChange} fullWidth required sx={{ mb: 2 }}
                    placeholder={userCard?.cardLast4 ? `**** **** **** ${userCard.cardLast4}` : ''} inputProps={{ maxLength: 16 }} />
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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

              {(formData.type === 'Bank') && (
                <>
                  {!otpSent ? (
                    <>
                      <TextField label="Bank Username" name="bankUsername" value={formData.bankUsername}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <TextField label="Bank Password" name="bankPassword" type="password" value={formData.bankPassword}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Button variant="contained" onClick={initiateBankOtp} disabled={loading}>
                          {loading ? <CircularProgress size={20} /> : 'Send OTP'}
                        </Button>
                        <Button onClick={() => { setFormData(prev => ({ ...prev, bankUsername: '', bankPassword: '' })); }}>
                          Clear
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        OTP sent to your bank phone. (Demo OTP: {otpDemoValue ?? 'hidden'})
                      </Alert>
                      <TextField label="Enter OTP" name="otp" value={formData.otp}
                        onChange={handleChange} fullWidth required sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Button variant="contained" onClick={verifyBankOtp} disabled={loading}>
                          {loading ? <CircularProgress size={20} /> : 'Verify OTP'}
                        </Button>
                        <Button onClick={() => { setOtpSent(false); setOtpDemoValue(null); setFormData(prev => ({ ...prev, otp: '' })); }}>
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
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : (activeStep === steps.length - 1 ? "Pay / Continue" : "Next")}
            </Button>
          </Box>

          {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentForm;