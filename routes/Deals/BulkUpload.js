const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const User = require('../../models/User');
const Log = require('../../models/Logs');
const { isDistributorAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

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
        { id: 'Size', title: 'Size (Format: "Size1:OrigCost1:DiscPrice1:Qty1-Disc1,Qty2-Disc2;Size2:OrigCost2:DiscPrice2:Qty1-Disc1")' },
        { id: 'Category', title: 'Category' },
        { id: 'Deal Month', title: 'Deal Month (e.g., January)' },
        { id: 'Deal Year', title: 'Deal Year (e.g., 2025)' },
        { id: 'Min Quantity for Discount', title: 'Min Quantity for Discount' },
        { id: 'Single Store Deals', title: 'Single Store Deals' },
        { id: 'Image URLs', title: 'Image URLs (Separate with ; or leave empty for default category images)' }
    ];

    const csvWriter = createCsvWriter({
        path: 'template.csv',
        header: headers
    });

    // Sample deals data with multiple sizes and per-size discount tiers
    const sampleDeals = [
        {
            'Name': 'Premium Wine Pack',
            'Description': 'Exclusive selection of premium wines',
            'Size': '750ml:29.99:24.99:75-23.99,100-22.99;1.5L:49.99:42.99:50-39.99',
            'Category': 'Wine',
            'Deal Month': 'May',
            'Deal Year': '2025',
            'Min Quantity for Discount': 50,
            'Single Store Deals': 'Store A: Special offer details',
            'Image URLs': defaultImages['Wine'].join(';')
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

// --- Utility: Month/Year to Deal/Commitment Dates (New Mexico timezone) ---
const DEAL_MONTHS_TABLE = (() => {
    // Get current date in New Mexico timezone (Mountain Time)
    const newMexicoTime = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
    const currentDate = new Date(newMexicoTime);
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const table = [];
    
    // Helper function to create New Mexico timezone dates
    const createNewMexicoDate = (year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) => {
        // Create the date in local timezone first
        const date = new Date(year, month, day, hour, minute, second, millisecond);
        return date;
    };
    
    // Generate for current year and next year
    for (let year = currentYear; year <= currentYear + 2; year++) {
        months.forEach((month, monthIndex) => {
            // Skip past months in current year
            if (year === currentYear && monthIndex < currentMonth) {
                return;
            }
            
            // Calculate deadline (3 days before the month starts) - New Mexico time
            const monthStart = createNewMexicoDate(year, monthIndex, 1);
            const deadline = new Date(monthStart);
            deadline.setDate(deadline.getDate() - 3); // 3 days before month starts
            
            // Deal timeframe is the complete month (1st to last day) - New Mexico time
            const timeframeStart = createNewMexicoDate(year, monthIndex, 1, 0, 0, 0, 0); // 1st day at 12:00 AM New Mexico time
            // Get the last day of the current month
            const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
            const timeframeEnd = createNewMexicoDate(year, monthIndex, lastDayOfMonth, 23, 59, 59, 999); // Last day at 11:59 PM New Mexico time
            
            // Commitment timeframe based on the provided table - New Mexico time
            let commitmentStart, commitmentEnd;
            
            if (month === 'July' && year === 2025) {
                commitmentStart = createNewMexicoDate(2025, 5, 29, 0, 0, 0, 0); // Jun 29, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2025, 6, 10, 23, 59, 59, 999); // Jul 10, 2025 at 11:59 PM New Mexico time
            } else if (month === 'August' && year === 2025) {
                commitmentStart = createNewMexicoDate(2025, 7, 1, 0, 0, 0, 0); // Aug 1, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2025, 7, 12, 23, 59, 59, 999); // Aug 12, 2025 at 11:59 PM New Mexico time
            } else if (month === 'September' && year === 2025) {
                commitmentStart = createNewMexicoDate(2025, 8, 1, 0, 0, 0, 0); // Sep 1, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2025, 8, 10, 23, 59, 59, 999); // Sep 10, 2025 at 11:59 PM New Mexico time
            } else if (month === 'October' && year === 2025) {
                commitmentStart = createNewMexicoDate(2025, 9, 1, 0, 0, 0, 0); // Oct 1, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2025, 9, 11, 23, 59, 59, 999); // Oct 11, 2025 at 11:59 PM New Mexico time
            } else if (month === 'November' && year === 2025) {
                commitmentStart = createNewMexicoDate(2025, 10, 1, 0, 0, 0, 0); // Nov 1, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2025, 10, 10, 23, 59, 59, 999); // Nov 10, 2025 at 11:59 PM New Mexico time
            } else if (month === 'December' && year === 2025) {
                commitmentStart = createNewMexicoDate(2025, 11, 1, 0, 0, 0, 0); // Dec 1, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2025, 11, 10, 23, 59, 59, 999); // Dec 10, 2025 at 11:59 PM New Mexico time
            } else if (month === 'January' && year === 2026) {
                commitmentStart = createNewMexicoDate(2025, 11, 29, 0, 0, 0, 0); // Dec 29, 2025 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 0, 9, 23, 59, 59, 999); // Jan 9, 2026 at 11:59 PM New Mexico time
            } else if (month === 'February' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 1, 2, 0, 0, 0, 0); // Feb 2, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 1, 12, 23, 59, 59, 999); // Feb 12, 2026 at 11:59 PM New Mexico time
            } else if (month === 'March' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 2, 2, 0, 0, 0, 0); // Mar 2, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 2, 12, 23, 59, 59, 999); // Mar 12, 2026 at 11:59 PM New Mexico time
            } else if (month === 'April' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 3, 1, 0, 0, 0, 0); // Apr 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 3, 10, 23, 59, 59, 999); // Apr 10, 2026 at 11:59 PM New Mexico time
            } else if (month === 'May' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 3, 30, 0, 0, 0, 0); // Apr 30, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 4, 11, 23, 59, 59, 999); // May 11, 2026 at 11:59 PM New Mexico time
            } else if (month === 'June' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 5, 1, 0, 0, 0, 0); // Jun 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 5, 11, 23, 59, 59, 999); // Jun 11, 2026 at 11:59 PM New Mexico time
            } else if (month === 'July' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 5, 29, 0, 0, 0, 0); // Jun 29, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 6, 10, 23, 59, 59, 999); // Jul 10, 2026 at 11:59 PM New Mexico time
            } else if (month === 'August' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 7, 1, 0, 0, 0, 0); // Aug 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 7, 12, 23, 59, 59, 999); // Aug 12, 2026 at 11:59 PM New Mexico time
            } else if (month === 'September' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 8, 1, 0, 0, 0, 0); // Sep 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 8, 10, 23, 59, 59, 999); // Sep 10, 2026 at 11:59 PM New Mexico time
            } else if (month === 'October' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 9, 1, 0, 0, 0, 0); // Oct 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 9, 11, 23, 59, 59, 999); // Oct 11, 2026 at 11:59 PM New Mexico time
            } else if (month === 'November' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 10, 1, 0, 0, 0, 0); // Nov 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 10, 10, 23, 59, 59, 999); // Nov 10, 2026 at 11:59 PM New Mexico time
            } else if (month === 'December' && year === 2026) {
                commitmentStart = createNewMexicoDate(2026, 11, 1, 0, 0, 0, 0); // Dec 1, 2026 at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(2026, 11, 10, 23, 59, 59, 999); // Dec 10, 2026 at 11:59 PM New Mexico time
            } else {
                // Default: commitment period is first 10 days of the month
                commitmentStart = createNewMexicoDate(year, monthIndex, 1, 0, 0, 0, 0); // 1st day at 12:00 AM New Mexico time
                commitmentEnd = createNewMexicoDate(year, monthIndex, 10, 23, 59, 59, 999); // 10th day at 11:59 PM New Mexico time
            }
            
            table.push({
                month,
                year,
                deadline: deadline,
                timeframeStart: timeframeStart,
                timeframeEnd: timeframeEnd,
                commitmentStart: commitmentStart,
                commitmentEnd: commitmentEnd
            });
        });
    }
    
    return table;
})();

