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
        { id: 'Description', title: 'Special Comment' },
        { id: 'Size', title: 'Size (Format: "Size1:OrigCost1:DiscPrice1;Size2:OrigCost2:DiscPrice2")' },
        { id: 'Category', title: 'Category' },
        { id: 'Deal Start Date (YYYY-MM-DD)', title: 'Deal Start Date (YYYY-MM-DD)' },
        { id: 'Deal End Date (YYYY-MM-DD)', title: 'Deal End Date (YYYY-MM-DD)' },
        { id: 'Min Quantity for Discount', title: 'Min Quantity for Discount' },
        { id: 'Discount Tiers', title: 'Discount Tiers (Format: "Qty1:Discount1%;Qty2:Discount2%")' },
        { id: 'Single Store Deals', title: 'Single Store Deals' },
        { id: 'Image URLs', title: 'Image URLs (Separate with ; or leave empty for default category images)' }
    ];

    const csvWriter = createCsvWriter({
        path: 'template.csv',
        header: headers
    });

    // Sample deals data with multiple sizes and discount tiers
    const sampleDeals = [
        {
            'Name': 'Premium Wine Pack',
            'Description': 'Exclusive selection of premium wines',
            'Size': '750ml:29.99:24.99;1.5L:49.99:42.99;375ml:15.99:13.99',
            'Category': 'Wine',
            'Deal Start Date (YYYY-MM-DD)': '2025-05-15',
            'Deal End Date (YYYY-MM-DD)': '2025-06-31',
            'Min Quantity for Discount': 50,
            'Discount Tiers': '75:5%;100:10%;200:15%',
            'Single Store Deals': 'Store A: Special offer details',
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
    if (!row.category?.trim()) errors.push('Category is required');
    if (!row.minQtyForDiscount?.toString().trim()) errors.push('Minimum Quantity for Discount is required');
    
    // Validate sizes (now in format "Size1:OrigCost1:DiscPrice1;Size2:OrigCost2:DiscPrice2")
    if (!row.sizes) {
        errors.push('At least one size is required');
    } else {
        const sizeEntries = row.sizes.split(';').filter(entry => entry.trim());
        if (sizeEntries.length === 0) {
            errors.push('At least one size is required');
        } else {
            for (const sizeEntry of sizeEntries) {
                const [size, originalCost, discountPrice] = sizeEntry.split(':').map(item => item?.trim());
                
                if (!size || !originalCost || !discountPrice) {
                    errors.push(`Size format incorrect for "${sizeEntry}". Required format: "Size:OrigCost:DiscPrice"`);
                    continue;
                }
                
                // Validate price values
                const origCostNum = Number(originalCost);
                const discPriceNum = Number(discountPrice);
                
                if (isNaN(origCostNum)) {
                    errors.push(`Original cost for size "${size}" must be a valid number, got: "${originalCost}"`);
                } else if (origCostNum < 0) {
                    errors.push(`Original cost for size "${size}" cannot be negative`);
                }
                
                if (isNaN(discPriceNum)) {
                    errors.push(`Discount price for size "${size}" must be a valid number, got: "${discountPrice}"`);
                } else if (discPriceNum < 0) {
                    errors.push(`Discount price for size "${size}" cannot be negative`);
                }
                
                // Validate price relationship
                if (!isNaN(origCostNum) && !isNaN(discPriceNum) && discPriceNum >= origCostNum) {
                    errors.push(`Discount price (${discPriceNum}) for size "${size}" must be less than original cost (${origCostNum})`);
                }
            }
        }
    }
    
    // Validate discount tiers if provided
    if (row.discountTiers) {
        const tierEntries = row.discountTiers.split(';').filter(entry => entry.trim());
        
        if (tierEntries.length > 0) {
            // Parse minimum quantity for validation
            const minQty = Number(row.minQtyForDiscount);
            
            let prevQty = 0;
            let prevDiscount = 0;
            
            for (const tierEntry of tierEntries) {
                const [qtyStr, discountStr] = tierEntry.split(':').map(item => item?.trim());
                
                // Validate format
                if (!qtyStr || !discountStr) {
                    errors.push(`Tier format incorrect for "${tierEntry}". Required format: "Quantity:Discount%"`);
                    continue;
                }
                
                // Remove % sign if present
                const discount = Number(discountStr.replace('%', ''));
                const qty = Number(qtyStr);
                
                // Validate values
                if (isNaN(qty)) {
                    errors.push(`Tier quantity must be a valid number, got: "${qtyStr}"`);
                } else if (qty < 0) {
                    errors.push(`Tier quantity cannot be negative`);
                } else if (qty <= minQty) {
                    errors.push(`Tier quantity (${qty}) must be greater than minimum quantity for discount (${minQty})`);
                }
                
                if (isNaN(discount)) {
                    errors.push(`Tier discount must be a valid number, got: "${discountStr}"`);
                } else if (discount <= 0 || discount >= 100) {
                    errors.push(`Tier discount must be between 0 and 100%, got: "${discount}%"`);
                }
                
                // Check progression
                if (qty <= prevQty && prevQty > 0) {
                    errors.push(`Tier quantities must increase in order. Got ${qty} after ${prevQty}`);
                }
                
                if (discount <= prevDiscount && prevDiscount > 0) {
                    errors.push(`Tier discounts must increase in order. Got ${discount}% after ${prevDiscount}%`);
                }
                
                prevQty = qty;
                prevDiscount = discount;
            }
        }
    }
    
    // Validate minimum quantity
    if (row.minQtyForDiscount) {
        const minQty = Number(row.minQtyForDiscount);
        if (isNaN(minQty)) {
            errors.push(`Min Quantity for Discount must be a valid number, got: "${row.minQtyForDiscount}"`);
        } else if (minQty < 1) {
            errors.push(`Min Quantity for Discount must be at least 1`);
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
        'Category',
        'Deal Start Date (YYYY-MM-DD)',
        'Deal End Date (YYYY-MM-DD)',
        'Min Quantity for Discount',
        'Discount Tiers',
        'Single Store Deals',
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
                            sizes: row['Size'] || '',
                            category: row['Category'] || '',
                            dealStartAt: row['Deal Start Date (YYYY-MM-DD)'] || '',
                            dealEndsAt: row['Deal End Date (YYYY-MM-DD)'] || '',
                            singleStoreDeals: row['Single Store Deals'] || '',
                            minQtyForDiscount: row['Min Quantity for Discount'] || '',
                            discountTiers: row['Discount Tiers'] || '',
                            images: row['Image URLs'] || ''
                        };

                        // Validate the normalized row
                        const rowErrors = validateDealRow(normalizedRow);
                        if (rowErrors.length > 0) {
                            errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}`);
                            return;
                        }

                        // Process sizes (format: "Size1:OrigCost1:DiscPrice1;Size2:OrigCost2:DiscPrice2")
                        const sizes = [];
                        if (normalizedRow.sizes) {
                            const sizeEntries = normalizedRow.sizes.split(';').filter(entry => entry.trim());
                            for (const sizeEntry of sizeEntries) {
                                const [size, originalCost, discountPrice] = sizeEntry.split(':').map(item => item?.trim());
                                sizes.push({
                                    size: size,
                                    originalCost: Number(originalCost),
                                    discountPrice: Number(discountPrice)
                                });
                            }
                        }

                        // Process discount tiers (format: "Qty1:Discount1%;Qty2:Discount2%")
                        const discountTiers = [];
                        if (normalizedRow.discountTiers) {
                            const tierEntries = normalizedRow.discountTiers.split(';').filter(entry => entry.trim());
                            for (const tierEntry of tierEntries) {
                                const [qtyStr, discountStr] = tierEntry.split(':').map(item => item?.trim());
                                const discount = Number(discountStr.replace('%', ''));
                                discountTiers.push({
                                    tierQuantity: Number(qtyStr),
                                    tierDiscount: discount
                                });
                            }
                            // Sort tiers by quantity
                            discountTiers.sort((a, b) => a.tierQuantity - b.tierQuantity);
                        }

                        deals.push({
                            name: normalizedRow.name.trim(),
                            description: normalizedRow.description.trim(),
                            sizes: sizes,
                            category: normalizedRow.category.trim(),
                            dealEndsAt: normalizedRow.dealEndsAt ? new Date(normalizedRow.dealEndsAt.toString().trim()) : null,
                            dealStartAt: normalizedRow.dealStartAt ? new Date(normalizedRow.dealStartAt.toString().trim()) : null,
                            singleStoreDeals: normalizedRow.singleStoreDeals.trim(),
                            minQtyForDiscount: Number(normalizedRow.minQtyForDiscount.toString().trim()),
                            discountTiers: discountTiers,
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
