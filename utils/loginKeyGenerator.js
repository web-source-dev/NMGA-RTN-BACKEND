const crypto = require('crypto');

/**
 * Generates a unique login key for user authentication
 * @param {number} length - Length of the login key (default: 64)
 * @returns {string} - A unique login key
 */
const generateLoginKey = (length = 64) => {
  // Generate a random alphanumeric string with the specified length
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generates a cryptographically secure login key using crypto module
 * @param {number} length - Length of the login key (default: 64)
 * @returns {string} - A cryptographically secure unique login key
 */
const generateSecureLoginKey = (length = 64) => {
  // Generate random bytes and convert to alphanumeric string
  const bytes = crypto.randomBytes(length);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
};

/**
 * Validates if a login key has the correct format
 * @param {string} loginKey - The login key to validate
 * @param {number} expectedLength - Expected length of the login key (default: 64)
 * @returns {boolean} - True if valid, false otherwise
 */
const validateLoginKey = (loginKey, expectedLength = 64) => {
  if (!loginKey || typeof loginKey !== 'string') {
    return false;
  }
  
  // Check if it's an alphanumeric string with the correct length
  const alphanumericRegex = new RegExp(`^[A-Za-z0-9]{${expectedLength}}$`);
  return alphanumericRegex.test(loginKey);
};

/**
 * Generates a unique login key and ensures it doesn't already exist in the database
 * @param {Object} User - Mongoose User model
 * @param {number} length - Length of the login key (default: 64)
 * @param {number} maxAttempts - Maximum attempts to generate unique key (default: 10)
 * @returns {Promise<string>} - A unique login key
 */
const generateUniqueLoginKey = async (User, length = 64, maxAttempts = 10) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const loginKey = generateSecureLoginKey(length);
    
    // Check if this login key already exists
    const existingUser = await User.findOne({ login_key: loginKey });
    if (!existingUser) {
      return loginKey;
    }
  }
  
  // If we couldn't generate a unique key after max attempts, throw an error
  throw new Error(`Failed to generate unique login key after ${maxAttempts} attempts`);
};

module.exports = {
  generateLoginKey,
  generateSecureLoginKey,
  validateLoginKey,
  generateUniqueLoginKey
};
