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
        { id: 'Original Cost 1', title: 'Original Cost 1' },
        { id: 'Discount Price 1', title: 'Discount Price 1' },
        { id: 'Discount Tiers 1', title: 'Discount Tiers 1 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 2', title: 'Size 2' },
        { id: 'Bottle Label 2', title: 'Bottle Label 2 (Optional)' },
        { id: 'Original Cost 2', title: 'Original Cost 2' },
        { id: 'Discount Price 2', title: 'Discount Price 2' },
        { id: 'Discount Tiers 2', title: 'Discount Tiers 2 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 3', title: 'Size 3' },
        { id: 'Bottle Label 3', title: 'Bottle Label 3 (Optional)' },
        { id: 'Original Cost 3', title: 'Original Cost 3' },
        { id: 'Discount Price 3', title: 'Discount Price 3' },
        { id: 'Discount Tiers 3', title: 'Discount Tiers 3 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 4', title: 'Size 4' },
        { id: 'Bottle Label 4', title: 'Bottle Label 4 (Optional)' },
        { id: 'Original Cost 4', title: 'Original Cost 4' },
        { id: 'Discount Price 4', title: 'Discount Price 4' },
        { id: 'Discount Tiers 4', title: 'Discount Tiers 4 (Format: Qty1-Disc1,Qty2-Disc2)' },
        { id: 'Size 5', title: 'Size 5' },
        { id: 'Bottle Label 5', title: 'Bottle Label 5 (Optional)' },
        { id: 'Original Cost 5', title: 'Original Cost 5' },
        { id: 'Discount Price 5', title: 'Discount Price 5' },
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
            'Discount Tiers 1': '75-23.99,100-22.99',
            'Size 2': '1.5L',
            'Bottle Label 2': 'Premium Red Wine Large',
            'Original Cost 2': '49.99',
            'Discount Price 2': '42.99',
            'Discount Tiers 2': '75-39.99,100-38.99',
            'Size 3': '',
            'Bottle Label 3': '',
            'Original Cost 3': '',
            'Discount Price 3': '',
            'Discount Tiers 3': '',
            'Size 4': '',
            'Bottle Label 4': '',
            'Original Cost 4': '',
            'Discount Price 4': '',
            'Discount Tiers 4': '',
            'Size 5': '',
            'Bottle Label 5': '',
            'Original Cost 5': '',
            'Discount Price 5': '',
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
            // Skip past months in current year (but allow current month and future months)
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

// Helper function to get month index from month name
function getMonthIndex(monthName) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.indexOf(monthName);
}

// Helper function to get month name from month index
function getMonthName(monthIndex) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
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
                errors.push(`Size ${i}: If you provide size information, all fields (Size, Original Cost, Discount Price) are required`);
                continue;
            }
            
            hasValidSize = true;
            
            // Validate price values
            const origCostNum = Number(originalCost);
            const discPriceNum = Number(discountPrice);
            
            if (isNaN(origCostNum)) {
                errors.push(`Size ${i}: Original cost must be a valid number, got: "${originalCost}"`);
            } else if (origCostNum < 0) {
                errors.push(`Size ${i}: Original cost cannot be negative`);
            }
            
            if (isNaN(discPriceNum)) {
                errors.push(`Size ${i}: Discount price must be a valid number, got: "${discountPrice}"`);
            } else if (discPriceNum < 0) {
                errors.push(`Size ${i}: Discount price cannot be negative`);
            }
            
            // Validate price relationship
            if (!isNaN(origCostNum) && !isNaN(discPriceNum) && discPriceNum >= origCostNum) {
                errors.push(`Size ${i}: Discount price (${discPriceNum}) must be less than original cost (${origCostNum})`);
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
        'Size 1', 'Bottle Label 1', 'Original Cost 1', 'Discount Price 1', 'Discount Tiers 1',
        'Size 2', 'Bottle Label 2', 'Original Cost 2', 'Discount Price 2', 'Discount Tiers 2',
        'Size 3', 'Bottle Label 3', 'Original Cost 3', 'Discount Price 3', 'Discount Tiers 3',
        'Size 4', 'Bottle Label 4', 'Original Cost 4', 'Discount Price 4', 'Discount Tiers 4',
        'Size 5', 'Bottle Label 5', 'Original Cost 5', 'Discount Price 5', 'Discount Tiers 5'
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
                            discountTiers1: row['Discount Tiers 1'] || '',
                            size2: row['Size 2'] || '',
                            bottleLabel2: row['Bottle Label 2'] || '',
                            originalCost2: row['Original Cost 2'] || '',
                            discountPrice2: row['Discount Price 2'] || '',
                            discountTiers2: row['Discount Tiers 2'] || '',
                            size3: row['Size 3'] || '',
                            bottleLabel3: row['Bottle Label 3'] || '',
                            originalCost3: row['Original Cost 3'] || '',
                            discountPrice3: row['Discount Price 3'] || '',
                            discountTiers3: row['Discount Tiers 3'] || '',
                            size4: row['Size 4'] || '',
                            bottleLabel4: row['Bottle Label 4'] || '',
                            originalCost4: row['Original Cost 4'] || '',
                            discountPrice4: row['Discount Price 4'] || '',
                            discountTiers4: row['Discount Tiers 4'] || '',
                            size5: row['Size 5'] || '',
                            bottleLabel5: row['Bottle Label 5'] || '',
                            originalCost5: row['Original Cost 5'] || '',
                            discountPrice5: row['Discount Price 5'] || '',
                            discountTiers5: row['Discount Tiers 5'] || ''
                        };

                        // Validate the normalized row
                        const rowErrors = validateDealRow(normalizedRow);
                        // Calculate dates from month/year - create deal for the month BEFORE the specified month
                        const targetMonthRow = getDealMonthRow(normalizedRow.dealMonth, normalizedRow.dealYear);
                        if (!targetMonthRow) {
                            rowErrors.push(`Invalid Deal Month/Year: ${normalizedRow.dealMonth} ${normalizedRow.dealYear}`);
                        }
                        
                        // Get the actual month row for the previous month (delivery month)
                        let monthRow;
                        if (targetMonthRow) {
                            // Find the previous month row
                            const monthIndex = getMonthIndex(targetMonthRow.month);
                            const year = parseInt(targetMonthRow.year);
                            let prevMonthIndex = monthIndex - 1;
                            let prevYear = year;
                            
                            // Handle year rollover
                            if (prevMonthIndex < 0) {
                                prevMonthIndex = 11; // December
                                prevYear = year - 1;
                            }
                            
                            const prevMonthName = getMonthName(prevMonthIndex);
                            monthRow = getDealMonthRow(prevMonthName, prevYear.toString());
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
