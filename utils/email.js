const SibApiV3Sdk = require('@getbrevo/brevo');
const Log = require('../models/Logs');
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

    // Log disabled email attempt
    await Log.create({ 
      message: `🚫 EMAIL FEATURE DISABLED
        📅 Time: ${timestamp}
        👥 Recipients: ${uniqueEmails.join(', ')}
        📧 Primary Emails: ${primaryEmails.join(', ')}
        📧 Additional Emails: ${uniqueEmails.filter(email => !primaryEmails.includes(email)).join(', ') || 'None'}
        📝 Subject: ${subject}
        📊 Content Length: ${html?.length || 0} characters
        🏢 Sender: New Mexico Grocers Association
        ⚠️ Status: Feature Disabled - Email Not Sent`, 
      type: 'warning', 
      user_id: null 
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
    const timestamp = new Date().toISOString();

    console.log('Email sent successfully:', {
      messageId: result.messageId,
      to: uniqueEmails,
      subject,
      timestamp,
      sender: sendSmtpEmail.sender.email
    });

    // Create detailed success log
    await Log.create({ 
      message: `📧 EMAIL SENT SUCCESSFULLY
        📅 Time: ${timestamp}
        📨 Message ID: ${result.messageId}
        👥 Recipients: ${uniqueEmails.join(', ')}
        📧 Primary Emails: ${primaryEmails.join(', ')}
        📧 Additional Emails: ${uniqueEmails.filter(email => !primaryEmails.includes(email)).join(', ') || 'None'}
        📝 Subject: ${subject}
        📊 Content Length: ${html?.length || 0} characters
        🏢 Sender: ${sendSmtpEmail.sender.name} (${sendSmtpEmail.sender.email})
        ✅ Status: Delivered`, 
      type: 'success', 
      user_id: null 
    });

    return result;
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error('Failed to send email:', error);
    
    // Create detailed error log
    await Log.create({ 
      message: `❌ EMAIL SEND FAILED
        📅 Time: ${timestamp}
        👥 Recipients: ${uniqueEmails.join(', ')}
        📧 Primary Emails: ${primaryEmails.join(', ')}
        📧 Additional Emails: ${uniqueEmails.filter(email => !primaryEmails.includes(email)).join(', ') || 'None'}
        📝 Subject: ${subject}
        📊 Content Length: ${html?.length || 0} characters
        🏢 Sender: ${sendSmtpEmail.sender.name} (${sendSmtpEmail.sender.email})
        ❌ Error: ${error.message}
        🔍 Error Code: ${error.code || 'Unknown'}
        📋 Error Details: ${JSON.stringify(error.response?.data || {})}`, 
      type: 'error', 
      user_id: null 
    });
    throw error;
  }
};

module.exports = sendEmail;
