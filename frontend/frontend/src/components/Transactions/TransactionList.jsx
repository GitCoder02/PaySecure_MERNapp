// TransactionList.jsx
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
  IconButton,
  Tooltip,
  Box,
  Alert,
  Snackbar,
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import VerifiedIcon from "@mui/icons-material/Verified";
import GppBadIcon from "@mui/icons-material/GppBad";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

const TransactionList = () => {
  const { token } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // map of txId -> { loading: bool, valid: bool|null, message: string }
  const [verifyState, setVerifyState] = useState({});
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/payment/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTransactions(res.data.transactions || []);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setSnack({ severity: "error", text: "Failed to load transactions" });
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchTransactions();
  }, [token]);

  const handleVerify = async (tx) => {
    // if no signature present, show alert
    if (!tx.signature) {
      setSnack({ severity: "warning", text: "No signature available for this transaction." });
      return;
    }

    // avoid re-verifying if already valid true
    setVerifyState((s) => ({ ...s, [tx._id]: { loading: true, valid: null, message: null } }));

    try {
      const res = await axios.get(`http://localhost:5000/api/payment/verify-signature/${tx._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { isValid, message } = res.data;
      setVerifyState((s) => ({ ...s, [tx._id]: { loading: false, valid: isValid, message } }));
      setSnack({ severity: isValid ? "success" : "error", text: message || (isValid ? "Valid" : "Invalid") });
    } catch (err) {
      console.error("Verify signature error:", err);
      setVerifyState((s) => ({ ...s, [tx._id]: { loading: false, valid: false, message: "Verification failed" } }));
      setSnack({ severity: "error", text: "Signature verification failed" });
    }
  };

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
      <Card sx={{ maxWidth: 1000, width: "100%" }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Transaction History
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Amount</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Merchant</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Signature</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length > 0 ? (
                    transactions.map((t) => {
                      const vs = verifyState[t._id] || { loading: false, valid: null, message: null };
                      return (
                        <TableRow key={t._id}>
                          <TableCell>₹{t.amount}</TableCell>
                          <TableCell>{t.type}</TableCell>
                          <TableCell>{t.receiverId?.name || "Unknown"}</TableCell>
                          <TableCell>
                            <Chip label={t.status} color={getStatusColor(t.status)} />
                          </TableCell>
                          <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            {/* If verifying */}
                            {vs.loading ? (
                              <Chip label="Verifying..." icon={<CircularProgress size={14} />} />
                            ) : vs.valid === true ? (
                              <Chip
                                label="Verified"
                                color="success"
                                icon={<VerifiedIcon />}
                                clickable={false}
                                onClick={() => {}}
                              />
                            ) : vs.valid === false ? (
                              <Chip label="Invalid" color="error" icon={<GppBadIcon />} />
                            ) : (
                              // default: show verify action if signature exists
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                {t.signature ? (
                                  <Tooltip title="Verify signature">
                                    <IconButton size="small" onClick={() => handleVerify(t)}>
                                      <HelpOutlineIcon />
                                    </IconButton>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="caption" color="textSecondary">
                                    No signature
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)}>
            {snack.text}
          </Alert>
        ) : null}
      </Snackbar>
    </div>
  );
};

export default TransactionList;
