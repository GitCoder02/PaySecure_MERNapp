import React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/Auth/LoginForm";
import RegisterForm from "./components/Auth/RegisterForm";
import Dashboard from "./components/Dashboard/Dashboard";
import MerchantDashboard from "./components/Dashboard/MerchantDashboard";
import PaymentForm from "./components/Payment/PaymentForm";
import TransactionList from "./components/Transactions/TransactionList";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout/Layout";
import BankAccountPage from "./pages/BankAccountPage";
import TwoFactorSetup from "./components/Auth/TwoFactorSetup";

function AppRoutes() {
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />

      {/*  Role-based dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              {user?.role === "merchant" ? <MerchantDashboard /> : <Dashboard />}
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bank-account"
        element={
          <ProtectedRoute>
            <Layout>
              <BankAccountPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      {/*  2FA Setup route */}
      <Route
        path="/2fa-setup"
        element={
          <ProtectedRoute>
            <Layout>
              <TwoFactorSetup />
            </Layout>
          </ProtectedRoute>
        }
      />
      {/*  User-only routes */}
      <Route
        path="/payment"
        element={
          <ProtectedRoute>
            <Layout>
              {user?.role === "user" ? <PaymentForm /> : <Navigate to="/dashboard" />}
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Layout>
              {user?.role === "user" ? <TransactionList /> : <Navigate to="/dashboard" />}
            </Layout>
          </ProtectedRoute>
        }
      />
    
      {/* Redirect unknown paths */}
      <Route path="*" element={<Navigate to="/login" />} />
      
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;