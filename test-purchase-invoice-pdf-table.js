#!/usr/bin/env node

/**
 * Purchase Invoice PDF Table Data Test Script
 *
 * Usage: node test-purchase-invoice-pdf-table.js <PURCHASE_INVOICE_ID>
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testPurchaseInvoicePdfTableData(invoiceId) {
  console.log(`\n🧪 Testing Purchase Invoice PDF Table Data for ID: ${invoiceId}`);
  console.log('='.repeat(60));

  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase-invoices/${invoiceId}/pdf-table-data`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Required fields
    const requiredFields = [
      'success', 'purchaseInvoiceId', 'invoiceNumber', 'currency',
      'tableHeaders', 'tableData', 'totals', 'itemCount', 'generatedAt'
    ];
    const missing = requiredFields.filter(f => !(f in data));
    if (missing.length) {
      console.log(`❌ Missing fields: ${missing.join(', ')}`);
      return false;
    }
    console.log('✅ Response contains required fields');

    // Headers validation
    const expectedHeaders = ['S/I','Item Description & Specifications','Qty','Unit Cost','Disc %','Disc Amt','VAT %','VAT Amt','Total Amount'];
    const headersMatch = JSON.stringify(data.tableHeaders) === JSON.stringify(expectedHeaders);
    console.log(`📋 Headers: ${headersMatch ? '✅ PASS' : '⚠️ MISMATCH'}`);
    if (!headersMatch) {
      console.log(`   Expected: ${expectedHeaders.join(' | ')}`);
      console.log(`   Received: ${data.tableHeaders.join(' | ')}`);
    }

    // Row structure validation
    if (data.tableData.length === 0) {
      console.log('⚠️ No table rows returned');
    } else {
      const first = data.tableData[0];
      const requiredRowFields = ['serialNumber','itemDescription','quantity','unitCost','discountPercent','discountAmount','vatPercent','vatAmount','totalAmount'];
      const missingRow = requiredRowFields.filter(f => !(f in first));
      console.log(`📝 Row fields: ${missingRow.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
      if (missingRow.length) {
        console.log(`   Missing row fields: ${missingRow.join(', ')}`);
      }
    }

    // Totals validation
    const requiredTotals = ['totalGrossAmount','totalDiscountAmount','totalNetAmount','totalVatAmount','totalAmount'];
    const missingTotals = requiredTotals.filter(f => !(f in data.totals));
    console.log(`💰 Totals: ${missingTotals.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
    if (missingTotals.length) {
      console.log(`   Missing totals: ${missingTotals.join(', ')}`);
    }

    // Display sample
    console.log('\n📋 Sample:');
    console.log(`   Invoice #: #${data.invoiceNumber}`);
    console.log(`   Currency: ${data.currency}`);
    console.log(`   Items: ${data.itemCount}`);
    if (data.tableData.length > 0) {
      const s = data.tableData[0];
      console.log(`   1) ${s.itemDescription.substring(0,60)}...`);
      console.log(`      Qty: ${s.quantity}  Unit: ${data.currency} ${s.unitCost}`);
      console.log(`      Disc: ${s.discountPercent}% (${data.currency} ${s.discountAmount})`);
      console.log(`      VAT: ${s.vatPercent}% (${data.currency} ${s.vatAmount})`);
      console.log(`      Total: ${data.currency} ${s.totalAmount}`);
    }

    console.log('\n💰 Totals:');
    console.log(`   Gross: ${data.currency} ${data.totals.totalGrossAmount}`);
    console.log(`   Discount: ${data.currency} ${data.totals.totalDiscountAmount}`);
    console.log(`   Net: ${data.currency} ${data.totals.totalNetAmount}`);
    console.log(`   VAT: ${data.currency} ${data.totals.totalVatAmount}`);
    console.log(`   Total: ${data.currency} ${data.totals.totalAmount}`);

    console.log('\n✅ Tests completed');
    return true;
  } catch (err) {
    console.log(`❌ Test failed: ${err.message}`);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling');
  console.log('='.repeat(40));
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase-invoices/invalid-id/pdf-table-data`);
    if (response.status === 404) {
      console.log('✅ 404 handling OK');
    } else {
      console.log(`⚠️ Expected 404, got ${response.status}`);
    }
    const errorData = await response.json();
    console.log(`📝 Error body: ${JSON.stringify(errorData, null, 2)}`);
  } catch (err) {
    console.log(`❌ Error test failed: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Purchase Invoice PDF Table Data Test Suite');
  console.log('============================================');
  const invoiceId = process.argv[2];
  if (!invoiceId) {
    console.log('❌ Provide a Purchase Invoice ID');
    console.log('Usage: node test-purchase-invoice-pdf-table.js <PURCHASE_INVOICE_ID>');
    process.exit(1);
  }
  const ok = await testPurchaseInvoicePdfTableData(invoiceId);
  await testErrorHandling();
  console.log('\n🏁 Done');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('💥 Crash:', e); process.exit(1); });


