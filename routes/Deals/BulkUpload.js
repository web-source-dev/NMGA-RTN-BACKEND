const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const User = require('../../models/User');
const { isDistributorAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');
const { getCommitmentDates, getDealTimeframe, getDeadline, MONTHS } = require('../../utils/monthMapping');

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
router.get('/template', isDistributorAdmin, async (req, res) => {
    const headers = [
        { id: 'Name', title: 'Name' },
        { id: 'Description', title: 'Special Comment' },
        { id: 'Category', title: 'Category' },
        { id: 'Deal Month', title: 'Deal Month (e.g., January)' },
        { id: 'Deal Year', title: 'Deal Year (e.g., 2025)' },
        { id: 'Min Quantity for Discount', title: 'Min Quantity for Discount' },
        { id: 'Single Store Deals', title: 'Single Store Deals' },
        { id: 'Image URLs', title: 'Image URLs (Separate with ; or leave empty for default category images)' },
        // Size columns - up to 5 sizes supported
        { id: 'Size 1', title: 'Size 1' },
        { id: 'Bottle Label 1', title: 'Bottle Label 1 (Optional)' },
        { id: 'Original Cost 1', title: 'Original Case Cost 1' },
        { id: 'Discount Price 1', title: 'Promo Case Cost 1' },
        { id: 'Bottles Per Case 1', title: '# of Bottles Per Case 1' },
        { id: 'Discount Tiers 1', title: 'Discount Tiers 1 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 2', title: 'Size 2' },
        { id: 'Bottle Label 2', title: 'Bottle Label 2 (Optional)' },
        { id: 'Original Cost 2', title: 'Original Case Cost 2' },
        { id: 'Discount Price 2', title: 'Promo Case Cost 2' },
        { id: 'Bottles Per Case 2', title: '# of Bottles Per Case 2' },
        { id: 'Discount Tiers 2', title: 'Discount Tiers 2 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 3', title: 'Size 3' },
        { id: 'Bottle Label 3', title: 'Bottle Label 3 (Optional)' },
        { id: 'Original Cost 3', title: 'Original Case Cost 3' },
        { id: 'Discount Price 3', title: 'Promo Case Cost 3' },
        { id: 'Bottles Per Case 3', title: '# of Bottles Per Case 3' },
        { id: 'Discount Tiers 3', title: 'Discount Tiers 3 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 4', title: 'Size 4' },
        { id: 'Bottle Label 4', title: 'Bottle Label 4 (Optional)' },
        { id: 'Original Cost 4', title: 'Original Case Cost 4' },
        { id: 'Discount Price 4', title: 'Promo Case Cost 4' },
        { id: 'Bottles Per Case 4', title: '# of Bottles Per Case 4' },
        { id: 'Discount Tiers 4', title: 'Discount Tiers 4 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 5', title: 'Size 5' },
        { id: 'Bottle Label 5', title: 'Bottle Label 5 (Optional)' },
        { id: 'Original Cost 5', title: 'Original Case Cost 5' },
        { id: 'Discount Price 5', title: 'Promo Case Cost 5' },
        { id: 'Bottles Per Case 5', title: '# of Bottles Per Case 5' },
        { id: 'Discount Tiers 5', title: 'Discount Tiers 5 (Format: Qty1-Disc1,Qty2-Disc2)' }
    ];

    const csvWriter = createCsvWriter({
        path: 'template.csv',
        header: headers
    });

    // Sample deals data with multiple sizes and per-size discount tiers
    const currentYear = new Date().getFullYear();
    const sampleDeals = [
        {
            'Name': 'Premium Wine Pack',
            'Description': 'Exclusive selection of premium wines',
            'Category': 'Wine',
            'Deal Month': 'October',
            'Deal Year': currentYear.toString(),
            'Min Quantity for Discount': 50,
            'Single Store Deals': 'Store A: Special offer details',
            'Image URLs': defaultImages['Wine'].join(';'),
            'Size 1': '750ml',
            'Bottle Label 1': 'Premium Red Wine',
            'Original Cost 1': '29.99',
            'Discount Price 1': '24.99',
            'Bottles Per Case 1': '12',
            'Discount Tiers 1': '75-23.99,100-22.99',
            'Size 2': '1.5L',
            'Bottle Label 2': 'Premium Red Wine Large',
            'Original Cost 2': '49.99',
            'Discount Price 2': '42.99',
            'Bottles Per Case 2': '6',
            'Discount Tiers 2': '75-39.99,100-38.99',
            'Size 3': '',
            'Bottle Label 3': '',
            'Original Cost 3': '',
            'Discount Price 3': '',
            'Bottles Per Case 3': '',
            'Discount Tiers 3': '',
            'Size 4': '',
            'Bottle Label 4': '',
            'Original Cost 4': '',
            'Discount Price 4': '',
            'Bottles Per Case 4': '',
            'Discount Tiers 4': '',
            'Size 5': '',
            'Bottle Label 5': '',
            'Original Cost 5': '',
            'Discount Price 5': '',
            'Bottles Per Case 5': '',
            'Discount Tiers 5': ''
        }
    ];

    // Log the action
    await logCollaboratorAction(req, 'download_deals_template', 'deals template');

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

// Helper function to get month index from month name
function getMonthIndex(monthName) {
    return MONTHS.indexOf(monthName);
}

// Helper function to get month name from month index
function getMonthName(monthIndex) {
    return MONTHS[monthIndex];
}

// Helper function to get deal month row data using global utility
function getDealMonthRow(month, year) {
    const monthIndex = getMonthIndex(month);
    if (monthIndex === -1) return null;
    
    const commitmentDates = getCommitmentDates(month, year);
    const dealTimeframe = getDealTimeframe(month, year);
    const deadline = getDeadline(month, year);
    
    return {
        month,
        year,
        deadline: new Date(deadline),
        timeframeStart: new Date(dealTimeframe.timeframeStart + 'T00:00:00'),
        timeframeEnd: new Date(dealTimeframe.timeframeEnd + 'T23:59:59'),
        commitmentStart: new Date(commitmentDates.commitmentStart + 'T00:00:00'),
        commitmentEnd: new Date(commitmentDates.commitmentEnd + 'T23:59:59')
    };
}

// Add this validation function for new CSV format
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
    
    // Validate sizes - check up to 5 size columns
    let hasValidSize = false;
    for (let i = 1; i <= 5; i++) {
        const size = row[`size${i}`]?.trim();
        const originalCost = row[`originalCost${i}`]?.trim();
        const discountPrice = row[`discountPrice${i}`]?.trim();
        const discountTiers = row[`discountTiers${i}`]?.trim();
        
        // If any size field is filled, all must be filled
        if (size || originalCost || discountPrice) {
            if (!size || !originalCost || !discountPrice) {
                errors.push(`Size ${i}: If you provide size information, all fields (Size, Original Case Cost, Promo Case Cost) are required`);
                continue;
            }
            
            hasValidSize = true;
            
            // Validate price values
            const origCostNum = Number(originalCost);
            const discPriceNum = Number(discountPrice);
            
            if (isNaN(origCostNum)) {
                errors.push(`Size ${i}: Original Case Cost must be a valid number, got: "${originalCost}"`);
            } else if (origCostNum < 0) {
                errors.push(`Size ${i}: Original Case Cost cannot be negative`);
            }
            
            if (isNaN(discPriceNum)) {
                errors.push(`Size ${i}: Promo Case Cost must be a valid number, got: "${discountPrice}"`);
            } else if (discPriceNum < 0) {
                errors.push(`Size ${i}: Promo Case Cost cannot be negative`);
            }
            
            // Validate price relationship
            if (!isNaN(origCostNum) && !isNaN(discPriceNum) && discPriceNum >= origCostNum) {
                errors.push(`Size ${i}: Promo Case Cost (${discPriceNum}) must be less than Original Case Cost (${origCostNum})`);
            }
            
            // Validate discount tiers if provided
            if (discountTiers) {
                const tierEntries = discountTiers.split(',').map(tier => tier.trim()).filter(tier => tier);
                if (tierEntries.length > 0) {
                    const minQty = Number(row.minQtyForDiscount);
                    let prevQty = 0;
                    let prevDiscount = 0; 
                    
                    for (const tierEntry of tierEntries) {
                        const [qtyStr, discountStr] = tierEntry.split('-').map(item => item?.trim());
                        
                        if (!qtyStr || !discountStr) {
                            errors.push(`Size ${i}: Tier format incorrect for "${tierEntry}". Required format: "Quantity-DiscountPrice"`);
                            continue;
                        }
                        
                        const qty = Number(qtyStr);
                        const discount = Number(discountStr);
                        
                        if (isNaN(qty)) {
                            errors.push(`Size ${i}: Tier quantity must be a valid number, got: "${qtyStr}"`);
                        } else if (qty < 0) {
                            errors.push(`Size ${i}: Tier quantity cannot be negative`);
                        } else if (qty < minQty) {
                            errors.push(`Size ${i}: Tier quantity (${qty}) must be greater than or equal to minimum quantity for discount (${minQty})`);
                        }
                        
                        if (isNaN(discount)) {
                            errors.push(`Size ${i}: Tier discount must be a valid number, got: "${discountStr}"`);
                        } else if (discount < 0) {
                            errors.push(`Size ${i}: Tier discount cannot be negative`);
                        }
                        
                        // Check progression
                        if (qty <= prevQty && prevQty > 0) {
                            errors.push(`Size ${i}: Tier quantities must increase in order. Got ${qty} after ${prevQty}`);
                        }
                        // For discount prices, higher quantities should have lower prices (better deals)
                        if (discount >= prevDiscount && prevDiscount > 0) {
                            errors.push(`Size ${i}: Tier discount prices should decrease as quantities increase (better deals for higher quantities). Got ${discount} after ${prevDiscount}`);
                        }
                        
                        prevQty = qty;
                        prevDiscount = discount;
                    }
                }
            }
        }
    }
    
    if (!hasValidSize) {
        errors.push('At least one size is required');
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
    
    // Validate month/year
    if (!row.dealMonth || !row.dealYear) {
        errors.push('Deal Month and Deal Year are required');
    } else {
        const validMonths = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        if (!validMonths.includes(row.dealMonth.trim())) {
            errors.push(`Invalid Deal Month: "${row.dealMonth}". Must be one of: ${validMonths.join(', ')}`);
        }
        const yearNum = Number(row.dealYear);
        const currentYear = new Date().getFullYear();
        if (isNaN(yearNum) || yearNum < currentYear) {
            errors.push(`Invalid Deal Year: "${row.dealYear}". Must be a valid year >= ${currentYear}`);
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
        'Category',
        'Deal Month',
        'Deal Year',
        'Min Quantity for Discount',
        'Single Store Deals',
        'Image URLs',
        // Size columns
        'Size 1', 'Bottle Label 1', 'Original Cost 1', 'Discount Price 1', 'Bottles Per Case 1', 'Discount Tiers 1',
        'Size 2', 'Bottle Label 2', 'Original Cost 2', 'Discount Price 2', 'Bottles Per Case 2', 'Discount Tiers 2',
        'Size 3', 'Bottle Label 3', 'Original Cost 3', 'Discount Price 3', 'Bottles Per Case 3', 'Discount Tiers 3',
        'Size 4', 'Bottle Label 4', 'Original Cost 4', 'Discount Price 4', 'Bottles Per Case 4', 'Discount Tiers 4',
        'Size 5', 'Bottle Label 5', 'Original Cost 5', 'Discount Price 5', 'Bottles Per Case 5', 'Discount Tiers 5'
    ],
    trim: true,
    skipEmptyLines: true
};

// Route to handle bulk upload
router.post('/upload', isDistributorAdmin, upload.single('file'), async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const distributorId = currentUser.id;
        
        console.log(`Distributor ID: ${distributorId} is attempting to upload a file.`); // Log distributor ID

        // Fetch user information if needed
        const user = await User.findById(distributorId);
        if (!user) {
            console.error(`User not found for ID: ${distributorId}`);
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
                            category: row['Category'] || '',
                            dealMonth: row['Deal Month'] || '',
                            dealYear: row['Deal Year'] || '',
                            singleStoreDeals: row['Single Store Deals'] || '',
                            minQtyForDiscount: row['Min Quantity for Discount'] || '',
                            images: row['Image URLs'] || '',
                            // Size fields
                            size1: row['Size 1'] || '',
                            bottleLabel1: row['Bottle Label 1'] || '',
                            originalCost1: row['Original Cost 1'] || '',
                            discountPrice1: row['Discount Price 1'] || '',
                            bottlesPerCase1: row['Bottles Per Case 1'] || '1',
                            discountTiers1: row['Discount Tiers 1'] || '',
                            size2: row['Size 2'] || '',
                            bottleLabel2: row['Bottle Label 2'] || '',
                            originalCost2: row['Original Cost 2'] || '',
                            discountPrice2: row['Discount Price 2'] || '',
                            bottlesPerCase2: row['Bottles Per Case 2'] || '1',
                            discountTiers2: row['Discount Tiers 2'] || '',
                            size3: row['Size 3'] || '',
                            bottleLabel3: row['Bottle Label 3'] || '',
                            originalCost3: row['Original Cost 3'] || '',
                            discountPrice3: row['Discount Price 3'] || '',
                            bottlesPerCase3: row['Bottles Per Case 3'] || '1',
                            discountTiers3: row['Discount Tiers 3'] || '',
                            size4: row['Size 4'] || '',
                            bottleLabel4: row['Bottle Label 4'] || '',
                            originalCost4: row['Original Cost 4'] || '',
                            discountPrice4: row['Discount Price 4'] || '',
                            bottlesPerCase4: row['Bottles Per Case 4'] || '1',
                            discountTiers4: row['Discount Tiers 4'] || '',
                            size5: row['Size 5'] || '',
                            bottleLabel5: row['Bottle Label 5'] || '',
                            originalCost5: row['Original Cost 5'] || '',
                            discountPrice5: row['Discount Price 5'] || '',
                            bottlesPerCase5: row['Bottles Per Case 5'] || '1',
                            discountTiers5: row['Discount Tiers 5'] || ''
                        };

                        // Validate the normalized row
                        const rowErrors = validateDealRow(normalizedRow);
                        // Calculate dates from month/year - the CSV specifies the delivery month
                        // but we need to create the deal for the actual month (previous month)
                        const deliveryMonth = normalizedRow.dealMonth.trim();
                        const deliveryYear = parseInt(normalizedRow.dealYear);
                        
                        // Get the previous month (actual deal month)
                        const monthIndex = getMonthIndex(deliveryMonth);
                        if (monthIndex === -1) {
                            rowErrors.push(`Invalid Deal Month: ${deliveryMonth}`);
                        } else {
                            let actualMonthIndex = monthIndex - 1;
                            let actualYear = deliveryYear;
                            
                            // Handle year rollover
                            if (actualMonthIndex < 0) {
                                actualMonthIndex = 11; // December
                                actualYear = deliveryYear - 1;
                            }
                            
                            const actualMonthName = getMonthName(actualMonthIndex);
                            const monthRow = getDealMonthRow(actualMonthName, actualYear);
                            
                            if (!monthRow) {
                                rowErrors.push(`Invalid Deal Month/Year: ${deliveryMonth} ${deliveryYear}`);
                            } else {
                                // Store monthRow for use below
                                normalizedRow._monthRow = monthRow;
                            }
                        }
                        if (rowErrors.length > 0) {
                            errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}`);
                            return;
                        }

                        // Process sizes from individual columns
                        const sizes = [];
                        for (let i = 1; i <= 5; i++) {
                            const size = normalizedRow[`size${i}`]?.trim();
                            const bottleLabel = normalizedRow[`bottleLabel${i}`]?.trim();
                            const originalCost = normalizedRow[`originalCost${i}`]?.trim();
                            const discountPrice = normalizedRow[`discountPrice${i}`]?.trim();
                            const bottlesPerCase = normalizedRow[`bottlesPerCase${i}`]?.trim() || '1';
                            const discountTiersStr = normalizedRow[`discountTiers${i}`]?.trim();
                            
                            if (size && originalCost && discountPrice) {
                                let discountTiers = [];
                                if (discountTiersStr) {
                                    discountTiers = discountTiersStr.split(',').map(tier => {
                                        const [qty, disc] = tier.split('-').map(x => x.trim());
                                        return {
                                            tierQuantity: Number(qty),
                                            tierDiscount: Number(disc)
                                        };
                                    }).filter(tier => !isNaN(tier.tierQuantity) && !isNaN(tier.tierDiscount));
                                    discountTiers.sort((a, b) => a.tierQuantity - b.tierQuantity);
                                }
                                
                                sizes.push({
                                    size: size,
                                    name: bottleLabel || '', // Bottle label is optional
                                    originalCost: Number(originalCost),
                                    discountPrice: Number(discountPrice),
                                    bottlesPerCase: Number(bottlesPerCase) || 1,
                                    discountTiers: discountTiers
                                });
                            }
                        }

                        // Use calculated dates from the monthRow stored in normalizedRow
                        const monthRow = normalizedRow._monthRow;
                        if (!monthRow) {
                            rowErrors.push(`Could not calculate dates for month: ${normalizedRow.dealMonth} ${normalizedRow.dealYear}`);
                            return;
                        }
                        
                        deals.push({
                            name: normalizedRow.name.trim(),
                            description: normalizedRow.description.trim(),
                            sizes: sizes,
                            category: normalizedRow.category.trim(),
                            dealEndsAt: monthRow.timeframeEnd,
                            dealStartAt: monthRow.timeframeStart,
                            commitmentStartAt: monthRow.commitmentStart,
                            commitmentEndsAt: monthRow.commitmentEnd,
                            singleStoreDeals: normalizedRow.singleStoreDeals.trim(),
                            minQtyForDiscount: Number(normalizedRow.minQtyForDiscount.toString().trim()),
                            images: normalizedRow.images ? 
                                normalizedRow.images.split(';')
                                    .map(url => url.trim())
                                    .filter(url => url) : 
                                (defaultImages[normalizedRow.category.trim()] || defaultImages.default),
                            distributor: distributorId,
                            status: 'active',
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
            
            // Log validation errors
            await logCollaboratorAction(req, 'bulk_upload_validation_errors', 'deals bulk upload', {
                additionalInfo: `${errors.length} validation errors found`
            });
            
            return res.status(400).json({ 
                message: 'Validation errors found in CSV file', 
                errors 
            });
        }

        // Check if any deals were processed
        if (deals.length === 0) {
            console.error('No valid deals found in the CSV file.');
            
            // Log no deals found
            await logCollaboratorAction(req, 'bulk_upload_no_deals', 'deals bulk upload', {
                additionalInfo: 'No valid deals found in CSV file'
            });
            
            return res.status(400).json({ 
                message: 'No valid deals found in the CSV file. Please check the file format and try again.',
                errors: ['Make sure to follow the template format and fill in all required fields']
            });
        }

        // Insert the deals
        await Deal.insertMany(deals);
        console.log(`${deals.length} deals uploaded successfully.`); // Log successful upload

        // Log the action
        await logCollaboratorAction(req, 'bulk_upload_deals', 'deals bulk upload', {
            additionalInfo: `Successfully uploaded ${deals.length} deals`,
            fileName: req.file.originalname
        });

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
        
        // Log the error
        await logError(req, 'bulk_upload_deals', 'deals bulk upload', error, {
            fileName: req.file?.originalname
        });
        
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
