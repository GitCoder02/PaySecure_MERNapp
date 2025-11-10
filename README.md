# 💰 PaySecure: MERN Payment Gateway & Fraud Detection Simulator

PaySecure is a full-stack MERN (MongoDB, Express, React, Node.js) application that simulates a secure digital payment gateway. It is built to demonstrate core information security principles in a practical, hands-on environment.

This project implements a multi-layered security model, handling user, merchant, and admin roles. It programmatically demonstrates concepts including multi-factor authentication, end-to-end data encryption, transaction integrity verification (HMAC), non-repudiation (RSA digital signatures), tamper-evident logging (SHA-256 hash chaining), and real-time fraud detection.

## ✨ Core Features

### User & Authentication

  * **Secure Registration & Login:** Full user authentication using `bcrypt` for password/PIN hashing and JSON Web Tokens (JWT) for session management.
  * **Two-Factor Authentication (2FA):** Complete TOTP (e.g., Google Authenticator) setup and verification flow using `otplib`.
  * **Role-Based Access Control (RBAC):** Distinct roles for **User**, **Merchant**, and **Admin**, each with a unique dashboard and protected API endpoints.

### Payment System

  * **Multi-Method Payments:** Simulate payments via:
      * **UPI:** (bcrypt PIN verification)
      * **Card:** (Luhn algorithm validation)
      * **Bank Transfer:** (OTP-secured flow)
  * **Dynamic Dashboards:**
      * **User:** View wallet/bank balances, success rate, and 2FA status.
      * **Merchant:** View a list of all payments received.

### Advanced Security (The "IS" Features)

  * **Confidentiality (AES Encryption):** Transaction PINs are encrypted using `AES-256-GCM` before being stored in the database.
  * **Integrity (HMAC):** Every transaction is signed with an `HMAC-SHA256` digest to prove its core data (amount, receiver) has not been tampered with.
  * **Non-Repudiation (Digital Signatures):**
      * The server automatically signs every successful transaction with a 2048-bit **RSA private key** (`private.pem`).
      * Users and Admins can verify this signature at any time using the **public key** (`public.pem`), proving the transaction's authenticity.
  * **Attack Prevention (Rate Limiting):** Strict rate limits are applied to sensitive endpoints like `/login`, `/pay`, and `/bank/initiate` to prevent brute-force and DoS attacks.
  * **Input Validation:** All incoming API data is sanitized and validated using `express-validator` to prevent injection and malformed data.

### Admin Console & Fraud Detection

  * **Real-time Fraud Detection:** A rule-based risk engine (`risk.js`) analyzes every transaction in real-time. It scores transactions (0-100) based on high amounts, high frequency, new user status, and balance drain attempts.
  * **Admin Dashboard:** A tabbed interface for full system oversight.
      * **Transactions:** View all transactions, filter them, and see their risk score.
      * **User Management:** View, update roles (user, merchant, admin), or delete any user.
  * **Tamper-Evident Audit Logs:**
      * All critical actions (logins, payments, admin changes) are recorded in an `Audit` collection.
      * Each log is **cryptographically chained** using its `previousHash`, making the entire log history immutable and verifiable.
      * The admin can trigger a `GET /api/admin/verify-audit-chain` to confirm the integrity of the log.

-----

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, React Router, Material-UI (MUI), Axios, jwt-decode |
| **Backend** | Node.js, Express, Mongoose |
| **Database** | MongoDB (Atlas) |
| **Security** | `bcrypt`, `jsonwebtoken`, `otplib`, `qrcode`, `express-rate-limit`, `helmet`, `express-validator` |
| **Cryptography** | Node.js `crypto` library (AES, HMAC, RSA, SHA-256) |

-----

## 📁 Project Structure

```
/
├── backend/
│   ├── keys/                 # Auto-generated RSA keys
│   ├── middleware/           # auth.js, adminMiddleware.js, rateLimiter.js
│   ├── models/               # User.js, Transaction.js, Audit.js, BankAccount.js
│   ├── routes/               # auth.js, payment.js, admin.js, bank.js
│   ├── utils/                # risk.js, signatures.js
│   ├── .env                  # (Must be created)
│   ├── package.json
│   └── server.js             # Main server entry point
│
└── frontend/frontend/
    ├── public/               # index.html, manifest.json
    └── src/
        ├── components/
        │   ├── Admin/        # AdminDashboard.jsx, AdminUserTable.jsx, etc.
        │   ├── Auth/         # LoginForm.jsx, RegisterForm.jsx, TwoFactorSetup.jsx
        │   ├── Dashboard/    # Dashboard.jsx, MerchantDashboard.jsx
        │   ├── Layout/       # Layout.jsx, Sidebar.jsx
        │   ├── Payment/      # PaymentForm.jsx
        │   └── Transactions/ # TransactionList.jsx
        ├── context/          # AuthContext.jsx (Global State)
        ├── pages/            # BankAccountPage.jsx
        ├── App.js            # Main React Router
        └── index.js          # React entry point
```

-----

## 🚀 Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

  * **Node.js** (v16 or later recommended)
  * **npm** (comes with Node.js)
  * **MongoDB:** A connection string for a MongoDB database (e.g., from a free MongoDB Atlas account).

### 1\. Backend Setup

First, set up and run the backend server.

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install backend dependencies
npm install
```

3.  **Create Environment File**

    Create a file named `.env` in the `backend/` directory and add the following variables.

    ```env
    # The port your backend server will run on
    PORT=5000

    # Your MongoDB connection string
    MONGO_URI=mongodb+srv://<user>:<password>@<cluster-url>/<db-name>

    # A long, random string for signing JWTs
    JWT_SECRET=your_super_secret_jwt_key_here

    # A 32-character (256-bit) secret for AES encryption
    AES_SECRET_KEY=must_be_exactly_32_chars_long!!!

    # A long, random string for signing HMAC digests
    HMAC_SECRET=your_super_secret_hmac_key
    ```

4.  **Run the Backend**

    This command uses `nodemon` to start the server, which will automatically restart on file changes.

    ```bash
    npm run dev
    ```

    The server will start, automatically generate your RSA keys in `backend/keys/`, and connect to MongoDB. You should see:
    `MongoDB connected`
    `Server running on port 5000`

### 2\. Frontend Setup

In a **new terminal window**, set up and run the React frontend.

```bash
# 1. Navigate to the frontend directory
# !! Note: The path is frontend/frontend
cd frontend/frontend

# 2. Install frontend dependencies
npm install

# 3. Run the Frontend
npm start
```

This will open the React development server, and your browser should automatically open to `http://localhost:3000`.

You can now register a new user, log in, and use the application.
