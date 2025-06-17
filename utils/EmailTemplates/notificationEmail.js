const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name, message, type = 'info') => baseTemplate(`
    <h2>NMGA Notification</h2>
    <p>Dear ${name},</p>

    <div class="alert-box ${
        type === 'success' ? 'alert-success' : 
        type === 'warning' ? 'alert-warning' : 
        type === 'error' ? 'alert-danger' : 
        'alert-info'
    }">
        <p style="margin: 0;">
            <strong>${message}</strong>
        </p>
    </div>

    <div style="text-align: center; margin-top: 20px;">
        <a href="${FRONTEND_URL}/dashboard" class="button">View Dashboard</a>
    </div>

    <p style="font-size: 0.9em; margin-top: 20px;">
        You can manage your notification preferences in your account settings.
    </p>
`);
