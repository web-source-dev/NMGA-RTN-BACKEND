const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (token, inviterName) => baseTemplate(`
    <h2>Welcome to NMGA!</h2>
    <p>You've been invited to join our exclusive buying group.</p>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>What is NMGA?</h3>
        <p>NMGA is a collaborative buying platform where members can:</p>
        <ul>
            <li>Access exclusive group deals</li>
            <li>Participate in bulk purchasing</li>
            <li>Connect with trusted distributors</li>
            <li>Save on business purchases</li>
        </ul>
    </div>

    <p>To complete your registration and start accessing deals:</p>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/create-password?token=${token}" class="button">Create Your Password</a>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        This invitation link will expire in 7 days. For security reasons, please complete your registration soon.
    </p>
`);
