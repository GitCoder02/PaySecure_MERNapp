import React, { useState, useContext, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Alert,
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const steps = ["Enter Amount", "Choose Type & Merchant", "Enter PIN"];

const PaymentForm = () => {
  const { token } = useContext(AuthContext);
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    amount: "",
    type: "UPI",
    pin: "",
    receiverId: "",
  });
  const [merchants, setMerchants] = useState([]);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // Fetch merchants for dropdown
  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/merchants", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMerchants(res.data.merchants);
      } catch (err) {
        console.error("Error fetching merchants:", err);
      }
    };
    if (token) fetchMerchants();
  }, [token]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleNext = async () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      try {
        const res = await axios.post(
          "http://localhost:5000/api/payment/pay",
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage({ type: "success", text: res.data.message });
        setTimeout(() => navigate("/transactions"), 1500);
      } catch (err) {
        setMessage({
          type: "error",
          text: err.response?.data?.message || "Payment failed",
        });
      }
    }
  };

  const handleBack = () => setActiveStep(activeStep - 1);

  return (
    <Box sx={{ maxWidth: 500, margin: "auto", mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Make a Payment
          </Typography>

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step 1: Enter Amount */}
          {activeStep === 0 && (
            <TextField
              label="Amount"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
          )}

          {/* Step 2: Payment Type + Merchant */}
          {activeStep === 1 && (
            <>
              <TextField
                label="Payment Type"
                name="type"
                select
                value={formData.type}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
              >
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="Bank">Bank Transfer</MenuItem>
              </TextField>

              <TextField
                label="Select Merchant"
                name="receiverId"
                select
                value={formData.receiverId}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 2 }}
              >
                {merchants.length > 0 ? (
                  merchants.map((m) => (
                    <MenuItem key={m._id} value={m._id}>
                      {m.name} ({m.email})
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>No merchants available</MenuItem>
                )}
              </TextField>
            </>
          )}

          {/* Step 3: Enter PIN */}
          {activeStep === 2 && (
            <TextField
              label="PIN"
              name="pin"
              type="password"
              value={formData.pin}
              onChange={handleChange}
              fullWidth
              required
              inputProps={{ maxLength: 4 }}
              sx={{ mb: 2 }}
            />
          )}

          {/* Navigation Buttons */}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>
              Back
            </Button>
            <Button variant="contained" onClick={handleNext}>
              {activeStep === steps.length - 1 ? "Pay" : "Next"}
            </Button>
          </Box>

          {/* Message */}
          {message && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentForm;
