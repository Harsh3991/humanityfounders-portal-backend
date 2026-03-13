const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
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

const sendOverdueTaskEmail = async (toEmail, fullName, taskName, dueDate) => {
    try {
        const mailOptions = {
            from: `"Humanity Founders" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Action Required: Task Overdue - ${taskName}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #d9534f;">Task Overdue Notice</h2>
                    <p>Hi ${fullName},</p>
                    <p>This is a notification that the task <strong>"${taskName}"</strong> assigned to you is now overdue.</p>
                    <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p>Please mark it complete quickly in the Employee Portal, or reach out to your Manager or HR if you need assistance or an extension.</p>
                    <p>Visit the portal here: <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}">${process.env.CLIENT_URL || 'http://localhost:5173'}</a></p>
                    <p style="margin-top: 30px; font-size: 0.9em; color: #777;">Regards,<br/>Humanity Founders Admin Team</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Overdue task email sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending overdue task email:", error);
        return false;
    }
};

const sendAbsentEmail = async (toEmail, fullName, absentDate) => {
    try {
        const mailOptions = {
            from: `"Humanity Founders" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Notice: Absence Recorded on ${absentDate}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #f0ad4e;">Absence Notice</h2>
                    <p>Hi ${fullName},</p>
                    <p>We noticed that you were marked <strong>absent</strong> on <strong>${absentDate}</strong>.</p>
                    <p>If this was a mistake and you forgot to clock in, or if you were on an approved leave, please reach out to the Manager or HR to update your records.</p>
                    <p>Visit the portal here: <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}">${process.env.CLIENT_URL || 'http://localhost:5173'}</a></p>
                    <p style="margin-top: 30px; font-size: 0.9em; color: #777;">Regards,<br/>Humanity Founders Admin Team</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Absent email sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending absent email:", error);
        return false;
    }
};

