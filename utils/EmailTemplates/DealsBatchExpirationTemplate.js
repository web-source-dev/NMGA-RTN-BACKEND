const baseTemplate = require('./baseTemplate');

module.exports = (userName, deals, timeRemaining) => {
  // Access FRONTEND_URL inside the function to ensure it's available when needed
  const FRONTEND_URL = process.env.FRONTEND_URL;
  
  return baseTemplate(`
    <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
      ${timeRemaining === 'expired' ? 'Deals Have Expired' : 'Deals Ending Soon!'}
    </h2>
    
    <p style="font-size: 16px; color: #333;">Dear ${userName},</p>

    <div class="alert-box" style="
      background-color: ${
        timeRemaining === 'expired' ? '#ffebee' :
        timeRemaining === '1 hour' ? '#ffebee' :
        timeRemaining === '1 day' ? '#fff3e0' : '#e8f5e9'
      }; 
      border-left: 5px solid ${
        timeRemaining === 'expired' ? '#f44336' :
        timeRemaining === '1 hour' ? '#f44336' :
        timeRemaining === '1 day' ? '#ff9800' : '#4caf50'
      };
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    ">
      <p style="margin: 0; font-size: 16px;">
        <strong style="color: ${
          timeRemaining === 'expired' ? '#d32f2f' :
          timeRemaining === '1 hour' ? '#d32f2f' :
          timeRemaining === '1 day' ? '#ef6c00' : '#2e7d32'
        };">${timeRemaining === 'expired' ? 'Notice:' : 'Time-Sensitive Notice:'}</strong> 
        ${timeRemaining === 'expired' ? 
          `The following deals have expired and are no longer available.` : 
          `The following deals are ending in ${timeRemaining}!`
        }
      </p>
    </div>

    <div style="margin: 30px 0;">
      ${deals.map((deal, index) => `
        ${index > 0 ? '<hr style="border: 0; height: 2px; background: #eee; margin: 35px 0;">' : ''}
        
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px; border-collapse: collapse; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 6px;">
          <!-- Deal Header with Name and Status -->
          <tr>
            <td colspan="2" style="background-color: #f5f7f8; padding: 12px 15px; border-top-left-radius: 6px; border-top-right-radius: 6px; border-bottom: 1px solid #eaeaea;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 70%;">
                    <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">${deal.name}</h3>
                  </td>
                  <td style="width: 30%; text-align: right;">
                    <span style="
                      display: inline-block; 
                      padding: 5px 10px; 
                      border-radius: 20px; 
                      font-size: 12px; 
                      font-weight: bold; 
                      background: ${timeRemaining === 'expired' ? '#f44336' : '#ff9800'}; 
                      color: white;
                    ">
                      ${timeRemaining === 'expired' ? 'EXPIRED' : `ENDS IN ${timeRemaining.toUpperCase()}`}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Deal Content Row -->
          <tr>
            <!-- First column: Image or Content based on index -->
            <td width="${index % 2 === 0 ? '30%' : '70%'}" valign="top" style="padding: 15px; ${index % 2 === 0 ? 'background-color: #fff;' : ''}">
              ${index % 2 === 0 ? 
                `<div style="border: 1px solid #eaeaea; border-radius: 6px; overflow: hidden;">
                   <img src="${deal.images && deal.images.length > 0 ? deal.images[0] : `${FRONTEND_URL}/RTNLOGO.jpg`}" 
                        style="width: 100%; object-fit: cover; min-height: 200px; max-height: 250px; display: block;">
                 </div>` :
                `
                <div class="deal-content">                  
                  <!-- Category and Distributor tags -->
                  <div style="margin-bottom: 15px; display: block;">
                    ${deal.category ? `<span style="display: inline-block; margin-bottom: 8px; margin-right: 8px; background: #3498db; color: white; padding: 5px 10px; border-radius: 4px; font-size: 13px; font-weight: bold;">${deal.category}</span>` : ''}
                    ${deal.distributor ? `<span style="display: inline-block; margin-bottom: 8px; background: #2ecc71; color: white; padding: 5px 10px; border-radius: 4px; font-size: 13px; font-weight: bold;">${deal.distributor.name}</span>` : ''}
                  </div>
                  
                  <!-- Description -->
                  ${deal.description ? `<p style="color: #555; margin-bottom: 15px; font-size: 15px; line-height: 1.5;">${deal.description.substring(0, 120)}${deal.description.length > 120 ? '...' : ''}</p>` : ''}
                  
                  <!-- Deal Key Info Table -->
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px; border-collapse: separate; border-spacing: 0 8px;">
                    <tr>
                      <td width="33%" style="vertical-align: top; padding-right: 10px;">
                        <div style="background: #f8f9fa; border-radius: 4px; padding: 10px;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">End Date</p>
                          <p style="margin: 0; font-weight: bold; color: ${timeRemaining === 'expired' ? '#e74c3c' : '#2c3e50'}; font-size: 15px;">
                            ${new Date(deal.dealEndsAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td width="33%" style="vertical-align: top; padding-right: 10px;">
                        <div style="background: #f8f9fa; border-radius: 4px; padding: 10px;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Min Quantity</p>
                          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 15px;">
                            ${deal.minQtyForDiscount ? deal.minQtyForDiscount : '0'} units
                          </p>
                        </div>
                      </td>
                      <td width="33%" style="vertical-align: top;">
                        <div style="background: #f8f9fa; border-radius: 4px; padding: 10px;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Committed</p>
                          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 15px;">
                            ${deal.commitments && deal.commitments.length > 0 ? 
                              deal.commitments.reduce((total, commitment) => {
                                return total + commitment.sizeCommitments.reduce((sizeTotal, sizeCommit) => sizeTotal + sizeCommit.quantity, 0);
                              }, 0) : '0'} units
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Sizes info -->
                  ${deal.sizes && deal.sizes.length > 0 ? `
                    <div style="margin-top: 15px; margin-bottom: 20px; background: #f8f9fa; border-radius: 4px; padding: 12px;">
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; font-weight: bold;">Available Sizes:</p>
                      <div style="display: block;">
                        ${deal.sizes.map(size => `
                          <span style="display: inline-block; background: white; border: 1px solid #ddd; padding: 6px 10px; margin-right: 6px; margin-bottom: 6px; border-radius: 4px; font-size: 13px;">
                            <strong>${size.size}</strong>: $${size.discountPrice.toFixed(2)}
                          </span>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                  
                  <!-- Action button -->
                  <div style="margin-top: 20px;">
                    <a href="${FRONTEND_URL}/deals-catlog/deals/${deal._id}" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-size: 14px; font-weight: bold; text-align: center; transition: background 0.3s;">
                      ${timeRemaining === 'expired' ? 'View Details' : 'Make Commitment'}
                    </a>
                  </div>
                </div>
                `
              }
            </td>
            
            <!-- Second column: Content or Image based on index -->
            <td width="${index % 2 === 0 ? '70%' : '30%'}" valign="top" style="padding: 15px; ${index % 2 !== 0 ? 'background-color: #fff;' : ''}">
              ${index % 2 === 0 ? 
                `
                <div class="deal-content">                  
                  <!-- Category and Distributor tags -->
                  <div style="margin-bottom: 15px; display: block;">
                    ${deal.category ? `<span style="display: inline-block; margin-bottom: 8px; margin-right: 8px; background: #3498db; color: white; padding: 5px 10px; border-radius: 4px; font-size: 13px; font-weight: bold;">${deal.category}</span>` : ''}
                    ${deal.distributor ? `<span style="display: inline-block; margin-bottom: 8px; background: #2ecc71; color: white; padding: 5px 10px; border-radius: 4px; font-size: 13px; font-weight: bold;">${deal.distributor.name}</span>` : ''}
                  </div>
                  
                  <!-- Description -->
                  ${deal.description ? `<p style="color: #555; margin-bottom: 15px; font-size: 15px; line-height: 1.5;">${deal.description.substring(0, 120)}${deal.description.length > 120 ? '...' : ''}</p>` : ''}
                  
                  <!-- Deal Key Info Table -->
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px; border-collapse: separate; border-spacing: 0 8px;">
                    <tr>
                      <td width="33%" style="vertical-align: top; padding-right: 10px;">
                        <div style="background: #f8f9fa; border-radius: 4px; padding: 10px;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">End Date</p>
                          <p style="margin: 0; font-weight: bold; color: ${timeRemaining === 'expired' ? '#e74c3c' : '#2c3e50'}; font-size: 15px;">
                            ${new Date(deal.dealEndsAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td width="33%" style="vertical-align: top; padding-right: 10px;">
                        <div style="background: #f8f9fa; border-radius: 4px; padding: 10px;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Min Quantity</p>
                          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 15px;">
                            ${deal.minQtyForDiscount ? deal.minQtyForDiscount : '0'} units
                          </p>
                        </div>
                      </td>
                      <td width="33%" style="vertical-align: top;">
                        <div style="background: #f8f9fa; border-radius: 4px; padding: 10px;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Committed</p>
                          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 15px;">
                            ${deal.commitments && deal.commitments.length > 0 ? 
                              deal.commitments.reduce((total, commitment) => {
                                return total + commitment.sizeCommitments.reduce((sizeTotal, sizeCommit) => sizeTotal + sizeCommit.quantity, 0);
                              }, 0) : '0'} units
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Sizes info -->
                  ${deal.sizes && deal.sizes.length > 0 ? `
                    <div style="margin-top: 15px; margin-bottom: 20px; background: #f8f9fa; border-radius: 4px; padding: 12px;">
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; font-weight: bold;">Available Sizes:</p>
                      <div style="display: block;">
                        ${deal.sizes.map(size => `
                          <span style="display: inline-block; background: white; border: 1px solid #ddd; padding: 6px 10px; margin-right: 6px; margin-bottom: 6px; border-radius: 4px; font-size: 13px;">
                            <strong>${size.size}</strong>: $${size.discountPrice.toFixed(2)}
                          </span>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                  
                  <!-- Action button -->
                  <div style="margin-top: 20px;">
                    <a href="${FRONTEND_URL}/deals-catlog/deals/${deal._id}" style="display: inline-block; background-color: #3498db; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-size: 14px; font-weight: bold; text-align: center; transition: background 0.3s;">
                      ${timeRemaining === 'expired' ? 'View Details' : 'Make Commitment'}
                    </a>
                  </div>
                </div>
                ` :
                `<div style="border: 1px solid #eaeaea; border-radius: 6px; overflow: hidden;">
                   <img src="${deal.images && deal.images.length > 0 ? deal.images[0] : `${FRONTEND_URL}/RTNLOGO.jpg`}" 
                        style="width: 100%; object-fit: cover; min-height: 200px; max-height: 250px; display: block;">
                 </div>`
              }
            </td>
          </tr>
          
          <!-- Size Commitments Breakdown Section (Always shown) -->
          <tr>
            <td colspan="2" style="padding: 0 15px 15px;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #eaeaea; padding-top: 15px; margin-top: 5px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #555;">Commitments By Size:</p>
                    
                    ${deal.commitments && deal.commitments.length > 0 ? `
                      <table width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; border-collapse: collapse;">
                        <tr style="background-color: #f5f7f8; text-align: left;">
                          <th style="padding: 8px; border: 1px solid #eaeaea;">Size</th>
                          <th style="padding: 8px; border: 1px solid #eaeaea;">Committed Qty</th>
                          <th style="padding: 8px; border: 1px solid #eaeaea;">Price</th>
                        </tr>
                        ${(() => {
                          // Calculate total commitments by size
                          const sizeCommitments = {};
                          
                          // Aggregate quantities by size
                          deal.commitments.forEach(commitment => {
                            commitment.sizeCommitments.forEach(sizeCommit => {
                              if (!sizeCommitments[sizeCommit.size]) {
                                sizeCommitments[sizeCommit.size] = {
                                  quantity: 0,
                                  price: sizeCommit.pricePerUnit
                                };
                              }
                              sizeCommitments[sizeCommit.size].quantity += sizeCommit.quantity;
                            });
                          });
                          
                          // Generate table rows
                          return Object.entries(sizeCommitments).map(([size, data]) => `
                            <tr>
                              <td style="padding: 8px; border: 1px solid #eaeaea;">${size}</td>
                              <td style="padding: 8px; border: 1px solid #eaeaea;">${data.quantity} units</td>
                              <td style="padding: 8px; border: 1px solid #eaeaea;">$${data.price.toFixed(2)}</td>
                            </tr>
                          `).join('');
                        })()}
                        <tr style="background-color: #f9f9f9; font-weight: bold;">
                          <td style="padding: 8px; border: 1px solid #eaeaea;">Total</td>
                          <td style="padding: 8px; border: 1px solid #eaeaea;" colspan="2">
                            ${deal.commitments.reduce((total, commitment) => {
                              return total + commitment.sizeCommitments.reduce((sizeTotal, sizeCommit) => sizeTotal + sizeCommit.quantity, 0);
                            }, 0)} units
                          </td>
                        </tr>
                      </table>
                    ` : `
                      <p style="margin: 0; color: #777; font-style: italic;">No commitments yet - Be the first!</p>
                    `}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `).join('')}
    </div>

    ${timeRemaining !== 'expired' ? `
      <p style="margin: 25px 0 15px; font-size: 16px;">Don't miss out on these opportunities! Review these deals and make your commitments before they expire.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/deals-catlog" style="display: inline-block; background-color: #2980b9; color: white; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-size: 16px; font-weight: bold;">View All Deals</a>
      </div>

      <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
        <strong>Note:</strong> Once deals expire, they will no longer be available for new commitments.
      </p>
    ` : `
      <p style="margin: 25px 0 15px; font-size: 16px;">Thank you for your interest in these deals. Check out our other active deals:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/deals-catlog" style="display: inline-block; background-color: #2980b9; color: white; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-size: 16px; font-weight: bold;">Browse Active Deals</a>
      </div>
    `}
  `);
}; 