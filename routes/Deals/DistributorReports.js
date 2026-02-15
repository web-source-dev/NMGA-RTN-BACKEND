const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const User = require('../../models/User');
const Supplier = require('../../models/Suppliers');
const { isDistributorAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');
const { MONTHS } = require('../../utils/monthMapping');

// Get distributor commitments report
router.get('/commitments-report', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;

    const {
      month,
      customerId, // co-op member ID
      salespersonId, // supplier ID
      view // 'customer' or 'deal'
    } = req.query;

    // Parse month and calculate date range (5th to 25th of the month)
    let monthName, year, rangeStart, rangeEnd;

    if (!month) {
      // Default to current month
      const currentDate = new Date();
      const currentMonthIndex = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      monthName = MONTHS[currentMonthIndex];
      year = currentYear;
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
    }

    // Calculate date range: 5th to 25th of the month
    const monthIndex = MONTHS.indexOf(monthName);
    rangeStart = new Date(year, monthIndex, 5, 0, 0, 0, 0);
    rangeEnd = new Date(year, monthIndex, 25, 23, 59, 59, 999);

    console.log('=== DISTRIBUTOR COMMITMENTS REPORT ===');
    console.log('Distributor ID:', distributorId);
    console.log('Month:', monthName, 'Year:', year);
    console.log('Range Start:', rangeStart.toISOString());
    console.log('Range End:', rangeEnd.toISOString());

    // Find all deals by this distributor that have deal dates overlapping with the range
    let dealQuery = {
      distributor: distributorId,
      dealStartAt: { $lte: rangeEnd },
      dealEndsAt: { $gte: rangeStart }
    };

    // Filter by customer if provided
    if (customerId) {
      // This will be handled when we filter commitments
    }

    const deals = await Deal.find(dealQuery)
      .populate('distributor', 'businessName name email')
      .sort({ name: 1 })
      .lean();

    console.log('Found deals:', deals.length);

    if (deals.length === 0) {
      return res.json({
        month: month || `${monthName} ${year}`,
        monthName,
        year,
        dateRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
        customers: [],
        totalCustomers: 0,
        totalCommitments: 0,
        totalCases: 0
      });
    }

    // Get all commitments for these deals
    const dealIds = deals.map(d => d._id);
    const commitments = await Commitment.find({
      dealId: { $in: dealIds },
      status: { $in: ['pending', 'approved'] } // Include both pending and approved commitments
    })
    .populate('userId', 'name businessName email phone address')
    .populate('dealId', 'name sizes category')
    .sort({ createdAt: -1 })
    .lean();

    console.log('Found commitments:', commitments.length);

    // Get all suppliers (salespeople) for this distributor
    const suppliers = await Supplier.find({
      distributorId: distributorId,
      status: 'active'
    }).lean();

    console.log('Found suppliers:', suppliers.length);

    // Create supplier lookup map
    const supplierMap = {};
    suppliers.forEach(supplier => {
      supplierMap[supplier._id.toString()] = supplier;
    });

    // Group commitments by customer (co-op member)
    const customerCommitments = {};

    commitments.forEach(commitment => {
      const customerId = commitment.userId._id.toString();
      const dealId = commitment.dealId._id.toString();

      // Find the deal
      const deal = deals.find(d => d._id.toString() === dealId);
      if (!deal) return;

      // Filter by specific customer if requested
      if (customerId && customerId !== customerId) {
        return;
      }

      if (!customerCommitments[customerId]) {
        // Get assigned suppliers for this customer
        const assignedSuppliers = suppliers.filter(supplier =>
          supplier.assignedMembers && supplier.assignedMembers.includes(customerId)
        );

        customerCommitments[customerId] = {
          customer: {
            id: customerId,
            name: commitment.userId.businessName || commitment.userId.name,
            email: commitment.userId.email,
            phone: commitment.userId.phone,
            address: commitment.userId.address,
            assignedSuppliers: assignedSuppliers.map(supplier => ({
              id: supplier._id.toString(),
              name: supplier.name,
              email: supplier.email
            }))
          },
          commitments: [],
          totalCases: 0,
          totalValue: 0
        };
      }

      // Process size commitments
      let totalCasesForCommitment = 0;
      let totalValueForCommitment = commitment.modifiedTotalPrice || commitment.totalPrice || 0;

      // Calculate total cases from size commitments
      const sizeCommitments = commitment.modifiedByDistributor && commitment.modifiedSizeCommitments
        ? commitment.modifiedSizeCommitments
        : commitment.sizeCommitments || [];

      sizeCommitments.forEach(size => {
        totalCasesForCommitment += size.quantity || 0;
      });

      // Get deal size information
      const dealSizes = deal.sizes || [];
      const commitmentDetails = sizeCommitments.map(sizeCommitment => {
        const dealSize = dealSizes.find(ds => ds.size === sizeCommitment.size);
        const bottlesPerCase = dealSize ? (dealSize.bottlesPerCase || 1) : 1;
        const bottlePrice = dealSize ? (dealSize.discountPrice / bottlesPerCase) : 0;
        const casePrice = dealSize ? dealSize.discountPrice : 0;

        return {
          size: sizeCommitment.size,
          sizeName: sizeCommitment.name || sizeCommitment.size,
          quantity: sizeCommitment.quantity || 0,
          bottlePrice: parseFloat(bottlePrice.toFixed(2)),
          casePrice: parseFloat(casePrice.toFixed(2)),
          bottlesPerCase: bottlesPerCase,
          totalPrice: sizeCommitment.totalPrice || (sizeCommitment.quantity * casePrice)
        };
      });

      const commitmentData = {
        commitmentId: commitment._id,
        dealId: deal._id,
        dealName: deal.name,
        category: deal.category,
        status: commitment.status,
        totalCases: totalCasesForCommitment,
        totalValue: totalValueForCommitment,
        commitmentDate: commitment.createdAt,
        distributorResponse: commitment.distributorResponse,
        sizes: commitmentDetails
      };

      customerCommitments[customerId].commitments.push(commitmentData);
      customerCommitments[customerId].totalCases += totalCasesForCommitment;
      customerCommitments[customerId].totalValue += totalValueForCommitment;
    });

    // Convert to array and sort by customer name
    const customerArray = Object.values(customerCommitments).sort((a, b) =>
      a.customer.name.localeCompare(b.customer.name)
    );

    // Apply customer filter if provided
    let filteredCustomers = customerArray;
    if (customerId && customerId !== 'all') {
      filteredCustomers = customerArray.filter(customer =>
        customer.customer.id === customerId
      );
    }

    // Apply salesperson filter if provided
    if (salespersonId && salespersonId !== 'all') {
      filteredCustomers = filteredCustomers.filter(customer =>
        customer.customer.assignedSuppliers.some(supplier => supplier.id === salespersonId)
      );
    }

    // Calculate totals
    const totalCustomers = filteredCustomers.length;
    const totalCommitments = filteredCustomers.reduce((sum, customer) => sum + customer.commitments.length, 0);
    const totalCases = filteredCustomers.reduce((sum, customer) => sum + customer.totalCases, 0);

    // Group by salesperson if requested
    let salespersonGroups = [];
    if (salespersonId) {
      const salesperson = suppliers.find(s => s._id.toString() === salespersonId);
      if (salesperson) {
        salespersonGroups = [{
          salesperson: {
            id: salesperson._id.toString(),
            name: salesperson.name,
            email: salesperson.email
          },
          customers: filteredCustomers,
          totalCustomers: filteredCustomers.length,
          totalCommitments: totalCommitments,
          totalCases: totalCases
        }];
      }
    } else {
      // Group all customers by their assigned salespeople
      const salespersonMap = {};

      filteredCustomers.forEach(customer => {
        // If customer has assigned suppliers, group by them
        if (customer.customer.assignedSuppliers && customer.customer.assignedSuppliers.length > 0) {
          customer.customer.assignedSuppliers.forEach(supplier => {
            if (!salespersonMap[supplier.id]) {
              salespersonMap[supplier.id] = {
                salesperson: supplier,
                customers: [],
                totalCustomers: 0,
                totalCommitments: 0,
                totalCases: 0
              };
            }
            salespersonMap[supplier.id].customers.push(customer);
            salespersonMap[supplier.id].totalCommitments += customer.commitments.length;
            salespersonMap[supplier.id].totalCases += customer.totalCases;
          });
        } else {
          // If no suppliers assigned, put in "Unassigned" group
          const unassignedId = 'unassigned';
          if (!salespersonMap[unassignedId]) {
            salespersonMap[unassignedId] = {
              salesperson: {
                id: unassignedId,
                name: 'Unassigned',
                email: ''
              },
              customers: [],
              totalCustomers: 0,
              totalCommitments: 0,
              totalCases: 0
            };
          }
          salespersonMap[unassignedId].customers.push(customer);
          salespersonMap[unassignedId].totalCommitments += customer.commitments.length;
          salespersonMap[unassignedId].totalCases += customer.totalCases;
        }
      });

      salespersonGroups = Object.values(salespersonMap).sort((a, b) =>
        a.salesperson.name.localeCompare(b.salesperson.name)
      );

      // Update total customers per salesperson
      salespersonGroups.forEach(group => {
        group.totalCustomers = group.customers.length;
      });
    }

    console.log('=== FINAL RESULT ===');
    console.log('Total customers:', totalCustomers);
    console.log('Total commitments:', totalCommitments);
    console.log('Total cases:', totalCases);
    console.log('Salesperson groups:', salespersonGroups.length);

    // Prepare deal-centric view if requested
    let dealGroups = [];
    if (view === 'deal') {
      const dealMap = {};

      filteredCustomers.forEach(customer => {
        customer.commitments.forEach(commitment => {
          const dealId = commitment.dealId._id.toString(); // Get the actual deal ID string

          if (!dealMap[dealId]) {
            // Find the deal info
            const deal = deals.find(d => d._id.toString() === dealId);

            if (deal) {
              dealMap[dealId] = {
                deal: {
                  id: dealId,
                  name: deal.name,
                  category: deal.category,
                  distributor: {
                    id: deal.distributor._id,
                    name: deal.distributor.businessName || deal.distributor.name
                  }
                },
                customers: [],
                totalCustomers: 0,
                totalCases: 0,
                totalValue: 0
              };
            }
          }

          if (dealMap[dealId]) {
            // Get customer's assigned salesperson
            const customerSalesperson = customer.customer.assignedSuppliers && customer.customer.assignedSuppliers.length > 0
              ? customer.customer.assignedSuppliers[0] // Use first assigned salesperson
              : { id: 'unassigned', name: 'Unassigned', email: '' };

            dealMap[dealId].customers.push({
              customer: {
                id: customer.customer.id,
                name: customer.customer.name,
                email: customer.customer.email
              },
              salesperson: customerSalesperson,
              commitment: commitment
            });
            dealMap[dealId].totalCases += commitment.totalCases;
            dealMap[dealId].totalValue += commitment.totalValue;
          }
        });
      });

      dealGroups = Object.values(dealMap).map(dealGroup => ({
        ...dealGroup,
        totalCustomers: dealGroup.customers.length
      })).sort((a, b) => a.deal.name.localeCompare(b.deal.name));
    }

    // Log the action
    await logCollaboratorAction(req, 'view_distributor_commitments_report', 'report', {
      distributorId,
      month: `${monthName} ${year}`,
      customerId: customerId || null,
      salespersonId: salespersonId || null,
      totalCustomers,
      totalCommitments,
      totalCases,
      additionalInfo: `Viewed distributor commitments report for ${monthName} ${year}: ${totalCustomers} customers, ${totalCommitments} commitments, ${totalCases} cases`
    });

    res.json({
      month: month || `${monthName} ${year}`,
      monthName,
      year,
      dateRange: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString()
      },
      customers: filteredCustomers,
      allCustomers: customerArray, // Always return all customers for dropdown options
      salespersonGroups,
      suppliers: [
        ...suppliers.map(supplier => ({
          id: supplier._id.toString(),
          name: supplier.name,
          email: supplier.email
        })),
        // Add "Unassigned" option if there are customers without salespeople
        ...(customerArray.some(customer =>
          !customer.customer.assignedSuppliers ||
          customer.customer.assignedSuppliers.length === 0
        ) ? [{
          id: 'unassigned',
          name: 'Unassigned',
          email: ''
        }] : [])
      ],
      totalCustomers,
      totalCommitments,
      totalCases,
      filteredByCustomer: !!customerId,
      filteredBySalesperson: !!salespersonId,
      view: view || 'customer',
      dealGroups: dealGroups
    });

  } catch (error) {
    console.error('Error fetching distributor commitments report:', error);
    await logError(req, 'view_distributor_commitments_report', 'report', error);
    res.status(500).json({ message: 'Error fetching distributor commitments report' });
  }
});

module.exports = router;
