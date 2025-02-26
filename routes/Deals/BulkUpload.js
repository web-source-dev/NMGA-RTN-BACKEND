const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const User = require('../../models/User');

// Configure multer for file upload with error handling
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure uploads directory exists
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// Update the default image mapping with reliable placeholder URLs
const defaultImages = {
    'Wine': [
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png'
    ],
    'Beer': [
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png'
    ],
    'Spirits': [
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png'
    ],
    'default': [
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png'
    ]
};

// Route to download CSV template
router.get('/template', (req, res) => {
    const headers = [
        { id: 'Name', title: 'Name' },
        { id: 'Description', title: 'Description' },
        { id: 'Size', title: 'Size' },
        { id: 'Original Cost', title: 'Original Cost' },
        { id: 'Discount Price', title: 'Discount Price' },
        { id: 'Category', title: 'Category' },
        { id: 'Deal End Date (YYYY-MM-DD)', title: 'Deal End Date (YYYY-MM-DD)' },
        { id: 'Min Quantity for Discount', title: 'Min Quantity for Discount' },
        { id: 'Image URLs', title: 'Image URLs (Separate with ; or leave empty for default category images)' }
    ];

    const csvWriter = createCsvWriter({
        path: 'template.csv',
        header: headers
    });

    // Sample deals data
    const sampleDeals = [
        {
            'Name': 'Premium Wine Pack',
            'Description': 'Exclusive selection of premium wines',
            'Size': '750ml',
            'Original Cost': 29.99,
            'Discount Price': 24.99,
            'Category': 'Wine',
            'Deal End Date (YYYY-MM-DD)': '2024-12-31',
            'Min Quantity for Discount': 50,
            'Image URLs': defaultImages['Wine'].join(';')
        }
    ];

    // Write template with sample deals
    csvWriter.writeRecords(sampleDeals)
        .then(() => {
            res.download('template.csv', 'deals_template.csv', (err) => {
                if (err) {
                    console.error(err);
                }
                // Clean up: delete the template file after sending
                fs.unlinkSync('template.csv');
            });
        });
});

// Add this validation function
const validateDealRow = (row) => {
    const errors = [];
    
    // Check if row is empty
    if (Object.values(row).every(value => !value)) {
        return ['Empty row detected - please remove empty rows'];
    }

    // Required field validation with trimming
    if (!row.name?.trim()) errors.push('Name is required');
    if (!row.size?.trim()) errors.push('Size is required');
    if (!row.originalCost?.toString().trim()) errors.push('Original Cost is required');
    if (!row.discountPrice?.toString().trim()) errors.push('Discount Price is required');
    if (!row.minQtyForDiscount?.toString().trim()) errors.push('Minimum Quantity for Discount is required');
    
    // Number field validation with better error messages
    const numberFields = {
        'Original Cost': row.originalCost,
        'Discount Price': row.discountPrice,
        'Min Quantity for Discount': row.minQtyForDiscount
    };

    for (const [fieldName, value] of Object.entries(numberFields)) {
        if (value) {
            const numValue = Number(value.toString().trim());
            if (isNaN(numValue)) {
                errors.push(`${fieldName} must be a valid number, got: "${value}"`);
            } else if (numValue < 0) {
                errors.push(`${fieldName} cannot be negative`);
            }
        }
    }
    
    // Validate discount price is less than original cost
    if (row.originalCost && row.discountPrice) {
        const originalCost = Number(row.originalCost);
        const discountPrice = Number(row.discountPrice);
        if (discountPrice >= originalCost) {
            errors.push('Discount Price must be less than Original Cost');
        }
    }
    
    // Date validation with better error message
    if (row.dealEndsAt) {
        const dateValue = row.dealEndsAt.toString().trim();
        if (dateValue && isNaN(Date.parse(dateValue))) {
            errors.push(`Deal End Date must be in YYYY-MM-DD format, got: "${dateValue}"`);
        }
    }

    // Image URLs validation
    if (row.images) {
        const urls = row.images.split(';').map(url => url.trim()).filter(url => url);
        for (const url of urls) {
            try {
                new URL(url); // Validate URL format
            } catch (e) {
                errors.push(`Invalid image URL format: "${url}"`);
            }
        }
    }

    return errors;
};

// Update the CSV parsing options
const csvOptions = {
    skipLines: 1,
    headers: [
        'Name',
        'Description',
        'Size',
        'Original Cost',
        'Discount Price',
        'Category',
        'Deal End Date (YYYY-MM-DD)',
        'Min Quantity for Discount',
        'Image URLs'
    ],
    trim: true,
    skipEmptyLines: true
};

