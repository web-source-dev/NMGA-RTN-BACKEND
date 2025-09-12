const express = require("express");
const router = express.Router();
const ContactUs = require("../models/contactus");
const { isAdmin } = require("../middleware/auth");
const { logCollaboratorAction } = require("../utils/collaboratorLogger");

// Update contact status
router.patch("/status/:id", isAdmin, async (req, res) => {
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
      await logCollaboratorAction(req, 'update_contact_status_failed', 'contact', { 
        contactId: id,
        additionalInfo: 'Contact not found'
      });
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    await logCollaboratorAction(req, 'update_contact_status', 'contact', { 
      contactId: id,
      contactName: updatedContact.name,
      contactEmail: updatedContact.email,
      newStatus: status,
      additionalInfo: `Updated contact status to "${status}" for "${updatedContact.name}"`
    });

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedContact
    });

  } catch (error) {
    console.error("Error updating contact status:", error);
    await logCollaboratorAction(req, 'update_contact_status_failed', 'contact', { 
      contactId: req.params.id,
      additionalInfo: `Error: ${error.message}`
    });
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

    await logCollaboratorAction(req, 'submit_contact_form', 'contact', { 
      contactName: name,
      contactEmail: email,
      subject: subject,
      userRole: user_role,
      additionalInfo: `Contact form submitted by ${name} (${user_role}) - Subject: "${subject}"`
    });

    res.status(201).json({
      success: true,
      message: "Contact form submitted successfully",
      data: newContact
    });

  } catch (error) {
    console.error("Error in contact form submission:", error);
    await logCollaboratorAction(req, 'submit_contact_form_failed', 'contact', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({
      success: false,
      message: "Error submitting contact form",
      error: error.message
    });
  }
});

// Get all contact form submissions (for admin)
router.get("/all", isAdmin, async (req, res) => {
  try {
    const contacts = await ContactUs.find()
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 });

    await logCollaboratorAction(req, 'view_all_contacts', 'contacts', { 
      totalContacts: contacts.length,
      additionalInfo: `Viewed all contact form submissions (${contacts.length} total)`
    });

    res.status(200).json({
      success: true,
      data: contacts
    });

  } catch (error) {
    console.error("Error fetching contact forms:", error);
    await logCollaboratorAction(req, 'view_all_contacts_failed', 'contacts', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({
      success: false,
      message: "Error fetching contact forms",
      error: error.message
    });
  }
});

module.exports = router;