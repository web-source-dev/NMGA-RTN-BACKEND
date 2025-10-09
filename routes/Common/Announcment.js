const express = require('express');
const router = express.Router();
const Announcement = require('../../models/Announcments');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction, logSystemAction, logError } = require('../../utils/collaboratorLogger');

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
            await logSystemAction('view_latest_announcement_failed', 'announcement', {
                message: `Failed to fetch latest announcement - Error: ${error.message}`,
                error: {
                    message: error.message,
                    stack: error.stack
                },
                severity: 'medium'
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
            await logSystemAction('view_event_announcements_failed', 'announcement', {
                message: `Failed to fetch announcements for event "${event}" - Error: ${error.message}`,
                error: {
                    message: error.message,
                    stack: error.stack
                },
                event,
                severity: 'medium'
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.get('/all', async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_announcements', 'announcements list');
        
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        if (!res.headersSent) {
            await logSystemAction('view_announcements_failed', 'announcement', {
                message: `Failed to fetch all announcements - Error: ${error.message}`,
                error: {
                    message: error.message,
                    stack: error.stack
                },
                severity: 'medium'
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.post('/create',isAdmin, async (req, res) => {
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
        
        // Log the action with user-friendly message
        await logCollaboratorAction(req, 'create_announcement', 'announcement', {
            title,
            category,
            event,
            resourceId: newAnnouncement._id
        });
        
        res.status(201).json({ message: 'Announcement created successfully', announcement: newAnnouncement });
    } catch (error) {
        if (!res.headersSent) {
            await logError(req, 'create_announcement', 'announcement', error, {
                title: req.body.title,
                category: req.body.category,
                event: req.body.event
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.patch('/:id',isAdmin, async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    try {
        const announcement = await Announcement.findByIdAndUpdate(id, { isActive }, { new: true });
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        
        // Log the action with user-friendly message
        await logCollaboratorAction(req, isActive ? 'activate_announcement' : 'deactivate_announcement', 'announcement', {
            title: announcement.title,
            resourceId: announcement._id,
            resourceName: announcement.title,
            isActive
        });
        
        res.json({ message: 'Announcement updated successfully', announcement });
    } catch (error) {
        if (!res.headersSent) {
            await logError(req, isActive ? 'activate_announcement' : 'deactivate_announcement', 'announcement', error, {
                announcementId: id,
                isActive: req.body.isActive
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.put('/:id',isAdmin, async (req, res) => {
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
        
        // Log the action with user-friendly message
        await logCollaboratorAction(req, 'update_announcement', 'announcement', {
            title: announcement.title,
            category,
            event,
            resourceId: announcement._id,
            resourceName: announcement.title
        });
        
        res.json({ message: 'Announcement updated successfully', announcement });
    } catch (error) {
        if (!res.headersSent) {
            await logError(req, 'update_announcement', 'announcement', error, {
                announcementId: id,
                title: req.body.title,
                category: req.body.category,
                event: req.body.event
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

router.delete('/:id',isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const announcement = await Announcement.findByIdAndDelete(id);
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        
        // Log the action with user-friendly message
        await logCollaboratorAction(req, 'delete_announcement', 'announcement', {
            title: announcement.title,
            resourceId: announcement._id,
            resourceName: announcement.title,
            category: announcement.category,
            event: announcement.event
        });
        
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        if (!res.headersSent) {
            await logError(req, 'delete_announcement', 'announcement', error, {
                announcementId: id
            });
            return res.status(500).json({ message: 'Server error, please try again' });
        }
    }
});

module.exports = router;