// Route to handle bulk upload
router.post('/upload/:userId', upload.single('file'), async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`User ID: ${userId} is attempting to upload a file.`); // Log user ID

        // Fetch user information if needed
        const user = await User.findById(userId);
        if (!user) {
            console.error(`User not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User not found' });
        }
        console.log(`User found: ${user.email}`); // Log user email

        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('File content preview:');
        const fileContent = fs.readFileSync(req.file.path, 'utf-8');
        console.log(fileContent.split('\n').slice(0, 5));

        const deals = [];
        const errors = [];
        let rowNumber = 2; // Start at 2 because row 1 is headers
        let hasData = false;

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path, { encoding: 'utf-8' })
                .pipe(csv(csvOptions))
                .on('data', (row) => {
                    hasData = true;
                    console.log('Processing row:', row); // Log each row being processed

                    try {
                        // Skip completely empty rows
                        if (Object.values(row).every(value => !value)) {
                            console.log('Skipping empty row');
                            return;
                        }

                        // Normalize field names (handle case sensitivity)
                        const normalizedRow = {
                            name: row['Name'] || '',
                            description: row['Description'] || '',
                            size: row['Size'] || '',
                            originalCost: row['Original Cost'] || '',
                            discountPrice: row['Discount Price'] || '',
                            category: row['Category'] || '',
                            dealEndsAt: row['Deal End Date (YYYY-MM-DD)'] || '',
                            minQtyForDiscount: row['Min Quantity for Discount'] || '',
                            images: row['Image URLs'] || ''
                        };

                        // Validate the normalized row
                        const rowErrors = validateDealRow(normalizedRow);
                        if (rowErrors.length > 0) {
                            errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}`);
                            return;
                        }

                        deals.push({
                            name: normalizedRow.name.trim(),
                            description: normalizedRow.description.trim(),
                            size: normalizedRow.size.trim(),
                            originalCost: Number(normalizedRow.originalCost.toString().trim()),
                            discountPrice: Number(normalizedRow.discountPrice.toString().trim()),
                            category: normalizedRow.category.trim(),
                            dealEndsAt: normalizedRow.dealEndsAt ? new Date(normalizedRow.dealEndsAt.toString().trim()) : null,
                            minQtyForDiscount: Number(normalizedRow.minQtyForDiscount.toString().trim()),
                            images: normalizedRow.images ? 
                                normalizedRow.images.split(';')
                                    .map(url => url.trim())
                                    .filter(url => url) : 
                                (defaultImages[normalizedRow.category.trim()] || defaultImages.default),
                            distributor: userId,
                            status: 'active',
                            soldQuantity: 0,
                            totalSoldPrice: 0,
                            views: 0,
                            impressions: 0,
                            notificationHistory: new Map()
                        });
                    } catch (error) {
                        errors.push(`Row ${rowNumber}: Unexpected error - ${error.message}`);
                    }
                    rowNumber++;
                })
                .on('end', () => {
                    if (!hasData) {
                        console.error('The CSV file appears to be empty or contains only headers');
                        errors.push('The CSV file appears to be empty or contains only headers');
                    }
                    resolve();
                })
                .on('error', (error) => {
                    console.error('CSV parsing error:', error);
                    reject(error);
                });
        });

        // Check if there were any errors during processing
        if (errors.length > 0) {
            console.error('Validation errors found in CSV file:', errors);
            return res.status(400).json({ 
                message: 'Validation errors found in CSV file', 
                errors 
            });
        }

        // Check if any deals were processed
        if (deals.length === 0) {
            console.error('No valid deals found in the CSV file.');
            return res.status(400).json({ 
                message: 'No valid deals found in the CSV file. Please check the file format and try again.',
                errors: ['Make sure to follow the template format and fill in all required fields']
            });
        }

        // Insert the deals
        await Deal.insertMany(deals);
        console.log(`${deals.length} deals uploaded successfully.`); // Log successful upload

        // Clean up: delete the uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
            else console.log('Uploaded file deleted successfully.');
        });

        res.json({ 
            message: 'Deals uploaded successfully', 
            count: deals.length 
        });

    } catch (error) {
        console.error('Upload error:', error); // Log the error
        // Clean up file on error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }

        res.status(500).json({ 
            message: 'Error uploading deals', 
            errors: [error.message]
        });
    }
});

module.exports = router;
