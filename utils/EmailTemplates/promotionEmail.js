const promotionEmail = (name, promotionDetails) => {
  return `
    Hi ${name},

    We have an exciting promotion for you: ${promotionDetails}

    Don't miss out on this limited-time offer!

    Best regards,
    The Team
  `;
};

module.exports = promotionEmail;