function getDealMonthRow(month, year) {
    return DEAL_MONTHS_TABLE.find(row =>
        row.month.toLowerCase() === month.toLowerCase() && Number(row.year) === Number(year)
    );
}

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
        if (isNaN(yearNum) || yearNum < 2024) {
            errors.push(`Invalid Deal Year: "${row.dealYear}". Must be a valid year >= 2024`);
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
        'Deal Month',
        'Deal Year',
        'Min Quantity for Discount',
        'Single Store Deals',
        'Image URLs'
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
                            sizes: row['Size'] || '',
                            category: row['Category'] || '',
                            dealMonth: row['Deal Month'] || '',
                            dealYear: row['Deal Year'] || '',
                            singleStoreDeals: row['Single Store Deals'] || '',
                            minQtyForDiscount: row['Min Quantity for Discount'] || '',
                            images: row['Image URLs'] || ''
                        };

                        // Validate the normalized row
                        const rowErrors = validateDealRow(normalizedRow);
                        // Calculate dates from month/year
                        const monthRow = getDealMonthRow(normalizedRow.dealMonth, normalizedRow.dealYear);
                        if (!monthRow) {
                            rowErrors.push(`Invalid Deal Month/Year: ${normalizedRow.dealMonth} ${normalizedRow.dealYear}`);
                        }
                        if (rowErrors.length > 0) {
                            errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}`);
                            return;
                        }

                        // Process sizes (format: "Size:OrigCost:DiscPrice:Qty1-Disc1,Qty2-Disc2")
                        const sizes = [];
                        if (normalizedRow.sizes) {
                            const sizeEntries = normalizedRow.sizes.split(';').filter(entry => entry.trim());
                            for (const sizeEntry of sizeEntries) {
                                const parts = sizeEntry.split(':').map(item => item?.trim());
                                const [size, originalCost, discountPrice, tiersStr] = parts;
                                let discountTiers = [];
                                if (tiersStr) {
                                    discountTiers = tiersStr.split(',').map(tier => {
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
                                    originalCost: Number(originalCost),
                                    discountPrice: Number(discountPrice),
                                    discountTiers: discountTiers
                                });
                            }
                        }

                        // Use calculated dates
                        deals.push({
                            name: normalizedRow.name.trim(),
                            description: normalizedRow.description.trim(),
                            sizes: sizes,
                            category: normalizedRow.category.trim(),
                            dealEndsAt: monthRow ? monthRow.timeframeEnd : null,
                            dealStartAt: monthRow ? monthRow.timeframeStart : null,
                            commitmentStartAt: monthRow ? monthRow.commitmentStart : null,
                            commitmentEndsAt: monthRow ? monthRow.commitmentEnd : null,
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
        await logCollaboratorAction(req, 'bulk_upload_deals_failed', 'deals bulk upload', {
            additionalInfo: `Error: ${error.message}`
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
