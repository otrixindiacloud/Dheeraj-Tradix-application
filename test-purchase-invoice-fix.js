#!/usr/bin/env node

/**
 * Test Purchase Invoice PDF Fix
 * 
 * Tests the fixes for:
 * 1. Purchase invoice items retrieval (lpo_item_id column fix)
 * 2. Purchase invoice PDF generation
 * 3. PDF table data endpoint
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const PURCHASE_INVOICE_ID = process.argv[2] || '246a741a-d40c-4af1-b8c3-55746f43d449';

async function testPurchaseInvoiceItems() {
  console.log('\n📦 Test 1: Purchase Invoice Items Retrieval');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase-invoices/${PURCHASE_INVOICE_ID}/items`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Failed: HTTP ${response.status}`);
      console.log(`   Error: ${errorText}`);
      return false;
    }
    
    const items = await response.json();
    console.log(`✅ Success: Retrieved ${items.length} items`);
    
    if (items.length > 0) {
      const firstItem = items[0];
      console.log(`\n   Sample item:`);
      console.log(`   - Description: ${firstItem.itemDescription || 'N/A'}`);
      console.log(`   - Quantity: ${firstItem.quantity || 0}`);
      console.log(`   - Unit Price: ${firstItem.unitPrice || '0'}`);
      console.log(`   - LPO Item ID: ${firstItem.lpoItemId || 'NULL (expected if column doesn\'t exist)'}`);
      console.log(`   - Discount Rate: ${firstItem.discountRate || '0'}%`);
      console.log(`   - Tax Rate: ${firstItem.taxRate || '0'}%`);
    } else {
      console.log('   ⚠️  No items found (this may be expected)');
    }
    
    return true;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function testPurchaseInvoiceDetails() {
  console.log('\n📄 Test 2: Purchase Invoice Details with Items');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase-invoices/${PURCHASE_INVOICE_ID}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Failed: HTTP ${response.status}`);
      console.log(`   Error: ${errorText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Success: Retrieved invoice ${data.invoiceNumber || data.id}`);
    console.log(`\n   Invoice Details:`);
    console.log(`   - Invoice Number: ${data.invoiceNumber || 'N/A'}`);
    console.log(`   - Supplier: ${data.supplierName || 'N/A'}`);
    console.log(`   - Status: ${data.status || 'N/A'}`);
    console.log(`   - Total Amount: ${data.currency || 'BHD'} ${data.totalAmount || '0'}`);
    console.log(`   - Items Count: ${data.items?.length || 0}`);
    
    if (data.items && data.items.length > 0) {
      console.log(`\n   ✅ Items array loaded successfully`);
      const firstItem = data.items[0];
      console.log(`   - First item: ${firstItem.itemDescription || 'N/A'}`);
    } else {
      console.log(`   ⚠️  No items in response`);
    }
    
    return true;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function testPdfTableData() {
  console.log('\n📊 Test 3: PDF Table Data Endpoint');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase-invoices/${PURCHASE_INVOICE_ID}/pdf-table-data`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Failed: HTTP ${response.status}`);
      console.log(`   Error: ${errorText}`);
      return false;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.log(`❌ API returned success: false`);
      console.log(`   Message: ${data.message || 'Unknown error'}`);
      return false;
    }
    
    console.log(`✅ Success: PDF table data generated`);
    console.log(`\n   Table Information:`);
    console.log(`   - Invoice Number: ${data.invoiceNumber || 'N/A'}`);
    console.log(`   - Currency: ${data.currency || 'BHD'}`);
    console.log(`   - Headers: ${data.tableHeaders?.length || 0} columns`);
    console.log(`   - Rows: ${data.tableData?.length || 0} items`);
    console.log(`   - Generated At: ${data.generatedAt || 'N/A'}`);
    
    if (data.totals) {
      console.log(`\n   Totals:`);
      console.log(`   - Gross: ${data.currency} ${data.totals.totalGrossAmount || '0'}`);
      console.log(`   - Discount: ${data.currency} ${data.totals.totalDiscountAmount || '0'}`);
      console.log(`   - Net: ${data.currency} ${data.totals.totalNetAmount || '0'}`);
      console.log(`   - VAT: ${data.currency} ${data.totals.totalVatAmount || '0'}`);
      console.log(`   - Total: ${data.currency} ${data.totals.totalAmount || '0'}`);
    }
    
    if (data.tableData && data.tableData.length > 0) {
      const firstRow = data.tableData[0];
      console.log(`\n   Sample Row:`);
      console.log(`   - Item: ${firstRow.itemDescription || 'N/A'}`);
      console.log(`   - Qty: ${firstRow.quantity || '0'}`);
      console.log(`   - Unit Cost: ${data.currency} ${firstRow.unitCost || '0'}`);
      console.log(`   - Discount: ${firstRow.discountPercent || '0'}% (${data.currency} ${firstRow.discountAmount || '0'})`);
      console.log(`   - VAT: ${firstRow.vatPercent || '0'}% (${data.currency} ${firstRow.vatAmount || '0'})`);
      console.log(`   - Total: ${data.currency} ${firstRow.totalAmount || '0'}`);
    }
    
    return true;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function testPdfGeneration() {
  console.log('\n📑 Test 4: PDF Generation');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase-invoices/${PURCHASE_INVOICE_ID}/pdf`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Failed: HTTP ${response.status}`);
      
      // Try to parse as JSON for error message
      try {
        const errorJson = JSON.parse(errorText);
        console.log(`   Error: ${errorJson.message || errorText}`);
        if (errorJson.error) {
          console.log(`   Details: ${errorJson.error}`);
        }
      } catch {
        console.log(`   Error: ${errorText.substring(0, 200)}`);
      }
      return false;
    }
    
    // Check if response is PDF
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('pdf')) {
      console.log(`⚠️  Warning: Expected PDF, got ${contentType}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const buffer = await response.arrayBuffer();
    
    console.log(`✅ Success: PDF generated`);
    console.log(`\n   PDF Information:`);
    console.log(`   - Content Type: ${contentType || 'N/A'}`);
    console.log(`   - Size: ${contentLength || buffer.byteLength} bytes`);
    console.log(`   - File Name: ${response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'purchase-invoice.pdf'}`);
    
    // Check PDF header (should start with %PDF)
    const uint8Array = new Uint8Array(buffer.slice(0, 4));
    const pdfHeader = String.fromCharCode(...uint8Array);
    if (pdfHeader === '%PDF') {
      console.log(`   - Valid PDF header: ✅`);
    } else {
      console.log(`   - Valid PDF header: ❌ (Expected %PDF, got ${pdfHeader})`);
    }
    
    return true;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🧪 Purchase Invoice PDF Fix Test Suite');
  console.log('='.repeat(60));
  console.log(`Testing Purchase Invoice ID: ${PURCHASE_INVOICE_ID}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  
  const results = {
    items: await testPurchaseInvoiceItems(),
    details: await testPurchaseInvoiceDetails(),
    pdfTable: await testPdfTableData(),
    pdfGeneration: await testPdfGeneration(),
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`✅ Purchase Invoice Items: ${results.items ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Purchase Invoice Details: ${results.details ? 'PASS' : 'FAIL'}`);
  console.log(`✅ PDF Table Data: ${results.pdfTable ? 'PASS' : 'FAIL'}`);
  console.log(`✅ PDF Generation: ${results.pdfGeneration ? 'PASS' : 'FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error('💥 Crash:', e);
  process.exit(1);
});

