const { google } = require('googleapis');
const User = require('../models/User');
const Deal = require('../models/Deals');
const Commitment = require('../models/Commitments');
const Announcement = require('../models/Announcments');
const Favorite = require('../models/Favorite');
const Log = require('../models/Logs');

// Initialize Google Sheets Auth
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json', // You'll need to create this
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getFormattedData() {
    try {
        // Fetch data from all models
        const [users, deals, commitments, announcements, favorites, logs] = await Promise.all([
            User.find({}).lean(),
            Deal.find({}).lean(),
            Commitment.find({}).lean(),
            Announcement.find({}).lean(),
            Favorite.find({}).lean(),
            Log.find({}).lean()
        ]);

        return {
            users: users.map(user => ({
                ...user,
                password: '[REDACTED]', // Don't backup sensitive data
                _id: user._id.toString()
            })),
            deals: deals.map(deal => ({
                ...deal,
                _id: deal._id.toString(),
                distributor: deal.distributor?.toString()
            })),
            commitments: commitments.map(commitment => ({
                ...commitment,
                _id: commitment._id.toString(),
                userId: commitment.userId?.toString(),
                dealId: commitment.dealId?.toString()
            })),
            announcements: announcements.map(announcement => ({
                ...announcement,
                _id: announcement._id.toString(),
                author: announcement.author?.toString()
            })),
            favorites: favorites.map(favorite => ({
                ...favorite,
                _id: favorite._id.toString(),
                userId: favorite.userId?.toString(),
                dealId: favorite.dealId?.toString()
            })),
            logs: logs.map(log => ({
                ...log,
                _id: log._id.toString(),
                user_id: log.user_id?.toString()
            }))
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

async function backupToGoogleSheets() {
    try {
        // Log the service account email and check credentials
        try {
            const credentials = require('../credentials.json');
            console.log('Credentials loaded successfully');
            console.log('Service Account Email:', credentials.client_email);
            console.log('Project ID:', credentials.project_id);
        } catch (credError) {
            console.error('Error loading credentials:', credError.message);
            throw new Error('Failed to load credentials.json');
        }

        console.log('Starting backup process...');
        console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);
        
        // Get auth client with error handling
        let authClient;
        try {
            authClient = await auth.getClient();
            console.log('Auth client created successfully');
        } catch (authError) {
            console.error('Auth client creation failed:', authError.message);
            throw authError;
        }

        const sheets = google.sheets({ version: 'v4', auth: authClient });
        console.log('Sheets client created successfully');
        
        // Test sheet access with more detailed error logging
        try {
            const testAccess = await sheets.spreadsheets.get({
                spreadsheetId: process.env.GOOGLE_SHEET_ID
            });
            console.log('Successfully accessed sheet:', testAccess.data.properties.title);
            console.log('Sheet permissions:', testAccess.data.properties.permissions);
        } catch (sheetError) {
            console.error('Error accessing sheet. Full error:', JSON.stringify(sheetError, null, 2));
            throw sheetError;
        }

        const data = await getFormattedData();
        console.log('Data fetched successfully');
        
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        // First, ensure all required sheets exist
        const existingSheets = await sheets.spreadsheets.get({
            spreadsheetId
        });

        const existingSheetTitles = existingSheets.data.sheets.map(
            sheet => sheet.properties.title
        );

        // Create sheets if they don't exist
        for (const collectionName of Object.keys(data)) {
            if (!existingSheetTitles.includes(collectionName)) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: collectionName
                                }
                            }
                        }]
                    }
                });
            }
        }

        // Backup each collection to its sheet
        for (const [collectionName, documents] of Object.entries(data)) {
            if (documents.length === 0) continue;

            // Clear existing content
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `${collectionName}!A:ZZ`,
            });

            const values = [
                // Header row
                Object.keys(documents[0] || {}),
                // Data rows
                ...documents.map(doc => {
                    const row = Object.values(doc);
                    // Convert any remaining objects or arrays to strings
                    return row.map(value => 
                        typeof value === 'object' ? JSON.stringify(value) : value
                    );
                })
            ];

            // Update with new data
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${collectionName}!A1`,
                valueInputOption: 'RAW',
                resource: { values },
            });

            // Add timestamp of last backup
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${collectionName}!A${values.length + 2}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[`Last backup: ${new Date().toLocaleString()}`]]
                },
            });
        }

        console.log('Backup completed successfully:', new Date().toLocaleString());
    } catch (error) {
        console.error('Backup failed:', error);
        throw error;
    }
}

module.exports = backupToGoogleSheets; 