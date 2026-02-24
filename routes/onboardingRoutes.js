const express = require("express");
const router = express.Router();
const { submitStep1, submitStep2, getOnboardingStatus } = require("../controllers/onboardingController");
const { step1Validator, step2Validator } = require("../validators/onboardingValidator");
const validate = require("../middleware/validate");
const protect = require("../middleware/auth");
const upload = require("../utils/fileUpload");

// All onboarding routes require authentication
router.use(protect);

// Get onboarding progress
router.get("/status", getOnboardingStatus);

// Step 1: Financials & Identity (with file uploads)
// Note: validation is handled in the controller since multipart/form-data
// fields aren't reliably read by express-validator's body()
router.post(
    "/step1",
    upload.fields([
        { name: "aadhaarCard", maxCount: 1 },
        { name: "panCard", maxCount: 1 },
    ]),
    submitStep1
);

// Step 2: Digital Declaration
router.post("/step2", step2Validator, validate, submitStep2);

module.exports = router;
