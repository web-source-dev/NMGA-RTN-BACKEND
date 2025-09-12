const baseTemplate = require('./baseTemplate');

// Email template for member credentials
module.exports = (name, email, businessName, password) => baseTemplate(`
      <h2>Welcome to NMGA</h2>
      
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3 style="margin-top: 0; color:rgb(26, 26, 26);">𝐏𝐋𝐄𝐀𝐒𝐄 𝐑𝐄𝐀𝐃: System Training Sessions</h3>
        <p style="margin-bottom: 10px;">Hello! You are getting this because you are a NMGA Co-op member and will be utilizing our new liquor co-op online system for monthly liquor commitments. We will be holding system training sessions on Tuesday 8/26/25 and on Thursday 9/6/25. On 8/26 we will have training sessions available at 10am and at 3:15pm and on 9/6 we will have training sessions at 10am and 3:15pm. Below this email, please find a link to sign up for the day and time that you can attend a training, along with the link for the meeting in Google Meets.</p>
        
        <p style="margin-bottom: 10px;">If you got the original email and have already signed in to the new system, please do not sign-up again.  We ask that you just complete the google form at the bottom of this email to sign up for the date and time of your training.  If you have any questions please email henry@novocommstrategies.com.</p>
        
        <p style="margin-bottom: 10px;">Thank you!</p>
        
        <p style="margin-bottom: 10px;"><strong>𝐈𝐌𝐏𝐎𝐑𝐓𝐀𝐍𝐓 𝐍𝐎𝐓𝐄!! 𝐒𝐲𝐬𝐭𝐞𝐦 𝐢𝐬 𝐥𝐨𝐜𝐚𝐭𝐞𝐝 𝐢𝐧 <a href="https://nmgrocers.com" style="color: #007bff;">nmgrocers.com</a> 𝐢𝐧 𝐭𝐡𝐞 𝐍𝐌 𝐆𝐫𝐨𝐜𝐞𝐫𝐬 𝐋𝐢𝐪𝐮𝐨𝐫 𝐂𝐨-𝐨𝐩 𝐭𝐚𝐛.</strong></p>
        
        <p style="margin-bottom: 10px;"><strong>Sign-up for Training Session</strong> (Please note that each session should take no more than 30-45 minutes)<br>
        Link: <a href="https://forms.gle/2obsVfrswtDFetDbA" style="color: #007bff;">https://forms.gle/2obsVfrswtDFetDbA</a></p>
        
        <p style="margin-bottom: 0;"><strong>Google Meets link for training meeting you chose:</strong><br>
        <a href="https://meet.google.com/ewz-gfoq-bvs" style="color: #007bff;">https://meet.google.com/ewz-gfoq-bvs</a></p>
      </div>
      
      <div class="alert-box alert-info">
        <h3>Your Login Credentials</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Business Name:</strong> ${businessName}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      
      <div class="alert-box alert-warning">
        <h3>Important Security Notice</h3>
        <p>For your security, we strongly recommend that you change your password after your first login. You can do this by:</p>
        <ol>
          <li>Logging into your account using the credentials above</li>
          <li>Going to your profile settings</li>
          <li>Selecting "Change Password"</li>
          <li>Entering a new secure password</li>
        </ol>
        <p style="padding:5px; background-color:rgb(238, 70, 70);color:white; border-radius: 5px;"><strong>Note:</strong> If you have already logged in or changed your password recently, You can login with your recent password.</p>
      </div>
      
      <div class="card">
        <h3 class="card-header">What You Can Do</h3>
        <ul>
          <li>Browse and participate in exclusive deals from distributors</li>
          <li>Access member-only content and resources</li>
          <li>Stay updated with industry news and events</li>
        </ul>
      </div>
      
      <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>
      <strong>NMGA Team</strong></p>
    `);