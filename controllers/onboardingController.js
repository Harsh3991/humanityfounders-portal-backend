const User = require("../models/User");
const { USER_STATUS } = require("../utils/constants");
const { encrypt, encryptBuffer, decrypt } = require("../utils/encryptData");

/**
 * POST /api/onboarding/step1
 * Protected — Submit financials & identity documents
 * Expects multipart/form-data with fields + files (aadhaarCard, panCard)
 */
const submitStep1 = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.status !== USER_STATUS.PENDING) {
            return res.status(400).json({
                success: false,
                message: "Onboarding already completed",
            });
        }

        const { bankName, accountNumber, ifscCode } = req.body;

        // ─── Manual validation (express-validator doesn't work with multipart) ───
        if (!bankName || !bankName.trim()) {
            return res.status(400).json({ success: false, message: "Bank name is required" });
        }
        if (!accountNumber || !accountNumber.trim()) {
            return res.status(400).json({ success: false, message: "Account number is required" });
        }
        if (!ifscCode || !ifscCode.trim()) {
            return res.status(400).json({ success: false, message: "IFSC code is required" });
        }

        // Update financial info (Encrypt sensitive fields)
        user.onboarding.bankName = bankName.trim();
        user.onboarding.accountNumber = encrypt(accountNumber.trim());
        user.onboarding.ifscCode = ifscCode.trim().toUpperCase();

        // Handle file uploads (Aadhaar and PAN) - Encrypt Buffers
        if (req.files) {
            if (req.files.aadhaarCard && req.files.aadhaarCard[0]) {
                const aadhaar = req.files.aadhaarCard[0];
                user.onboarding.aadhaarCard = {
                    data: encryptBuffer(aadhaar.buffer),
                    contentType: aadhaar.mimetype,
                    fileName: aadhaar.originalname,
                };
            }

            if (req.files.panCard && req.files.panCard[0]) {
                const pan = req.files.panCard[0];
                user.onboarding.panCard = {
                    data: encryptBuffer(pan.buffer),
                    contentType: pan.mimetype,
                    fileName: pan.originalname,
                };
            }
        }

        // Validate that both documents are uploaded
        if (!user.onboarding.aadhaarCard?.data) {
            return res.status(400).json({
                success: false,
                message: "Aadhaar card document is required",
            });
        }

        if (!user.onboarding.panCard?.data) {
            return res.status(400).json({
                success: false,
                message: "PAN card document is required",
            });
        }

        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "Step 1 completed — Financials & documents saved",
            data: {
                step: 1,
                bankName: user.onboarding.bankName,
                ifscCode: user.onboarding.ifscCode,
                aadhaarUploaded: !!user.onboarding.aadhaarCard?.data,
                panUploaded: !!user.onboarding.panCard?.data,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/onboarding/step2
 * Protected — Submit digital declaration & signature
 * On completion: status changes from "pending" → "active"
 */
const submitStep2 = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.status !== USER_STATUS.PENDING) {
            return res.status(400).json({
                success: false,
                message: "Onboarding already completed",
            });
        }

        // Check that Step 1 was completed first
        if (!user.onboarding.bankName || !user.onboarding.aadhaarCard?.data) {
            return res.status(400).json({
                success: false,
                message: "Please complete Step 1 (Financials & Identity) first",
            });
        }

        const { declarationAccepted, digitalSignature } = req.body;

        // Update declaration data
        user.onboarding.declarationAccepted = declarationAccepted === true || declarationAccepted === "true";
        user.onboarding.digitalSignature = digitalSignature;
        user.onboarding.declarationDate = new Date();
        user.onboarding.completedAt = new Date();

        // ─── KEY: Update status to ACTIVE ───
        user.status = USER_STATUS.ACTIVE;

        await user.save({ validateBeforeSave: false });

        // Decrypt account number for the response
        const userData = user.toJSON();
        if (userData.onboarding && userData.onboarding.accountNumber) {
            try {
                userData.onboarding.accountNumber = decrypt(userData.onboarding.accountNumber);
            } catch (err) {
                console.error("Decryption failed in onboarding step 2");
            }
        }

        res.status(200).json({
            success: true,
            message: "Onboarding complete! Welcome aboard 🎉",
            data: {
                user: userData,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/onboarding/status
 * Protected — Check onboarding progress
 */
const getOnboardingStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const step1Complete =
            !!user.onboarding.bankName &&
            !!user.onboarding.accountNumber &&
            !!user.onboarding.aadhaarCard?.data &&
            !!user.onboarding.panCard?.data;

        const step2Complete =
            user.onboarding.declarationAccepted && !!user.onboarding.digitalSignature;

        res.status(200).json({
            success: true,
            data: {
                status: user.status,
                step1Complete,
                step2Complete,
                onboardingComplete: user.status === USER_STATUS.ACTIVE,
                currentStep: step2Complete ? "done" : step1Complete ? 2 : 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    submitStep1,
    submitStep2,
    getOnboardingStatus,
};
