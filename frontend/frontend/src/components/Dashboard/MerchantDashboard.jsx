import React, { useContext, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  TableContainer,
  Paper,
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";

const MerchantDashboard = () => {
  const { token, user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReceivedPayments = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/payment/received", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTransactions(res.data.transactions);
      } catch (err) {
        console.error("Error fetching received payments:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchReceivedPayments();
  }, [token]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Success":
        return "success";
      case "Failed":
        return "error";
      default:
        return "warning"; // Pending
    }
  };

  return (
    <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
      <Card sx={{ maxWidth: 900, width: "100%" }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Payments Received {user?.name ? ` - ${user.name}` : ""}
          </Typography>

          {loading ? (
            <CircularProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length > 0 ? (
                    transactions.map((t) => (
                      <TableRow key={t._id}>
                        <TableCell>{t.userId?.name || "Unknown"}</TableCell>
                        <TableCell>₹{t.amount}</TableCell>
                        <TableCell>{t.type}</TableCell>
                        <TableCell>
                          <Chip label={t.status} color={getStatusColor(t.status)} />
                        </TableCell>
                        <TableCell>
                          {new Date(t.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No received payments found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantDashboard;