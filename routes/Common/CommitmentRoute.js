const express = require('express');
const router = express.Router();
const Commitment = require('../../models/Commitments');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Get all commitments
router.get('/', async (req, res) => {
  try {
    // Log the action
    await logCollaboratorAction(req, 'view_commitments', 'commitments list');
    
    const commitments = await Commitment.find().populate('userId dealId');
    res.json(commitments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new commitment
router.post('/', async (req, res) => {
  try {
    const newCommitment = new Commitment(req.body);
    const savedCommitment = await newCommitment.save();
    
    // Log the action
    await logCollaboratorAction(req, 'create_commitment', 'commitment', {
      dealTitle: req.body.dealTitle || 'Unknown Deal',
    });
    
    res.status(201).json(savedCommitment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// {{ Additional CRUD operations can be added here }}

module.exports = router; 