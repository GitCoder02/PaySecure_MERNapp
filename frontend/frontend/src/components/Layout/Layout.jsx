import React from "react";
import Sidebar from "./Sidebar";
import "./Layout.css"; // for styling

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <Sidebar />
      <div className="content">
        <header className="header">
          <h2>Digital Payment Gateway</h2>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
};

export default Layout;