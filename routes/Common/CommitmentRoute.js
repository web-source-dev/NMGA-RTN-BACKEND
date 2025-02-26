const express = require('express');
const router = express.Router();
const Commitment = require('../../models/Commitments');

// Get all commitments
router.get('/', async (req, res) => {
  try {
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
    res.status(201).json(savedCommitment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// {{ Additional CRUD operations can be added here }}

module.exports = router; 