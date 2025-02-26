const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name, dealName) => baseTemplate(`
    <h2>Your Feedback Matters!</h2>
    <p>Dear ${name},</p>

    <p>We hope you're enjoying your experience with NMGA. Your feedback is crucial in helping us improve our services.</p>

    ${dealName ? `
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>Recent Deal Activity:</h3>
        <p>We noticed you recently participated in: <strong>${dealName}</strong></p>
    </div>
    ` : ''}

    <p>We'd love to hear your thoughts on:</p>
    <ul>
        <li>Deal quality and pricing</li>
        <li>Platform usability</li>
        <li>Customer support experience</li>
        <li>Suggestions for improvement</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/feedback" class="button">Share Your Feedback</a>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        Your feedback helps us create a better experience for all NMGA members.
    </p>
`);
