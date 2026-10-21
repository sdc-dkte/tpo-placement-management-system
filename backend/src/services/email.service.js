const nodemailer = require("nodemailer");

const createTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error("SMTP environment variables are not configured");
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
};

const sendEmail = async ({ to, subject, text, html }) => {
    if (!to || !subject || (!text && !html)) {
        throw new Error("Recipient, subject, and email content are required");
    }

    const transporter = createTransporter();

    return transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
    });
};

module.exports = { sendEmail };