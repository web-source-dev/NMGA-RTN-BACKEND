const SibApiV3Sdk = require('@getbrevo/brevo');
const User = require('../models/User');
const { isFeatureEnabled } = require('../config/features');
const { logSystemAction } = require('./collaboratorLogger');

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

    // Log disabled email attempt
    await logSystemAction('email_disabled', 'email', { 
      message: `Email feature disabled - Would have sent to ${uniqueEmails.length} recipient(s)`,
      recipients: uniqueEmails,
      primaryEmails,
      additionalEmails: uniqueEmails.filter(email => !primaryEmails.includes(email)),
      subject,
      contentLength: html?.length || 0,
      sender: 'New Mexico Grocers Association',
      timestamp,
      severity: 'low',
      tags: ['email', 'disabled-feature'],
      metadata: {
        featureDisabled: true,
        wouldHaveSent: true
      }
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

    console.log('Email sent successfully:', {
      messageId: result.messageId,
      to: uniqueEmails,
      subject,
      timestamp,
      sender: sendSmtpEmail.sender.email
    });

    // Create detailed success log
    await logSystemAction('email_sent_successfully', 'email', { 
      message: `Email sent successfully to ${uniqueEmails.length} recipient(s): ${subject}`,
      messageId: result.messageId,
      recipients: uniqueEmails,
      primaryEmails,
      additionalEmails: uniqueEmails.filter(email => !primaryEmails.includes(email)),
      subject,
      contentLength: html?.length || 0,
      senderName: sendSmtpEmail.sender.name,
      senderEmail: sendSmtpEmail.sender.email,
      timestamp,
      severity: 'low',
      tags: ['email', 'communication', 'sent'],
      metadata: {
        deliveryStatus: 'delivered',
        recipientCount: uniqueEmails.length,
        hasAdditionalEmails: uniqueEmails.length > primaryEmails.length
      }
    });

    return result;
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error('Failed to send email:', error);
    
    // Create detailed error log
    await logSystemAction('email_send_failed', 'email', { 
      message: `Failed to send email to ${uniqueEmails.length} recipient(s): ${subject}`,
      recipients: uniqueEmails,
      primaryEmails,
      additionalEmails: uniqueEmails.filter(email => !primaryEmails.includes(email)),
      subject,
      contentLength: html?.length || 0,
      senderName: sendSmtpEmail.sender.name,
      senderEmail: sendSmtpEmail.sender.email,
      timestamp,
      error: {
        message: error.message,
        code: error.code || 'Unknown',
        response: error.response?.data
      },
      severity: 'high',
      tags: ['email', 'communication', 'failed'],
      metadata: {
        apiError: true,
        errorDetails: JSON.stringify(error.response?.data || {})
      }
    });
    throw error;
  }
};

module.exports = sendEmail;
