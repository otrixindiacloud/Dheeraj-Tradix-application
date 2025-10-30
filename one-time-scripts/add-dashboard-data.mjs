#!/usr/bin/env node

/**
 * Simple Dashboard Data Addition Script
 * This script adds some basic data to populate the dashboard
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  return res.json();
}

async function addDashboardData() {
  console.log('🚀 Adding dashboard data...\n');
  
  try {
    // Get existing customers
    const customersResponse = await safeFetch(`${BASE_URL}/api/customers`);
    const customers = customersResponse.customers || [];
    
    if (customers.length === 0) {
      console.log('❌ No customers found. Please create customers first.');
      return;
    }
    
    const customer = customers[0]; // Use first customer
    console.log(`✓ Using customer: ${customer.name}`);
    
    // Create a quotation
    try {
      const quotation = await safeFetch(`${BASE_URL}/api/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          customerType: customer.customerType || 'Retail',
          quoteNumber: `QT-${Date.now()}`,
          status: 'Draft',
          currency: 'BHD',
          subtotal: '1000.00',
          taxAmount: '100.00',
          discountAmount: '0.00',
          totalAmount: '1100.00',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: 'Sample quotation for dashboard'
        })
      });
      console.log(`✓ Created quotation: ${quotation.quoteNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating quotation: ${error.message}`);
    }
    
    // Create a sales order
    try {
      const salesOrder = await safeFetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          status: 'Confirmed',
          subtotal: '2000.00',
          taxAmount: '200.00',
          discountAmount: '0.00',
          totalAmount: '2200.00',
          notes: 'Sample sales order for dashboard'
        })
      });
      console.log(`✓ Created sales order: ${salesOrder.orderNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating sales order: ${error.message}`);
    }
    
    // Create an invoice
    try {
      const invoice = await safeFetch(`${BASE_URL}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          salesOrderId: '00000000-0000-0000-0000-000000000000', // Dummy sales order ID
          invoiceNumber: `INV-${Date.now()}`,
          status: 'Sent',
          subtotal: '1500.00',
          taxAmount: '150.00',
          discountAmount: '0.00',
          totalAmount: '1650.00',
          paidAmount: '0.00',
          remainingAmount: '1650.00',
          paymentTerms: 'Net 30',
          notes: 'Sample invoice for dashboard'
        })
      });
      console.log(`✓ Created invoice: ${invoice.invoiceNumber}`);
    } catch (error) {
      console.log(`⚠ Error creating invoice: ${error.message}`);
    }
    
    // Check dashboard stats
    const stats = await safeFetch(`${BASE_URL}/api/dashboard/stats`);
    console.log('\n📊 Current Dashboard Stats:');
    console.log(`   • Active Enquiries: ${stats.activeEnquiries}`);
    console.log(`   • Pending Quotes: ${stats.pendingQuotes}`);
    console.log(`   • Active Orders: ${stats.activeOrders}`);
    console.log(`   • Monthly Revenue: BHD ${stats.monthlyRevenue}`);
    
    console.log('\n✅ Dashboard data addition completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addDashboardData();
