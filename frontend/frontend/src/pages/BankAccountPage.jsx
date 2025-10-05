// frontend/src/pages/BankAccountPage.jsx
import React, { useState, useContext, useEffect } from "react";
import { Box, Card, CardContent, TextField, Button, Typography, Alert } from "@mui/material";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const BankAccountPage = () => {
  const { token } = useContext(AuthContext);
  const [form, setForm] = useState({
    bankUsername: "",
    bankPassword: "",
    accountNumber: "",
    phone: "",
    balance: 10000,
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const fetchAccounts = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/bank/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBankAccounts(res.data.banks || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  useEffect(() => {
    if (token) fetchAccounts();
  }, [token]);

  const handleSubmit = async () => {
    setMessage(null);
    if (!form.bankUsername || !form.bankPassword || !form.accountNumber || !form.phone) {
      return setMessage({ type: "error", text: "Please fill all required fields" });
    }
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/bank/add", form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({ type: "success", text: res.data.message });
      setForm({ bankUsername: "", bankPassword: "", accountNumber: "", phone: "", balance: 10000 });
      fetchAccounts(); // refresh after adding
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to add bank account",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", mt: 4 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🏦 Add Bank Account (Demo)
          </Typography>
          <TextField
            label="Bank Username"
            name="bankUsername"
            value={form.bankUsername}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Bank Password"
            name="bankPassword"
            type="password"
            value={form.bankPassword}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Account Number"
            name="accountNumber"
            value={form.accountNumber}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Phone (for OTP)"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Initial Bank Balance (demo)"
            name="balance"
            type="number"
            value={form.balance}
            onChange={handleChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Bank Account"}
          </Button>
          {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
        </CardContent>
      </Card>

      {bankAccounts.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              💳 Your Linked Bank Accounts
            </Typography>
            {bankAccounts.map((acc) => (
              <Box
                key={acc._id}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #eee",
                  py: 1.5,
                }}
              >
                <Typography>
                  {acc.bankUsername} — A/C {acc.accountNumber}
                </Typography>
                <Typography color="primary" fontWeight={600}>
                  ₹ {acc.balance.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default BankAccountPage;