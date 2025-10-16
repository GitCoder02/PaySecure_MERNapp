# PaySecure MERN App

PaySecure is a full-stack MERN (MongoDB, Express, React, Node.js) application that provides a secure digital payment gateway. It supports various payment methods, including UPI, Card, and Bank Transfers, with a focus on security features like two-factor authentication (2FA) and data encryption.

-----

## 🚀 Features

  * **User Authentication**: Secure user registration and login with JWT-based authentication.
  * **Two-Factor Authentication (2FA)**: TOTP-based 2FA for enhanced account security, required for high-value transactions.
  * **Multiple Payment Options**:
      * **UPI**: Instant payments using a UPI ID and PIN.
      * **Card**: Secure credit/debit card payments with Luhn algorithm validation.
      * **Bank Transfer**: OTP-based bank transfers for secure transactions.
  * **Transaction History**: Users can view their complete transaction history.
  * **Merchant and Admin Roles**:
      * **Merchants**: Can view all payments received.
      * **Admins**: Have access to all transactions and user management capabilities.
  * **Dashboard**: A personalized dashboard for users to view their wallet balance, linked bank accounts, and transaction success rate.
  * **Security**:
      * **Password and PIN Hashing**: User credentials are securely hashed using bcrypt.
      * **Data Encryption**: Sensitive information like PINs is encrypted using AES-256-GCM.
      * **HMAC for Integrity**: Transactions are protected with HMAC-SHA256 to ensure data integrity.

-----

## Project Structure

The project is organized into two main directories: `backend` and `frontend`.

```
/
├── backend/
│ ├── middleware/ (Express middleware for auth, validation, etc.)
│ ├── models/ (Mongoose schemas for User, Transaction, BankAccount)
│ ├── routes/ (API routes for auth, payment, and bank)
│ ├── .env (Environment variables - not committed)
│ └── server.js (Main Express server file)
│
└── frontend/
  ├── public/ (Public assets and index.html)
  └── src/
    ├── components/ (React components for different features)
    ├── context/ (React context for authentication)
    ├── pages/ (Pages for different routes)
    ├── App.js (Main App component with routing)
    └── index.js (Entry point for the React app)
```

-----

## 🛠️ Getting Started

### Prerequisites

  * Node.js and npm (or yarn)
  * MongoDB (local or a cloud-based instance like MongoDB Atlas)

### Backend Setup

1.  **Navigate to the backend directory**:

    ```bash
    cd backend
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Create a `.env` file** in the `backend` directory and add the following environment variables:

    ```
    PORT=5000
    MONGO_URI=<YOUR_MONGODB_CONNECTION_STRING>
    JWT_SECRET=<YOUR_JWT_SECRET>
    AES_SECRET_KEY=<YOUR_AES_SECRET_KEY>
    HMAC_SECRET=<YOUR_HMAC_SECRET>
    ```

4.  **Run the backend server**:

    ```bash
    npm run dev
    ```

    The backend will be running on `http://localhost:5000`.

### Frontend Setup

1.  **Navigate to the frontend directory**:

    ```bash
    cd frontend/frontend
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Run the frontend development server**:

    ```bash
    npm start
    ```

    The frontend will be running on `http://localhost:3000`.

-----

## 💻 Technologies Used

### Backend

  * **Node.js**: JavaScript runtime environment
  * **Express**: Web framework for Node.js
  * **MongoDB**: NoSQL database
  * **Mongoose**: Object Data Modeling (ODM) library for MongoDB
  * **JWT (jsonwebtoken)**: For user authentication
  * **bcrypt**: For hashing passwords and PINs
  * **otplib & qrcode**: For two-factor authentication
  * **express-validator**: For request validation
  * **cors**: For enabling Cross-Origin Resource Sharing
  * **helmet**: For securing Express apps by setting various HTTP headers

### Frontend

  * **React**: JavaScript library for building user interfaces
  * **React Router**: For client-side routing
  * **Axios**: For making HTTP requests to the backend
  * **Material-UI (MUI)**: For UI components
  * **jwt-decode**: For decoding JWTs on the client-side
