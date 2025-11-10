// AdminDashboard.jsx (updated)
import React, { useContext } from "react";
import { Box, Tabs, Tab, Typography, Paper } from "@mui/material";
import AdminTransactionTable from "./AdminTransactionTable";
import AuditLogTable from "./AuditLogTable";
import AdminUserTable from "./AdminUserTable";
import { AuthContext } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

const AdminDashboard = ({ initialTab = 0 }) => {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = React.useState(initialTab);

  if (!user || user.role !== "admin") {
    return <Navigate to="/dashboard" />;
  }

  return (
    <Box sx={{ padding: "2rem" }}>
      <Typography variant="h4" gutterBottom>
        Admin Console
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary">
          <Tab label="All Transactions" />
          <Tab label="Audit Logs" />
          <Tab label="Manage Users" />
        </Tabs>
      </Paper>

      {tab === 0 && <AdminTransactionTable />}
      {tab === 1 && <AuditLogTable />}
      {tab === 2 && <AdminUserTable />}
    </Box>
  );
};

export default AdminDashboard;
