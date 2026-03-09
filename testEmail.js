const dotenv = require("dotenv");
dotenv.config();

const { sendAbsentEmail, sendOverdueTaskEmail } = require("./utils/emailService");

async function runTests() {
    console.log("Starting email tests for dhobleharshwardhan@gmail.com...");

    try {
        console.log("1. Testing Absent Email...");
        const absentDate = new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const absentResult = await sendAbsentEmail(
            "dhobleharshwardhan@gmail.com",
            "Harshwardhan Dhoble",
            absentDate
        );
        console.log("Absent email result:", absentResult ? "✅ SUCCESS" : "❌ FAILED");

        console.log("2. Testing Overdue Task Email...");
        const overdueResult = await sendOverdueTaskEmail(
            "dhobleharshwardhan@gmail.com",
            "Harshwardhan Dhoble",
            "Important Project Milestone (Test)",
            new Date(Date.now() - 86400000) // Yesterday
        );
        console.log("Overdue task email result:", overdueResult ? "✅ SUCCESS" : "❌ FAILED");

        console.log("\nAll email tests completed.");
        process.exit(0);
    } catch (error) {
        console.error("Test script encountered an error:", error);
        process.exit(1);
    }
}

runTests();
