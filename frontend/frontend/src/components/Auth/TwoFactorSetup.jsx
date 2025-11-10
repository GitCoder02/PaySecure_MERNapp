import React, { useState, useContext } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";

const TwoFactorSetup = () => {
  const { token } = useContext(AuthContext);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  //  Generate QR + secret
  const handleSetup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/2fa/setup",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setMessage({
        type: "info",
        text: "Scan this QR code with Google Authenticator.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to start 2FA setup.",
      });
    } finally {
      setLoading(false);
    }
  };

  //  Verify code entered from app
  const handleVerify = async () => {
    if (!code) {
      setMessage({ type: "error", text: "Please enter the code first." });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/2fa/verify",
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: "success", text: res.data.message });
      setIsEnabled(true);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Verification failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 400, mx: "auto", textAlign: "center" }}>
      <Typography variant="h5" gutterBottom>
        Two-Factor Authentication (2FA)
      </Typography>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      {!qrCode && !isEnabled && (
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={handleSetup}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : "Enable 2FA"}
        </Button>
      )}

      {qrCode && !isEnabled && (
        <Box sx={{ mt: 3 }}>
          <img src={qrCode} alt="2FA QR Code" style={{ width: "200px" }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Secret: <strong>{secret}</strong> (for demo)
          </Typography>

          <TextField
            label="Enter 6-digit code"
            fullWidth
            margin="normal"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <Button
            variant="contained"
            color="success"
            fullWidth
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Verify & Enable"}
          </Button>
        </Box>
      )}

      {isEnabled && (
        <Alert severity="success" sx={{ mt: 3 }}>
          ✅ Two-Factor Authentication is now enabled on your account!
        </Alert>
      )}
    </Box>
  );
};

export default TwoFactorSetup;