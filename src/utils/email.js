// src/utils/email.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. ��������� "transporter" - �����, �� ���� ���������� �����
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    // 2. ��������� ����� �����
    const mailOptions = {
        from: 'Your App Name <hello@yourapp.com>',
        to: options.email,
        subject: options.subject,
        text: options.message
        // html: ����� ������ HTML-����� �����
    };

    // 3. ³���������� ����
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;