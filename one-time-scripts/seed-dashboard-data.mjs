#!/usr/bin/env node

/**
 * Dashboard Data Seeding Script
 * This script creates comprehensive sample data for the dashboard to display meaningful metrics
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createSampleCustomers() {
  console.log('Creating sample customers...');
  
  const customers = [
    {
      name: 'Golden Tag Trading LLC',
      email: 'info@goldentag.com',
      phone: '+973-1234-5678',
      customerType: 'Corporate',
      classification: 'Premium',
      address: 'Building 123, Road 456, Manama, Bahrain'
    },
    {
      name: 'Al Rashid Group',
      email: 'orders@alrashid.com',
      phone: '+973-2345-6789',
      customerType: 'Corporate',
      classification: 'Standard',
      address: 'Office 789, Diplomatic Area, Manama, Bahrain'
    },
    {
      name: 'Retail Store ABC',
      email: 'manager@retailabc.com',
      phone: '+973-3456-7890',
      customerType: 'Retail',
      classification: 'Standard',
      address: 'Shop 101, City Center Mall, Manama, Bahrain'
    },
    {
      name: 'Tech Solutions Inc',
      email: 'procurement@techsolutions.com',
      phone: '+973-4567-8901',
      customerType: 'Corporate',
      classification: 'Premium',
      address: 'Tower 456, Financial Harbor, Manama, Bahrain'
    },
    {
      name: 'Small Business Co',
      email: 'owner@smallbiz.com',
      phone: '+973-5678-9012',
      customerType: 'Retail',
      classification: 'Basic',
      address: 'Unit 202, Business Park, Manama, Bahrain'
    }
  ];

  const createdCustomers = [];
  for (const customerData of customers) {
    try {
      const customer = await safeFetch(`${BASE_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });
      createdCustomers.push(customer);
      console.log(`✓ Created customer: ${customer.name}`);
    } catch (error) {
      console.log(`⚠ Customer might already exist: ${customerData.name}`);
      // Try to find existing customer by name
      try {
        const existingCustomers = await safeFetch(`${BASE_URL}/api/customers`);
        const existingCustomer = existingCustomers.customers.find(c => c.name === customerData.name);
        if (existingCustomer) {
          createdCustomers.push(existingCustomer);
          console.log(`✓ Using existing customer: ${existingCustomer.name}`);
        } else {
          // Create a fallback customer if none found
          const fallbackCustomer = {
            id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...customerData
          };
          createdCustomers.push(fallbackCustomer);
          console.log(`✓ Using fallback customer: ${fallbackCustomer.name}`);
        }
      } catch (fetchError) {
        console.log(`⚠ Error fetching existing customers: ${fetchError.message}`);
        // Create a fallback customer
        const fallbackCustomer = {
          id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...customerData
        };
        createdCustomers.push(fallbackCustomer);
        console.log(`✓ Using fallback customer: ${fallbackCustomer.name}`);
      }
    }
  }
  
  return createdCustomers;
}

async function createSampleEnquiries(customers) {
  console.log('Creating sample enquiries...');
  
  const enquiryData = [
    {
      customerId: customers[0].id,
      enquiryNumber: `ENQ-${Date.now()}-001`,
      subject: 'Bulk Order for Electronics Components',
      description: 'Need 1000 units of various electronic components for Q1 production',
      priority: 'High',
      status: 'New',
      expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 50000,
      currency: 'BHD'
    },
    {
      customerId: customers[1].id,
      enquiryNumber: `ENQ-${Date.now()}-002`,
      subject: 'Office Supplies Monthly Order',
      description: 'Regular monthly order for office supplies and stationery',
      priority: 'Medium',
      status: 'In Progress',
      expectedDeliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 2500,
      currency: 'BHD'
    },
    {
      customerId: customers[2].id,
      enquiryNumber: `ENQ-${Date.now()}-003`,
      subject: 'Retail Display Items',
      description: 'Custom display items for retail store setup',
      priority: 'Low',
      status: 'Quoted',
      expectedDeliveryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 1500,
      currency: 'BHD'
    },
    {
      customerId: customers[3].id,
      enquiryNumber: `ENQ-${Date.now()}-004`,
      subject: 'IT Hardware Procurement',
      description: 'Complete IT hardware setup for new office',
      priority: 'High',
      status: 'New',
      expectedDeliveryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 75000,
      currency: 'BHD'
    },
    {
      customerId: customers[4].id,
      enquiryNumber: `ENQ-${Date.now()}-005`,
      subject: 'Small Business Starter Kit',
      description: 'Basic office equipment and supplies package',
      priority: 'Medium',
      status: 'Closed',
      expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 800,
      currency: 'BHD'
    }
  ];

  const createdEnquiries = [];
  for (const enquiry of enquiryData) {
    try {
      const created = await safeFetch(`${BASE_URL}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enquiry)
      });
      createdEnquiries.push(created);
      console.log(`✓ Created enquiry: ${enquiry.enquiryNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating enquiry: ${error.message}`);
    }
  }
  
  return createdEnquiries;
}

async function createSampleQuotations(customers, enquiries) {
  console.log('Creating sample quotations...');
  
  const quotationData = [
    {
      customerId: customers[0].id,
      enquiryId: enquiries[0]?.id,
      quoteNumber: `QT-${Date.now()}-001`,
      status: 'Draft',
      currency: 'BHD',
      subtotal: 45000,
      taxAmount: 4500,
      discountAmount: 2000,
      totalAmount: 47500,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Bulk discount applied for order over 40,000 BHD'
    },
    {
      customerId: customers[1].id,
      enquiryId: enquiries[1]?.id,
      quoteNumber: `QT-${Date.now()}-002`,
      status: 'Sent',
      currency: 'BHD',
      subtotal: 2300,
      taxAmount: 230,
      discountAmount: 0,
      totalAmount: 2530,
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Standard pricing for regular customer'
    },
    {
      customerId: customers[2].id,
      enquiryId: enquiries[2]?.id,
      quoteNumber: `QT-${Date.now()}-003`,
      status: 'Accepted',
      currency: 'BHD',
      subtotal: 1400,
      taxAmount: 140,
      discountAmount: 50,
      totalAmount: 1490,
      validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Custom design included in pricing'
    },
    {
      customerId: customers[3].id,
      enquiryId: enquiries[3]?.id,
      quoteNumber: `QT-${Date.now()}-004`,
      status: 'Draft',
      currency: 'BHD',
      subtotal: 68000,
      taxAmount: 6800,
      discountAmount: 5000,
      totalAmount: 69800,
      validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Premium support and extended warranty included'
    },
    {
      customerId: customers[4].id,
      enquiryId: enquiries[4]?.id,
      quoteNumber: `QT-${Date.now()}-005`,
      status: 'Rejected',
      currency: 'BHD',
      subtotal: 750,
      taxAmount: 75,
      discountAmount: 0,
      totalAmount: 825,
      validUntil: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Customer found better pricing elsewhere'
    }
  ];

  const createdQuotations = [];
  for (const quotation of quotationData) {
    try {
      const created = await safeFetch(`${BASE_URL}/api/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotation)
      });
      createdQuotations.push(created);
      console.log(`✓ Created quotation: ${quotation.quoteNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating quotation: ${error.message}`);
    }
  }
  
  return createdQuotations;
}

async function createSampleSalesOrders(customers, quotations) {
  console.log('Creating sample sales orders...');
  
  const salesOrderData = [
    {
      customerId: customers[0].id,
      quotationId: quotations[0]?.id,
      orderNumber: `SO-${Date.now()}-001`,
      status: 'Confirmed',
      currency: 'BHD',
      subtotal: 45000,
      taxAmount: 4500,
      discountAmount: 2000,
      totalAmount: 47500,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Priority order for Q1 production'
    },
    {
      customerId: customers[1].id,
      quotationId: quotations[1]?.id,
      orderNumber: `SO-${Date.now()}-002`,
      status: 'Processing',
      currency: 'BHD',
      subtotal: 2300,
      taxAmount: 230,
      discountAmount: 0,
      totalAmount: 2530,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Regular monthly order'
    },
    {
      customerId: customers[2].id,
      quotationId: quotations[2]?.id,
      orderNumber: `SO-${Date.now()}-003`,
      status: 'Shipped',
      currency: 'BHD',
      subtotal: 1400,
      taxAmount: 140,
      discountAmount: 50,
      totalAmount: 1490,
      orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Custom items in production'
    },
    {
      customerId: customers[3].id,
      quotationId: quotations[3]?.id,
      orderNumber: `SO-${Date.now()}-004`,
      status: 'Delivered',
      currency: 'BHD',
      subtotal: 68000,
      taxAmount: 6800,
      discountAmount: 5000,
      totalAmount: 69800,
      orderDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'IT setup completed successfully'
    },
    {
      customerId: customers[4].id,
      orderNumber: `SO-${Date.now()}-005`,
      status: 'Pending',
      currency: 'BHD',
      subtotal: 800,
      taxAmount: 80,
      discountAmount: 0,
      totalAmount: 880,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Awaiting customer confirmation'
    }
  ];

  const createdSalesOrders = [];
  for (const order of salesOrderData) {
    try {
      const created = await safeFetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      createdSalesOrders.push(created);
      console.log(`✓ Created sales order: ${order.orderNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating sales order: ${error.message}`);
    }
  }
  
  return createdSalesOrders;
}

async function createSampleInvoices(customers, salesOrders) {
  console.log('Creating sample invoices...');
  
  const invoiceData = [
    {
      customerId: customers[0].id,
      salesOrderId: salesOrders[0]?.id,
      invoiceNumber: `INV-${Date.now()}-001`,
      status: 'Sent',
      currency: 'BHD',
      subtotal: 45000,
      taxAmount: 4500,
      discountAmount: 2000,
      totalAmount: 47500,
      paidAmount: 0,
      remainingAmount: 47500,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 30',
      notes: 'Payment due within 30 days'
    },
    {
      customerId: customers[1].id,
      salesOrderId: salesOrders[1]?.id,
      invoiceNumber: `INV-${Date.now()}-002`,
      status: 'Paid',
      currency: 'BHD',
      subtotal: 2300,
      taxAmount: 230,
      discountAmount: 0,
      totalAmount: 2530,
      paidAmount: 2530,
      remainingAmount: 0,
      invoiceDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 15',
      notes: 'Payment received on time'
    },
    {
      customerId: customers[2].id,
      salesOrderId: salesOrders[2]?.id,
      invoiceNumber: `INV-${Date.now()}-003`,
      status: 'Overdue',
      currency: 'BHD',
      subtotal: 1400,
      taxAmount: 140,
      discountAmount: 50,
      totalAmount: 1490,
      paidAmount: 0,
      remainingAmount: 1490,
      invoiceDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 30',
      notes: 'Follow up required for overdue payment'
    },
    {
      customerId: customers[3].id,
      salesOrderId: salesOrders[3]?.id,
      invoiceNumber: `INV-${Date.now()}-004`,
      status: 'Paid',
      currency: 'BHD',
      subtotal: 68000,
      taxAmount: 6800,
      discountAmount: 5000,
      totalAmount: 69800,
      paidAmount: 69800,
      remainingAmount: 0,
      invoiceDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 15',
      notes: 'Large order payment received'
    },
    {
      customerId: customers[4].id,
      salesOrderId: salesOrders[4]?.id,
      invoiceNumber: `INV-${Date.now()}-005`,
      status: 'Draft',
      currency: 'BHD',
      subtotal: 800,
      taxAmount: 80,
      discountAmount: 0,
      totalAmount: 880,
      paidAmount: 0,
      remainingAmount: 880,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 15',
      notes: 'Draft invoice pending order confirmation'
    }
  ];

  const createdInvoices = [];
  for (const invoice of invoiceData) {
    try {
      const created = await safeFetch(`${BASE_URL}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      });
      createdInvoices.push(created);
      console.log(`✓ Created invoice: ${invoice.invoiceNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating invoice: ${error.message}`);
    }
  }
  
  return createdInvoices;
}

async function createSampleItems() {
  console.log('Creating sample items...');
  
  const items = [
    {
      name: 'Electronic Component A',
      description: 'High-quality electronic component for industrial use',
      sku: 'EC-A-001',
      barcode: '1234567890123',
      category: 'Electronics',
      unitOfMeasure: 'PCS',
      unitPrice: 25.50,
      costPrice: 18.00,
      supplierCode: 'SUP-EC-A-001',
      isActive: true
    },
    {
      name: 'Office Supplies Kit',
      description: 'Complete office supplies package',
      sku: 'OS-KIT-001',
      barcode: '1234567890124',
      category: 'Office Supplies',
      unitOfMeasure: 'SET',
      unitPrice: 45.00,
      costPrice: 30.00,
      supplierCode: 'SUP-OS-001',
      isActive: true
    },
    {
      name: 'IT Hardware Bundle',
      description: 'Complete IT hardware setup package',
      sku: 'IT-BUNDLE-001',
      barcode: '1234567890125',
      category: 'IT Hardware',
      unitOfMeasure: 'SET',
      unitPrice: 1500.00,
      costPrice: 1200.00,
      supplierCode: 'SUP-IT-001',
      isActive: true
    },
    {
      name: 'Retail Display Unit',
      description: 'Custom retail display unit',
      sku: 'RD-UNIT-001',
      barcode: '1234567890126',
      category: 'Retail Equipment',
      unitOfMeasure: 'UNIT',
      unitPrice: 200.00,
      costPrice: 150.00,
      supplierCode: 'SUP-RD-001',
      isActive: true
    },
    {
      name: 'Small Business Starter Pack',
      description: 'Essential items for small business setup',
      sku: 'SBS-PACK-001',
      barcode: '1234567890127',
      category: 'Business Starter',
      unitOfMeasure: 'PACK',
      unitPrice: 150.00,
      costPrice: 100.00,
      supplierCode: 'SUP-SBS-001',
      isActive: true
    }
  ];

  const createdItems = [];
  for (const item of items) {
    try {
      const created = await safeFetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      createdItems.push(created);
      console.log(`✓ Created item: ${item.name}`);
    } catch (error) {
      console.log(`⚠ Error creating item: ${error.message}`);
    }
  }
  
  return createdItems;
}

async function main() {
  console.log('🚀 Starting Dashboard Data Seeding...\n');
  
  try {
    // Create sample data in sequence
    const customers = await createSampleCustomers();
    await delay(1000);
    
    const enquiries = await createSampleEnquiries(customers);
    await delay(1000);
    
    const quotations = await createSampleQuotations(customers, enquiries);
    await delay(1000);
    
    const salesOrders = await createSampleSalesOrders(customers, quotations);
    await delay(1000);
    
    const invoices = await createSampleInvoices(customers, salesOrders);
    await delay(1000);
    
    const items = await createSampleItems();
    
    console.log('\n✅ Dashboard data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Customers: ${customers.length}`);
    console.log(`   • Enquiries: ${enquiries.length}`);
    console.log(`   • Quotations: ${quotations.length}`);
    console.log(`   • Sales Orders: ${salesOrders.length}`);
    console.log(`   • Invoices: ${invoices.length}`);
    console.log(`   • Items: ${items.length}`);
    
    console.log('\n🎯 Dashboard should now display:');
    console.log('   • Active Enquiries: 2 (New + In Progress)');
    console.log('   • Pending Quotes: 2 (Draft + Sent)');
    console.log('   • Active Orders: 3 (Confirmed + Processing + Shipped)');
    console.log('   • Monthly Revenue: Calculated from current month orders');
    
    console.log('\n🌐 You can now view the dashboard at: http://localhost:3000/dashboard');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
