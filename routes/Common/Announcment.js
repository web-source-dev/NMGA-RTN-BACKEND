const express = require('express');
const router = express.Router();
const Log = require('../../models/Logs');
const Announcement = require('../../models/Announcments');

router.get('/latest', async (req, res) => {
    try {
        const announcements = await Announcement.find({
            isActive: true,
            startTime: { $lte: new Date() },
            endTime: { $gte: new Date() }
        }).sort({ priority: -1, createdAt: -1 }).limit(1);
        res.json(announcements[0]);
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.get('/event/:event', async (req, res) => {
    const { event } = req.params;
    try {
        const announcements = await Announcement.find({
            event,
            isActive: true,
            startTime: { $lte: new Date() },
            endTime: { $gte: new Date() }
        }).sort({ priority: -1, createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.get('/all', async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.post('/create', async (req, res) => {
    const { title, content, author, category, tags, isActive, priority, event, startTime, endTime } = req.body;
    try {
        const newAnnouncement = new Announcement({
            title,
            content,
            author,
            category,
            tags,
            isActive,
            priority,
            event,
            startTime,
            endTime
        });
        await newAnnouncement.save();
        res.status(201).json({ message: 'Announcement created successfully', announcement: newAnnouncement });
        await Log.create({ 
            message: `Announcement "${title}" created by ${author.name}`, 
            type: 'success', 
            user_id: req.body.author 
        });
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    try {
        const announcement = await Announcement.findByIdAndUpdate(id, { isActive }, { new: true });
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        res.json({ message: 'Announcement updated successfully', announcement });
        await Log.create({ 
            message: `Announcement "${announcement.title}" ${isActive ? 'activated' : 'deactivated'}`, 
            type: 'info', 
            user_id: null 
        });
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, author, category, tags, isActive, priority, event, startTime, endTime } = req.body;
    try {
        const announcement = await Announcement.findByIdAndUpdate(id, {
            title,
            content,
            author,
            category,
            tags,
            isActive,
            priority,
            event,
            startTime,
            endTime
        }, { new: true });
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        res.json({ message: 'Announcement updated successfully', announcement });
        await Log.create({ 
            message: `Announcement "${announcement.title}" updated with new content`, 
            type: 'info', 
            user_id: null 
        });
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const announcement = await Announcement.findByIdAndDelete(id);
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        res.json({ message: 'Announcement deleted successfully' });
        await Log.create({ 
            message: `Announcement "${announcement.title}" permanently deleted`, 
            type: 'info', 
            user_id: null 
        });
    } catch (error) {
        if (!res.headersSent) {
            await Log.create({
                message: `Failed to process announcement operation - Error: ${error.message}`,
                type: 'error',
                user_id: null
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

module.exports = router;