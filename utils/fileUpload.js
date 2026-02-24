const multer = require("multer");

// Use memory storage — files are stored as Buffers in memory
// then saved directly to MongoDB (no cloud storage needed)
const storage = multer.memoryStorage();

// File filter — only allow PDFs and images
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF, JPEG, JPG, and PNG files are allowed"), false);
    }
};

// Configure multer
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max per file
    },
});

module.exports = upload;
