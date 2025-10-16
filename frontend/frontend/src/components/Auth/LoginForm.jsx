import React, { useState, useContext } from "react";
import {
  TextField,
  Button,
  Typography,
  Container,
  Box,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const LoginForm = () => {
  const { setToken } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [userId, setUserId] = useState(null);
  const [step, setStep] = useState(1); // 1 = password login, 2 = 2FA
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Step 1: Login with email/password
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      if (res.data.require2fa) {
        // User has 2FA enabled → ask for code next
        setUserId(res.data.userId);
        setStep(2);
      } else {
        // Normal login (no 2FA)
        setToken(res.data.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Step 2: Verify 2FA code
  const handle2FAVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/2fa/login-verify", {
        userId,
        code: twoFactorCode,
      });

      setToken(res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "2FA verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 10, p: 4, boxShadow: 3, borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom>
          {step === 1 ? "Login" : "Two-Factor Verification"}
        </Typography>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {step === 1 ? (
          // 🔹 Step 1 Form
          <form onSubmit={handleLogin}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Login"}
            </Button>
          </form>
        ) : (
          // 🔹 Step 2 Form (2FA)
          <form onSubmit={handle2FAVerify}>
            <Typography align="center" sx={{ mb: 1 }}>
              Enter the 6-digit code from your Google Authenticator app.
            </Typography>
            <TextField
              label="2FA Code"
              fullWidth
              margin="normal"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              color="success"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Verify 2FA"}
            </Button>
          </form>
        )}

        {/* Register redirect button */}
        {step === 1 && (
          <>
            <Typography align="center" sx={{ mt: 2 }}>
              Don’t have an account?
            </Typography>
            <Button
              variant="outlined"
              color="secondary"
              fullWidth
              sx={{ mt: 1 }}
              onClick={() => navigate("/register")}
            >
              Register
            </Button>
          </>
        )}
      </Box>
    </Container>
  );
};

export default LoginForm;