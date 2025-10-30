/**
 * Currency calculation and formatting utilities
 * Ensures consistent handling of currency values across the application
 */

export interface CurrencyCalculation {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
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
): CurrencyCalculation {
  const grossAmount = Math.round((quantity * unitPrice) * 100) / 100;
  
  let discountAmount = 0;
  if (explicitDiscountAmount && explicitDiscountAmount > 0) {
    discountAmount = Math.round(explicitDiscountAmount * 100) / 100;
  } else {
    discountAmount = Math.round((grossAmount * discountPercent / 100) * 100) / 100;
  }
  
  const netAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
  const taxAmount = Math.round((netAmount * taxPercent / 100) * 100) / 100;
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  
  return {
    grossAmount,
    discountAmount,
    netAmount,
    totalAmount,
    taxAmount
  };
}

/**
 * Calculate document totals from line items
 */
export function calculateDocumentTotals(items: Array<{
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  explicitDiscountAmount?: number;
}>): {
  grossSubtotal: number;
  totalDiscount: number;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
} {
  let grossSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  
  items.forEach(item => {
    const calculation = calculateLineItemTotals(
      item.quantity,
      item.unitPrice,
      item.discountPercent || 0,
      item.taxPercent || 0,
      item.explicitDiscountAmount
    );
    
    grossSubtotal += calculation.grossAmount;
    totalDiscount += calculation.discountAmount;
    totalTax += calculation.taxAmount;
  });
  
  const subtotal = Math.round((grossSubtotal - totalDiscount) * 100) / 100;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
  
  return {
    grossSubtotal: Math.round(grossSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotal,
    totalTax: Math.round(totalTax * 100) / 100,
    totalAmount
  };
}

/**
 * Validate currency amount
 */
export function validateCurrencyAmount(amount: any): number {
  if (amount === null || amount === undefined || amount === '') {
    return 0;
  }
  
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  
  return Math.round(num * 100) / 100;
}

/**
 * Format currency with proper precision
 */
export function formatCurrencyAmount(amount: number, currency: string = 'BHD'): string {
  const roundedAmount = Math.round(amount * 100) / 100;
  
  if (currency === 'BHD') {
    return new Intl.NumberFormat("en-BH", {
      style: "currency",
      currency: "BHD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(roundedAmount);
  }
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundedAmount);
}

/**
 * Parse currency string to number
 */
export function parseCurrencyAmount(amount: string | number): number {
  if (typeof amount === 'number') {
    return validateCurrencyAmount(amount);
  }
  
  // Remove currency symbols and spaces
  const cleaned = amount.replace(/[^\d.-]/g, '');
  return validateCurrencyAmount(cleaned);
}
