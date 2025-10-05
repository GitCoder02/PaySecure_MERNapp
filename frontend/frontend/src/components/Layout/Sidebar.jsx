import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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

  const linkStyle = {
    display: "block",
    color: "white",
    textDecoration: "none",
    padding: "10px 12px",
    borderRadius: "6px",
    marginBottom: "8px",
    transition: "background 0.2s ease",
  };

  const activeStyle = {
    backgroundColor: "rgba(76,175,239,0.2)",
    color: "#4cafef",
  };

  return (
    <div
      className="sidebar"
      style={{
        width: "230px",
        background: "#1e1e2f",
        color: "white",
        height: "100vh",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          className="logo"
          style={{
            fontSize: "1.5rem",
            fontWeight: "700",
            marginBottom: "1.5rem",
            textAlign: "center",
            color: "#4cafef",
          }}
        >
          💰 PaySecure
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li>
            <NavLink
              to="/dashboard"
              style={({ isActive }) => ({
                ...linkStyle,
                ...(isActive ? activeStyle : {}),
              })}
            >
              📊 Dashboard
            </NavLink>
          </li>

          {user?.role === "user" && (
            <>
              <li>
                <NavLink
                  to="/payment"
                  style={({ isActive }) => ({
                    ...linkStyle,
                    ...(isActive ? activeStyle : {}),
                  })}
                >
                  💳 Make Payment
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/transactions"
                  style={({ isActive }) => ({
                    ...linkStyle,
                    ...(isActive ? activeStyle : {}),
                  })}
                >
                  📜 Transactions
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/bank-account"
                  style={({ isActive }) => ({
                    ...linkStyle,
                    ...(isActive ? activeStyle : {}),
                  })}
                >
                  🏦 Bank Account
                </NavLink>
              </li>
            </>
          )}

          {user?.role === "merchant" && (
            <li>
              <NavLink
                to="/transactions/received"
                style={({ isActive }) => ({
                  ...linkStyle,
                  ...(isActive ? activeStyle : {}),
                })}
              >
                📥 Received Payments
              </NavLink>
            </li>
          )}

          {user?.role === "admin" && (
            <>
              <li>
                <NavLink
                  to="/admin/transactions"
                  style={({ isActive }) => ({
                    ...linkStyle,
                    ...(isActive ? activeStyle : {}),
                  })}
                >
                  📊 All Transactions
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/users"
                  style={({ isActive }) => ({
                    ...linkStyle,
                    ...(isActive ? activeStyle : {}),
                  })}
                >
                  👥 Manage Users
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </div>

      <button
        onClick={handleLogout}
        style={{
          background: "#e74c3c",
          border: "none",
          color: "white",
          fontWeight: "600",
          cursor: "pointer",
          padding: "10px 15px",
          borderRadius: "6px",
          width: "100%",
          textAlign: "center",
          transition: "background 0.3s ease",
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default Sidebar;