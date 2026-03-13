require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const testEmail = "dhobleharshwardhan@gmail.com"; // Correct email address

console.log(`Sending test overdue email to: ${testEmail}\n`);

transporter.sendMail({
    from: process.env.EMAIL_FROM || "no-reply@humanityfounders.com",
    to: testEmail,
    subject: "🚨 Overdue Task: TEST EMAIL",
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">⏰ Task Overdue Reminder</h2>
            <p>Hi <strong>Harshwardhan</strong>,</p>
            <p>This is a <strong>TEST EMAIL</strong> to verify the email service is working.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Task:</strong> TEST: Sample Overdue Task</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> March 11, 2026</p>
            </div>
            <p>If you received this email, the service is working correctly!</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
                Sent at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
        </div>
    `
})
.then((info) => {
    console.log("✅ Test email sent successfully!");
    console.log("   To:", testEmail);
    console.log("   Message ID:", info.messageId);
    console.log("   Response:", info.response);
    console.log("\n👉 Check your inbox (and spam folder)!");
    process.exit(0);
})
.catch((error) => {
    console.error("❌ Failed to send email:");
    console.error(error);
    process.exit(1);
});
