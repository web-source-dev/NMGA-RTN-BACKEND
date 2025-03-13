const nodemailer = require('nodemailer');
const Log = require('../models/Logs');

const sendEmail = async (to, subject, html) => {
  console.log('Attempting to send email:', {
    to,
    subject,
    // Don't log the full HTML for security
    htmlLength: html?.length
  });
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com", // Zoho SMTP Server
    port: 465, // Use 465 for SSL (or 587 for TLS)
    secure: true, // true for SSL (465), false for TLS (587)
    auth: {
      user: process.env.EMAIL_USER, // Your Zoho email
      pass: process.env.EMAIL_PASS, // Your Zoho App Password
    },
  });

  try {
    const result = await transporter.sendMail({
      from: `"RTN Global" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });

    console.log('Email sent successfully:', {
      messageId: result.messageId,
      to,
      subject
    });

    await Log.create({ 
      message: `Email sent to ${to}`, 
      type: 'success', 
      user_id: null 
    });

    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    await Log.create({ 
      message: `Failed to send email to ${to}: ${error.message}`, 
      type: 'error', 
      user_id: null 
    });
    throw error;
  }
};

module.exports = sendEmail;
