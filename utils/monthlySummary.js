const User = require('../models/User');
const Deal = require('../models/Deals');
const Commitment = require('../models/Commitments');
const Payment = require('../models/Paymentmodel');
const Log = require('../models/Logs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sendEmail = require('./email');
const MonthlySummaryTemplate = require('./EmailTemplates/MonthlySummaryTemplate');
const { logSystemAction } = require('./collaboratorLogger');

/**
 * Generate comprehensive monthly summary report (Previous Month Only)
 * @param {Date} reportMonthStart - Start date of the report month
 * @param {Date} reportMonthEnd - End date of the report month
 * @returns {Object} Monthly summary data
 */
const generateMonthlySummary = async (reportMonthStart, reportMonthEnd) => {
    try {
        // User Statistics (from previous month only)
        const [
            usersByRole
        ] = await Promise.all([
            // Users by role (from previous month)
            User.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: reportMonthStart,
                            $lte: reportMonthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Deal Statistics (Previous Month Only)
        // Filter deals where the deal timeframe overlaps with the previous month
        // A deal is in the previous month if dealStartAt <= reportMonthEnd AND dealEndsAt >= reportMonthStart
        const [
            totalDealsPreviousMonth,
            dealsByCategory
        ] = await Promise.all([
            // Total deals active in previous month (based on dealStartAt/dealEndsAt)
            Deal.countDocuments({
                $and: [
                    { dealStartAt: { $lte: reportMonthEnd } },
                    { dealEndsAt: { $gte: reportMonthStart } }
                ]
            }),
            // Deals by category (previous month) - based on deal timeframe
            Deal.aggregate([
                {
                    $match: {
                        $and: [
                            { dealStartAt: { $lte: reportMonthEnd } },
                            { dealEndsAt: { $gte: reportMonthStart } }
                        ]
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ])
        ]);

        // First, get deal IDs that were active in previous month (needed for commitment queries)
        // A deal is active in the previous month if its timeframe overlaps with the month
        const activeDealIds = await Deal.find({
            $and: [
                { dealStartAt: { $lte: reportMonthEnd } },
                { dealEndsAt: { $gte: reportMonthStart } }
            ]
        }).select('_id');
        
        const activeDealIdsArray = activeDealIds.map(deal => deal._id);
        
        // If no active deals, return empty summary structure
        if (activeDealIdsArray.length === 0) {
            return {
                reportPeriod: {
                    start: reportMonthStart,
                    end: reportMonthEnd,
                    monthName: reportMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' })
                },
                users: {
                    byRole: usersByRole
                },
                deals: {
                    total: 0,
                    byCategory: [],
                    allDealsForPDF: []
                },
                commitments: {
                    total: 0,
                    byStatus: [],
                    totalRevenue: 0,
                    totalQuantity: 0,
                    topDeals: [],
                    allDealsForPDF: [],
                    topMembers: [],
                    allMembersForPDF: []
                },
                activity: {
                    byType: [],
                    errors: 0,
                    warnings: 0,
                    mostRepeatedErrors: [],
                    mostRepeatedWarnings: []
                },
                generatedAt: new Date()
            };
        }

        // Commitment Statistics (Previous Month Only)
        // Get commitments for deals active in previous month
        const [
            totalCommitmentsPreviousMonth,
            totalCommitmentRevenue,
            totalCommitmentQuantity,
            commitmentsByStatus
        ] = await Promise.all([
            // Total commitments for deals active in previous month
            Commitment.countDocuments({
                dealId: { $in: activeDealIdsArray }
            }),
            // Total revenue from commitments for deals active in previous month
            Commitment.aggregate([
                {
                    $match: {
                        dealId: { $in: activeDealIdsArray },
                        status: 'approved'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalPrice' }
                    }
                }
            ]),
            // Total quantity committed for deals active in previous month
            Commitment.aggregate([
                {
                    $match: {
                        dealId: { $in: activeDealIdsArray },
                        status: 'approved'
                    }
                },
                {
                    $unwind: '$sizeCommitments'
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$sizeCommitments.quantity' }
                    }
                }
            ]),
            // Commitments by status for deals active in previous month
            Commitment.aggregate([
                {
                    $match: {
                        dealId: { $in: activeDealIdsArray }
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalRevenue: { $sum: '$totalPrice' }
                    }
                }
            ])
        ]);

        const totalRevenue = totalCommitmentRevenue[0]?.total || 0;
        const totalQuantity = totalCommitmentQuantity[0]?.total || 0;

        // Get all commitments for deals that were active in the previous month
        const allCommitmentsPreviousMonth = await Commitment.find({
            dealId: { $in: activeDealIdsArray }
        }).populate('dealId', 'name dealStartAt dealEndsAt').populate('userId', 'name email businessName');

        // Calculate deal approval status based on commitments
        const dealStatusMap = {};
        allCommitmentsPreviousMonth.forEach(commitment => {
            const dealId = commitment.dealId?._id?.toString();
            if (!dealId) return;

            if (!dealStatusMap[dealId]) {
                dealStatusMap[dealId] = {
                    dealId: dealId,
                    dealName: commitment.dealId?.name || 'Unknown Deal',
                    commitments: {
                        approved: 0,
                        declined: 0,
                        cancelled: 0,
                        pending: 0,
                        total: 0
                    },
                    quantities: {
                        approved: 0,
                        declined: 0,
                        cancelled: 0,
                        pending: 0
                    },
                    status: 'pending'
                };
            }

            const status = commitment.status || 'pending';
            dealStatusMap[dealId].commitments[status]++;
            dealStatusMap[dealId].commitments.total++;
            
            // Calculate quantities
            const sizeCommitments = commitment.modifiedByDistributor 
                ? commitment.modifiedSizeCommitments 
                : commitment.sizeCommitments;
            
            if (sizeCommitments && Array.isArray(sizeCommitments)) {
                const quantity = sizeCommitments.reduce((sum, size) => sum + (size.quantity || 0), 0);
                dealStatusMap[dealId].quantities[status] += quantity;
            }
        });

        // Determine final deal status
        // Approved: if all commitments are approved
        // Declined: if all commitments are declined OR all are cancelled
        Object.keys(dealStatusMap).forEach(dealId => {
            const deal = dealStatusMap[dealId];
            if (deal.commitments.total === 0) {
                deal.status = 'pending';
            } else if (deal.commitments.approved === deal.commitments.total) {
                deal.status = 'approved';
            } else if (deal.commitments.declined === deal.commitments.total || deal.commitments.cancelled === deal.commitments.total) {
                deal.status = 'declined';
            } else {
                deal.status = 'mixed';
            }
        });

        // Get all deals active in previous month (based on dealStartAt/dealEndsAt)
        const allDealsFromPreviousMonth = await Deal.find({
            $and: [
                { dealStartAt: { $lte: reportMonthEnd } },
                { dealEndsAt: { $gte: reportMonthStart } }
            ]
        }).populate('distributor', 'name businessName').select('name distributor _id');

        // Build complete deals list with status for PDF (include all deals, even without commitments)
        const dealsWithStatus = await Promise.all(
            allDealsFromPreviousMonth.map(async (dealDoc) => {
                const dealIdStr = dealDoc._id.toString();
                const dealStatus = dealStatusMap[dealIdStr];
                
                if (dealStatus) {
                    // Deal has commitments
                    return {
                        ...dealStatus,
                        distributorName: dealDoc.distributor?.businessName || dealDoc.distributor?.name || 'Unknown'
                    };
                } else {
                    // Deal has no commitments - status is pending
                    return {
                        dealId: dealIdStr,
                        dealName: dealDoc.name || 'Unknown Deal',
                        distributorName: dealDoc.distributor?.businessName || dealDoc.distributor?.name || 'Unknown',
                        commitments: {
                            approved: 0,
                            declined: 0,
                            cancelled: 0,
                            pending: 0,
                            total: 0
                        },
                        quantities: {
                            approved: 0,
                            declined: 0,
                            cancelled: 0,
                            pending: 0
                        },
                        status: 'pending'
                    };
                }
            })
        );

        // Top deals by commitments (previous month) - for email
        // Get commitments for deals active in previous month
        const commitmentsByDeal = await Commitment.aggregate([
            {
                $match: {
                    dealId: { $in: activeDealIdsArray }
                }
            },
            {
                $group: {
                    _id: '$dealId',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalPrice' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const topDealsWithNames = await Promise.all(
            commitmentsByDeal.map(async (deal) => {
                const dealDoc = await Deal.findById(deal._id).select('name distributor').populate('distributor', 'name businessName');
                const dealStatus = dealStatusMap[deal._id?.toString()] || { status: 'pending', quantities: {} };
                return {
                    dealName: dealDoc?.name || 'Unknown Deal',
                    distributorName: dealDoc?.distributor?.businessName || dealDoc?.distributor?.name || 'Unknown',
                    commitments: deal.count,
                    revenue: deal.totalRevenue,
                    status: dealStatus.status,
                    quantities: dealStatus.quantities
                };
            })
        );

        // All deals for PDF (sorted by commitments)
        const allDealsForPDF = [...dealsWithStatus]
            .sort((a, b) => b.commitments.total - a.commitments.total);

        // Top members by commitments (previous month) - for email
        // Get commitments for deals active in previous month
        const commitmentsByMember = await Commitment.aggregate([
            {
                $match: {
                    dealId: { $in: activeDealIdsArray }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalPrice' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const topMembersWithNames = await Promise.all(
            commitmentsByMember.map(async (member) => {
                const memberDoc = await User.findById(member._id).select('name email businessName');
                return {
                    memberName: memberDoc?.businessName || memberDoc?.name || 'Unknown Member',
                    email: memberDoc?.email || 'N/A',
                    commitments: member.count,
                    revenue: member.totalRevenue
                };
            })
        );

        // All members for PDF (previous month)
        // Get commitments for deals active in previous month
        const allMembersForPDF = await Commitment.aggregate([
            {
                $match: {
                    dealId: { $in: activeDealIdsArray }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalPrice' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const allMembersWithNames = await Promise.all(
            allMembersForPDF.map(async (member) => {
                const memberDoc = await User.findById(member._id).select('name email businessName');
                return {
                    memberName: memberDoc?.businessName || memberDoc?.name || 'Unknown Member',
                    email: memberDoc?.email || 'N/A',
                    commitments: member.count,
                    revenue: member.totalRevenue
                };
            })
        );

        // Activity Log Statistics (Previous Month Only)
        const [
            logsByType,
            errorLogs,
            warningLogs,
            mostRepeatedErrors,
            mostRepeatedWarnings
        ] = await Promise.all([
            // Logs by type (previous month)
            Log.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: reportMonthStart,
                            $lte: reportMonthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),
            // Error logs count (previous month)
            Log.countDocuments({
                type: 'error',
                createdAt: {
                    $gte: reportMonthStart,
                    $lte: reportMonthEnd
                }
            }),
            // Warning logs count (previous month)
            Log.countDocuments({
                type: 'warning',
                createdAt: {
                    $gte: reportMonthStart,
                    $lte: reportMonthEnd
                }
            }),
            // Most repeated errors (previous month)
            Log.aggregate([
                {
                    $match: {
                        type: 'error',
                        createdAt: {
                            $gte: reportMonthStart,
                            $lte: reportMonthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: '$message',
                        count: { $sum: 1 },
                        action: { $first: '$action' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            // Most repeated warnings (previous month)
            Log.aggregate([
                {
                    $match: {
                        type: 'warning',
                        createdAt: {
                            $gte: reportMonthStart,
                            $lte: reportMonthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: '$message',
                        count: { $sum: 1 },
                        action: { $first: '$action' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        return {
            reportPeriod: {
                start: reportMonthStart,
                end: reportMonthEnd,
                monthName: reportMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' })
            },
            users: {
                byRole: usersByRole
            },
            deals: {
                total: totalDealsPreviousMonth,
                byCategory: dealsByCategory,
                allDealsForPDF: allDealsForPDF
            },
            commitments: {
                total: totalCommitmentsPreviousMonth,
                byStatus: commitmentsByStatus,
                totalRevenue,
                totalQuantity,
                topDeals: topDealsWithNames,
                allDealsForPDF: allDealsForPDF,
                topMembers: topMembersWithNames,
                allMembersForPDF: allMembersWithNames
            },
            activity: {
                byType: logsByType,
                errors: errorLogs,
                warnings: warningLogs,
                mostRepeatedErrors,
                mostRepeatedWarnings
            },
            generatedAt: new Date()
        };
    } catch (error) {
        console.error('Error generating monthly summary:', error);
        throw error;
    }
};

/**
 * Helper function to draw a table with proper rows and columns
 */
const drawTable = (doc, startX, startY, headers, rows, options = {}) => {
    const { 
        colWidths = [],
        rowHeight = 20,
        headerHeight = 28,
        fontSize = 9,
        headerFontSize = 10,
        pageMargin = 25,
        alternateRowColor = '#F5F5F5',
        borderColor = '#CCCCCC'
    } = options;
    
    const pageWidth = doc.page.width;
    const tableWidth = pageWidth - (pageMargin * 2);
    
    // Calculate column widths if not provided
    let actualColWidths;
    if (colWidths.length === headers.length && colWidths.reduce((sum, w) => sum + (w || 0), 0) > 0) {
        const totalSpecified = colWidths.reduce((sum, w) => sum + (w || 0), 0);
        const scale = tableWidth / totalSpecified;
        actualColWidths = colWidths.map(w => (w || 0) * scale);
    } else {
        actualColWidths = headers.map(() => tableWidth / headers.length);
    }
    
    let currentY = startY;
    const tableRight = startX + tableWidth;
    
    // Draw header background and border
    doc.rect(startX, currentY, tableWidth, headerHeight)
       .fillAndStroke('#0047AB', borderColor);
    
    // Draw header text
    doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor('#FFFFFF');
    let headerX = startX + 8;
    headers.forEach((header, index) => {
        const width = actualColWidths[index];
        const isNumericHeader = /(Revenue|Commitments|Total|Qty|#|Count|Email)$/i.test(header);
        const align = isNumericHeader ? 'right' : 'left';
        doc.text(header, headerX, currentY + (headerHeight / 2) - (headerFontSize / 2), { 
            width: width - 12, 
            align: align,
            ellipsis: true 
        });
        headerX += width;
    });
    
    currentY += headerHeight;
    
    // Draw vertical lines between header columns
    let colX = startX;
    doc.strokeColor(borderColor);
    headers.forEach((header, index) => {
        if (index > 0) {
            doc.moveTo(colX, startY).lineTo(colX, currentY).stroke();
        }
        colX += actualColWidths[index];
    });
    doc.moveTo(tableRight, startY).lineTo(tableRight, currentY).stroke();
    
    // Draw rows
    doc.font('Helvetica').fontSize(fontSize).fillColor('#000000');
    let rowIndex = 0;
    
    rows.forEach((row) => {
        // Check if we need a new page
        if (currentY + rowHeight > doc.page.height - 25) {
            doc.addPage();
            currentY = pageMargin;
            
            // Redraw header on new page
            doc.rect(startX, currentY, tableWidth, headerHeight)
               .fillAndStroke('#0047AB', borderColor);
            
            doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor('#FFFFFF');
            headerX = startX + 8;
            headers.forEach((header, hIndex) => {
                const width = actualColWidths[hIndex];
                const isNumericHeader = /(Revenue|Commitments|Total|Qty|#|Count|Email)$/i.test(header);
                const align = isNumericHeader ? 'right' : 'left';
                doc.text(header, headerX, currentY + (headerHeight / 2) - (headerFontSize / 2), { 
                    width: width - 12, 
                    align: align,
                    ellipsis: true 
                });
                headerX += width;
            });
            
            currentY += headerHeight;
            
            // Redraw vertical lines
            colX = startX;
            headers.forEach((header, index) => {
                if (index > 0) {
                    doc.moveTo(colX, currentY - headerHeight).lineTo(colX, currentY).stroke();
                }
                colX += actualColWidths[index];
            });
            doc.moveTo(tableRight, currentY - headerHeight).lineTo(tableRight, currentY).stroke();
            
            doc.font('Helvetica').fontSize(fontSize).fillColor('#000000');
            rowIndex = 0;
        }
        
        // Alternate row background
        const isEven = rowIndex % 2 === 0;
        if (isEven && alternateRowColor) {
            doc.rect(startX, currentY, tableWidth, rowHeight)
               .fillColor(alternateRowColor)
               .fill();
        }
        
        // Draw row border (top)
        doc.moveTo(startX, currentY).lineTo(tableRight, currentY).stroke();
        
        // Draw cell content
        let cellX = startX + 8;
        row.forEach((cell, cellIndex) => {
            const width = actualColWidths[cellIndex];
            const isNumeric = cellIndex === row.length - 1 || 
                            cellIndex === row.length - 2 || 
                            (cell && /^\$?[\d,]+(\.\d+)?$/.test(cell.toString().trim()));
            const align = isNumeric ? 'right' : 'left';
            
            doc.fillColor('#000000');
            doc.text(cell || '', cellX, currentY + (rowHeight / 2) - (fontSize / 2), { 
                width: width - 12, 
                align: align,
                ellipsis: true 
            });
            
            // Draw vertical line between cells
            if (cellIndex < row.length - 1) {
                doc.moveTo(cellX + width, currentY).lineTo(cellX + width, currentY + rowHeight).stroke();
            }
            
            cellX += width;
        });
        
        // Draw right border
        doc.moveTo(tableRight, currentY).lineTo(tableRight, currentY + rowHeight).stroke();
        
        currentY += rowHeight;
        rowIndex++;
    });
    
    // Draw bottom border
    doc.moveTo(startX, currentY).lineTo(tableRight, currentY).stroke();
    
    return currentY + 10;
};

/**
 * Generate PDF report
 */
const generatePDF = async (summary) => {
    return new Promise((resolve, reject) => {
        try {
            // Use A4 landscape for wider format with reduced margins
            const doc = new PDFDocument({ 
                margin: 25,
                size: 'A4',
                layout: 'landscape' // Landscape orientation for wider format
            });
            const fileName = `monthly-report-${summary.reportPeriod.monthName.replace(/\s+/g, '-')}.pdf`;
            const filePath = path.join(__dirname, '..', 'uploads', fileName);
            
            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Header
            doc.fontSize(20).text('Monthly Summary Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(summary.reportPeriod.monthName, { align: 'center' });
            doc.fontSize(10).text(`Generated: ${new Date(summary.generatedAt).toLocaleString('en-US')}`, { align: 'center' });
            doc.moveDown(2);

            // Executive Summary
            doc.fontSize(16).text('Executive Summary', { underline: true });
            doc.moveDown();
            doc.fontSize(12);
            doc.text(`Total Deals: ${summary.deals.total.toLocaleString()}`);
            doc.text(`Total Commitments: ${summary.commitments.total.toLocaleString()}`);
            doc.text(`Total Revenue: $${summary.commitments.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            doc.moveDown();

            // Deals by Category
            if (summary.deals.byCategory && summary.deals.byCategory.length > 0) {
                doc.fontSize(14).text('Deals by Category', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(11);
                summary.deals.byCategory.forEach(cat => {
                    doc.text(`${cat._id || 'Uncategorized'}: ${cat.count.toLocaleString()}`);
                });
                doc.moveDown();
            }

            // All Deals with Status and Quantities in Table Format
            doc.addPage();
            doc.fontSize(14).text('All Deals with Commitment Status', { underline: true });
            doc.moveDown(1);
            
            // Prepare table data - using wider columns for landscape format
            const dealHeaders = ['Deal Name', 'Distributor', 'Status', 'Total', 'Quantities'];
            const dealColWidths = [220, 180, 80, 60, 220]; // Total: 760 (wider for landscape)
            
            const dealRows = summary.commitments.allDealsForPDF.map(deal => {
                const statusDisplay = {
                    'approved': 'APPROVED',
                    'declined': 'DECLINED',
                    'pending': 'PENDING',
                    'mixed': 'MIXED'
                };
                
                // Build quantities string showing only non-zero values
                const quantities = [];
                if (deal.quantities.approved > 0) {
                    quantities.push(`${deal.quantities.approved} approved`);
                }
                if (deal.quantities.declined > 0) {
                    quantities.push(`${deal.quantities.declined} declined`);
                }
                if (deal.quantities.cancelled > 0) {
                    quantities.push(`${deal.quantities.cancelled} cancelled`);
                }
                if (deal.quantities.pending > 0) {
                    quantities.push(`${deal.quantities.pending} pending`);
                }
                
                const quantitiesText = quantities.length > 0 ? quantities.join(' • ') : '0';
                
                return [
                    deal.dealName || 'Unknown Deal',
                    deal.distributorName || 'Unknown',
                    statusDisplay[deal.status] || deal.status?.toUpperCase() || 'PENDING',
                    deal.commitments.total.toString(),
                    quantitiesText
                ];
            });
            
            if (dealRows.length > 0) {
                const finalY = drawTable(doc, 25, doc.y, dealHeaders, dealRows, {
                    colWidths: dealColWidths,
                    rowHeight: 20,
                    headerHeight: 28,
                    fontSize: 9,
                    headerFontSize: 10,
                    pageMargin: 25
                });
                doc.y = finalY;
            } else {
                doc.fontSize(11).fillColor('#666666');
                doc.text('No deals found for this period.', 30, doc.y);
                doc.moveDown();
            }

            // All Members by Commitments in Table Format
            doc.addPage();
            doc.fontSize(14).text('All Members by Commitments', { underline: true });
            doc.moveDown(1);
            
            // Prepare table data - using wider columns for landscape format
            const memberHeaders = ['#', 'Member Name', 'Email', 'Commitments', 'Revenue'];
            const memberColWidths = [30, 250, 220, 100, 110]; // Total: 710 (wider for landscape)
            
            const memberRows = summary.commitments.allMembersForPDF.map((member, index) => [
                (index + 1).toString(),
                member.memberName || 'Unknown Member',
                member.email || 'N/A',
                member.commitments.toLocaleString(),
                `$${member.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);
            
            if (memberRows.length > 0) {
                const finalY = drawTable(doc, 25, doc.y, memberHeaders, memberRows, {
                    colWidths: memberColWidths,
                    rowHeight: 20,
                    headerHeight: 28,
                    fontSize: 9,
                    headerFontSize: 10,
                    pageMargin: 25
                });
                doc.y = finalY;
            } else {
                doc.fontSize(11).fillColor('#666666');
                doc.text('No members found for this period.', 30, doc.y);
                doc.moveDown();
            }

            // Activity Logs
            doc.addPage();
            doc.fontSize(14).text('Activity Logs Summary', { underline: true });
            doc.moveDown(0.5);
            
            doc.fontSize(12).text('Logs by Type:', { underline: true });
            doc.fontSize(11);
            summary.activity.byType.forEach(log => {
                doc.text(`${log._id || 'Unknown'}: ${log.count.toLocaleString()}`);
            });
            doc.moveDown();
            
            doc.fontSize(12).text(`Total Errors: ${summary.activity.errors.toLocaleString()}`);
            doc.fontSize(12).text(`Total Warnings: ${summary.activity.warnings.toLocaleString()}`);
            doc.moveDown();

            // Most Repeated Errors
            if (summary.activity.mostRepeatedErrors && summary.activity.mostRepeatedErrors.length > 0) {
                doc.fontSize(12).text('Most Repeated Errors:', { underline: true });
                doc.fontSize(10);
                summary.activity.mostRepeatedErrors.forEach((error, index) => {
                    doc.text(`${index + 1}. [${error.count}x] ${error._id?.substring(0, 100) || 'Unknown'}`);
                    if (error.action) {
                        doc.text(`   Action: ${error.action}`);
                    }
                    doc.moveDown(0.3);
                });
                doc.moveDown();
            }

            // Most Repeated Warnings
            if (summary.activity.mostRepeatedWarnings && summary.activity.mostRepeatedWarnings.length > 0) {
                doc.fontSize(12).text('Most Repeated Warnings:', { underline: true });
                doc.fontSize(10);
                summary.activity.mostRepeatedWarnings.forEach((warning, index) => {
                    doc.text(`${index + 1}. [${warning.count}x] ${warning._id?.substring(0, 100) || 'Unknown'}`);
                    if (warning.action) {
                        doc.text(`   Action: ${warning.action}`);
                    }
                    doc.moveDown(0.3);
                });
            }

            doc.end();

            stream.on('finish', () => {
                // Read file for attachment
                const fileContent = fs.readFileSync(filePath);
                const base64Content = fileContent.toString('base64');
                
                // Clean up file after reading
                setTimeout(() => {
                    fs.unlinkSync(filePath);
                }, 5000);

                resolve({
                    name: fileName,
                    content: base64Content
                });
            });

            stream.on('error', (error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Send monthly summary report via email
 */
const sendMonthlySummary = async () => {
    try {
        console.log('📊 Starting monthly summary generation...');

        // Get last month's date range
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Generate the summary
        const summary = await generateMonthlySummary(lastMonth, lastMonthEnd);

        // Generate email content
        const emailContent = MonthlySummaryTemplate(summary);

        // Generate PDF
        console.log('📄 Generating PDF report...');
        const pdfAttachment = await generatePDF(summary);

        // Prepare attachment for Brevo
        const attachment = {
            name: pdfAttachment.name,
            content: pdfAttachment.content
        };

        // Send email with attachment
        await sendEmail(
            'muhammadnouman72321@gmail.com',
            `Monthly Summary Report - ${summary.reportPeriod.monthName}`,
            emailContent,
            attachment
        );

        console.log(`✅ Monthly summary report sent successfully for ${summary.reportPeriod.monthName}`);

        // Log the action
        await logSystemAction('monthly_summary_sent', 'system', {
            message: `Monthly summary report sent for ${summary.reportPeriod.monthName}`,
            reportPeriod: summary.reportPeriod,
            severity: 'low',
            tags: ['monthly-summary', 'email', 'automated', 'completed']
        });

        return summary;
    } catch (error) {
        console.error('❌ Error sending monthly summary:', error);
        
        // Log the error
        await logSystemAction('monthly_summary_failed', 'system', {
            message: `Failed to send monthly summary: ${error.message}`,
            error: error.message,
            severity: 'high',
            tags: ['monthly-summary', 'email', 'automated', 'error']
        });

        throw error;
    }
};

module.exports = {
    generateMonthlySummary,
    sendMonthlySummary
};
