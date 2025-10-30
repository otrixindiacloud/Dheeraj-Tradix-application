import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem, Item, Customer, Quotation, QuotationItem } from '../../shared/schema';

// Core reusable interfaces
export interface PdfGenerateResult {
  buffer: Buffer;
  byteLength: number;
  fileName: string;
  contentType: string; // always application/pdf for now
}

export interface InvoicePdfContext {
  invoice: Invoice;
  items: (InvoiceItem & { item?: Item })[];
  customer: Customer;
  related?: { salesOrder?: any; delivery?: any; markupConfig?: any };
  mode?: 'enhanced' | 'simple';
}

export interface QuotationPdfContext {
  quotation: Quotation;
  items: (QuotationItem & { item?: Item })[];
  customer: Customer;
  mode?: 'enhanced' | 'simple';
}

// Currency formatting centralised
export function fmtCurrency(amount: number | string | null | undefined, currency = 'BHD') {
  const n = amount == null ? 0 : (typeof amount === 'string' ? parseFloat(amount) : amount);
  if (Number.isNaN(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

export function fmtDate(date: string | Date | null | undefined) {
  if (!date) return '';
  try { return new Date(date).toLocaleDateString('en-GB'); } catch { return ''; }
}

function baseDoc(): any { return new jsPDF(); }

// Convert number to words (simple, supports up to billions) for amount in words section
function numberToWords(num: number): string {
  if (!Number.isFinite(num)) return '';
  if (num === 0) return 'Zero';
  const belowTwenty = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','Ten','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function words(n: number): string {
    if (n < 20) return belowTwenty[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10?'-'+belowTwenty[n%10]:'');
    if (n < 1000) return belowTwenty[Math.floor(n/100)] + ' Hundred' + (n%100? ' ' + words(n%100):'');
    if (n < 1_000_000) return words(Math.floor(n/1000)) + ' Thousand' + (n%1000? ' ' + words(n%1000):'');
    if (n < 1_000_000_000) return words(Math.floor(n/1_000_000)) + ' Million' + (n%1_000_000? ' ' + words(n%1_000_000):'');
    return words(Math.floor(n/1_000_000_000)) + ' Billion' + (n%1_000_000_000? ' ' + words(n%1_000_000_000):'');
  }
  return words(Math.floor(num));
}

function amountInWords(total: number, currency: string) {
  const integerPart = Math.floor(total);
  const fractional = Math.round((total - integerPart) * 100);
  const words = numberToWords(integerPart) || 'Zero';
  return `${currency} ${words} ${fractional > 0 ? fractional + '/100' : ''}`.trim();
}

// Enhanced invoice PDF - Clean Tax Invoice format matching quotation layout
export function buildEnhancedInvoicePdf(ctx: InvoicePdfContext): Buffer {
  const { invoice, items, customer, related } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // Precompute gross totals for discount proration when only header discountAmount exists
  const globalDiscAmount = Number((invoice as any).discountAmount) || 0;
  const headerSubtotal = Number((invoice as any).subtotal) || 0;
  const totalGrossForProration = items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    return sum + (qty * unit);
  }, 0);
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  // Check invoice type to display appropriate title
  const invoiceType = (invoice as any).invoiceType || (invoice as any).type || 'Standard';
  const documentTitle = invoiceType === 'Proforma' ? 'PROFORMA INVOICE' : 'INVOICE';
  doc.text(documentTitle, pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const invoiceDate = fmtDate((invoice as any).invoiceDate || invoice.createdAt);
  doc.text(`Date: ${invoiceDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - 15, 35, { align: 'right' });
  const dueDate = fmtDate((invoice as any).dueDate);
  if (dueDate) {
    doc.text(`Due Date: ${dueDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Invoice No, Date, Customer Name, Customer Type, Sales Person, Payment Terms, Due Date)
  const customerName = (customer as any).customerName || customer.name || '';
  const customerType = (customer as any).customerType || 'Retail';
  const customerTypeDisplay = (customer as any).customerType || 'N/A';
  const salesPerson = (invoice as any).salesPerson || (invoice as any).createdBy || '';
  const paymentTerms = (invoice as any).terms ? ((invoice as any).terms.split('\n')[0].slice(0,40)) : '30 Days';
  const invoiceDateFormatted = fmtDate((invoice as any).invoiceDate || invoice.createdAt);
  const dueDateFormatted = fmtDate((invoice as any).dueDate);
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Invoice No', 'Invoice Date', 'Customer Name', 'Customer Type', 'Sales Person', 'Payment Terms', 'Due Date' ]],
    body: [[
      invoice.invoiceNumber,
      invoiceDateFormatted,
      customerName,
      customerTypeDisplay,
      String(salesPerson).slice(0,12),
      paymentTerms,
      dueDateFormatted || 'N/A'
    ]],
    styles: { fontSize: 6, cellPadding: 1 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Customer Address & Contact section with proper formatting
  const custName = (customer as any).customerName || customer.name || 'N/A';
  const custAddress = customer.address || 'N/A';
  const custEmail = customer.email || 'N/A';
  const custPhone = (customer as any).phone || customer.phone || 'N/A';
  const contactPerson = (invoice as any).contactPerson || (customer as any).contactPerson || 'N/A';
  const contactEmail = (customer as any).contactEmail || customer.email || 'N/A';
  const contactPhone = (customer as any).contactPhone || customer.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    custName,
    custAddress,
    custEmail,
    custPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Customer Name & Address:', styles: { fontStyle: 'bold', fontSize: 7, halign:'left', cellPadding: { top: 2, left: 3, right: 3, bottom: 1 } } }, 
        { content: 'Customer Contact Person:', styles: { fontStyle: 'bold', fontSize: 7, halign:'left', cellPadding: { top: 2, left: 3, right: 3, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 6, halign:'left', cellPadding: { top: 1, left: 3, right: 3, bottom: 2 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 6, halign:'left', cellPadding: { top: 1, left: 3, right: 3, bottom: 2 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  
  // Get customer type (reuse the variable already declared above)
  const isWholesale = customerType === 'Wholesale';
  
  // Get configured markup percentages from markup config
  const markupConfig = related?.markupConfig;
  const configuredRetailMarkup = markupConfig ? Number(markupConfig.retailMarkupPercentage) || 0 : 0;
  const configuredWholesaleMarkup = markupConfig ? Number(markupConfig.wholesaleMarkupPercentage) || 0 : 0;
  const configuredMarkup = isWholesale ? configuredWholesaleMarkup : configuredRetailMarkup;
  
  // Enhanced Items table with comprehensive columns matching quotation format
  const currency = (invoice as any).currency || 'BHD';
  
  // Calculate markup for each item and include in row
  const itemRowsWithMarkup = items.map((it, i) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gross = qty * unit;
    
    // Get cost price - prioritize quotation item costPrice first
    let baseCost = 0;
    if ((it as any).quotationCostPrice !== null && (it as any).quotationCostPrice !== undefined) {
      baseCost = Number((it as any).quotationCostPrice) || 0;
      console.log(`[PDF] Using quotation costPrice for item ${i + 1}: ${baseCost}`);
    } else if ((it as any).quotationItem?.costPrice) {
      baseCost = Number((it as any).quotationItem.costPrice) || 0;
      console.log(`[PDF] Using quotationItem.costPrice for item ${i + 1}: ${baseCost}`);
    } else if ((it as any).item?.costPrice) {
      baseCost = Number((it as any).item.costPrice) || 0;
    } else if ((it as any).costPrice) {
      baseCost = Number((it as any).costPrice) || 0;
    }
    
    // Get markup percentage - prefer quotation item markup if available
    let markupPercent = 0;
    let markupLabel = 'N/A';
    
    // First, try to use quotation item markup if available
    if ((it as any).quotationMarkup !== null && (it as any).quotationMarkup !== undefined) {
      markupPercent = Number((it as any).quotationMarkup) || 0;
      markupLabel = `${markupPercent.toFixed(1)}%`;
      console.log(`[PDF] Using quotation markup for item ${i + 1}: ${markupLabel}`);
    } else {
      // Fallback: Calculate markup percentage based on customer type and item cost
      if (baseCost > 0 && unit > 0) {
        // Calculate actual markup applied
        markupPercent = ((unit - baseCost) / baseCost) * 100;
        // Show both actual markup and configured markup
        if (configuredMarkup > 0) {
          markupLabel = `${markupPercent.toFixed(1)}% (${configuredMarkup.toFixed(1)}% ${isWholesale ? 'W' : 'R'})`;
        } else {
          markupLabel = `${markupPercent.toFixed(1)}% (${isWholesale ? 'Wholesale' : 'Retail'})`;
        }
      } else if (baseCost <= 0 && (it as any).item) {
        // If no cost price available, show configured markup
        if (configuredMarkup > 0) {
          markupLabel = `${configuredMarkup.toFixed(1)}% (${isWholesale ? 'Wholesale' : 'Retail'})`;
        } else {
          markupLabel = `Applied (${isWholesale ? 'Wholesale' : 'Retail'})`;
        }
      } else {
        markupLabel = 'N/A';
      }
    }
    
    // Calculate discount: use absolute amount if provided and > 0, otherwise calculate from percentage
    const discPerc = Number((it as any).discountPercentage ?? (it as any).discountPercent) || 0;
    const discAmtRaw = Number((it as any).discountAmount ?? (it as any).discountAmountBase) || 0;
    const calculatedDiscountAmount = discAmtRaw > 0 ? Math.round(discAmtRaw * 100) / 100 : Math.round((gross * discPerc / 100) * 100) / 100;
    const net = Math.round((gross - calculatedDiscountAmount) * 100) / 100;
    
    // Calculate VAT: use absolute amount if provided and > 0, otherwise calculate from percentage on net amount
    const vatPerc = Number((it as any).taxRate ?? (it as any).taxPercent ?? (it as any).vatPercent) || 0;
    const vatAmtRaw = Number((it as any).taxAmount ?? (it as any).taxAmountBase ?? (it as any).vatAmount) || 0;
    const vatAmt = vatAmtRaw > 0 ? Math.round(vatAmtRaw * 100) / 100 : Math.round((net * vatPerc / 100) * 100) / 100;

    // Build enhanced description ensuring base item description always first
    const isGeneric = (txt?: string) => {
      if (!txt) return true;
      const v = String(txt).trim().toLowerCase();
      return v === 'generic item' || v === 'delivery item' || v === 'item from sales order' || v === 'item';
    };
    const descParts: string[] = [];
    // Prefer original sales order/master item descriptions over placeholders
    let baseName = (it as any).salesOrderItemDescription
      || (it as any).itemDescription
      || (it as any).item?.description
      || it.description
      || (it as any).productName
      || (it as any).item?.itemName
      || (it as any).name
      || 'Item';
    if (isGeneric(baseName)) {
      baseName = (it as any).item?.description || (it as any).productName || it.description || baseName;
    }
    descParts.push(baseName);
    if (it.description && it.description !== baseName && !isGeneric(it.description)) descParts.push(it.description);
    const originalName = (it as any).originalName || (it as any).originalItemName || (it as any).oemName;
    if (originalName && originalName !== baseName) {
      descParts.push(`Original: ${originalName}`);
    }
    // Original quantity (if differs)
    const originalQty = (it as any).originalQuantity ?? (it as any).sourceQuantity ?? (it as any).baseQuantity;
    if (originalQty != null && !Number.isNaN(Number(originalQty)) && Number(originalQty) !== qty) {
      descParts.push(`Original Qty: ${Number(originalQty).toFixed(2)}`);
    }
    // Original unit cost (if differs)
    const originalUnitRaw = (it as any).originalUnitPrice ?? (it as any).baseUnitPrice ?? (it as any).sourceUnitPrice ?? (it as any).item?.unitPrice;
    if (originalUnitRaw != null && !Number.isNaN(Number(originalUnitRaw)) && Number(originalUnitRaw) !== unit) {
      descParts.push(`Original Unit Cost: ${currency} ${Number(originalUnitRaw).toFixed(3)}`);
    }
    // Try to include original source references (quotation / enquiry) if available
    const sourceQuote = (it as any).quotationItemNumber || (it as any).quotationReference;
    const sourceEnquiry = (it as any).enquiryItemNumber || (it as any).enquiryReference;
    if (sourceQuote) descParts.push(`Quote Ref: ${sourceQuote}`);
    if (sourceEnquiry) descParts.push(`Enquiry Ref: ${sourceEnquiry}`);
    // Optional secondary display (productName)
    if ((it as any).productName && (it as any).productName !== baseName) descParts.push((it as any).productName);
    // Specifications / technical details
    const specRaw = (it as any).specifications || (it as any).specification || (it as any).itemSpecification || (it as any).technicalDetails;
    if (specRaw) {
      const specStr = String(specRaw).trim();
      if (specStr && !/^(n\/a|none)$/i.test(specStr)) {
        descParts.push(`Specs: ${specStr}`);
      }
    }
    // Notes / additional description
    const notes = (it as any).notes || (it as any).remarks || (it as any).additionalDescription;
    if (notes) {
      const notesStr = String(notes).trim();
      if (notesStr && notesStr.length > 0 && notesStr.toLowerCase() !== 'n/a') {
        descParts.push(`Notes: ${notesStr}`);
      }
    }
    // Supplier / catalog meta
    if ((it as any).supplierCode) descParts.push(`Supplier Code: ${(it as any).supplierCode}`);
    if ((it as any).barcode) descParts.push(`Barcode: ${(it as any).barcode}`);
    if ((it as any).item?.category) descParts.push(`Category: ${(it as any).item.category}`);
    // Collapse multiple blank lines & join
    const enhancedDesc = descParts.filter(p => p && p.trim().length > 0).join('\n');

    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty.toFixed(2)}`,
      `${currency} ${baseCost.toFixed(3)}`,
      markupLabel,
      `${currency} ${unit.toFixed(3)}`,
      `${(Number.isFinite(discPerc) ? discPerc : 0).toFixed(1)}%`,
      `${currency} ${(Math.round(calculatedDiscountAmount * 100) / 100).toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${(Math.round(vatAmt * 100) / 100).toFixed(2)}`,
      `${currency} ${(Math.round((net + vatAmt) * 100) / 100).toFixed(2)}`
    ];
  });
  
  // Scale columns to use a narrower width and reduce row height
  // Shrink overall table width so it doesn't span edge-to-edge
  const contentWidth = pageWidth - 30;
  const baseTableWidth = 184; // baseline sum used to proportionally scale columns
  const scale = contentWidth / baseTableWidth;
  const colW = {
    // Narrower Markup %, Disc. Amt, VAT Amt; shift freed width to description
    c0: 5 * scale,
    c1: 56 * scale,
    c2: 8 * scale,
    c3: 16 * scale,
    c4: 10 * scale,
    c5: 18 * scale,
    c6: 10 * scale,
    c7: 14 * scale,
    c8: 10 * scale,
    c9: 14 * scale,
    c10: 23 * scale
  };

  const shiftX = 5; // slight right shift
  autoTable(doc, {
    startY: afterAddress,
    startX: 15 + shiftX,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Cost Price', 'Markup %', 'Unit Price', 'Disc. %', 'Disc. Amt', 'VAT %', 'VAT Amt', 'Total Amount' ]],
    body: itemRowsWithMarkup,
    styles: { 
      fontSize: 5.5, 
      cellPadding: 0.5, 
      lineHeight: 0.8,
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 6.5,
      cellPadding: 0.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: colW.c0, halign:'center' },
      1: { cellWidth: colW.c1, halign: 'left' },
      2: { cellWidth: colW.c2, halign:'center' },
      3: { cellWidth: colW.c3, halign:'right' },
      4: { cellWidth: colW.c4, halign:'center' },
      5: { cellWidth: colW.c5, halign:'right' },
      6: { cellWidth: colW.c6, halign:'center' },
      7: { cellWidth: colW.c7, halign:'right' },
      8: { cellWidth: colW.c8, halign:'center' },
      9: { cellWidth: colW.c9, halign:'right' },
      10: { cellWidth: colW.c10, halign:'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: contentWidth - shiftX,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  
  // Calculate totals from items - ALWAYS use calculated values from items to ensure accuracy
  // This ensures discount and VAT amounts are automatically calculated from items, matching frontend calculation
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  
  items.forEach(it => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gross = Math.round((qty * unit) * 100) / 100;
    
    // Calculate discount: use absolute amount if provided and > 0, otherwise calculate from percentage
    const discPerc = Number((it as any).discountPercentage ?? (it as any).discountPercent) || 0;
    const discAmtRaw = Number((it as any).discountAmount ?? (it as any).discountAmountBase) || 0;
    const calculatedDiscountAmount = discAmtRaw > 0 ? Math.round(discAmtRaw * 100) / 100 : Math.round((gross * discPerc / 100) * 100) / 100;
    const net = Math.round((gross - calculatedDiscountAmount) * 100) / 100;
    
    // Calculate VAT: use absolute amount if provided and > 0, otherwise calculate from percentage on net amount
    const vatPerc = Number((it as any).taxRate ?? (it as any).taxPercent ?? (it as any).vatPercent) || 0;
    const vatAmtRaw = Number((it as any).taxAmount ?? (it as any).taxAmountBase ?? (it as any).vatAmount) || 0;
    const calculatedVatAmount = vatAmtRaw > 0 ? Math.round(vatAmtRaw * 100) / 100 : Math.round((net * vatPerc / 100) * 100) / 100;
    
    calculatedSubtotal += gross;
    calculatedDiscount += calculatedDiscountAmount;
    calculatedVAT += calculatedVatAmount;
  });
  
  // Always use calculated values from items (never use stored invoice values)
  // This ensures PDF matches the frontend calculation exactly and discount/VAT are always auto-calculated
  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const discountAmount = Math.round(calculatedDiscount * 100) / 100;
  const taxAmount = Math.round(calculatedVAT * 100) / 100;
  const netAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  // Always calculate totalAmount from netAmount + taxAmount to ensure accuracy
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  
  // Summary table (align right)
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Subtotal', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Total Amount', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:6, cellPadding:1 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = (invoice as any).notes || (invoice as any).terms || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || 'Generation from enquiry [NO-2024-191]'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:6, halign:'left' } }]],
    styles: { cellPadding: 2 },
    margin: { left: 20, right: 10 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  
  // Signature sections
  const sigY = afterRemarks + 10;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer with company information
  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimpleInvoicePdf(ctx: InvoicePdfContext): Buffer {
  const { invoice } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('INVOICE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Invoice #: ${invoice.invoiceNumber}`,20,30);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateInvoicePdf(ctx: InvoicePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleInvoicePdf(ctx) : buildEnhancedInvoicePdf(ctx));
  const invoiceType = (ctx.invoice as any).invoiceType || (ctx.invoice as any).type || 'Standard';
  const filePrefix = invoiceType === 'Proforma' ? 'proforma-invoice' : 'invoice';
  return { buffer, byteLength: buffer.length, fileName: `${filePrefix}-${ctx.invoice.invoiceNumber}.pdf`, contentType: 'application/pdf' };
}

export function generateQuotationPdf(ctx: QuotationPdfContext): PdfGenerateResult {
  if (ctx.mode === 'simple') {
    const { quotation, items, customer } = ctx;
    const doc = baseDoc();
    doc.setFontSize(18).setFont('helvetica','bold').text('QUOTATION',20,20);
    doc.setFontSize(10).setFont('helvetica','normal');
    doc.text(`Quote #: ${(quotation as any).quotationNumber || quotation.quoteNumber}`,20,30);
    doc.text(`Date: ${fmtDate((quotation as any).quotationDate || (quotation as any).quoteDate || quotation.createdAt)}`,20,36);
    doc.setFont('helvetica','bold').text('Customer:',20,48);
    doc.setFont('helvetica','normal').text((customer as any).customerName || customer.name || '',20,54);
    // Add customer type (Retail/Wholesale)
    const custType = (quotation as any).customerType ? String((quotation as any).customerType) : '';
    if (custType) {
      doc.setFont('helvetica','bold').text('Customer Type:',20,60);
      doc.setFont('helvetica','normal').text(custType,60,60);
    }

    const rows = items.map((it,i)=>{
      const markupPerc = Number((it as any).markup || 0);
      return [
        (i+1).toString(),
        it.description || '',
        it.quantity.toString(),
        `${markupPerc.toFixed(2)}%`,
        fmtCurrency(it.unitPrice, (quotation as any).currency || 'BHD'),
        fmtCurrency(it.lineTotal, (quotation as any).currency || 'BHD')
      ];
    });
    autoTable(doc, { startY: 70, head: [['#','Description','Qty','Markup %','Unit','Total']], body: rows, styles:{fontSize:8}, headStyles:{fillColor:[255,255,255], textColor:0}});
    const buffer = Buffer.from(doc.output('arraybuffer'));
    return { buffer, byteLength: buffer.length, fileName: `quotation-${(quotation as any).quotationNumber || quotation.quoteNumber}.pdf`, contentType: 'application/pdf' };
  }

  // Enhanced template replicating provided layout image
  const { quotation, items, customer } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('QUOTATION', pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const qDate = fmtDate((quotation as any).quoteDate || quotation.createdAt);
  doc.text(`Date: ${qDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Quote #: ${(quotation as any).quotationNumber || quotation.quoteNumber}`, pageWidth - 15, 35, { align: 'right' });
  const validUntilDate = fmtDate((quotation as any).validUntil);
  if (validUntilDate) {
    doc.text(`Valid Until: ${validUntilDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Quotation No, Date, Customer Name, Customer Type, Sales Person, Payment Terms, Quote Validity / Lead Time placeholders)
  const customerName = (customer as any).customerName || customer.name || '';
  const customerType = (quotation as any).customerType || '';
  const salesPerson = (quotation as any).salesPerson || (quotation as any).createdBy || '';
  const paymentTerms = (quotation as any).terms ? ((quotation as any).terms.split('\n')[0].slice(0,40)) : '30 Days';
  const leadTime = (quotation as any).leadTime || '10 days after receiving agreed LPO';
  const quoteDateFormatted = fmtDate((quotation as any).quoteDate || quotation.createdAt);
  const validUntil = fmtDate((quotation as any).validUntil);
  autoTable(doc, {
    startY: 56,
    head: [[ 'Quotation No', 'Quotation Date', 'Customer Name', 'Customer Type', 'Sales Person', 'Payment Terms', 'Lead Time / Validity' ]],
    body: [[
      (quotation as any).quotationNumber || quotation.quoteNumber,
      quoteDateFormatted,
      customerName,
      String(customerType),
      String(salesPerson).slice(0,12),
      paymentTerms,
      validUntil || leadTime
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Customer Address & Contact section with proper formatting
  const custName = (customer as any).customerName || customer.name || 'N/A';
  const custAddress = customer.address || 'N/A';
  const custEmail = customer.email || 'N/A';
  const custPhone = (customer as any).phone || customer.phone || 'N/A';
  
  const contactPerson = (quotation as any).contactPerson || (customer as any).contactPerson || 'N/A';
  const contactEmail = (customer as any).contactEmail || customer.email || 'N/A';
  const contactPhone = (customer as any).contactPhone || customer.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    custName,
    custAddress,
    custEmail,
    custPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Customer Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Customer Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  // Enhanced Items table with comprehensive columns for professional quotation
  const currency = (quotation as any).currency || 'BHD';
  const itemRows = items.map((it,i)=> {
    const qty = Number(it.quantity) || 0;
    const cost = Number((it as any).costPrice) || 0;
    const markupPct = Number((it as any).markup) || 0;
    // Unit Price = Cost Price * (1 + Markup % / 100) - rounded to 3 decimals
    const computedUnitFromMarkup = cost > 0 ? cost * (1 + Math.max(0, markupPct) / 100) : 0;
    const unit = Math.round((computedUnitFromMarkup > 0 ? computedUnitFromMarkup : Number(it.unitPrice) || 0) * 1000) / 1000;
    // Subtotal = Unit Price × Quantity - rounded to 2 decimals
    const subtotal = Math.round((qty * unit) * 100) / 100;
    // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount - rounded to 2 decimals
    const discPerc = Number((it as any).discountPercentage) || Number((quotation as any).discountPercentage) || 0;
    const discAmtRaw = (it as any).discountAmount != null ? Number((it as any).discountAmount) : 0;
    let discAmt = 0;
    if (discPerc > 0) {
      // Prioritize discount percentage calculation - calculate directly from subtotal
      discAmt = Math.round((subtotal * discPerc / 100) * 100) / 100;
    } else if (discAmtRaw !== 0) {
      // Use explicit discount amount only if no percentage is provided
      discAmt = Math.round(Math.min(subtotal, Math.abs(discAmtRaw)) * 100) / 100;
    }
    // After Discount = Subtotal - Discount Amount - rounded to 2 decimals
    const afterDiscount = Math.round(Math.max(0, subtotal - discAmt) * 100) / 100;
    // VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount - rounded to 2 decimals
    const vatPerc = Number((it as any).vatPercent) || Number((quotation as any).vatPercent) || 0;
    const vatAmtRaw = (it as any).vatAmount != null ? Number((it as any).vatAmount) : 0;
    let vatAmt = 0;
    if (vatPerc > 0) {
      // Prioritize VAT percentage calculation - calculate directly from afterDiscount
      vatAmt = Math.round((afterDiscount * vatPerc / 100) * 100) / 100;
    } else if (vatAmtRaw > 0) {
      // Use explicit VAT amount only if no percentage is provided
      vatAmt = Math.round(vatAmtRaw * 100) / 100;
    }
    
    // Markup percentage for display
    const markupPerc = cost > 0 && unit > 0 ? ((unit - cost) / cost) * 100 : markupPct;
    
    
    // Enhanced description with specifications
    let enhancedDesc = it.description || 'Product Description';
    if ((it as any).supplierCode) enhancedDesc += `\nCode: ${(it as any).supplierCode}`;
    if ((it as any).barcode) enhancedDesc += `\nBarcode: ${(it as any).barcode}`;
    if ((it as any).item?.category) enhancedDesc += `\nCategory: ${(it as any).item.category}`;
    if ((it as any).specifications) enhancedDesc += `\nSpecs: ${(it as any).specifications}`;
    
    // Calculate total amount for this line item (After Discount + VAT) - rounded to 2 decimals
    const totalAmount = Math.round((afterDiscount + vatAmt) * 100) / 100;
    
    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty.toFixed(2)} PCS`,
      `${currency} ${cost.toFixed(3)}`,
      markupPerc > 0 ? `${markupPerc.toFixed(1)}%` : '0%',
      `${currency} ${unit.toFixed(3)}`,
      discPerc > 0 ? `${discPerc.toFixed(1)}%` : '0%',
      `${currency} ${discAmt.toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${vatAmt.toFixed(2)}`,
      `${currency} ${totalAmount.toFixed(2)}`
    ];
  });
  
  // Scale item table to full content width with custom margins and nudge slightly right
  const leftMargin = 16;
  const rightMargin = 18;
  const contentWidth = pageWidth - (leftMargin + rightMargin);
  const baseTableWidth = 184; // sum of the original fixed column widths
  const scale = contentWidth / baseTableWidth;
  const colW = {
    c0: 5 * scale,
    c1: 38 * scale,
    c2: 8 * scale,
    c3: 16 * scale,
    c4: 16 * scale,
    c5: 18 * scale,
    c6: 10 * scale,
    c7: 20 * scale,
    c8: 10 * scale,
    c9: 20 * scale,
    c10: 23 * scale
  };

  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Cost Price', 'Markup %', 'Unit Price', 'Disc. %', 'Disc. Amt', 'VAT %', 'VAT Amt', 'Total Amount' ]],
    body: itemRows,
    styles: { 
      fontSize: 5, 
      cellPadding: 0.4, 
      lineHeight: 1.0,
      valign:'middle',
      lineColor: [200, 200, 200], // Softer light gray borders
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [40, 40, 40] // Softer dark gray text
    },
    headStyles: { 
      fillColor: [255, 255, 255], // White header background
      textColor: [40, 40, 40], // Softer dark gray text
      fontStyle:'bold',
      halign: 'center',
      fontSize: 7,
      cellPadding: 1,
      lineColor: [200, 200, 200], // Softer light gray borders
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: colW.c0, halign:'center' },
      1: { cellWidth: colW.c1, halign: 'left' },
      2: { cellWidth: colW.c2, halign:'center' },
      3: { cellWidth: colW.c3, halign:'right' },
      4: { cellWidth: colW.c4, halign:'center' },
      5: { cellWidth: colW.c5, halign:'right' },
      6: { cellWidth: colW.c6, halign:'center' },
      7: { cellWidth: colW.c7, halign:'right' },
      8: { cellWidth: colW.c8, halign:'center' },
      9: { cellWidth: colW.c9, halign:'right' },
      10:{ cellWidth: colW.c10, halign:'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] // Light gray alternating rows
    },
    margin: { left: leftMargin, right: rightMargin },
    pageBreak: 'auto',
    tableWidth: contentWidth,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  // Summary tables (align right) – Total, Discount, Net, VAT, Grand Total
  // Always calculate from items to ensure accuracy, matching frontend calculation
  // Use the same calculation logic as itemRows to ensure consistency
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  
  items.forEach(it => {
    const qty = Number(it.quantity) || 0;
    const cost = Number((it as any).costPrice) || 0;
    const markupPct = Number((it as any).markup) || 0;
    // Unit Price = Cost Price * (1 + Markup % / 100) - rounded to 3 decimals
    const computedUnitFromMarkup = cost > 0 ? cost * (1 + Math.max(0, markupPct) / 100) : 0;
    const unit = Math.round((computedUnitFromMarkup > 0 ? computedUnitFromMarkup : Number(it.unitPrice) || 0) * 1000) / 1000;
    // Subtotal = Unit Price × Quantity - rounded to 2 decimals
    const subtotal = Math.round((qty * unit) * 100) / 100;
    // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount - rounded to 2 decimals
    const discPerc = Number((it as any).discountPercentage) || Number((quotation as any).discountPercentage) || 0;
    const discAmtRaw = (it as any).discountAmount != null ? Number((it as any).discountAmount) : 0;
    let discAmt = 0;
    if (discPerc > 0) {
      // Prioritize discount percentage calculation - calculate directly from subtotal
      discAmt = Math.round((subtotal * discPerc / 100) * 100) / 100;
    } else if (discAmtRaw !== 0) {
      // Use explicit discount amount only if no percentage is provided
      discAmt = Math.round(Math.min(subtotal, Math.abs(discAmtRaw)) * 100) / 100;
    }
    // After Discount = Subtotal - Discount Amount - rounded to 2 decimals
    const afterDiscount = Math.round(Math.max(0, subtotal - discAmt) * 100) / 100;
    // VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount - rounded to 2 decimals
    const vatPerc = Number((it as any).vatPercent) || Number((quotation as any).vatPercent) || 0;
    const vatAmtRaw = (it as any).vatAmount != null ? Number((it as any).vatAmount) : 0;
    let vatAmt = 0;
    if (vatPerc > 0) {
      // Prioritize VAT percentage calculation - calculate directly from afterDiscount
      vatAmt = Math.round((afterDiscount * vatPerc / 100) * 100) / 100;
    } else if (vatAmtRaw > 0) {
      // Use explicit VAT amount only if no percentage is provided
      vatAmt = Math.round(vatAmtRaw * 100) / 100;
    }
    
    calculatedSubtotal += subtotal;
    calculatedDiscount += discAmt;
    calculatedVAT += vatAmt;
  });
  
  // Always use calculated values from items (never use stored quotation values)
  // This ensures PDF matches the frontend calculation exactly
  // Round totals to 2 decimals for final display
  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const discountAmount = Math.round(calculatedDiscount * 100) / 100;
  const taxAmount = Math.round(calculatedVAT * 100) / 100;
  const netAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  // Always calculate totalAmount from netAmount + taxAmount to ensure accuracy
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Subtotal', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', discountAmount > 0 ? `-${currency} ${discountAmount.toFixed(2)}` : `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Total Amount', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = (quotation as any).notes || (quotation as any).terms || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || '---'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  // Terms line (validity) & signatures
  const validity = validUntil ? `This quote is valid until ${validUntil}` : 'This quote is valid for 15 days';
  doc.setFont('helvetica','normal').setFontSize(7).text(validity, 15, afterRemarks);
  const sigY = afterRemarks + 14;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer with company information
  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  const buffer = Buffer.from(doc.output('arraybuffer'));
  return { buffer, byteLength: buffer.length, fileName: `quotation-${(quotation as any).quotationNumber || quotation.quoteNumber}.pdf`, contentType: 'application/pdf' };
}

// Purchase Invoice PDF Context
export interface PurchaseInvoicePdfContext {
  invoice: any; // PurchaseInvoice type
  items: any[]; // PurchaseInvoiceItem type
  supplier: any; // Supplier type
  mode?: 'enhanced' | 'simple';
}

export interface DeliveryNotePdfContext {
  deliveryNote: any; // DeliveryNote type
  items: any[]; // DeliveryNoteItem type
  customer: any; // Customer type
  salesOrder?: any; // SalesOrder type
  soTotals?: { totalOrdered: number; totalDelivered: number; totalRemaining: number };
  mode?: 'enhanced' | 'simple';
}

// Purchase Invoice PDF Generation
export function buildEnhancedPurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): Buffer {
  const { invoice, items, supplier } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PURCHASE INVOICE', pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const invoiceDate = fmtDate(invoice.invoiceDate || invoice.createdAt);
  doc.text(`Date: ${invoiceDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Invoice #: ${invoice.invoiceNumber || 'N/A'}`, pageWidth - 15, 35, { align: 'right' });
  const dueDate = fmtDate(invoice.dueDate);
  if (dueDate) {
    doc.text(`Due Date: ${dueDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table
  const supplierName = (supplier as any).supplierName || supplier.name || '';
  const paymentTerms = invoice.paymentTerms || '30 Days';
  const invoiceDateFormatted = fmtDate(invoice.invoiceDate || invoice.createdAt);
  const dueDateFormatted = fmtDate(invoice.dueDate);
  const status = invoice.status || 'Draft';
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Invoice No', 'Invoice Date', 'Supplier Name', 'Status', 'Payment Terms', 'Due Date' ]],
    body: [[
      invoice.invoiceNumber || 'N/A',
      invoiceDateFormatted,
      supplierName,
      status,
      paymentTerms,
      dueDateFormatted || 'N/A'
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Supplier Address & Contact section with proper formatting
  const suppName = (supplier as any).supplierName || supplier.name || 'N/A';
  const suppAddress = supplier.address || 'N/A';
  const suppEmail = supplier.email || 'N/A';
  const suppPhone = supplier.phone || 'N/A';
  
  const contactPerson = (supplier as any).contactPerson || 'N/A';
  const contactEmail = (supplier as any).contactEmail || supplier.email || 'N/A';
  const contactPhone = (supplier as any).contactPhone || supplier.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    suppName,
    suppAddress,
    suppEmail,
    suppPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Supplier Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Supplier Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  
  // Enhanced Items table
  const currency = invoice.currency || 'BHD';
  const itemRows = items.map((it:any,i:number)=> {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gross = qty * unit;
    
    // Parse discount fields - handle multiple possible field names for discount data
    // Database uses: discountRate (percentage) and discountAmount (absolute value)
    const discPerc = Number(it.discountRate || it.discountPercent || it.discountPercentage || 0) || 0;
    const discAmt = Number(it.discountAmount || 0) || 0;
    
    // Calculate discount: use absolute amount if provided, otherwise calculate from percentage
    const calculatedDiscountAmount = discAmt > 0 ? discAmt : (gross * discPerc / 100);
    const net = gross - calculatedDiscountAmount;
    
    // Parse VAT/Tax fields - handle multiple possible field names for VAT data
    // Database uses: taxRate (percentage) and taxAmount (absolute value)
    const vatPerc = Number(it.taxRate || it.vatPercent || it.vatPercentage || 0) || 0;
    const vatAmt = Number(it.taxAmount || it.vatAmount || 0) || 0;
    
    // Calculate VAT: use absolute amount if provided, otherwise calculate from percentage
    const calculatedVatAmount = vatAmt > 0 ? vatAmt : (net * vatPerc / 100);
    
    

    // Build enriched description using multiple possible sources
    const descParts: string[] = [];
    const baseName = it.item?.itemName || it.itemName || it.description || it.itemDescription || 'Item';
    descParts.push(baseName);
  const originalName = it.originalName || it.originalItemName || it.oemName;
  if (originalName && originalName !== baseName) descParts.push(`Original: ${originalName}`);
  if (it.item?.itemCode) descParts.push(`Code: ${it.item.itemCode}`);
    const itemId = it.itemId || it.item?.id;
    if (itemId) descParts.push(`Item ID: ${itemId}`);
    if (it.itemCode && it.itemCode !== it.item?.itemCode) descParts.push(`Item Code: ${it.itemCode}`);
    // Source references (goods receipt, PO, supplier quote)
    const originalQty = it.originalQuantity ?? it.sourceQuantity ?? it.baseQuantity;
    if (originalQty != null && !Number.isNaN(Number(originalQty)) && Number(originalQty) !== qty) {
      descParts.push(`Original Qty: ${Number(originalQty).toFixed(2)}`);
    }
    const originalUnitRaw = it.originalUnitPrice ?? it.baseUnitPrice ?? it.sourceUnitPrice ?? it.item?.unitPrice;
    if (originalUnitRaw != null && !Number.isNaN(Number(originalUnitRaw)) && Number(originalUnitRaw) !== unit) {
      descParts.push(`Original Unit Rate: ${currency} ${Number(originalUnitRaw).toFixed(3)}`);
    }
    if (it.goodsReceiptItemId) descParts.push(`GR Item ID: ${it.goodsReceiptItemId}`);
    if (it.purchaseOrderItemId) descParts.push(`PO Item ID: ${it.purchaseOrderItemId}`);
    if (it.supplierQuoteItemId) descParts.push(`SQ Item ID: ${it.supplierQuoteItemId}`);
    // Specifications & technical details
    const specs = it.specifications || it.specification || it.itemSpecification || it.technicalDetails;
    if (specs && String(specs).trim() && !/^(n\/a|none)$/i.test(String(specs))) {
      descParts.push(`Specs: ${String(specs).trim()}`);
    }
    // Packaging / UOM extra
    if (it.packaging) descParts.push(`Pack: ${it.packaging}`);
    if (it.unitOfMeasure && !/pcs/i.test(it.unitOfMeasure)) descParts.push(`UOM: ${it.unitOfMeasure}`);
    // Supplier meta
    if (it.supplierPartNumber) descParts.push(`Supplier PN: ${it.supplierPartNumber}`);
    if (it.manufacturerPartNumber) descParts.push(`MFR PN: ${it.manufacturerPartNumber}`);
    if (it.brand) descParts.push(`Brand: ${it.brand}`);
    if (it.countryOfOrigin) descParts.push(`Origin: ${it.countryOfOrigin}`);
    // Notes
    if (it.notes) {
      const notesStr = String(it.notes).trim();
      if (notesStr && notesStr.length > 0) descParts.push(`Notes: ${notesStr}`);
    }
    // original name already added above if different
  const enrichedDescription = descParts.filter(Boolean).join('\n');

    return [
      (i+1).toString(),
      enrichedDescription,
      `${qty.toFixed(2)}`,
      `${(it.unitOfMeasure || 'PCS').toUpperCase()}`,
      `${currency} ${unit.toFixed(3)}`,
      discPerc > 0 ? `${discPerc.toFixed(1)}%` : '0%',
      `${currency} ${calculatedDiscountAmount.toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${calculatedVatAmount.toFixed(2)}`,
      `${currency} ${(net + calculatedVatAmount).toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S\nI', 'Item Description & Specifications', 'Qty', 'Unit', 'Unit Cost', 'Disc\n%', 'Disc\nAmt', 'VAT\n%', 'VAT Amt', 'Total\nAmount' ]],
    body: itemRows,
    styles: { 
      fontSize: 6, 
      cellPadding: 1,
      lineHeight: 0.9,
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 7,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign:'center' },   // S/N
      1: { cellWidth: 34, halign: 'left' },   // Item Description (slightly narrower)
      2: { cellWidth: 10, halign:'center' },  // Qty (centered)
      3: { cellWidth: 10, halign:'center' },  // Unit (centered)
      4: { cellWidth: 18, halign:'center' },  // Unit Cost (wider, centered)
      5: { cellWidth: 16, halign:'center' },  // Disc % (wider, centered)
      6: { cellWidth: 18, halign:'center' },  // Disc Amt (wider, centered)
      7: { cellWidth: 16, halign:'center' },  // VAT % (wider, centered)
      8: { cellWidth: 18, halign:'center' },  // VAT Amt (wider, centered)
      9: { cellWidth: 28, halign:'center' }   // Total Amount (wider, centered)
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 6 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 21,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  
  // Calculate totals from items - ALWAYS use calculated values from items to ensure accuracy
  // This ensures discount and VAT amounts are automatically calculated from items, matching frontend calculation
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  
  items.forEach((it:any) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gross = qty * unit;
    
    // Parse discount fields - same logic as item rows above
    const discPerc = Number(it.discountRate || it.discountPercent || it.discountPercentage || 0) || 0;
    const discAmt = Number(it.discountAmount || 0) || 0;
    const calculatedDiscountAmount = discAmt > 0 ? discAmt : (gross * discPerc / 100);
    
    const net = gross - calculatedDiscountAmount;
    
    // Parse VAT/Tax fields - same logic as item rows above
    const vatPerc = Number(it.taxRate || it.vatPercent || it.vatPercentage || 0) || 0;
    const vatAmt = Number(it.taxAmount || it.vatAmount || 0) || 0;
    const calculatedVatAmount = vatAmt > 0 ? vatAmt : (net * vatPerc / 100);
    
    calculatedSubtotal += gross;
    calculatedDiscount += calculatedDiscountAmount;
    calculatedVAT += calculatedVatAmount;
  });
  
  // Always use calculated values from items (never use stored invoice values)
  // This ensures PDF matches the frontend calculation exactly and discount/VAT are always auto-calculated
  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const discountAmount = Math.round(calculatedDiscount * 100) / 100;
  const taxAmount = Math.round(calculatedVAT * 100) / 100;
  const netAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  // Always calculate totalAmount from netAmount + taxAmount to ensure accuracy
  const totalAmount = netAmount + taxAmount;
  
  // Summary table
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Subtotal', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Total Amount', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = invoice.notes || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || '---'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  
  // Signature sections
  const sigY = afterRemarks + 10;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Supplier Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer
  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}


export function buildSimplePurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): Buffer {
  const { invoice } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('PURCHASE INVOICE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Invoice #: ${invoice.invoiceNumber}`,20,30);
  doc.text(`Supplier: ${invoice.supplierName}`,20,36);
  doc.text(`Total: ${invoice.currency} ${Number(invoice.totalAmount || 0).toFixed(2)}`,20,42);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generatePurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimplePurchaseInvoicePdf(ctx) : buildEnhancedPurchaseInvoicePdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `purchase-invoice-${ctx.invoice.invoiceNumber}.pdf`, 
    contentType: 'application/pdf' 
  };
}

// Delivery Note PDF Generation
export function buildEnhancedDeliveryNotePdf(ctx: DeliveryNotePdfContext): Buffer {
  const { deliveryNote, items, customer, salesOrder } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftColX = 15;
  const rightColX = pageWidth - 15;
  const leftColMaxWidth = (pageWidth / 2) - 25; // ensure left block doesn't collide with right block
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', leftColX, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', leftColX, 27);
  doc.text('Kingdom of Bahrain', leftColX, 32);
  doc.text('Mobile: +973 XXXX XXXX', leftColX, 37);
  doc.text('Email: info@goldentag.com', leftColX, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('DELIVERY NOTE', rightColX, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const deliveryDate = fmtDate(deliveryNote.deliveryDate || deliveryNote.createdAt);
  doc.text(`Date: ${deliveryDate}`, rightColX, 30, { align: 'right' });
  doc.text(`Delivery #: ${deliveryNote.deliveryNumber || 'N/A'}`, rightColX, 35, { align: 'right' });
  if (salesOrder?.orderNumber) {
    doc.text(`Order #: ${salesOrder.orderNumber}`, rightColX, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(leftColX, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Delivery No, Date, Customer Name, Sales Person, Delivery Type, Status)
  const customerName = (customer as any).customerName || customer.name || '';
  const salesPerson = deliveryNote.salesPerson || deliveryNote.createdBy || '';
  const deliveryType = deliveryNote.deliveryType || 'Standard';
  const status = deliveryNote.status || 'Pending';
  const deliveryDateFormatted = fmtDate(deliveryNote.deliveryDate || deliveryNote.createdAt);
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Delivery No', 'Delivery Date', 'Customer Name', 'Sales Person', 'Delivery Type', 'Status' ]],
    body: [[
      deliveryNote.deliveryNumber || 'N/A',
      deliveryDateFormatted,
      customerName,
      String(salesPerson).slice(0,12),
      deliveryType,
      status
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Customer Information - Left Side (no box)
  const custName = (customer as any).customerName || customer.name || 'N/A';
  const custAddress = customer.address || 'N/A';
  const custPhone = (customer as any).phone || customer.phone || 'N/A';
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const leftStartY = afterMeta + 5;
  doc.text('DELIVER TO:', leftColX, leftStartY);
  doc.setFont('helvetica', 'normal');
  // Wrap long fields to prevent overlap into right column
  const nameLines = doc.splitTextToSize(`Customer: ${custName}`, leftColMaxWidth);
  const nameY = leftStartY + 6;
  doc.text(nameLines, leftColX, nameY);
  const nameDims = doc.getTextDimensions(nameLines);
  const addressLines = doc.splitTextToSize(`Address: ${custAddress}`, leftColMaxWidth);
  const addressY = nameY + nameDims.h + 2;
  doc.text(addressLines, leftColX, addressY);
  const addressDims = doc.getTextDimensions(addressLines);
  const phoneLines = doc.splitTextToSize(`Phone: ${custPhone}`, leftColMaxWidth);
  const phoneY = addressY + addressDims.h + 2;
  doc.text(phoneLines, leftColX, phoneY);
  
  // Delivery Information - Right Side (no box)
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY INFO:', rightColX, afterMeta + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Type: ${deliveryNote.deliveryType || 'Standard'}`, rightColX, afterMeta + 11, { align: 'right' });
  doc.text(`Status: ${deliveryNote.status || 'Pending'}`, rightColX, afterMeta + 17, { align: 'right' });
  const hasTracking = Boolean(deliveryNote.trackingNumber);
  if (hasTracking) {
    doc.text(`Tracking: ${deliveryNote.trackingNumber}`, rightColX, afterMeta + 23, { align: 'right' });
  }

  const leftBlockBottom = phoneY + doc.getTextDimensions(phoneLines).h;
  const rightBlockBottom = afterMeta + (hasTracking ? 23 : 17);
  const afterAddress = Math.max(leftBlockBottom, rightBlockBottom) + 6;
  
  // Sales Order totals banner (aggregated across all deliveries)
  if ((ctx as any).soTotals) {
    const so = (ctx as any).soTotals as { totalOrdered: number; totalDelivered: number; totalRemaining: number };
    const soRef = salesOrder?.orderNumber ? ` (${salesOrder.orderNumber})` : '';
    autoTable(doc, {
      startY: afterAddress - 10,
      head: [[ `SO Totals${soRef}`, 'Ordered', 'Delivered', 'Remaining' ]],
      body: [[ '', 
        so.totalOrdered.toFixed(2), 
        so.totalDelivered.toFixed(2), 
        so.totalRemaining.toFixed(2) 
      ]],
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
      columnStyles: { 0: { cellWidth: 70 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 15, right: 15 }
    });
  }
 
  // Determine safe start position for items table to avoid overlap with SO totals banner
  let itemsStartY = afterAddress;
  if ((ctx as any).soTotals && (doc as any).lastAutoTable && typeof (doc as any).lastAutoTable.finalY === 'number') {
    // Ensure the items table starts after the SO totals table if it extends below afterAddress
    itemsStartY = Math.max(afterAddress, (doc as any).lastAutoTable.finalY + 4);
  }

  // Enhanced Items table with comprehensive columns matching quotation format
  const currency = (deliveryNote as any).currency || (salesOrder as any)?.currency || 'BHD';
  const itemRows = items.map((it:any,i:number)=> {
    const deliveredQty = Number(it.deliveredQuantity || it.pickedQuantity || it.quantity || 0);
    const orderedQty = Number((it as any).orderedQuantity ?? (it as any).baseQuantity ?? deliveredQty);
    // Use the stored remainingQuantity which accounts for all previous deliveries
    const remainingQty = Number((it as any).remainingQuantity ?? Math.max(0, orderedQty - deliveredQty));
    const unit = Number(it.unitPrice || it.price || it.rate || 0);
    const gross = deliveredQty * unit;
    
    // Build enhanced description ensuring base item description always first
    const isGeneric = (txt?: string) => {
      if (!txt) return true;
      const v = String(txt).trim().toLowerCase();
      return v === 'generic item' || v === 'delivery item' || v === 'item from sales order' || v === 'item';
    };
    const descParts: string[] = [];
    // Prefer original sales order/master item descriptions over placeholders
    let baseName = (it as any).salesOrderItemDescription
      || (it as any).itemDescription
      || (it as any).item?.description
      || it.description
      || (it as any).productName
      || (it as any).item?.itemName
      || (it as any).name
      || 'Item';
    if (isGeneric(baseName)) {
      baseName = (it as any).item?.description || (it as any).productName || it.description || baseName;
    }
    descParts.push(baseName);
    if (it.description && it.description !== baseName && !isGeneric(it.description)) descParts.push(it.description);
    const originalName = (it as any).originalName || (it as any).originalItemName || (it as any).oemName;
    if (originalName && originalName !== baseName) {
      descParts.push(`Original: ${originalName}`);
    }
    // Original quantity (if differs)
    const originalQty = (it as any).originalQuantity ?? (it as any).sourceQuantity ?? (it as any).baseQuantity;
    if (originalQty != null && !Number.isNaN(Number(originalQty)) && Number(originalQty) !== qty) {
      descParts.push(`Original Qty: ${Number(originalQty).toFixed(2)}`);
    }
    // Original unit cost (if differs)
    const originalUnitRaw = (it as any).originalUnitPrice ?? (it as any).baseUnitPrice ?? (it as any).sourceUnitPrice ?? (it as any).item?.unitPrice;
    if (originalUnitRaw != null && !Number.isNaN(Number(originalUnitRaw)) && Number(originalUnitRaw) !== unit) {
      descParts.push(`Original Unit Cost: ${currency} ${Number(originalUnitRaw).toFixed(3)}`);
    }
    // Try to include original source references (quotation / enquiry) if available
    const sourceQuote = (it as any).quotationItemNumber || (it as any).quotationReference;
    const sourceEnquiry = (it as any).enquiryItemNumber || (it as any).enquiryReference;
    if (sourceQuote) descParts.push(`Quote Ref: ${sourceQuote}`);
    if (sourceEnquiry) descParts.push(`Enquiry Ref: ${sourceEnquiry}`);
    // Optional secondary display (productName)
    if ((it as any).productName && (it as any).productName !== baseName) descParts.push((it as any).productName);
    // Specifications / technical details
    const specRaw = (it as any).specifications || (it as any).specification || (it as any).itemSpecification || (it as any).technicalDetails;
    if (specRaw) {
      const specStr = String(specRaw).trim();
      if (specStr && !/^(n\/a|none)$/i.test(specStr)) {
        descParts.push(`Specs: ${specStr}`);
      }
    }
    // Notes / additional description
    const notes = (it as any).notes || (it as any).remarks || (it as any).additionalDescription;
    if (notes) {
      const notesStr = String(notes).trim();
      if (notesStr && notesStr.length > 0 && notesStr.toLowerCase() !== 'n/a') {
        descParts.push(`Notes: ${notesStr}`);
      }
    }
    // Supplier / catalog meta
    if ((it as any).supplierCode) descParts.push(`Supplier Code: ${(it as any).supplierCode}`);
    if ((it as any).barcode) descParts.push(`Barcode: ${(it as any).barcode}`);
    if ((it as any).item?.category) descParts.push(`Category: ${(it as any).item.category}`);
    // Collapse multiple blank lines & join
    const enhancedDesc = descParts.filter(p => p && p.trim().length > 0).join('\n');

    return [
      (i+1).toString(),
      enhancedDesc,
      `${deliveredQty.toFixed(2)} PCS`,
      `${remainingQty.toFixed(2)} PCS`
    ];
  });
  
  autoTable(doc, {
    startY: itemsStartY,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Remaining Qty' ]],
    body: itemRows,
    styles: { 
      fontSize: 6, 
      cellPadding: 0.3, 
      lineHeight: 0.8,
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 7,
      cellPadding: 0.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 12, halign:'center' },
      1: { cellWidth: 90, halign: 'left' },
      2: { cellWidth: 30, halign:'center' },
      3: { cellWidth: 30, halign:'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15, bottom: 35 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  
  // No totals or currency displayed on delivery note; proceed to remarks directly
  const afterSummary = afterItems;

  // Remarks / Notes box
  const remarks = (deliveryNote as any).notes || (deliveryNote as any).remarks || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || 'Delivery note generated from sales order'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15, bottom: 35 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  
  // Signature sections
  const sigY = afterRemarks + 10;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer with company information
  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimpleDeliveryNotePdf(ctx: DeliveryNotePdfContext): Buffer {
  const { deliveryNote } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('DELIVERY NOTE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Delivery #: ${deliveryNote.deliveryNumber || 'N/A'}`,20,30);
  doc.text(`Date: ${fmtDate(deliveryNote.deliveryDate || deliveryNote.createdAt)}`,20,36);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateDeliveryNotePdf(ctx: DeliveryNotePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleDeliveryNotePdf(ctx) : buildEnhancedDeliveryNotePdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `delivery-note-${ctx.deliveryNote.deliveryNumber || 'unknown'}.pdf`, 
    contentType: 'application/pdf' 
  };
}

// Receipt PDF Context
export interface ReceiptPdfContext {
  receipt: any; // Receipt type
  items: any[]; // ReceiptItem type
  customer: any; // Customer type
  mode?: 'enhanced' | 'simple';
}

// Receipt PDF Generation - Professional design matching the screenshot
export function buildEnhancedReceiptPdf(ctx: ReceiptPdfContext): Buffer {
  const { receipt, items, customer } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RECEIPT', pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const receiptDate = fmtDate(receipt.receiptDate || receipt.createdAt);
  doc.text(`Date: ${receiptDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Receipt #: ${receipt.receiptNumber || 'N/A'}`, pageWidth - 15, 35, { align: 'right' });
  const paymentMethod = receipt.paymentMethod || 'Cash';
  doc.text(`Payment: ${paymentMethod}`, pageWidth - 15, 40, { align: 'right' });
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Receipt No, Date, Customer Name, Payment Method, Status)
  const customerName = (customer as any).customerName || customer.name || '';
  const receiptDateFormatted = fmtDate(receipt.receiptDate || receipt.createdAt);
  const status = receipt.status || 'Completed';
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Receipt No', 'Receipt Date', 'Customer Name', 'Payment Method', 'Status' ]],
    body: [[
      receipt.receiptNumber || 'N/A',
      receiptDateFormatted,
      customerName,
      paymentMethod,
      status
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Customer Address & Contact section with proper formatting
  const custName = (customer as any).customerName || customer.name || 'N/A';
  const custAddress = customer.address || 'N/A';
  const custEmail = customer.email || 'N/A';
  const custPhone = (customer as any).phone || customer.phone || 'N/A';
  
  const contactPerson = (customer as any).contactPerson || 'N/A';
  const contactEmail = (customer as any).contactEmail || customer.email || 'N/A';
  const contactPhone = (customer as any).contactPhone || customer.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    custName,
    custAddress,
    custEmail,
    custPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Customer Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Customer Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  
  // Enhanced Items table with comprehensive columns matching quotation format
  const currency = (receipt as any).currency || 'BHD';
  const itemRows = items.map((it:any,i:number)=> {
    const qty = Number(it.quantity || 0);
    const unit = Number(it.unitPrice || 0);
    const gross = qty * unit;
    
    // Build enhanced description
    const descParts: string[] = [];
    const baseName = it.description || it.itemDescription || 'Item';
    descParts.push(baseName);
    
    if (it.specifications) {
      const specStr = String(it.specifications).trim();
      if (specStr && !/^(n\/a|none)$/i.test(specStr)) {
        descParts.push(`Specs: ${specStr}`);
      }
    }
    
    if (it.notes) {
      const notesStr = String(it.notes).trim();
      if (notesStr && notesStr.length > 0 && notesStr.toLowerCase() !== 'n/a') {
        descParts.push(`Notes: ${notesStr}`);
      }
    }
    
    const enhancedDesc = descParts.filter(p => p && p.trim().length > 0).join('\n');

    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty.toFixed(2)} PCS`,
      `${currency} ${unit.toFixed(3)}`,
      `${currency} ${gross.toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Unit Rate', 'Total Amount' ]],
    body: itemRows,
    styles: { 
      fontSize: 7, 
      cellPadding: 4, 
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign:'center' },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 20, halign:'center' },
      3: { cellWidth: 25, halign:'right' },
      4: { cellWidth: 25, halign:'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  
  // Calculate totals from items
  let calculatedSubtotal = 0;
  
  items.forEach((it:any) => {
    const qty = Number(it.quantity || 0);
    const unit = Number(it.unitPrice || 0);
    const gross = qty * unit;
    calculatedSubtotal += gross;
  });
  
  const subtotal = Number((receipt as any).subtotal) || calculatedSubtotal;
  
  // Summary table (align right)
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Total Amount', `${currency} ${subtotal.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(subtotal, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = (receipt as any).notes || (receipt as any).remarks || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || 'Receipt generated from payment'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  
  // Signature sections
  const sigY = afterRemarks + 10;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer with company information
  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimpleReceiptPdf(ctx: ReceiptPdfContext): Buffer {
  const { receipt } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('RECEIPT',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Receipt #: ${receipt.receiptNumber || 'N/A'}`,20,30);
  doc.text(`Date: ${fmtDate(receipt.receiptDate || receipt.createdAt)}`,20,36);
  doc.text(`Total: ${receipt.currency} ${Number(receipt.totalAmount || 0).toFixed(2)}`,20,42);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateReceiptPdf(ctx: ReceiptPdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleReceiptPdf(ctx) : buildEnhancedReceiptPdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `receipt-${ctx.receipt.receiptNumber || 'unknown'}.pdf`, 
    contentType: 'application/pdf' 
  };
}

// Goods Receipt PDF Context
export interface GoodsReceiptPdfContext {
  goodsReceipt: any; // GoodsReceiptHeader type
  items: any[]; // GoodsReceiptItem type
  supplier: any; // Supplier type
  mode?: 'enhanced' | 'simple';
}

// Goods Receipt PDF Generation - Professional design matching the screenshot
export function buildEnhancedGoodsReceiptPdf(ctx: GoodsReceiptPdfContext): Buffer {
  const { goodsReceipt, items, supplier } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('P.O. Box XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('GOODS RECEIPT', pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const receiptDate = fmtDate(goodsReceipt.receiptDate || goodsReceipt.createdAt);
  doc.text(`Date: ${receiptDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Receipt #: ${goodsReceipt.receiptNumber || 'N/A'}`, pageWidth - 15, 35, { align: 'right' });
  const expectedDate = fmtDate(goodsReceipt.expectedDeliveryDate);
  if (expectedDate) {
    doc.text(`Expected: ${expectedDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Main Receipt Details Table - matching the screenshot layout
  const supplierName = (supplier as any).supplierName || supplier.name || 'N/A';
  const receivedBy = goodsReceipt.receivedBy || 'system';
  const status = goodsReceipt.status || 'Draft';
  const actualDate = fmtDate(goodsReceipt.actualDeliveryDate || goodsReceipt.receiptDate);
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Receipt No', 'Receipt Date', 'Supplier Name', 'Received By', 'Status', 'Actual Date' ]],
    body: [[
      goodsReceipt.receiptNumber || 'N/A',
      receiptDate,
      supplierName,
      receivedBy,
      status,
      actualDate
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Supplier Address & Contact section with proper formatting - matching screenshot
  const suppName = (supplier as any).supplierName || supplier.name || 'N/A';
  const suppAddress = supplier.address || 'N/A';
  const suppEmail = supplier.email || 'N/A';
  const suppPhone = supplier.phone || 'N/A';
  
  const contactPerson = (supplier as any).contactPerson || 'N/A';
  const contactEmail = (supplier as any).contactEmail || supplier.email || 'N/A';
  const contactPhone = (supplier as any).contactPhone || supplier.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    suppName,
    suppEmail,
    suppPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Supplier Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Supplier Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  
  // Item Details Table - matching the screenshot with Items, Expected, Received, Discrepancy columns
  const itemRows = items.map((it:any,i:number)=> {
    const expected = Number(it.quantityExpected || 0);
    const received = Number(it.quantityReceived || 0);
    const discrepancy = expected - received;
    const discrepancyText = discrepancy === 0 ? 'NO' : discrepancy.toString();
    
    return [
      (i+1).toString(),
      expected.toString(),
      received.toString(),
      discrepancyText
    ];
  });
  
  // If no items, add a default row with zeros
  if (itemRows.length === 0) {
    itemRows.push(['0', '0', '0', 'NO']);
  }
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'Items', 'Expected', 'Received', 'Discrepancy' ]],
    body: itemRows,
    styles: { 
      fontSize: 7, 
      cellPadding: 4, 
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 30, halign:'center' }, // Items
      1: { cellWidth: 30, halign:'center' }, // Expected
      2: { cellWidth: 30, halign:'center' }, // Received
      3: { cellWidth: 30, halign:'center' }  // Discrepancy
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 10;
  
  // Notes Section - matching the screenshot format
  const notes = goodsReceipt.notes || '';
  const shipmentRef = goodsReceipt.shipmentReference || `SHP-TEMP-${Date.now()}`;
  const lpoValue = goodsReceipt.lpoValue || '0.00';
  const currency = goodsReceipt.lpoCurrency || 'BHD';
  const supplierId = goodsReceipt.supplierId || 'N/A';
  
  const notesContent = `Generated from shipment ${shipmentRef}. Supplier: ${supplierName}. Customer: Unknown. Value: ${currency} ${lpoValue}. Supplier ID: ${supplierId}`;
  
  doc.setFont('helvetica','bold').setFontSize(8).text('Notes', 15, afterItems);
  doc.setFont('helvetica','normal').setFontSize(7);
  const notesLines = doc.splitTextToSize(notesContent, pageWidth - 30);
  doc.text(notesLines, 15, afterItems + 6);
  
  // Footer with company information
  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimpleGoodsReceiptPdf(ctx: GoodsReceiptPdfContext): Buffer {
  const { goodsReceipt } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('GOODS RECEIPT',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Receipt #: ${goodsReceipt.receiptNumber || 'N/A'}`,20,30);
  doc.text(`Date: ${fmtDate(goodsReceipt.receiptDate || goodsReceipt.createdAt)}`,20,36);
  doc.text(`Status: ${goodsReceipt.status || 'Draft'}`,20,42);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateGoodsReceiptPdf(ctx: GoodsReceiptPdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleGoodsReceiptPdf(ctx) : buildEnhancedGoodsReceiptPdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `goods-receipt-${ctx.goodsReceipt.receiptNumber || 'unknown'}.pdf`, 
    contentType: 'application/pdf' 
  };
}

// Supplier LPO PDF Context
export interface SupplierLpoPdfContext {
  lpo: any; // SupplierLpo type
  items: any[]; // SupplierLpoItem type
  supplier: any; // Supplier type
  mode?: 'enhanced' | 'simple';
}

// Supplier LPO PDF Generation - Enhanced version matching Purchase Invoice design
export function buildEnhancedSupplierLpoPdf(ctx: SupplierLpoPdfContext): Buffer {
  const { lpo, items, supplier } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Company Header - Left Side (Quotation-style)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32);
  doc.text('GOLDEN TAG', 15, 20);

  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);

  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SUPPLIER LPO', pageWidth - 15, 20, { align: 'right' });

  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const lpoDate = fmtDate(lpo.lpoDate || lpo.createdAt);
  doc.text(`Date: ${lpoDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`LPO #: ${lpo.lpoNumber || 'N/A'}`, pageWidth - 15, 35, { align: 'right' });
  const expectedDelivery = fmtDate(lpo.expectedDeliveryDate);
  if (expectedDelivery) {
    doc.text(`Delivery Date: ${expectedDelivery}`, pageWidth - 15, 40, { align: 'right' });
  }

  // Separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);

  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (quotation-like)
  const supplierName = (supplier as any)?.name || lpo.supplierName || 'N/A';
  const status = lpo.status || 'Draft';
  const paymentTerms = lpo.paymentTerms || '30 Days';
  const deliveryTerms = lpo.deliveryTerms || '';
  const lpoDateFormatted = fmtDate(lpo.lpoDate || lpo.createdAt);
  const expectedDeliveryFormatted = fmtDate(lpo.expectedDeliveryDate) || deliveryTerms;
  autoTable(doc, {
    startY: 56,
    head: [[ 'LPO No', 'LPO Date', 'Supplier Name', 'Status', 'Payment Terms', 'Delivery / Terms' ]],
    body: [[
      lpo.lpoNumber || 'N/A',
      lpoDateFormatted,
      supplierName,
      status,
      paymentTerms,
      expectedDeliveryFormatted || 'N/A'
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;

  // Supplier address and contact (mirrors quotation customer block)
  const suppName = supplierName;
  const suppAddress = supplier?.address || 'N/A';
  const suppEmail = supplier?.email || lpo.supplierEmail || 'N/A';
  const suppPhone = supplier?.phone || lpo.supplierPhone || 'N/A';
  const contactPerson = (supplier as any)?.contactPerson || lpo.supplierContactPerson || 'N/A';
  const contactBlock = [contactPerson, suppEmail, suppPhone].filter(v => v && v !== 'N/A').join('\n');
  const addressBlock = [suppName, suppAddress, suppEmail, suppPhone].filter(v => v && v !== 'N/A').join('\n');
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Supplier Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Supplier Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;

  // Items table (remove Cost Price and Markup columns)
  const currency = lpo.currency || 'BHD';
  const itemRows = items.map((it:any, i:number) => {
    const qty = Number(it.quantity) || 0;
    const unitPrice = Number(it.unitPrice ?? it.unitCost ?? (it as any).costPrice ?? 0) || 0;
    const subtotal = Math.round((qty * unitPrice) * 100) / 100;
    const discPerc = Number((it as any).discountPercentage ?? it.discountPercent ?? 0) || 0;
    const discAmtRaw = (it as any).discountAmount != null ? Number((it as any).discountAmount) : 0;
    let discAmt = 0;
    if (discPerc > 0) {
      discAmt = Math.round((subtotal * discPerc / 100) * 100) / 100;
    } else if (discAmtRaw !== 0) {
      discAmt = Math.round(Math.min(subtotal, Math.abs(discAmtRaw)) * 100) / 100;
    }
    const afterDiscount = Math.round(Math.max(0, subtotal - discAmt) * 100) / 100;
    const vatPerc = Number((it as any).vatPercent ?? (it as any).taxPercent ?? 0) || 0;
    const vatAmtRaw = (it as any).vatAmount != null ? Number((it as any).vatAmount) : 0;
    let vatAmt = 0;
    if (vatPerc > 0) {
      vatAmt = Math.round((afterDiscount * vatPerc / 100) * 100) / 100;
    } else if (vatAmtRaw > 0) {
      vatAmt = Math.round(vatAmtRaw * 100) / 100;
    }
    let enhancedDesc = it.itemDescription || it.description || 'Item';
    if ((it as any).supplierCode) enhancedDesc += `\nCode: ${(it as any).supplierCode}`;
    if ((it as any).barcode) enhancedDesc += `\nBarcode: ${(it as any).barcode}`;
    if ((it as any).specifications) enhancedDesc += `\nSpecs: ${(it as any).specifications}`;
    const totalAmount = Math.round((afterDiscount + vatAmt) * 100) / 100;
    const unitOfMeasure = String((it as any).unitOfMeasure || 'PCS').toUpperCase();
    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty.toFixed(2)}`,
      `${unitOfMeasure}`,
      `${currency} ${unitPrice.toFixed(3)}`,
      discPerc > 0 ? `${discPerc.toFixed(1)}%` : '0%',
      `${currency} ${discAmt.toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${vatAmt.toFixed(2)}`,
      `${currency} ${totalAmount.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S\nI', 'Item Description & Specifications', 'Qty', 'Unit', 'Unit Price', 'Disc\n%', 'Disc\nAmt', 'VAT\n%', 'VAT Amt', 'Total\nAmount' ]],
    body: itemRows,
    styles: { 
      fontSize: 6, 
      cellPadding: 2, 
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 7,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign:'center' },  // S/N
      1: { cellWidth: 34, halign: 'left' },  // Item Description & Specifications (wider)
      2: { cellWidth: 10, halign:'center' }, // Qty
      3: { cellWidth: 10, halign:'center' }, // Unit
      4: { cellWidth: 18, halign:'right' },  // Unit Price (wider)
      5: { cellWidth: 16, halign:'center' }, // Disc % (wider)
      6: { cellWidth: 18, halign:'right' },  // Disc Amt (wider)
      7: { cellWidth: 16, halign:'center' }, // VAT % (wider)
      8: { cellWidth: 18, halign:'right' },  // VAT Amt (wider)
      9: { cellWidth: 28, halign:'right' }   // Total Amount (wider)
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;

  // Totals (quotation-like calc)
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  items.forEach((it:any) => {
    const qty = Number(it.quantity) || 0;
    const cost = Number((it as any).costPrice ?? it.unitCost ?? 0) || 0;
    const markupPct = Number((it as any).markup) || 0;
    const unit = Math.round((cost * (1 + Math.max(0, markupPct) / 100)) * 1000) / 1000 || Number(it.unitPrice) || cost;
    const subtotal = Math.round((qty * unit) * 100) / 100;
    const discPerc = Number((it as any).discountPercentage ?? it.discountPercent ?? 0) || 0;
    const discAmtRaw = (it as any).discountAmount != null ? Number((it as any).discountAmount) : 0;
    let discAmt = 0;
    if (discPerc > 0) discAmt = Math.round((subtotal * discPerc / 100) * 100) / 100; else if (discAmtRaw !== 0) discAmt = Math.round(Math.min(subtotal, Math.abs(discAmtRaw)) * 100) / 100;
    const afterDiscount = Math.round(Math.max(0, subtotal - discAmt) * 100) / 100;
    const vatPerc = Number((it as any).vatPercent ?? (it as any).taxPercent ?? 0) || 0;
    const vatAmtRaw = (it as any).vatAmount != null ? Number((it as any).vatAmount) : 0;
    let vatAmt = 0;
    if (vatPerc > 0) vatAmt = Math.round((afterDiscount * vatPerc / 100) * 100) / 100; else if (vatAmtRaw > 0) vatAmt = Math.round(vatAmtRaw * 100) / 100;
    calculatedSubtotal += subtotal;
    calculatedDiscount += discAmt;
    calculatedVAT += vatAmt;
  });
  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const discountAmount = Math.round(calculatedDiscount * 100) / 100;
  const taxAmount = Math.round(calculatedVAT * 100) / 100;
  const netAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;

  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Subtotal', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', discountAmount > 0 ? `-${currency} ${discountAmount.toFixed(2)}` : `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Total Amount', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks
  const remarks = [lpo.termsAndConditions, lpo.specialInstructions, lpo.deliveryTerms].filter(Boolean).join('\n');
  if (remarks) {
    const remarksLines = doc.splitTextToSize('Remarks:\n' + remarks, pageWidth - 30);
    autoTable(doc, {
      startY: afterSummary + 8,
      body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
      styles: { cellPadding: 3 },
      margin: { left: 15, right: 15 },
      theme: 'grid'
    });
  }

  const afterRemarks = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : afterSummary + 8;
  const validity = expectedDelivery ? `This order is expected by ${expectedDelivery}` : '';
  if (validity) doc.setFont('helvetica','normal').setFontSize(7).text(validity, 15, afterRemarks);

  // Signatures and footer
  const sigY = (validity ? afterRemarks + 12 : afterRemarks + 0) + 14;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Supplier Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);

  const currentPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, currentPageHeight - 25, pageWidth - 15, currentPageHeight - 25);
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your partnership!', pageWidth / 2, currentPageHeight - 20, { align: 'center' });
  doc.text('Golden Tag Trading & Supply Company | Kingdom of Bahrain', pageWidth / 2, currentPageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Phone: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, currentPageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

// Simple supplier LPO PDF (minimal version)
export function buildSimpleSupplierLpoPdf(ctx: SupplierLpoPdfContext): Buffer {
  const { lpo } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('PURCHASE ORDER',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`LPO #: ${lpo.lpoNumber}`,20,30);
  doc.text(`Supplier: ${lpo.supplierName}`,20,36);
  doc.text(`Total: ${lpo.currency || 'BHD'} ${Number(lpo.totalAmount || 0).toFixed(2)}`,20,42);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateSupplierLpoPdf(ctx: SupplierLpoPdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleSupplierLpoPdf(ctx) : buildEnhancedSupplierLpoPdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `lpo-${ctx.lpo.lpoNumber || 'unknown'}.pdf`, 
    contentType: 'application/pdf' 
  };
}

export type { InvoicePdfContext as InvoicePdfOptions, QuotationPdfContext as QuotationPdfOptions, PurchaseInvoicePdfContext as PurchaseInvoicePdfOptions, DeliveryNotePdfContext as DeliveryNotePdfOptions, ReceiptPdfContext as ReceiptPdfOptions, GoodsReceiptPdfContext as GoodsReceiptPdfOptions, SupplierLpoPdfContext as SupplierLpoPdfOptions };
