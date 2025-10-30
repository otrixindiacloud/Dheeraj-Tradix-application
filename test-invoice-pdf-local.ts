#!/usr/bin/env -S npx tsx

import fs from 'fs';
import path from 'path';
import { buildEnhancedInvoicePdf } from './server/pdf/pdf-utils.ts';

async function main() {
  const outDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sample = {
    invoice: {
      invoiceNumber: 'INV-LOCAL-TEST',
      currency: 'USD',
      subtotal: 300,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 300,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    items: [
      { description: 'Aluminum Sheet 2mm - 1x2m', quantity: 2, unitPrice: 50, discountPercentage: 0, taxRate: 10 },
      { description: 'Stainless Bolt M8x30 - Box of 100', quantity: 1, unitPrice: 150, discountPercentage: 5, taxRate: 10 },
      { description: 'Industrial Adhesive 500ml', quantity: 3, unitPrice: 16.67, discountPercentage: 0, taxRate: 10 },
    ],
    customer: {
      name: 'Local Test Customer',
      address: '123 Test Ave, City',
      email: 'test@example.com',
      phone: '+0000000000',
      customerType: 'Wholesale',
    },
    related: {},
  } as any;

  const buf = buildEnhancedInvoicePdf(sample);
  const outPath = path.join(outDir, 'invoice-local-test.pdf');
  fs.writeFileSync(outPath, buf);
  console.log(`✅ Wrote ${outPath} (${buf.length} bytes)`);
}

main().catch((e) => {
  console.error('❌ Failed:', e);
  process.exit(1);
});


