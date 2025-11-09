import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import axios from "axios";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Box,
  Alert,
  IconButton,
  Collapse,
  Divider,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { token, user, setUser, logout } = useContext(AuthContext);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [successRate, setSuccessRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const navigate = useNavigate();

  //  Fetch wallet and profile data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWalletBalance(userRes.data.balance);
        setUser(userRes.data);
        setTwoFAEnabled(userRes.data.twoFactorEnabled || false);

        // Fetch linked bank accounts
        try {
          const bankRes = await axios.get("http://localhost:5000/api/bank/my", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setBankAccounts(bankRes.data.banks || []);
        } catch {
          setBankAccounts([]);
        }

        // Fetch transaction success rate
        const txRes = await axios.get("http://localhost:5000/api/payment/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const txs = txRes.data.transactions || [];
        const total = txs.length;
        const success = txs.filter((tx) => tx.status === "Success").length;
        setSuccessRate(total > 0 ? Math.round((success / total) * 100) : 0);
      } catch (err) {
        console.error("Error loading dashboard:", err);
        setMessage({
          type: "error",
          text: "Failed to load dashboard data. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [token, setUser]);

  //  Manual refresh handler
  const handleRefresh = async () => {
    setMessage({ type: "info", text: "Refreshing balances..." });
    try {
      const userRes = await axios.get("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWalletBalance(userRes.data.balance);
      setMessage({ type: "success", text: "Balances updated!" });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to refresh balances" });
    }
    setTimeout(() => setMessage(null), 2000);
  };

  //  Loader while data loads
  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ padding: "2rem" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4">Welcome, {user?.name || "User"} 👋</Typography>
        <Button variant="outlined" color="error" onClick={logout}>
          Logout
        </Button>
      </Box>

      {/* Alerts */}
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Wallet Balance */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "#f1f8e9", boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6">Wallet Balance</Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                ₹ {walletBalance.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Linked Bank Account */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "#e3f2fd", boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="h6">Linked Bank Accounts</Typography>
                <IconButton onClick={handleRefresh} size="small" color="primary">
                  <RefreshIcon />
                </IconButton>
              </Box>

              {bankAccounts.length > 0 ? (
                <>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    ₹ {bankAccounts[0].balance.toLocaleString()}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setExpanded((prev) => !prev)}
                    sx={{ mt: 1, textTransform: "none" }}
                  >
                    {expanded ? (
                      <>
                        Hide Details <ExpandLessIcon fontSize="small" />
                      </>
                    ) : (
                      <>
                        View Details <ExpandMoreIcon fontSize="small" />
                      </>
                    )}
                  </Button>

                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 1 }} />
                    {bankAccounts.map((bank, idx) => (
                      <Box key={bank._id} sx={{ mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Bank {idx + 1}
                        </Typography>
                        <Typography variant="body2">
                          Username: {bank.bankUsername}
                        </Typography>
                        <Typography variant="body2">
                          Account: ****{bank.accountNumber.slice(-4)}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Balance: ₹ {bank.balance.toLocaleString()}
                        </Typography>
                        {idx < bankAccounts.length - 1 && (
                          <Divider sx={{ my: 1 }} />
                        )}
                      </Box>
                    ))}
                  </Collapse>
                </>
              ) : (
                <Box sx={{ mt: 1 }}>
                  <Typography color="textSecondary">
                    No bank account linked
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ mt: 1 }}
                    onClick={() => navigate("/bank-account")}
                  >
                    + Add Bank Account
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Transaction Success Rate */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "#fff3e0", boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6">Transaction Success Rate</Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {successRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/*  2FA Setup Section */}
      <Box sx={{ mt: 5, textAlign: "center" }}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6">Account Security</Typography>
        {twoFAEnabled ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            ✅ Two-Factor Authentication is already enabled on your account.
          </Alert>
        ) : (
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            onClick={() => navigate("/2fa-setup")}
          >
            🔒 Enable Two-Factor Authentication
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;