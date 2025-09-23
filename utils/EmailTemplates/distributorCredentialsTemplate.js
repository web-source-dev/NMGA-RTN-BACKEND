const baseTemplate = require('./baseTemplate');

// Email template for distributor credentials
module.exports = (name, email, businessName, password) => baseTemplate(`
      <h2>Welcome to NMGA</h2>
      
      <div style="background-color: #e8f4fd; border: 1px solid #b3d9ff; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <p style="margin-bottom: 10px;">Hello! You are getting this because you are a NMGA Co-op distributor and will be utilizing our new liquor co-op online system to manage your deals and interact with members.</p>
        
        <p style="margin-bottom: 10px;">We understand that you may have created a log-in before, but due to system updates we are needing you to create your log-in again. If you have any questions please email <a href="mailto:henry@novocommstrategies.com" style="color: #007bff;">henry@novocommstrategies.com</a>.</p>
        
        <p style="margin-bottom: 10px;">Thank you!</p>
        
        <p style="margin-bottom: 10px;"><strong>𝐈𝐌𝐏𝐎𝐑𝐓𝐀𝐍𝐓 𝐍𝐎𝐓𝐄!! 𝐒𝐲𝐬𝐭𝐞𝐦 𝐢𝐬 𝐥𝐨𝐜𝐚𝐭𝐞𝐝 𝐢𝐧 <a href="https://nmgrocers.com" style="color: #007bff;">nmgrocers.com</a> 𝐢𝐧 𝐭𝐡𝐞 𝐍𝐌 𝐆𝐫𝐨𝐜𝐞𝐫𝐬 𝐋𝐢𝐪𝐮𝐨𝐫 𝐂𝐨-𝐨𝐩 𝐭𝐚𝐛.</strong></p>
      </div>
      
      <div class="alert-box alert-info">
        <h3>Your Distributor Login Credentials</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Business Name:</strong> ${businessName}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      
      <div class="alert-box alert-warning">
        <h3>Important Security Notice</h3>
        <p>For your security, we strongly recommend that you change your password after your first login. You can do this by:</p>
        <ol>
          <li>Login your account using the credentials above</li>
          <li>Navigate to profile settings</li>
          <li>Select "Change Password"</li>
          <li>Entering a new secure password</li>
        </ol>
      </div>
      
      <p>If you have any questions or need assistance with the distributor portal, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>
      <strong>NMGA Team</strong></p>
    `);
