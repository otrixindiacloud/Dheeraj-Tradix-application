import { z } from "zod";

// LPO Status validation
export const lpoStatusSchema = z.enum(["Draft", "Pending", "Sent", "Confirmed", "Received", "Cancelled"]);

// LPO Item validation
export const lpoItemSchema = z.object({
  id: z.string().uuid().optional(),
  supplierLpoId: z.string().uuid(),
  itemId: z.string().uuid().nullable().optional(),
  salesOrderItemId: z.string().uuid().nullable().optional(),
  quotationItemId: z.string().uuid().nullable().optional(),
  supplierCode: z.string().min(1, "Supplier code is required").max(100),
  barcode: z.string().min(1, "Barcode is required").max(100),
  itemDescription: z.string().min(1, "Item description is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  receivedQuantity: z.number().int().min(0).default(0),
  pendingQuantity: z.number().int().min(0).default(0),
  unitCost: z.number().min(0, "Unit cost must be non-negative"),
  totalCost: z.number().min(0, "Total cost must be non-negative"),
  lineNumber: z.number().int().min(1).optional(),
  requestedDeliveryDate: z.date().nullable().optional(),
  confirmedDeliveryDate: z.date().nullable().optional(),
  deliveryStatus: z.enum(["Pending", "Partial", "Complete"]).default("Pending"),
  urgency: z.enum(["Low", "Normal", "High", "Urgent"]).default("Normal"),
  specialInstructions: z.string().nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
});

// LPO validation schema
export const lpoSchema = z.object({
  id: z.string().uuid().optional(),
  lpoNumber: z.string().min(1, "LPO number is required").max(50),
  supplierId: z.string().uuid("Invalid supplier ID"),
  status: lpoStatusSchema.default("Draft"),
  lpoDate: z.date().default(() => new Date()),
  expectedDeliveryDate: z.date().nullable().optional(),
  requestedDeliveryDate: z.date().nullable().optional(),
  sourceType: z.enum(["Manual", "Auto", "SupplierQuote"]).default("Manual"),
  sourceSalesOrderIds: z.array(z.string().uuid()).nullable().optional(),
  sourceQuotationIds: z.array(z.string().uuid()).nullable().optional(),
  groupingCriteria: z.string().max(100).nullable().optional(),
  subtotal: z.number().min(0, "Subtotal must be non-negative"),
  taxAmount: z.number().min(0, "Tax amount must be non-negative"),
  totalAmount: z.number().min(0, "Total amount must be non-negative"),
  currency: z.string().min(3).max(10).default("BHD"),
  supplierContactPerson: z.string().max(255).nullable().optional(),
  supplierEmail: z.string().email("Invalid email format").max(255).nullable().optional(),
  supplierPhone: z.string().max(50).nullable().optional(),
  paymentTerms: z.string().max(255).nullable().optional(),
  deliveryTerms: z.string().max(255).nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
  version: z.number().int().min(1).default(1),
  parentLpoId: z.string().uuid().nullable().optional(),
  amendmentReason: z.string().nullable().optional(),
  amendmentType: z.enum(["Quantity", "Price", "Delivery", "Terms", "Cancellation"]).nullable().optional(),
  requiresApproval: z.boolean().default(false),
  approvalStatus: z.enum(["Not Required", "Pending", "Approved", "Rejected"]).default("Not Required"),
  createdBy: z.string().uuid().nullable().optional(),
  updatedBy: z.string().uuid().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  approvedAt: z.date().nullable().optional(),
  approvalNotes: z.string().nullable().optional(),
  sentToSupplierAt: z.date().nullable().optional(),
  confirmedBySupplierAt: z.date().nullable().optional(),
  supplierConfirmationReference: z.string().max(255).nullable().optional(),
});

// LPO Update validation schema (all fields optional except id)
export const lpoUpdateSchema = lpoSchema.partial().extend({
  id: z.string().uuid(),
});

// LPO creation from quotes validation
export const createLpoFromQuotesSchema = z.object({
  quoteIds: z.array(z.string().uuid("Invalid quote ID")).min(1, "At least one quote ID is required"),
  groupBy: z.enum(["supplier", "delivery_date", "custom"]).default("supplier"),
});

// LPO creation from sales orders validation
export const createLpoFromSalesOrdersSchema = z.object({
  salesOrderIds: z.array(z.string().uuid("Invalid sales order ID")).min(1, "At least one sales order ID is required"),
  groupBy: z.enum(["supplier", "delivery_date", "custom"]).default("supplier"),
  supplierId: z.string().uuid("Invalid supplier ID").optional(),
});

// LPO status update validation
export const lpoStatusUpdateSchema = z.object({
  status: lpoStatusSchema,
  notes: z.string().max(1000).optional(),
});

// LPO approval validation
export const lpoApprovalSchema = z.object({
  notes: z.string().max(1000).optional(),
});

// LPO rejection validation
export const lpoRejectionSchema = z.object({
  notes: z.string().min(1, "Rejection notes are required").max(1000),
});

// LPO confirmation validation
export const lpoConfirmationSchema = z.object({
  confirmationReference: z.string().max(255).optional(),
});

// LPO delivery date update validation
export const lpoDeliveryDateUpdateSchema = z.object({
  expectedDeliveryDate: z.string().datetime("Invalid date format"),
  userId: z.string().uuid("Invalid user ID").optional(),
});

// Validation helper functions
export function validateLpoData(data: any) {
  try {
    return lpoSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateLpoUpdateData(data: any) {
  try {
    return lpoUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateLpoItemData(data: any) {
  try {
    return lpoItemSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateCreateLpoFromQuotesData(data: any) {
  try {
    return createLpoFromQuotesSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateCreateLpoFromSalesOrdersData(data: any) {
  try {
    return createLpoFromSalesOrdersSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

// Business logic validation functions
export function validateLpoStatusTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    "Draft": ["Pending", "Sent", "Cancelled"],
    "Pending": ["Sent", "Cancelled"],
    "Sent": ["Confirmed", "Received", "Cancelled"],
    "Confirmed": ["Received", "Cancelled"],
    "Received": [], // Terminal state
    "Cancelled": [], // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

export function validateLpoApprovalStatusTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    "Not Required": ["Pending"],
    "Pending": ["Approved", "Rejected"],
    "Approved": [], // Terminal state
    "Rejected": ["Pending"], // Can be resubmitted
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

export function validateLpoFinancialData(subtotal: number, taxAmount: number, totalAmount: number): boolean {
  // Basic financial validation
  if (subtotal < 0 || taxAmount < 0 || totalAmount < 0) {
    return false;
  }
  
  // Allow some tolerance for rounding differences
  const calculatedTotal = subtotal + taxAmount;
  const difference = Math.abs(totalAmount - calculatedTotal);
  const tolerance = 0.01; // 1 cent tolerance
  
  return difference <= tolerance;
}

export function validateLpoItemFinancialData(quantity: number, unitCost: number, totalCost: number, discountPercent: number = 0, discountAmount: number = 0): boolean {
  if (quantity <= 0 || unitCost < 0 || totalCost < 0 || discountPercent < 0 || discountPercent > 100 || discountAmount < 0) {
    return false;
  }
  
  const grossAmount = quantity * unitCost;
  const calculatedDiscount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
  const calculatedTotal = grossAmount - calculatedDiscount;
  
  // Allow some tolerance for rounding differences
  const difference = Math.abs(totalCost - calculatedTotal);
  const tolerance = 0.01; // 1 cent tolerance
  
  return difference <= tolerance;
}
