// components/Layout/Sidebar.js
import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

const Sidebar = () => {
  const { user, setUser, setToken } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="sidebar">
      <div className="logo">PaySecure</div>
      <ul>
        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>

        {/* Show only for customers */}
        {user?.role === "user" && (
          <>
            <li>
              <Link to="/payment">Make Payment</Link>
            </li>
            <li>
              <Link to="/transactions">Transactions</Link>
            </li>
          </>
        )}

        {/* Logout always visible */}
        <li style={{ marginTop: "2rem" }}>
          <button
            onClick={handleLogout}
            style={{
              background: "#e74c3c", // red button
              border: "none",
              color: "white",
              fontWeight: "600",
              cursor: "pointer",
              padding: "10px 15px",
              borderRadius: "6px",
              width: "100%",
              textAlign: "center",
            }}
          >
            Logout
          </button>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;