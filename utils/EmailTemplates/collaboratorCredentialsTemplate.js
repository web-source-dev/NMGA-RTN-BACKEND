const baseTemplate = require('./baseTemplate');

// Helper function to format role names
function formatRoleName(role) {
  const roleMap = {
    'manager': 'Account Admin',
    'deal_manager': 'Deal Manager',
    'supplier_manager': 'Supplier Manager',
    'media_manager': 'Media Manager',
    'commitment_manager': 'Commitment Manager',
    'substore_manager': 'Substore Manager',
    'viewer': 'Viewer'
  };
  return roleMap[role] || role;
}

// Email template for collaborator credentials
module.exports = (name, email, businessName, password, collaboratorRole, mainUser) => baseTemplate(`
      
      <div style="background-color: #f0f8ff; border: 1px solid #b3d9ff; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <p style="margin-bottom: 10px;">You have been added as a ${formatRoleName(collaboratorRole)} at <strong>${businessName}</strong>.</p>
        
        <p style="margin-bottom: 10px;">If you have any questions please email <a href="mailto:henry@novocommstrategies.com" style="color: #007bff;">henry@novocommstrategies.com</a>.</p>
        
        <p style="margin-bottom: 10px;">Thank you!</p>
        
        <p style="margin-bottom: 10px;"><strong>𝐈𝐌𝐏𝐎𝐑𝐓𝐀𝐍𝐓 𝐍𝐎𝐓𝐄!! 𝐒𝐲𝐬𝐭𝐞𝐦 𝐢𝐬 𝐥𝐨𝐜𝐚𝐭𝐞𝐝 𝐢𝐧 <a href="https://nmgrocers.com" style="color: #007bff;">nmgrocers.com</a> 𝐢𝐧 𝐭𝐡𝐞 𝐍𝐌 𝐆𝐫𝐨𝐜𝐞𝐫𝐬 𝐋𝐢𝐪𝐮𝐨𝐫 𝐂𝐨-𝐨𝐩 𝐭𝐚𝐛.</strong></p>
      </div>
      
      <div class="alert-box alert-info">
        <h3>Your Login Credentials</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p><strong>Added for:</strong> ${businessName}</p>
        <p><strong>Role:</strong> ${formatRoleName(collaboratorRole)}</p>
      </div>
      
      <div class="alert-box alert-warning">
        <h3>Important Security Notice</h3>
        <p>Do not share your login credentials with anyone. Keep your password secure and confidential.</p>
      </div>
      
      <div class="card">
        <h3 class="card-header">Your Permissions</h3>
        <p>Based on your role (<strong>${formatRoleName(collaboratorRole)}</strong>), you have access to:</p>
        <ul>
          ${getRolePermissions(collaboratorRole)}
        </ul>
      </div>
      
      <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>
      <strong>NMGA Team</strong></p>
    `);

// Helper function to get role-specific permissions
function getRolePermissions(role) {
  const permissions = {
    'manager': [
      '<li>Full control of the account</li>',
      '<li>Manage all aspects of the business</li>',
      '<li>Add and remove other collaborators</li>',
      '<li>Access all features and data</li>'
    ],
    'deal_manager': [
      '<li>Create and manage deals</li>',
      '<li>Accept and decline deals</li>',
      '<li>Handle assets and media</li>',
      '<li>Track deal performance</li>'
    ],
    'supplier_manager': [
      '<li>Add and manage suppliers</li>',
      '<li>Update supplier information</li>',
      '<li>View supplier-related data</li>'
    ],
    'media_manager': [
      '<li>Handle assets and media</li>',
      '<li>Upload and manage files</li>',
      '<li>Organize media content</li>'
    ],
    'commitment_manager': [
      '<li>Manage commitments</li>',
      '<li>Update commitment status</li>'
    ],
    'substore_manager': [
      '<li>Manage sub-stores (co-op only)</li>',
      '<li>Add and remove sub-stores</li>',
      '<li>Update sub-store information</li>'
    ],
    'viewer': [
      '<li>View account information</li>',
      '<li>Read-only access to data</li>',
    ]
  };
  
  return permissions[role] ? permissions[role].join('') : '<li>Basic account access</li>';
}
