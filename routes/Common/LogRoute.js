const express = require('express');
const router = express.Router();
const Log = require('../../models/Logs');
const { isAuthenticated, isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Route to get all logs with advanced filtering and pagination - admin only
router.get('/', isAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            type = '',
            severity = '',
            action = '',
            resource = '',
            role = '',
            status = '',
            isCollaborator = '',
            isImpersonating = '',
            fromDate = '',
            toDate = '',
            dateRange = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter query
        const filter = {};

        // Text search across multiple fields
        if (search) {
            filter.$or = [
                { message: { $regex: search, $options: 'i' } },
                { userName: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } },
                { action: { $regex: search, $options: 'i' } },
                { resource: { $regex: search, $options: 'i' } },
                { resourceName: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by type
        if (type) filter.type = type;

        // Filter by severity
        if (severity) filter.severity = severity;

        // Filter by action
        if (action) filter.action = action;

        // Filter by resource
        if (resource) filter.resource = resource;

        // Filter by user role
        if (role) filter.userRole = role;

        // Filter by status
        if (status) filter.status = status;

        // Filter by collaborator
        if (isCollaborator !== '') filter.isCollaborator = isCollaborator === 'true';

        // Filter by impersonation
        if (isImpersonating !== '') filter.isImpersonating = isImpersonating === 'true';

        // Date range filtering
        if (fromDate || toDate || dateRange) {
            filter.createdAt = {};
            
            if (dateRange) {
                const today = new Date();
                const pastDate = new Date();
                pastDate.setDate(today.getDate() - parseInt(dateRange));
                filter.createdAt.$gte = pastDate;
                filter.createdAt.$lte = today;
            } else {
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) {
                    const endDate = new Date(toDate);
                    endDate.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = endDate;
                }
            }
        }

        // Count total documents matching filter
        const totalLogs = await Log.countDocuments(filter);

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Fetch logs with pagination
        const logs = await Log.find(filter)
            .populate('user_id', 'name role email')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Map the results to handle null user_id cases
        const sanitizedLogs = logs.map(log => ({
            ...log,
            user_id: log.user_id || { name: 'System', role: 'System', email: 'system@nmga.com' }
        }));

        // Calculate statistics for the filtered dataset
        const stats = await Log.aggregate([
            { $match: filter },
            {
                $facet: {
                    byType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    bySeverity: [
                        { $group: { _id: '$severity', count: { $sum: 1 } } }
                    ],
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    todayCount: [
                        {
                            $match: {
                                createdAt: {
                                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                                    $lte: new Date(new Date().setHours(23, 59, 59, 999))
                                }
                            }
                        },
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        // Log the action
        await logCollaboratorAction(req, 'view_all_logs', 'system logs', {
            totalLogs: totalLogs,
            page: pageNum,
            limit: limitNum,
            filters: Object.keys(filter).length,
            additionalInfo: `Viewed system logs with ${Object.keys(filter).length} filters applied`
        });

        res.json({
            logs: sanitizedLogs,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalLogs / limitNum),
                totalItems: totalLogs,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(totalLogs / limitNum),
                hasPrevPage: pageNum > 1
            },
            stats: {
                total: totalLogs,
                byType: stats[0].byType.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                bySeverity: stats[0].bySeverity.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                byStatus: stats[0].byStatus.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                todayCount: stats[0].todayCount[0]?.count || 0
            }
        });
    } catch (err) {
        console.error('Error fetching logs:', err);
        await logError(req, 'view_all_logs', 'system logs', err);
        res.status(500).json({ 
            message: 'An error occurred while fetching logs',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Route to get logs for the current user with pagination
router.get('/user', isAuthenticated, async (req, res) => {
    try {
        const { currentUser } = getCurrentUserContext(req);
        const userId = currentUser.id;

        const {
            page = 1,
            limit = 10,
            type = '',
            severity = '',
            action = '',
            resource = '',
            fromDate = '',
            toDate = '',
            dateRange = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter query
        const filter = { user_id: userId };

        // Filter by type
        if (type) filter.type = type;

        // Filter by severity
        if (severity) filter.severity = severity;

        // Filter by action
        if (action) filter.action = action;

        // Filter by resource
        if (resource) filter.resource = resource;

        // Date range filtering
        if (fromDate || toDate || dateRange) {
            filter.createdAt = {};
            
            if (dateRange) {
                const today = new Date();
                const pastDate = new Date();
                pastDate.setDate(today.getDate() - parseInt(dateRange));
                filter.createdAt.$gte = pastDate;
                filter.createdAt.$lte = today;
            } else {
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) {
                    const endDate = new Date(toDate);
                    endDate.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = endDate;
                }
            }
        }

        // Count total documents matching filter
        const totalLogs = await Log.countDocuments(filter);

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Fetch logs with pagination
        const logs = await Log.find(filter)
            .populate('user_id', 'name role email')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Map the results to handle null user_id cases
        const sanitizedLogs = logs.map(log => ({
            ...log,
            user_id: log.user_id || { name: 'System', role: 'System', email: 'system@nmga.com' }
        }));

        // Log the action
        await logCollaboratorAction(req, 'view_user_logs', 'user logs', {
            totalLogs: totalLogs,
            page: pageNum,
            limit: limitNum
        });

        res.json({
            logs: sanitizedLogs,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalLogs / limitNum),
                totalItems: totalLogs,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(totalLogs / limitNum),
                hasPrevPage: pageNum > 1
            }
        });
    } catch (err) {
        console.error('Error fetching user logs:', err);
        await logError(req, 'view_user_logs', 'user logs', err);
        res.status(500).json({ 
            message: 'An error occurred while fetching user logs',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Route to get logs for a specific user with pagination - admin only
router.get('/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate userId format (assuming MongoDB ObjectId)
        if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const {
            page = 1,
            limit = 10,
            type = '',
            severity = '',
            action = '',
            resource = '',
            fromDate = '',
            toDate = '',
            dateRange = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter query
        const filter = { user_id: userId };

        // Filter by type
        if (type) filter.type = type;

        // Filter by severity
        if (severity) filter.severity = severity;

        // Filter by action
        if (action) filter.action = action;

        // Filter by resource
        if (resource) filter.resource = resource;

        // Date range filtering
        if (fromDate || toDate || dateRange) {
            filter.createdAt = {};
            
            if (dateRange) {
                const today = new Date();
                const pastDate = new Date();
                pastDate.setDate(today.getDate() - parseInt(dateRange));
                filter.createdAt.$gte = pastDate;
                filter.createdAt.$lte = today;
            } else {
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) {
                    const endDate = new Date(toDate);
                    endDate.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = endDate;
                }
            }
        }

        // Count total documents matching filter
        const totalLogs = await Log.countDocuments(filter);

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Fetch logs with pagination
        const logs = await Log.find(filter)
            .populate('user_id', 'name role email')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Map the results to handle null user_id cases
        const sanitizedLogs = logs.map(log => ({
            ...log,
            user_id: log.user_id || { name: 'System', role: 'System', email: 'system@nmga.com' }
        }));

        // Log the action
        await logCollaboratorAction(req, 'view_specific_user_logs', 'user logs', {
            targetUserId: userId,
            totalLogs: totalLogs,
            page: pageNum,
            limit: limitNum
        });

        res.json({
            logs: sanitizedLogs,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalLogs / limitNum),
                totalItems: totalLogs,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(totalLogs / limitNum),
                hasPrevPage: pageNum > 1
            }
        });
    } catch (err) {
        console.error('Error fetching user logs:', err);
        await logError(req, 'view_specific_user_logs', 'user logs', err, {
            targetUserId: req.params.userId
        });
        res.status(500).json({ 
            message: 'An error occurred while fetching user logs',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;
