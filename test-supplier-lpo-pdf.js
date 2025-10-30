// Quick test to generate a Supplier LPO PDF (quotation-style) with dummy data
// Run: node test-supplier-lpo-pdf.js

const fs = require('fs');
const path = require('path');

// Use compiled dist if available, otherwise ts-node will handle ts imports in dev
const pdf = require('./dist/index.js');

async function main() {
  // Fallback to requiring TypeScript source if dist export not present
  let generateSupplierLpoPdf;
  try {
    // In dist build we re-export server/pdf/pdf-utils generate methods
    generateSupplierLpoPdf = pdf.server?.pdf?.generateSupplierLpoPdf || pdf.generateSupplierLpoPdf;
  } catch (e) {}
  if (!generateSupplierLpoPdf) {
    ({ generateSupplierLpoPdf } = require('./server/pdf/pdf-utils'));
  }

  const lpo = {
    lpoNumber: 'LPO-TEST-001',
    lpoDate: new Date().toISOString(),
    expectedDeliveryDate: new Date(Date.now() + 7*24*3600*1000).toISOString(),
    status: 'Draft',
    paymentTerms: '30 Days',
    deliveryTerms: 'FOB',
    currency: 'BHD',
    termsAndConditions: 'Standard terms apply.',
    specialInstructions: 'Handle with care.',
    supplierEmail: 'supplier@example.com',
    supplierPhone: '+973 0000 0000',
    supplierContactPerson: 'Mr. Supplier'
  };

  const supplier = {
    name: 'Sample Supplier WLL',
    address: 'Manama, Bahrain',
    email: 'supplier@example.com',
    phone: '+973 0000 0000',
    contactPerson: 'Mr. Supplier'
  };

  const items = [
    {
      itemDescription: 'Steel Bolts M8',
      quantity: 100,
      costPrice: 0.250,
      unitCost: 0.250,
      discountPercent: 5,
      vatPercent: 10,
      specifications: 'Zinc coated'
    },
    {
      itemDescription: 'Industrial Adhesive 1L',
      quantity: 12,
      costPrice: 2.900,
      unitCost: 2.900,
      discountAmount: 1.20,
      vatPercent: 10
    }
  ];

  const { buffer, fileName } = generateSupplierLpoPdf({ lpo, items, supplier, mode: 'enhanced' });
  const outDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, fileName || 'lpo-test.pdf');
  fs.writeFileSync(outPath, buffer);
  console.log('Wrote PDF:', outPath, 'size:', buffer.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