const sendMonthlyReportEmail = async (toEmail, fullName, report) => {
    const {
        monthName, year,
        daysPresent = 0, daysAbsent = 0, totalDays = 0,
        totalWorkingHours = 0,
        completedTasks = [],
        inProgressTasks = 0,
        totalTasks = 0,
        attendanceRate = 0,
    } = report;

    const gradeColor = attendanceRate >= 90 ? '#22c55e' : attendanceRate >= 70 ? '#f59e0b' : '#ef4444';
    const grade      = attendanceRate >= 90 ? 'Excellent' : attendanceRate >= 70 ? 'Good' : 'Needs Improvement';

    const taskRows = completedTasks.length > 0
        ? completedTasks.map(t => `
            <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;color:#e4e4e7;font-size:13px;">${t.name}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;color:#a1a1aa;font-size:12px;white-space:nowrap;">${t.project || '—'}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;white-space:nowrap;">
                    <span style="background:#052e16;color:#22c55e;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">DONE</span>
                </td>
            </tr>`).join('')
        : `<tr><td colspan="3" style="padding:18px;text-align:center;color:#52525b;font-style:italic;font-size:13px;">No tasks completed this month.</td></tr>`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr>
        <td style="background:linear-gradient(135deg,#1c1c1e 0%,#18181b 100%);border:1px solid #27272a;border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;">
            <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#78716c;font-weight:700;">Humanity Founders Portal</p>
            <h1 style="margin:0;font-size:26px;font-weight:300;color:#fafafa;letter-spacing:-0.02em;">Monthly Report</h1>
            <p style="margin:12px 0 0;font-size:15px;color:#d4af37;font-weight:600;">${monthName} ${year}</p>
            <div style="width:48px;height:2px;background:linear-gradient(to right,#d4af37,#aa8a2e);margin:16px auto 0;border-radius:1px;"></div>
        </td>
    </tr>
    <tr>
        <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:28px 40px 20px;">
            <p style="margin:0;font-size:15px;color:#a1a1aa;">Hi <strong style="color:#e4e4e7;">${fullName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#71717a;line-height:1.6;">Here is your performance summary for <strong style="color:#d4af37;">${monthName} ${year}</strong>. Keep up the great work!</p>
        </td>
    </tr>
    <tr>
        <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="25%" style="padding:0 6px 0 0;">
                        <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:10px;padding:20px 16px;text-align:center;">
                            <p style="margin:0 0 6px;font-size:28px;font-weight:300;color:#22c55e;">${daysPresent}</p>
                            <p style="margin:0;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Present</p>
                        </div>
                    </td>
                    <td width="25%" style="padding:0 4px;">
                        <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:10px;padding:20px 16px;text-align:center;">
                            <p style="margin:0 0 6px;font-size:28px;font-weight:300;color:#ef4444;">${daysAbsent}</p>
                            <p style="margin:0;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Absent</p>
                        </div>
                    </td>
                    <td width="25%" style="padding:0 4px;">
                        <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:10px;padding:20px 16px;text-align:center;">
                            <p style="margin:0 0 6px;font-size:28px;font-weight:300;color:#d4af37;">${totalWorkingHours}</p>
                            <p style="margin:0;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Hrs Worked</p>
                        </div>
                    </td>
                    <td width="25%" style="padding:0 0 0 6px;">
                        <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:10px;padding:20px 16px;text-align:center;">
                            <p style="margin:0 0 6px;font-size:28px;font-weight:300;color:#a78bfa;">${completedTasks.length}</p>
                            <p style="margin:0;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Tasks Done</p>
                        </div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    <tr>
        <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:0 40px 28px;">
            <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:10px;padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Attendance Rate</p>
                            <p style="margin:0;font-size:22px;color:${gradeColor};font-weight:600;">${attendanceRate}% <span style="font-size:13px;font-weight:400;color:#52525b;">— ${grade}</span></p>
                        </td>
                        <td style="text-align:right;white-space:nowrap;">
                            <span style="font-size:11px;color:#52525b;">${daysPresent} of ${totalDays} working days</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding-top:12px;">
                            <div style="background:#27272a;border-radius:99px;height:8px;overflow:hidden;">
                                <div style="background:linear-gradient(to right,${gradeColor},${gradeColor}99);width:${Math.min(attendanceRate,100)}%;height:100%;border-radius:99px;"></div>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </td>
    </tr>
    <tr>
        <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:0 40px 28px;">
            <p style="margin:0 0 10px;font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">Task Summary</p>
            <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:10px;padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding:6px 12px;font-size:13px;color:#a1a1aa;">Total Tasks Assigned (Inc. Subtasks)</td>
                        <td style="padding:6px 12px;font-size:13px;color:#e4e4e7;text-align:right;font-weight:600;">${totalTasks}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 12px;font-size:13px;color:#a1a1aa;">Completed</td>
                        <td style="padding:6px 12px;font-size:13px;color:#22c55e;text-align:right;font-weight:600;">${completedTasks.length}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 12px;font-size:13px;color:#a1a1aa;">Still In Progress</td>
                        <td style="padding:6px 12px;font-size:13px;color:#f59e0b;text-align:right;font-weight:600;">${inProgressTasks}</td>
                    </tr>
                </table>
            </div>
        </td>
    </tr>
    <tr>
        <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:0 40px 32px;">
            <p style="margin:0 0 10px;font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:0.2em;font-weight:700;">Completed Tasks</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:10px;overflow:hidden;">
                <thead>
                    <tr style="background:#0a0a0a;">
                        <th style="padding:10px 14px;text-align:left;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Task</th>
                        <th style="padding:10px 14px;text-align:left;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Project</th>
                        <th style="padding:10px 14px;text-align:left;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Status</th>
                    </tr>
                </thead>
                <tbody style="background:#18181b;">
                    ${taskRows}
                </tbody>
            </table>
        </td>
    </tr>
    <tr>
        <td style="background:#0a0a0a;border:1px solid #27272a;border-top:1px solid #27272a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#52525b;">View full details on the portal:</p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="color:#d4af37;font-size:13px;font-weight:600;text-decoration:none;">${process.env.CLIENT_URL || 'http://localhost:5173'}</a>
            <p style="margin:16px 0 0;font-size:11px;color:#3f3f46;">© ${year} Humanity Founders · This is an automated message</p>
        </td>
    </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    try {
        const mailOptions = {
            from: `"Humanity Founders" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Your ${monthName} ${year} Monthly Report — Humanity Founders`,
            html,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`📊 Monthly report sent to ${fullName} <${toEmail}>: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send monthly report to ${toEmail}:`, error);
        return false;
    }
};

module.exports = {
    sendWelcomeEmail,
    sendOverdueTaskEmail,
    sendAbsentEmail,
    sendMonthlyReportEmail,
};
