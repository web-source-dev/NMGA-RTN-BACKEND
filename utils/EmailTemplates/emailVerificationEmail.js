const baseTemplate = require('./baseTemplate');

module.exports = (name, verificationLink) => baseTemplate(`
    <h2>Verify Your Email Address</h2>
    <p>Dear ${name},</p>

    <p>Thank you for joining NMGA! To complete your registration and access all features, please verify your email address.</p>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" class="button">Verify Email Address</a>
    </div>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Why verify?</strong></p>
        <ul>
            <li>Ensure secure account access</li>
            <li>Receive important deal notifications</li>
            <li>Participate in group buying opportunities</li>
            <li>Access exclusive member benefits</li>
        </ul>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        This verification link will expire in 24 hours. If you didn't create an account with NMGA, please ignore this email.
    </p>
`);
