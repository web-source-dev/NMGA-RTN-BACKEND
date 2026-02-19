const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const User = require('../../models/User');
const Supplier = require('../../models/Suppliers');
const { isAdmin } = require('../../middleware/auth');
const { logError } = require('../../utils/collaboratorLogger');
const { MONTHS } = require('../../utils/monthMapping');

// Get comprehensive admin reports
router.get('/comprehensive-reports', isAdmin, async (req, res) => {
  try {
    const {
      month,
      allMonths,
      distributorId,
      customerId: filterCustomerId,
      salespersonId: filterSalespersonId,
      viewMode = 'deals' // 'deals', 'customer', 'salesperson'
    } = req.query;

    console.log('=== ADMIN COMPREHENSIVE REPORTS ===');
    console.log('View Mode:', viewMode);
    console.log('Filters:', { month, allMonths, distributorId, filterCustomerId, filterSalespersonId });

    // Parse month and calculate date range
    let monthName, year, rangeStart, rangeEnd;

    if (allMonths === 'true' || !month) {
      // All months - no date filter
      rangeStart = null;
      rangeEnd = null;
    } else {
      // Parse month value (format: "Month Year", e.g., "October 2025")
      const monthParts = month.trim().split(' ');
      if (monthParts.length !== 2) {
        return res.status(400).json({ message: 'Invalid month format. Expected "Month Year"' });
      }

      monthName = monthParts[0];
      year = parseInt(monthParts[1], 10);

      if (isNaN(year) || !MONTHS.includes(monthName)) {
        return res.status(400).json({ message: 'Invalid month or year' });
      }

      // Calculate date range: 5th to 25th of the month
      const monthIndex = MONTHS.indexOf(monthName);
      rangeStart = new Date(year, monthIndex, 5, 0, 0, 0, 0);
      rangeEnd = new Date(year, monthIndex, 25, 23, 59, 59, 999);

      console.log('Month:', monthName, 'Year:', year);
      console.log('Range Start:', rangeStart.toISOString());
      console.log('Range End:', rangeEnd.toISOString());
    }

    // Build base query for deals
    let dealQuery = {};

    if (rangeStart && rangeEnd) {
      dealQuery = {
        dealStartAt: { $lte: rangeEnd },
        dealEndsAt: { $gte: rangeStart }
      };
    }

    // Filter by distributor if provided
    if (distributorId) {
      dealQuery.distributor = distributorId;
    }

    const deals = await Deal.find(dealQuery)
      .populate('distributor', 'businessName name email')
      .sort({ name: 1 })
      .lean();

    console.log('Found deals:', deals.length);

    // Get all commitments for these deals
    let commitmentQuery = {};
    if (deals.length > 0) {
      commitmentQuery.dealId = { $in: deals.map(d => d._id) };
    }

    // Always include all commitment statuses for comprehensive reporting
    commitmentQuery.status = { $in: ['pending', 'approved', 'declined'] };

    const commitments = await Commitment.find(commitmentQuery)
      .populate('userId', 'name businessName email phone address addedBy')
      .populate('dealId', 'name sizes category distributor')
      .sort({ createdAt: -1 })
      .lean();

    console.log('Found commitments:', commitments.length);

    // Get all users (customers/members)
    let userQuery = { role: { $in: ['member', 'distributor'] } };
    if (filterCustomerId) {
      userQuery._id = filterCustomerId;
    }

    const customers = await User.find(userQuery)
      .select('name businessName email phone address addedBy')
      .lean();

    console.log('Found customers:', customers.length);

    // Get all suppliers (salespeople)
    let supplierQuery = {};
    if (filterSalespersonId && filterSalespersonId !== 'unassigned') {
      supplierQuery._id = filterSalespersonId;
    }

    const suppliers = await Supplier.find(supplierQuery)
      .populate('assignedTo', 'name businessName email')
      .lean();

    console.log('Found suppliers:', suppliers.length);

    // Create lookup maps
    const customerMap = {};
    customers.forEach(customer => {
      customer.id = customer._id.toString(); // Add id property for consistency
      customerMap[customer._id.toString()] = customer;
    });

    const supplierMap = {};
    suppliers.forEach(supplier => {
      supplierMap[supplier._id.toString()] = supplier;
    });

    const dealMap = {};
    deals.forEach(deal => {
      dealMap[deal._id.toString()] = deal;
    });

    // Process data based on view mode
    let responseData = {
      month: allMonths === 'true' ? 'All Months' : (month || `${monthName} ${year}`),
      viewMode,
      totalDistributors: 0,
      totalCustomers: 0,
      totalDeals: deals.length,
      totalCommitments: commitments.length,
      totalRevenue: 0
    };

    // Create distributor groups based on view mode
    const distributorGroups = {};

    commitments.forEach(commitment => {
      const dealId = commitment.dealId?._id?.toString();
      const customerId = commitment.userId?._id?.toString();
      const deal = dealMap[dealId];
      const customer = customerMap[customerId];

      if (!deal || !customer) return;

        // Filter by customer if specified
        if (filterCustomerId && filterCustomerId !== customer.id) return;

        // Filter by salesperson if specified
        if (filterSalespersonId) {
          if (filterSalespersonId === 'unassigned') {
            // Show only customers with no assigned salesperson
            const assignedSupplier = suppliers.find(supplier =>
              supplier.assignedMembers && supplier.assignedMembers.includes(customerId)
            );
            if (assignedSupplier) return; // Skip if customer has an assigned supplier
          } else {
            // Show only customers assigned to the specific salesperson
            const assignedSupplier = suppliers.find(supplier =>
              supplier.assignedMembers && supplier.assignedMembers.includes(customerId)
            );
            if (!assignedSupplier || assignedSupplier._id.toString() !== filterSalespersonId) return;
          }
        }

      const distributorId = deal.distributor._id.toString();

      // Initialize distributor group if not exists
      if (!distributorGroups[distributorId]) {
        distributorGroups[distributorId] = {
          distributor: {
            id: distributorId,
            name: deal.distributor.businessName || deal.distributor.name,
            email: deal.distributor.email
          },
          totalCustomers: 0,
          totalDeals: 0,
          totalCommitments: 0,
          totalCases: 0,
          totalValue: 0
        };

        // Initialize view mode specific structures
        if (viewMode === 'deals') {
          distributorGroups[distributorId].deals = {};
        } else if (viewMode === 'customer') {
          distributorGroups[distributorId].customers = {};
        } else if (viewMode === 'salesperson') {
          distributorGroups[distributorId].salespeople = {};
        }
      }

      // Find assigned supplier for this customer
      const assignedSupplier = suppliers.find(supplier =>
        supplier.assignedMembers && supplier.assignedMembers.includes(customerId)
      );

      const supplierId = assignedSupplier?._id?.toString() || 'unassigned';
      const supplier = assignedSupplier || { name: 'Unassigned', email: 'N/A' };

      // Transform size commitments to include casePrice
      const dealSizes = deal.sizes || [];
      const transformedSizes = (commitment.sizeCommitments || []).map(sizeCommitment => {
        const dealSize = dealSizes.find(ds => ds.size === sizeCommitment.size);
        const casePrice = dealSize ? dealSize.discountPrice : 0;

        return {
          size: sizeCommitment.size,
          sizeName: sizeCommitment.name || sizeCommitment.size,
          quantity: sizeCommitment.quantity || 0,
          casePrice: parseFloat(casePrice.toFixed(2)),
          totalPrice: sizeCommitment.totalPrice || (sizeCommitment.quantity * casePrice)
        };
      });

      // Structure data based on view mode
      if (viewMode === 'deals') {
        // Group by deals within distributors
        if (!distributorGroups[distributorId].deals[dealId]) {
          distributorGroups[distributorId].deals[dealId] = {
            deal: {
              id: dealId,
              name: deal.name,
              category: deal.category || 'Uncategorized'
            },
            customers: [],
            totalCustomers: 0,
            totalCases: 0,
            totalValue: 0
          };
        }

        const dealGroup = distributorGroups[distributorId].deals[dealId];
        const commitmentData = {
          customer: {
            id: customerId,
            name: customer.businessName || customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address
          },
          salesperson: assignedSupplier ? {
            id: supplierId,
            name: supplier.name,
            email: supplier.email
          } : null,
          commitment: {
            id: commitment._id.toString(),
            status: commitment.status,
            sizes: transformedSizes,
            totalValue: commitment.totalPrice || 0
          }
        };

        dealGroup.customers.push(commitmentData);
        dealGroup.totalCustomers += 1;
        dealGroup.totalCases += commitment.sizeCommitments?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
        dealGroup.totalValue += commitment.totalPrice || 0;

      } else if (viewMode === 'customer') {
        // Group by customers within distributors
        if (!distributorGroups[distributorId].customers[customerId]) {
          distributorGroups[distributorId].customers[customerId] = {
            customer: {
              id: customerId,
              name: customer.businessName || customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address
            },
            salesperson: assignedSupplier ? {
              id: supplierId,
              name: supplier.name,
              email: supplier.email
            } : null,
            deals: [],
            totalDeals: 0,
            totalCases: 0,
            totalValue: 0
          };
        }

        const customerGroup = distributorGroups[distributorId].customers[customerId];
        const dealData = {
          deal: {
            id: dealId,
            name: deal.name,
            category: deal.category || 'Uncategorized'
          },
          commitment: {
            id: commitment._id.toString(),
            status: commitment.status,
            sizes: transformedSizes,
            totalValue: commitment.totalPrice || 0
          }
        };

        customerGroup.deals.push(dealData);
        customerGroup.totalDeals += 1;
        customerGroup.totalCases += commitment.sizeCommitments?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
        customerGroup.totalValue += commitment.totalPrice || 0;

      } else if (viewMode === 'salesperson') {
        // Group by salespeople within distributors, then customers within salespeople
        if (!distributorGroups[distributorId].salespeople[supplierId]) {
          distributorGroups[distributorId].salespeople[supplierId] = {
            salesperson: {
              id: supplierId,
              name: supplier.name,
              email: supplier.email
            },
            customers: {},
            totalCustomers: 0,
            totalCases: 0,
            totalValue: 0
          };
        }

        const salespersonGroup = distributorGroups[distributorId].salespeople[supplierId];

        if (!salespersonGroup.customers[customerId]) {
          salespersonGroup.customers[customerId] = {
            customer: {
              id: customerId,
              name: customer.businessName || customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address
            },
            deals: [],
            totalDeals: 0,
            totalCases: 0,
            totalValue: 0
          };
        }

        const customerGroup = salespersonGroup.customers[customerId];
        const dealData = {
          deal: {
            id: dealId,
            name: deal.name,
            category: deal.category || 'Uncategorized'
          },
          commitment: {
            id: commitment._id.toString(),
            status: commitment.status,
            sizes: transformedSizes,
            totalValue: commitment.totalPrice || 0
          }
        };

        customerGroup.deals.push(dealData);
        customerGroup.totalDeals += 1;
        customerGroup.totalCases += commitment.sizeCommitments?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
        customerGroup.totalValue += commitment.totalPrice || 0;

        // Update salesperson totals
        salespersonGroup.totalCustomers = Object.keys(salespersonGroup.customers).length;
        salespersonGroup.totalCases += commitment.sizeCommitments?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
        salespersonGroup.totalValue += commitment.totalPrice || 0;
      }

      // Update distributor totals
      distributorGroups[distributorId].totalCommitments += 1;
      distributorGroups[distributorId].totalCases += commitment.sizeCommitments?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
      distributorGroups[distributorId].totalValue += commitment.totalPrice || 0;

      if (viewMode === 'deals') {
        distributorGroups[distributorId].totalDeals = Object.keys(distributorGroups[distributorId].deals).length;
        distributorGroups[distributorId].totalCustomers = Object.values(distributorGroups[distributorId].deals).reduce((sum, deal) => sum + deal.totalCustomers, 0);
      } else if (viewMode === 'customer') {
        distributorGroups[distributorId].totalCustomers = Object.keys(distributorGroups[distributorId].customers).length;
        distributorGroups[distributorId].totalDeals = Object.values(distributorGroups[distributorId].customers).reduce((sum, customer) => sum + customer.totalDeals, 0);
      } else if (viewMode === 'salesperson') {
        distributorGroups[distributorId].totalCustomers = Object.values(distributorGroups[distributorId].salespeople).reduce((sum, salesperson) => sum + salesperson.totalCustomers, 0);
        distributorGroups[distributorId].totalDeals = Object.values(distributorGroups[distributorId].salespeople).reduce((sum, salesperson) =>
          sum + Object.values(salesperson.customers).reduce((customerSum, customer) => customerSum + customer.totalDeals, 0), 0);
      }
    });

    // Convert to array and calculate totals
    responseData.distributorGroups = Object.values(distributorGroups);
    responseData.totalDistributors = responseData.distributorGroups.length;
    responseData.totalRevenue = responseData.distributorGroups.reduce((sum, group) => sum + group.totalValue, 0);

    // Add analytics data
    const dealStatusStats = { approved: 0, declined: 0, pending: 0 };
    const topDistributors = {};

    responseData.distributorGroups.forEach(group => {
      // Track distributor stats
      const distId = group.distributor.id;
      if (!topDistributors[distId]) {
        topDistributors[distId] = {
          id: distId,
          name: group.distributor.name,
          dealCount: group.totalDeals,
          customerCount: group.totalCustomers,
          revenue: group.totalValue
        };
      }

      // Calculate status stats by traversing the data structure
      if (viewMode === 'deals') {
        Object.values(group.deals || {}).forEach(deal => {
          deal.customers.forEach(customerData => {
            const status = customerData.commitment.status;
            if (dealStatusStats.hasOwnProperty(status)) {
              dealStatusStats[status] += 1;
            }
          });
        });
      } else if (viewMode === 'customer') {
        Object.values(group.customers || {}).forEach(customer => {
          customer.deals.forEach(dealData => {
            const status = dealData.commitment.status;
            if (dealStatusStats.hasOwnProperty(status)) {
              dealStatusStats[status] += 1;
            }
          });
        });
      } else if (viewMode === 'salesperson') {
        Object.values(group.salespeople || {}).forEach(salesperson => {
          Object.values(salesperson.customers || {}).forEach(customer => {
            customer.deals.forEach(dealData => {
              const status = dealData.commitment.status;
              if (dealStatusStats.hasOwnProperty(status)) {
                dealStatusStats[status] += 1;
              }
            });
          });
        });
      }
    });

    responseData.dealStatusStats = dealStatusStats;
    responseData.topDistributors = Object.values(topDistributors)
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate revenue trends (simplified)
    const currentMonthRevenue = responseData.totalRevenue;
    responseData.revenueStats = {
      thisMonth: currentMonthRevenue,
      lastMonth: 0, // Would need proper month-over-month calculation
      growth: 0
    };

    // Add all customers and suppliers that have data in current context for dropdown options
    const customersWithData = new Set();
    const suppliersWithData = new Set();

    // Collect customers and suppliers that have commitments in the current filtered data
    Object.values(distributorGroups).forEach(distributorGroup => {
      // Collect from deals view
      Object.values(distributorGroup.deals || {}).forEach(deal => {
        deal.customers?.forEach(customer => {
          customersWithData.add(customer.customer.id);
          if (customer.salesperson && customer.salesperson.id !== 'unassigned') {
            suppliersWithData.add(customer.salesperson.id);
          }
        });
      });

      // Collect from customers view
      Object.values(distributorGroup.customers || {}).forEach(customer => {
        customersWithData.add(customer.customer.id);
        if (customer.salesperson && customer.salesperson.id !== 'unassigned') {
          suppliersWithData.add(customer.salesperson.id);
        }
      });

      // Collect from salespeople view
      Object.values(distributorGroup.salespeople || {}).forEach(salesperson => {
        if (salesperson.salesperson.id !== 'unassigned') {
          suppliersWithData.add(salesperson.salesperson.id);
        }
        Object.values(salesperson.customers || {}).forEach(customer => {
          customersWithData.add(customer.customer.id);
        });
      });
    });

    // Get the actual customer and supplier data for the dropdowns
    const allCustomersData = customersWithData.size > 0 ?
      await User.find({ _id: { $in: Array.from(customersWithData) } })
        .select('name businessName email')
        .lean() : [];

    const allSuppliersData = suppliersWithData.size > 0 ?
      await Supplier.find({ _id: { $in: Array.from(suppliersWithData) } })
        .select('name email')
        .lean() : [];

    responseData.allCustomers = allCustomersData.map(customer => ({
      id: customer._id.toString(),
      name: customer.businessName || customer.name,
      email: customer.email
    }));

    responseData.suppliers = [
      { id: 'unassigned', name: 'Unassigned', email: 'N/A' },
      ...allSuppliersData.map(supplier => ({
        id: supplier._id.toString(),
        name: supplier.name,
        email: supplier.email
      }))
    ];

    console.log('Report generated successfully');
    res.json(responseData);

  } catch (error) {
    console.error('Error generating admin comprehensive reports:', error);
    logError('admin_comprehensive_reports', error || new Error('Unknown error'), req.user?.id);
    res.status(500).json({
      message: 'Error generating admin reports',
      error: error?.message || 'Unknown error'
    });
  }
});

module.exports = router;
