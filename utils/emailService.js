const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendWelcomeEmail = async (toEmail, fullName, password) => {
    try {
        const mailOptions = {
            from: `"Humanity Founders" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: "Welcome to Humanity Founders Employee Portal",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #6a11cb;">Welcome, ${fullName}!</h2>
                    <p>You have been given access to the Humanity Founders Employee Portal.</p>
                    <p>Please log in using the credentials below:</p>
                    <div style="background-color: #f7f9fc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; padding-bottom: 5px;"><strong>Email:</strong> ${toEmail}</p>
                        <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
                    </div>
                    <p><strong>Important:</strong> You will be required to complete your onboarding process upon your first login. For security reasons, we strongly recommend changing your password shortly after.</p>
                    <p>Visit the portal here: <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}">${process.env.CLIENT_URL || 'http://localhost:5173'}</a></p>
                    <p style="margin-top: 30px; font-size: 0.9em; color: #777;">Regards,<br/>Humanity Founders Admin Team</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

module.exports = {
    sendWelcomeEmail,
};
