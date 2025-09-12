const SibApiV3Sdk = require('@getbrevo/brevo');
const Log = require('../models/Logs');
const User = require('../models/User');
const { isFeatureEnabled } = require('../config/features');

const sendEmail = async (to, subject, html) => {
  // Check if email feature is enabled
  if (!(await isFeatureEnabled('EMAIL'))) {
    console.log('📧 Email feature is disabled. Email would have been sent to:', to);
    console.log('📧 Subject:', subject);
    console.log('📧 Content length:', html?.length || 0);
    return { messageId: 'disabled', to: to, subject: subject }; // Return mock success response
  }

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

  // Configure Brevo API
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

  // Prepare email data
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.to = uniqueEmails.map(email => ({ email }));
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = {
    name: "New Mexico Grocers Association",
    email: process.env.BREVO_EMAIL_USER
  };

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

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
