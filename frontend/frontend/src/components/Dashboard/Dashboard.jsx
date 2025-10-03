import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import axios from "axios";
import { Card, CardContent, Typography, Grid, Button } from "@mui/material";

const Dashboard = () => {
  const { token, user, setUser, logout } = useContext(AuthContext);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [successRate, setSuccessRate] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBalance(userRes.data.balance);
        setUser(userRes.data);

        const txRes = await axios.get("http://localhost:5000/api/payment/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTransactions(txRes.data.transactions);

        const total = txRes.data.transactions.length;
        const success = txRes.data.transactions.filter(
          (tx) => tx.status === "Success"
        ).length;
        setSuccessRate(total > 0 ? Math.round((success / total) * 100) : 0);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    if (token) fetchData();
  }, [token, setUser]);

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {user?.name || "User"}
        </Typography>
        <Button variant="outlined" color="error" onClick={logout}>
          Logout
        </Button>
      </div>

      <Grid container spacing={3}>
        {/* Balance Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "#f1f8e9" }}>
            <CardContent>
              <Typography variant="h6">Account Balance</Typography>
              <Typography variant="h4">₹ {balance.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Transactions Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "#e3f2fd" }}>
            <CardContent>
              <Typography variant="h6">Total Transactions</Typography>
              <Typography variant="h4">{transactions.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Success Rate Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: "#fff3e0" }}>
            <CardContent>
              <Typography variant="h6">Success Rate</Typography>
              <Typography variant="h4">{successRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};

export default Dashboard;