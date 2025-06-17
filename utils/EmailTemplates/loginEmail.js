const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (data) => {
  if (!data) {
    throw new Error('Data object is required for login email template');
  }

  const { name, time, location, device } = data;
  
  if (!time || !location || !device) {
    throw new Error('Login email template requires time, location, and device information');
  }

  return baseTemplate(`
    <h2>New Login Detected</h2>
    <p>Hello ${name || 'User'},</p>
    
    <div class="alert-box alert-warning">
      <p><strong>Security Alert:</strong> We detected a new login to your account.</p>
    </div>
    
    <div class="card">
      <h3 class="card-header">Login Details:</h3>
      <ul>
        <li>Time: ${time}</li>
        <li>Location: ${location}</li>
        <li>Device: ${device}</li>
      </ul>
    </div>
    
  `);
};
