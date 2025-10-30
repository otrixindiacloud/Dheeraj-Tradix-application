/**
 * Centralized tax and discount calculation utilities
 * Provides consistent calculations across all modules
 */

export interface LineItemCalculationInput {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
}

export interface LineItemCalculationResult {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface DocumentTotalsResult {
  grossSubtotal: number;
  totalDiscount: number;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
}

/**
 * Calculate line item totals with proper rounding
 */
export function calculateLineItemTotals(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0,
  taxPercent: number = 0,
  explicitDiscountAmount?: number
): LineItemCalculationResult {
  // Ensure valid numeric inputs
  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Number(unitPrice) || 0);
  const discPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const taxPct = Math.max(0, Number(taxPercent) || 0);
  const explicitDisc = Math.max(0, Number(explicitDiscountAmount) || 0);

  // Calculate gross amount
  const grossAmount = Math.round((qty * price) * 100) / 100;
  
  // Calculate discount amount
  let discountAmount = 0;
  if (explicitDisc > 0) {
    // Use explicit discount amount if provided
    discountAmount = Math.min(explicitDisc, grossAmount * 0.999); // Cap at 99.9% of gross
  } else {
    // Calculate from percentage
    discountAmount = Math.round((grossAmount * discPct / 100) * 100) / 100;
  }
  
  // Calculate net amount (after discount)
  const netAmount = Math.max(0.01, Math.round((grossAmount - discountAmount) * 100) / 100);
  
  // Calculate tax amount (on net amount)
  const taxAmount = Math.round((netAmount * taxPct / 100) * 100) / 100;
  
  // Calculate total amount
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  
  return {
    grossAmount,
    discountAmount,
    netAmount,
    taxAmount,
    totalAmount
  };
}

/**
 * Calculate document totals from multiple line items
 */
export function calculateDocumentTotals(items: LineItemCalculationInput[]): DocumentTotalsResult {
  let grossSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  
  items.forEach(item => {
    const result = calculateLineItemTotals(
      item.quantity,
      item.unitPrice,
      item.discountPercent || 0,
      item.taxPercent || 0,
      item.discountAmount
    );
    
    grossSubtotal += result.grossAmount;
    totalDiscount += result.discountAmount;
    totalTax += result.taxAmount;
  });
  
  const subtotal = Math.round((grossSubtotal - totalDiscount) * 100) / 100;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
  
  return {
    grossSubtotal,
    totalDiscount,
    subtotal,
    totalTax,
    totalAmount
  };
}

/**
 * Validate and sanitize currency amounts
 */
export function validateCurrencyAmount(amount: any): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  if (typeof amount === 'number') {
    return isNaN(amount) || !isFinite(amount) ? 0 : Math.max(0, amount);
  }
  return 0;
}

/**
 * Format currency amount with proper decimal places
 */
export function formatCurrencyAmount(amount: number, currency: string = 'BHD'): string {
  const validAmount = validateCurrencyAmount(amount);
  
  if (currency === 'BHD') {
    return `BHD ${validAmount.toFixed(3)}`;
  } else if (currency === 'USD') {
    return `BHD ${validAmount.toFixed(2)}`;
  } else {
    return `${currency} ${validAmount.toFixed(2)}`;
  }
}

/**
 * Get default tax rate for different document types
 * Returns 0 by default to make VAT optional
 */
export function getDefaultTaxRate(documentType: 'sales_order' | 'invoice' | 'supplier_lpo' | 'quotation'): number {
  // VAT is now optional - return 0 by default
  // Users can set specific VAT rates when needed
  return 0;
}

/**
 * Calculate tax breakdown for display
 */
export function calculateTaxBreakdown(items: LineItemCalculationInput[], taxRate: number = 10) {
  const totals = calculateDocumentTotals(items);
  
  return {
    ...totals,
    taxRate,
    taxBreakdown: {
      subtotal: totals.subtotal,
      taxAmount: totals.totalTax,
      totalAmount: totals.totalAmount,
      taxPercentage: taxRate
    }
  };
}

/**
 * Recalculate totals for existing items with proper tax handling
 */
export function recalculateItemTotals(item: any, taxRate: number = 10): any {
  const calculation = calculateLineItemTotals(
    item.quantity || 0,
    item.unitPrice || 0,
    item.discountPercent || 0,
    taxRate,
    item.discountAmount
  );
  
  return {
    ...item,
    grossAmount: calculation.grossAmount,
    discountAmount: calculation.discountAmount,
    netAmount: calculation.netAmount,
    taxAmount: calculation.taxAmount,
    totalAmount: calculation.totalAmount,
    taxPercent: taxRate
  };
}
