const nodemailer = require('nodemailer');
const Log = require('../models/Logs');
const User = require('../models/User');

const sendEmail = async (to, subject, html) => {
  // Convert single email to array for consistent handling
  const primaryEmails = Array.isArray(to) ? to : [to];
  
  // Collect all additional emails
  const allEmails = [...primaryEmails];
  
  // Check for additional emails in User model
  for (const email of primaryEmails) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user && user.additionalEmails && user.additionalEmails.length > 0) {
      const additionalEmails = user.additionalEmails.map(e => e.email);
      allEmails.push(...additionalEmails);
    }
  }
  
  // Remove duplicates
  const uniqueEmails = [...new Set(allEmails)];
  
  console.log('Attempting to send email:', {
    to: uniqueEmails,
    subject,
    // Don't log the full HTML for security
    htmlLength: html?.length
  });

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // Zoho SMTP Server
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
      to: uniqueEmails.join(', '),
      subject,
      html,
    });

    console.log('Email sent successfully:', {
      messageId: result.messageId,
      to: uniqueEmails,
      subject
    });

    await Log.create({ 
      message: `Email sent to ${uniqueEmails.join(', ')}`, 
      type: 'success', 
      user_id: null 
    });

    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    await Log.create({ 
      message: `Failed to send email to ${uniqueEmails.join(', ')}: ${error.message}`, 
      type: 'error', 
      user_id: null 
    });
    throw error;
  }
};

module.exports = sendEmail;
