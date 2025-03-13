const express = require("express");
const router = express.Router();
const ContactUs = require("../models/contactus");

// Update contact status
router.patch("/status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const updatedContact = await ContactUs.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedContact
    });

  } catch (error) {
    console.error("Error updating contact status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating contact status",
      error: error.message
    });
  }
});

// Create new contact form submission
router.post("/submit", async (req, res) => {
  try {
    const { user_id, user_role, name, email, subject, message } = req.body;

    if (!user_id || !user_role) {
      return res.status(401).json({
        success: false,
        message: "User ID and role are required"
      });
    }

    const newContact = new ContactUs({
      user_id,
      user_role,
      name,
      email,
      subject,
      message
    });

    await newContact.save();

    res.status(201).json({
      success: true,
      message: "Contact form submitted successfully",
      data: newContact
    });

  } catch (error) {
    console.error("Error in contact form submission:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting contact form",
      error: error.message
    });
  }
});

// Get all contact form submissions (for admin)
router.get("/all", async (req, res) => {
  try {
    const contacts = await ContactUs.find()
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contacts
    });

  } catch (error) {
    console.error("Error fetching contact forms:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching contact forms",
      error: error.message
    });
  }
});

module.exports = router;