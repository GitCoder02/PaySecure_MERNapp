// AdminTransactionTable.jsx
import React, { useContext, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  CircularProgress,
  Chip,
  IconButton,
  Box,
  Snackbar,
  Alert,
  TextField,
  Button,
  Tooltip,
} from "@mui/material";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import GppBadIcon from "@mui/icons-material/GppBad";
import VerifiedIcon from "@mui/icons-material/Verified";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const AdminTransactionTable = () => {
  const { token } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyState, setVerifyState] = useState({});
  const [snack, setSnack] = useState(null);
  const [filters, setFilters] = useState({ status: "", type: "" });

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.status) query.set("status", filters.status);
      if (filters.type) query.set("type", filters.type);

      const url = `http://localhost:5000/api/admin/transactions${
        query.toString() ? `?${query.toString()}` : ""
      }`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error("Fetch admin transactions error:", err);
      setSnack({ severity: "error", text: "Failed to fetch transactions" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (txId) => {
    setVerifyState((s) => ({ ...s, [txId]: { loading: true } }));
    try {
      const res = await axios.get(
        `http://localhost:5000/api/admin/verify/${txId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const { isValid, message } = res.data;
      setVerifyState((s) => ({
        ...s,
        [txId]: { loading: false, valid: isValid, message },
      }));
      setSnack({ severity: isValid ? "success" : "error", text: message });
    } catch (err) {
      console.error("Admin verify error:", err);
      setVerifyState((s) => ({
        ...s,
        [txId]: { loading: false, valid: false, message: "Verify failed" },
      }));
      setSnack({ severity: "error", text: "Verification failed" });
    }
  };

  const getRiskColor = (score) => {
    if (score >= 70) return "error";
    if (score >= 40) return "warning";
    return "success";
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          All Transactions
        </Typography>

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label="Status"
            size="small"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
            placeholder="Success / Failed / Pending"
          />
          <TextField
            label="Type"
            size="small"
            value={filters.type}
            onChange={(e) =>
              setFilters((f) => ({ ...f, type: e.target.value }))
            }
            placeholder="UPI / Bank / Card"
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={fetchTransactions}
          >
            Filter
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Txn ID</TableCell>
                  <TableCell>Sender</TableCell>
                  <TableCell>Receiver</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Signature</TableCell>
                  <TableCell>Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length ? (
                  transactions.map((tx) => {
                    const vs = verifyState[tx._id] || {
                      loading: false,
                      valid: null,
                    };
                    return (
                      <TableRow key={tx._id}>
                        <TableCell>{tx._id}</TableCell>
                        <TableCell>
                          {tx.userId?.name || tx.userId?.email}
                        </TableCell>
                        <TableCell>
                          {tx.receiverId?.name || tx.receiverId?.email}
                        </TableCell>
                        <TableCell>₹{tx.amount}</TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>
                          <Chip
                            label={tx.status}
                            color={
                              tx.status === "Success"
                                ? "success"
                                : tx.status === "Failed"
                                ? "error"
                                : "warning"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(tx.createdAt).toLocaleString()}
                        </TableCell>

                        {/* Digital Signature Column */}
                        <TableCell>
                          {vs.loading ? (
                            <Chip
                              label="Verifying..."
                              icon={<CircularProgress size={14} />}
                            />
                          ) : vs.valid === true ? (
                            <Chip
                              label="Valid"
                              color="success"
                              icon={<VerifiedIcon />}
                            />
                          ) : vs.valid === false ? (
                            <Chip
                              label="Invalid"
                              color="error"
                              icon={<GppBadIcon />}
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleVerify(tx._id)}
                            >
                              Verify
                            </Button>
                          )}
                        </TableCell>

                        {/* Risk Column */}
                        <TableCell>
                          {typeof tx.riskScore !== "undefined" &&
                          tx.riskScore !== null ? (
                            <Tooltip
                              title={
                                tx.riskReasons && tx.riskReasons.length
                                  ? tx.riskReasons.join(", ")
                                  : "No specific reasons recorded"
                              }
                              arrow
                              placement="top"
                            >
                              <Chip
                                label={`${tx.riskScore}`}
                                color={getRiskColor(tx.riskScore)}
                                icon={<InfoOutlinedIcon />}
                                sx={{
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography
                              variant="caption"
                              color="textSecondary"
                            >
                              N/A
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

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
      </CardContent>
    </Card>
  );
};

export default AdminTransactionTable;