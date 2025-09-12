const express = require('express');
const router = express.Router();
const { 
    getAllFeatures,
    getVisibleFeatures, 
    enableFeature, 
    disableFeature, 
    enableAllFeatures, 
    disableAllFeatures,
    isFeatureEnabled
} = require('../../config/features');
const { isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Get features that should be shown on the management page
router.get('/', isAdmin, async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_feature_management', 'feature management');
        
        const features = await getVisibleFeatures();
        res.json({
            success: true,
            features
        });
    } catch (error) {
        console.error('Error fetching features:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching features'
        });
    }
});

// Get all features (including hidden ones) - for admin purposes
router.get('/all', isAdmin, async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_all_features', 'feature management');
        
        const features = await getAllFeatures();
        res.json({
            success: true,
            features
        });
    } catch (error) {
        console.error('Error fetching all features:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching all features'
        });
    }
});

// Enable a specific feature
router.post('/enable/:featureName', isAdmin, async (req, res) => {
    try {
        const { featureName } = req.params;
        const { currentUser } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        // Log the action
        await logCollaboratorAction(req, 'enable_feature', 'feature management', {
            featureName,
            additionalInfo: `Feature '${featureName}' enabled`
        });
        
        const success = await enableFeature(featureName, userId);
        
        if (success) {
            res.json({
                success: true,
                message: `Feature '${featureName}' enabled successfully`
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Feature '${featureName}' not found`
            });
        }
    } catch (error) {
        console.error('Error enabling feature:', error);
        res.status(500).json({
            success: false,
            message: 'Error enabling feature'
        });
    }
});

// Disable a specific feature
router.post('/disable/:featureName', isAdmin, async (req, res) => {
    try {
        const { featureName } = req.params;
        const { currentUser } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        // Log the action
        await logCollaboratorAction(req, 'disable_feature', 'feature management', {
            featureName,
            additionalInfo: `Feature '${featureName}' disabled`
        });
        
        const success = await disableFeature(featureName, userId);
        
        if (success) {
            res.json({
                success: true,
                message: `Feature '${featureName}' disabled successfully`
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Feature '${featureName}' not found`
            });
        }
    } catch (error) {
        console.error('Error disabling feature:', error);
        res.status(500).json({
            success: false,
            message: 'Error disabling feature'
        });
    }
});

// Enable all features
router.post('/enable-all', isAdmin, async (req, res) => {
    try {
        const { currentUser } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        // Log the action
        await logCollaboratorAction(req, 'enable_all_features', 'feature management', {
            additionalInfo: 'All features enabled'
        });
        
        await enableAllFeatures(userId);
        
        res.json({
            success: true,
            message: 'All features enabled successfully'
        });
    } catch (error) {
        console.error('Error enabling all features:', error);
        res.status(500).json({
            success: false,
            message: 'Error enabling all features'
        });
    }
});

// Disable all features
router.post('/disable-all', isAdmin, async (req, res) => {
    try {
        const { currentUser } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        // Log the action
        await logCollaboratorAction(req, 'disable_all_features', 'feature management', {
            additionalInfo: 'All features disabled'
        });
        
        await disableAllFeatures(userId);
        
        res.json({
            success: true,
            message: 'All features disabled successfully'
        });
    } catch (error) {
        console.error('Error disabling all features:', error);
        res.status(500).json({
            success: false,
            message: 'Error disabling all features'
        });
    }
});

// Check if a specific feature is enabled
router.get('/status/:featureName', isAdmin, async (req, res) => {
    try {
        const { featureName } = req.params;
        const enabled = await isFeatureEnabled(featureName);
        
        res.json({
            success: true,
            featureName,
            enabled
        });
    } catch (error) {
        console.error('Error checking feature status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking feature status'
        });
    }
});

module.exports = router;
