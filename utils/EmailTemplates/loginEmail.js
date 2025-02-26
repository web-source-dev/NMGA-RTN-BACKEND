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
    <h1>New Login Detected</h1>
    <p>Hello ${name || 'User'},</p>
    <p>We detected a new login to your account with the following details:</p>
    <ul>
      <li>Time: ${time}</li>
      <li>Location: ${location}</li>
      <li>Device: ${device}</li>
    </ul>
    <p>If this wasn't you, please secure your account immediately.</p>
  `);
};
