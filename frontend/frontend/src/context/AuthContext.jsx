import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  // 🔹 Logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    window.location.href = '/login'; // redirect
  };

  // Function to check if token expired
  const isTokenExpired = (decoded) => {
    if (!decoded.exp) return true;
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  };

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);

        if (isTokenExpired(decoded)) {
          console.warn('Token expired, logging out');
          logout();
          return;
        }

        setUser({ email: decoded.email, id: decoded.id, role: decoded.role });
        localStorage.setItem('token', token);

        // Auto logout when token is about to expire
        const timeUntilExpiry = decoded.exp * 1000 - Date.now();
        const timer = setTimeout(() => {
          alert('Session expired. Please login again.');
          logout();
        }, timeUntilExpiry);

        return () => clearTimeout(timer);
      } catch (err) {
        console.error('Invalid token:', err);
        logout();
      }
    } else {
      setUser(null);
      localStorage.removeItem('token');
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, setToken, user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};