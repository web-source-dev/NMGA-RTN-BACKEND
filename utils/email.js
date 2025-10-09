const SibApiV3Sdk = require('@getbrevo/brevo');
const User = require('../models/User');
const { isFeatureEnabled } = require('../config/features');

const sendEmail = async (to, subject, html) => {
  // Check if email feature is disabled
  if (!(await isFeatureEnabled('EMAIL'))) {
    const timestamp = new Date().toISOString();
    const primaryEmails = Array.isArray(to) ? to : [to];
    
    // Collect all additional emails even when disabled
    const allEmails = [...primaryEmails];
    for (const email of primaryEmails) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user && user.additionalEmails && user.additionalEmails.length > 0) {
        const additionalEmails = user.additionalEmails.map(e => e.email);
        allEmails.push(...additionalEmails);
      }
    }
    const uniqueEmails = [...new Set(allEmails)];
    
    console.log('📧 Email feature is disabled. Email would have been sent:', {
      to: uniqueEmails,
      subject,
      contentLength: html?.length || 0,
      timestamp
    });
    
    return { messageId: 'disabled', to: uniqueEmails, subject: subject }; // Return mock success response
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
  
  const timestamp = new Date().toISOString();
  console.log('📧 Attempting to send email:', {
    timestamp,
    to: uniqueEmails,
    primaryEmails: primaryEmails,
    additionalEmails: uniqueEmails.filter(email => !primaryEmails.includes(email)),
    subject,
    htmlLength: html?.length,
    sender: sendSmtpEmail.sender.email
  });

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const timestamp = new Date().toISOString();

    return result;
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error('Failed to send email:', error);
    
    throw error;
  }
};

module.exports = sendEmail;
