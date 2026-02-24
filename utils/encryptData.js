const crypto = require("crypto");

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

/**
 * Encrypt a string or buffer
 * Returns format: "iv:encryptedData" (hex encoded)
 */
const encrypt = (text) => {
    if (!text) return text;
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Return IV + Encrypted data
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

/**
 * Decrypt a string
 * Expects format: "iv:encryptedData" (hex encoded)
 */
const decrypt = (text) => {
    if (!text) return text;

    const parts = text.split(":");
    // Handle legacy/unencrypted data gracefully if format doesn't match
    if (parts.length !== 2) return text;

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");

    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
};

/**
 * Encrypt a Buffer (for files)
 * Returns Buffer: [IV (16 bytes) + Encrypted Data]
 */
const encryptBuffer = (buffer) => {
    if (!buffer) return buffer;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
};

/**
 * Decrypt a Buffer (for files)
 * Expects Buffer: [IV (16 bytes) + Encrypted Data]
 */
const decryptBuffer = (buffer) => {
    if (!buffer) return buffer;
    const iv = buffer.slice(0, 16);
    const encryptedData = buffer.slice(16);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
};

module.exports = { encrypt, decrypt, encryptBuffer, decryptBuffer };

