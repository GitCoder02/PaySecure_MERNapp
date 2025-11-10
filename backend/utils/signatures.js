// backend/utils/signatures.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Paths for persistent RSA keys
const keysDir = path.join(__dirname, "../keys");
const privateKeyPath = path.join(keysDir, "private.pem");
const publicKeyPath = path.join(keysDir, "public.pem");

/**
 * Initialize RSA key pair on server startup.
 * If keys already exist, reuses them.
 */
function initializeKeys() {
  try {
    if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir);

    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      console.log("🔐 Generating new RSA key pair (2048-bit)...");
      const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "pkcs1", format: "pem" },
        privateKeyEncoding: { type: "pkcs1", format: "pem" },
      });
      fs.writeFileSync(privateKeyPath, privateKey);
      fs.writeFileSync(publicKeyPath, publicKey);
      console.log("✅ RSA key pair generated successfully.");
    } else {
      console.log("🔑 RSA keys already exist, using existing pair.");
    }
  } catch (err) {
    console.error("❌ RSA key initialization failed:", err);
    process.exit(1);
  }
}

/**
 * Digitally sign a canonical string using RSA-SHA256.
 */
function signTransaction(data) {
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  return signer.sign(privateKey, "base64");
}

/**
 * Verify a signature against data using public key.
 */
function verifySignature(data, signature) {
  const publicKey = fs.readFileSync(publicKeyPath, "utf8");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(data);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

/**
 * Export the public key (for demo / verification display).
 */
function getPublicKey() {
  return fs.readFileSync(publicKeyPath, "utf8");
}

module.exports = {
  initializeKeys,
  signTransaction,
  verifySignature,
  getPublicKey,
};
