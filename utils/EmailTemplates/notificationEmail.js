const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name, message, type = 'info') => baseTemplate(`
    <h2>NMGA Notification</h2>
    <p>Dear ${name},</p>

    <div style="background-color: ${
        type === 'success' ? '#d4edda' : 
        type === 'warning' ? '#fff3cd' : 
        type === 'error' ? '#f8d7da' : 
        '#f8f9fa'
    }; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="color: ${
            type === 'success' ? '#155724' : 
            type === 'warning' ? '#856404' : 
            type === 'error' ? '#721c24' : 
            '#333'
        }; margin: 0;">
            <strong>${message}</strong>
        </p>
    </div>

    <div style="margin-top: 20px;">
        <a href="${FRONTEND_URL}/dashboard" class="button">View Dashboard</a>
    </div>

    <p style="font-size: 0.9em; margin-top: 20px;">
        You can manage your notification preferences in your account settings.
    </p>
`);
