const AuthMessages = {
    // Registration message
    registration: (name) => {
        return `Welcome to NMGA, ${name}! Your registration is complete. Thank you for joining our platform.`;
    },

    // Login notification
    login: (data) => {
        return `Welcome back ${data.name}! New login detected.\nTime: ${data.time}\nLocation: ${data.location}\nDevice: ${data.device}`;
    },

    // Password reset request
    passwordReset: (name) => {
        return `Hi ${name}, your password reset request has been received. Please check your email for further instructions.`;
    },

    // Password changed confirmation
    passwordChanged: (name) => {
        return `Hi ${name}, your NMGA account password has been successfully changed. If you didn't make this change, please contact support immediately.`;
    },

    // Account blocked notification
    accountBlocked: (name) => {
        return `Hi ${name}, your NMGA account has been temporarily blocked. Please contact support for assistance.`;
    },

    // Account unblocked notification
    accountUnblocked: (name) => {
        return `Hi ${name}, your NMGA account has been unblocked. You can now access your account normally.`;
    },

    // New user invitation
    invitation: (name) => {
        return `Welcome to NMGA, ${name}! You've been invited to join our platform. Please check your email for account setup instructions.`;
    }
};

module.exports = AuthMessages; 