// Note: The deliveryNote table has been replaced by the deliveries table below

// Delivery Item Table
export const deliveryItem = pgTable("delivery_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id").notNull().references(() => deliveries.id, { onDelete: "cascade" }),
  salesOrderItemId: uuid("sales_order_item_id").notNull(),
  itemId: uuid("item_id").notNull(),
  barcode: varchar("barcode", { length: 64 }),
  supplierCode: varchar("supplier_code", { length: 64 }),
  description: text("description"),
  orderedQuantity: integer("ordered_quantity").notNull(),
  pickedQuantity: integer("picked_quantity").notNull().default(0),
  deliveredQuantity: integer("delivered_quantity").notNull().default(0),
  unitPrice: varchar("unit_price", { length: 32 }),
  totalPrice: varchar("total_price", { length: 32 }),
  pickedBy: uuid("picked_by"),
  pickedAt: timestamp("picked_at"),
  storageLocation: varchar("storage_location", { length: 64 }),
  pickingNotes: text("picking_notes"),
  qualityChecked: boolean("quality_checked").default(false),
  qualityCheckedBy: uuid("quality_checked_by"),
  qualityCheckedAt: timestamp("quality_checked_at"),
  qualityNotes: text("quality_notes"),
});
import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  decimal,
  integer,
  jsonb,
  boolean,
  pgEnum,
  uuid,
  date,
  unique
} from "drizzle-orm/pg-core";
// Physical Stock Table
export const physicalStock = pgTable("physical_stock", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull(),
  location: varchar("location", { length: 128 }),
  quantity: integer("quantity").notNull(),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  countedBy: varchar("counted_by", { length: 128 }),
  notes: text("notes"),
});

// Stock Transfer Table
export const stockTransfer = pgTable("stock_transfer", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromLocation: varchar("from_location", { length: 128 }).notNull(),
  toLocation: varchar("to_location", { length: 128 }).notNull(),
  itemId: uuid("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  transferDate: timestamp("transfer_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 32 }), // e.g., Pending, Completed
});

// Stock Issues Table
export const stockIssue = pgTable("stock_issue", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueNumber: varchar("issue_number", { length: 32 }),
  itemId: uuid("item_id"), // Made nullable for wizard with multiple items
  issuedTo: varchar("issued_to", { length: 128 }),
  quantity: integer("quantity"), // Made nullable for wizard with multiple items
  issueDate: timestamp("issue_date", { withTimezone: true }).defaultNow(),
  reason: text("reason"),
  // Newly added fields (ensure migrations applied: see add-stock-issue-fixes.sql)
  departmentId: uuid("department_id"),
  notes: text("notes"),
  status: varchar("status", { length: 32 }),
  // Wizard fields
  deliveryNumber: varchar("delivery_number", { length: 64 }),
  customerId: uuid("customer_id"),
  supplierId: uuid("supplier_id"),
  issueReason: text("issue_reason"),
});

export const stockIssueItems = pgTable("stock_issue_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  stockIssueId: uuid("stock_issue_id").notNull().references(() => stockIssue.id),
  itemId: uuid("item_id"),
  itemDescription: text("item_description"),
  quantityIssued: integer("quantity_issued").notNull().default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default("0"),
  issueReason: text("issue_reason"),
  conditionNotes: text("condition_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Issue Return Wizard tables
export const issueReturnHeader = pgTable("issue_return", {
  id: uuid("id").primaryKey().defaultRandom(),
  stockIssueId: uuid("stock_issue_id").references(() => stockIssue.id, { onDelete: "cascade" }),
  issueNumber: varchar("issue_number", { length: 64 }).notNull(),
  issueDate: date("issue_date").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  issueReason: text("issue_reason"),
  status: varchar("status", { length: 32 }).default("Draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const issueReturnItems = pgTable("issue_return_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueReturnId: uuid("issue_return_id").notNull().references(() => issueReturnHeader.id, { onDelete: "cascade" }),
  serialNo: integer("serial_no").notNull().default(1),
  itemId: uuid("item_id"),
  itemDescription: text("item_description").notNull().default(""),
  quantityIssued: decimal("quantity_issued", { precision: 10, scale: 2 }).notNull().default("0"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  issueReason: text("issue_reason"),
  conditionNotes: text("condition_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Issue Returns Table
export const issueReturns = pgTable("issue_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnNumber: varchar("return_number", { length: 64 }).notNull(),
  stockIssueId: uuid("stock_issue_id").notNull().references(() => stockIssue.id),
  returnType: varchar("return_type", { length: 64 }).notNull(), // Quality Issue, Wrong Item, Damaged Item, Over Issued, Other
  priority: varchar("priority", { length: 32 }).notNull(), // Critical, High, Medium, Low
  description: text("description").notNull(),
  returnedBy: varchar("returned_by", { length: 128 }).notNull(),
  returnDate: timestamp("return_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 32 }).default("Open"), // Open, In Progress, Resolved, Closed, Escalated
  resolution: text("resolution"),
  assignedTo: varchar("assigned_to", { length: 128 }),
  estimatedResolution: timestamp("estimated_resolution", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Material Request Table
export const materialRequest = pgTable("material_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestedBy: varchar("requested_by", { length: 128 }),
  itemId: uuid("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  requestDate: timestamp("request_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 32 }), // e.g., Pending, Approved, Rejected
  notes: text("notes"),
});

// Zod schema for Material Request
export const materialRequestSchema = createInsertSchema(materialRequest).omit({ id: true });

// Legacy inventory item table - DEPRECATED, use inventoryItems from schemas/inventory.ts
// Keeping for backward compatibility with existing data
export const inventoryItem = pgTable("inventory_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierCode: varchar("supplier_code", { length: 64 }),
  barcode: varchar("barcode", { length: 64 }),
  description: text("description"),
  category: varchar("category", { length: 64 }),
  uom: varchar("uom", { length: 16 }),
  costPrice: integer("cost_price"),
  markupRule: varchar("markup_rule", { length: 32 }),
  color: varchar("color", { length: 32 }),
  size: varchar("size", { length: 32 }),
  packaging: varchar("packaging", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Goods Receipt Table
export const goodsReceipt = pgTable("goods_receipt", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierLpoId: uuid("supplier_lpo_id").notNull(),
  itemId: uuid("item_id").notNull(),
  barcode: varchar("barcode", { length: 64 }),
  quantity: integer("quantity").notNull(),
  receiptDate: timestamp("receipt_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 32 }), // e.g., Received, Damaged, Shortage
  notes: text("notes"),
});

// Shipping Tracking Table
export const shippingTracking = pgTable("shipping_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  salesOrderId: uuid("sales_order_id").notNull(),
  trackingNumber: varchar("tracking_number", { length: 64 }),
  carrier: varchar("carrier", { length: 64 }),
  status: varchar("status", { length: 32 }), // e.g., In Transit, Delivered
  shippedDate: timestamp("shipped_date", { withTimezone: true }),
  deliveredDate: timestamp("delivered_date", { withTimezone: true }),
  notes: text("notes"),
});

// Customer PO Upload Table
export const customerPoUpload = pgTable("customer_po_upload", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull(),
  quotationId: uuid("quotation_id").notNull(),
  poNumber: varchar("po_number", { length: 64 }),
  fileUrl: varchar("file_url", { length: 256 }), // Path to uploaded PO file
  uploadDate: timestamp("upload_date", { withTimezone: true }).defaultNow(),
  uploadedBy: varchar("uploaded_by", { length: 128 }),
});

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "nanoid";

// Enums
export const customerTypeEnum = pgEnum("customer_type", ["Retail", "Wholesale"]);
export const customerClassificationEnum = pgEnum("customer_classification", ["Internal", "Corporate", "Individual", "Family", "Ministry"]);
export const enquiryStatusEnum = pgEnum("enquiry_status", ["New", "In Progress", "Quoted", "Closed"]);
export const enquirySourceEnum = pgEnum("enquiry_source", ["Email", "Phone", "Web Form", "Walk-in", "Referral"]);
export const quotationStatusEnum = pgEnum("quotation_status", ["Draft", "Sent", "Accepted", "Approved", "Rejected", "Expired"]);
export const salesOrderStatusEnum = pgEnum("sales_order_status", ["Draft", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]);
export const supplierLpoStatusEnum = pgEnum("supplier_lpo_status", ["Draft", "Pending", "Sent", "Confirmed", "Received", "Cancelled"]);
export const goodsReceiptStatusEnum = pgEnum("goods_receipt_status", ["Pending", "Partial", "Complete", "Discrepancy", "Approved"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["Pending", "Partial", "Complete", "Cancelled"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["Draft", "Sent", "Paid", "Overdue", "Cancelled"]);
export const requisitionStatusEnum = pgEnum("requisition_status", ["Draft", "Pending Approval", "Approved", "Rejected", "Processing", "Completed", "Cancelled"]);
export const requisitionPriorityEnum = pgEnum("requisition_priority", ["Low", "Medium", "High", "Urgent"]);
export const requisitionItemUrgencyEnum = pgEnum("requisition_item_urgency", ["Standard", "Urgent"]);
export const physicalStockStatusEnum = pgEnum("physical_stock_status", ["Draft", "In Progress", "Completed", "Approved", "Cancelled"]);
export const stockCountStatusEnum = pgEnum("stock_count_status", ["Pending", "Counted", "Verified", "Discrepancy", "Adjusted"]);
export const shipmentStatusEnum = pgEnum("shipment_status", ["Pending", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Delayed", "Cancelled", "Lost"]);
export const shipmentPriorityEnum = pgEnum("shipment_priority", ["Low", "Medium", "High", "Urgent"]);
export const shipmentServiceTypeEnum = pgEnum("shipment_service_type", ["Standard", "Express", "Overnight", "Economy"]);
export const trackingEventTypeEnum = pgEnum("tracking_event_type", ["Pickup", "In Transit", "Sorting", "Out for Delivery", "Delivered", "Exception"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  // Authentication fields
  passwordHash: varchar("password_hash", { length: 255 }),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  customerType: customerTypeEnum("customer_type").notNull(),
  classification: customerClassificationEnum("classification").notNull(),
  taxId: varchar("tax_id", { length: 100 }),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Add unique constraints to prevent duplicate entries
  nameUnique: unique("customers_name_unique").on(table.name),
  emailUnique: unique("customers_email_unique").on(table.email),
}));

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  supplierCode: varchar("supplier_code", { length: 100 }).unique(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 255 }),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Carriers
export const carriers = pgTable("carriers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  carrierCode: varchar("carrier_code", { length: 100 }).unique(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 255 }),
  serviceType: varchar("service_type", { length: 100 }), // Standard, Express, Overnight, Economy
  trackingUrl: varchar("tracking_url", { length: 500 }), // URL template for tracking
  apiKey: varchar("api_key", { length: 255 }), // Optional API key for integration
  accountNumber: varchar("account_number", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Items/Products
export const items = pgTable("items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(), // Add required name field
  supplierCode: varchar("supplier_code", { length: 100 }).notNull(),
  barcode: varchar("barcode", { length: 100 }).unique(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  retailMarkup: decimal("retail_markup", { precision: 5, scale: 2 }).default("70"),
  wholesaleMarkup: decimal("wholesale_markup", { precision: 5, scale: 2 }).default("40"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  variants: jsonb("variants"), // For color, size, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legacy Inventory (keeping for existing data)
export const legacyInventory = pgTable("inventory", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  quantity: integer("quantity").default(0),
  reservedQuantity: integer("reserved_quantity").default(0),
  storageLocation: varchar("storage_location", { length: 100 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Customer Enquiries
export const enquiries = pgTable("enquiries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  enquiryNumber: varchar("enquiry_number", { length: 50 }).unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  enquiryDate: timestamp("enquiry_date").defaultNow(),
  status: enquiryStatusEnum("status").default("New"),
  source: enquirySourceEnum("source").notNull(),
  referralCustomerId: uuid("referral_customer_id").references(() => customers.id),
  referralName: varchar("referral_name", { length: 255 }),
  targetDeliveryDate: timestamp("target_delivery_date"),
  notes: text("notes"),
  attachments: jsonb("attachments"), // File paths/URLs
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enquiry Items
export const enquiryItems = pgTable("enquiry_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  enquiryId: uuid("enquiry_id").references(() => enquiries.id).notNull(),
  itemId: uuid("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  // Optional discount fields for enquiry item line
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  // Optional VAT fields for enquiry item line
  vatPercent: decimal("vat_percent", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

// Requisitions
export const requisitions = pgTable("requisitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requisitionNumber: varchar("requisition_number", { length: 50 }).unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  requestedBy: varchar("requested_by", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  priority: requisitionPriorityEnum("priority").notNull(),
  status: requisitionStatusEnum("status").default("Draft"),
  requestDate: timestamp("request_date").defaultNow(),
  requiredDate: timestamp("required_date").notNull(),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedDate: timestamp("approved_date"),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 12, scale: 2 }).notNull(),
  justification: text("justification").notNull(),
  notes: text("notes"),
  itemCount: integer("item_count").default(0),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Requisition Items
export const requisitionItems = pgTable("requisition_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requisitionId: uuid("requisition_id").references(() => requisitions.id).notNull(),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }).notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }).notNull(),
  vatPercentage: decimal("vat_percentage", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  specification: text("specification"),
  preferredSupplier: varchar("preferred_supplier", { length: 255 }),
  urgency: requisitionItemUrgencyEnum("urgency").default("Standard"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Approval Levels enum
export const approvalLevelEnum = pgEnum("approval_level", ["Sales Rep", "Manager", "Finance", "Director"]);

// Quotations
export const quotations = pgTable("quotations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: varchar("quote_number", { length: 50 }).unique().notNull(),
  revision: integer("revision").default(1),
  // Revision tracking for audit purposes
  parentQuotationId: uuid("parent_quotation_id"),
  revisionReason: text("revision_reason"),
  supersededAt: timestamp("superseded_at"),
  supersededBy: uuid("superseded_by").references(() => users.id),
  isSuperseded: boolean("is_superseded").default(false),
  enquiryId: uuid("enquiry_id").references(() => enquiries.id),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  customerType: customerTypeEnum("customer_type").notNull(),
  status: quotationStatusEnum("status").default("Draft"),
  quoteDate: timestamp("quote_date").defaultNow(),
  validUntil: timestamp("valid_until"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  terms: text("terms"),
  notes: text("notes"),
  approvalStatus: varchar("approval_status", { length: 50 }).default("Pending"),
  requiredApprovalLevel: approvalLevelEnum("required_approval_level"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quotation Items
export const quotationItems = pgTable("quotation_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
  // supplierCode: varchar("supplier_code", { length: 100 }), // Temporarily commented out due to DB schema issue
  // barcode: varchar("barcode", { length: 100 }), // Temporarily commented out due to DB schema issue
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  costPrice: decimal("cost_price", { precision: 12, scale: 4 }),
  markup: decimal("markup", { precision: 5, scale: 2 }),
  unitPrice: decimal("unit_price", { precision: 12, scale: 4 }).notNull(),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
  // Optional discount fields for quotation item line
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }),
  // Optional VAT fields for quotation item line
  vatPercent: decimal("vat_percent", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }),
  isAccepted: boolean("is_accepted").default(true),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Approval Rules
export const approvalRules = pgTable("approval_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  customerType: customerTypeEnum("customer_type"),
  minQuoteValue: decimal("min_quote_value", { precision: 12, scale: 2 }),
  maxQuoteValue: decimal("max_quote_value", { precision: 12, scale: 2 }),
  maxDiscountPercentage: decimal("max_discount_percentage", { precision: 5, scale: 2 }),
  requiredApprovalLevel: approvalLevelEnum("required_approval_level").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quotation Approvals (Audit Trail)
export const quotationApprovals = pgTable("quotation_approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
  approverLevel: approvalLevelEnum("approver_level").notNull(),
  approverId: uuid("approver_id").references(() => users.id),
  status: varchar("status", { length: 50 }).notNull(), // "Pending", "Approved", "Rejected"
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales Orders
export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  orderDate: timestamp("order_date").defaultNow(),
  status: salesOrderStatusEnum("status").default("Draft"),
  customerPoNumber: varchar("customer_po_number", { length: 100 }),
  customerPoDocument: varchar("customer_po_document", { length: 500 }),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  deliveryInstructions: text("delivery_instructions"),
  // Version control for amendments
  version: integer("version").default(1),
  parentOrderId: uuid("parent_order_id"),
  amendmentSequence: integer("amendment_sequence"), // Incremental sequence per parent (A1, A2, ...)
  amendmentReason: text("amendment_reason"),
  // Customer LPO validation
  customerLpoRequired: boolean("customer_lpo_required").default(true),
  customerLpoDocumentName: varchar("customer_lpo_document_name", { length: 255 }),
  customerLpoDocumentSize: integer("customer_lpo_document_size"),
  customerLpoValidationStatus: varchar("customer_lpo_validation_status", { length: 50 }).default("Pending"),
  customerLpoValidatedBy: uuid("customer_lpo_validated_by").references(() => users.id),
  customerLpoValidatedAt: timestamp("customer_lpo_validated_at"),
  // Order type tracking
  isPartialOrder: boolean("is_partial_order").default(false),
  sourceType: varchar("source_type", { length: 50 }).default("Manual"), // "Auto", "Manual"
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales Order Items  
export const salesOrderItems = pgTable("sales_order_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  lineNumber: integer("line_number"),
  // supplierCode: varchar("supplier_code", { length: 100 }), // Temporarily commented out due to DB schema issue
  // barcode: varchar("barcode", { length: 100 }).notNull(), // Temporarily commented out due to DB schema issue - Mandatory barcode enforcement
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  // Discount fields
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  deliveryRequirement: text("delivery_requirement"),
  specialInstructions: text("special_instructions"),
});

// Supplier LPOs (Local Purchase Orders) - Enhanced
export const supplierLpos = pgTable("supplier_lpos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  lpoNumber: varchar("lpo_number", { length: 50 }).unique().notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  status: supplierLpoStatusEnum("status").default("Draft"),
  lpoDate: timestamp("lpo_date").defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  requestedDeliveryDate: timestamp("requested_delivery_date"),
  // Auto-generation source tracking
  sourceType: varchar("source_type", { length: 50 }).default("Manual"), // "Auto", "Manual"
  sourceSalesOrderIds: jsonb("source_sales_order_ids"), // Array of sales order IDs for auto-generation
  sourceQuotationIds: jsonb("source_quotation_ids"), // Array of quotation IDs for direct traceability
  groupingCriteria: varchar("grouping_criteria", { length: 100 }), // "supplier", "delivery_date", "custom"
  // Financial details
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("BHD"),
  // Supplier details snapshot
  supplierContactPerson: varchar("supplier_contact_person", { length: 255 }),
  supplierEmail: varchar("supplier_email", { length: 255 }),
  supplierPhone: varchar("supplier_phone", { length: 50 }),
  // Terms and conditions
  paymentTerms: varchar("payment_terms", { length: 255 }),
  deliveryTerms: varchar("delivery_terms", { length: 255 }),
  termsAndConditions: text("terms_and_conditions"),
  specialInstructions: text("special_instructions"),
  // Amendment tracking
  version: integer("version").default(1),
  parentLpoId: uuid("parent_lpo_id"),
  amendmentReason: text("amendment_reason"),
  amendmentType: varchar("amendment_type", { length: 50 }), // "Quantity", "Price", "Delivery", "Terms", "Cancellation"
  // Approval workflow
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),
  // Tracking
  sentToSupplierAt: timestamp("sent_to_supplier_at"),
  confirmedBySupplierAt: timestamp("confirmed_by_supplier_at"),
  supplierConfirmationReference: varchar("supplier_confirmation_reference", { length: 255 }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplier LPO Items - Enhanced
export const supplierLpoItems = pgTable("supplier_lpo_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierLpoId: uuid("supplier_lpo_id").references(() => supplierLpos.id).notNull(),
  salesOrderItemId: uuid("sales_order_item_id").references(() => salesOrderItems.id),
  quotationItemId: uuid("quotation_item_id").references(() => supplierQuoteItems.id), // Direct link to supplier quote item
  itemId: uuid("item_id").references(() => items.id),
  lineNumber: integer("line_number"),
  // Item details
  supplierCode: varchar("supplier_code", { length: 100 }).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull(),
  itemDescription: text("item_description").notNull(),
  // Quantities
  quantity: integer("quantity").notNull(),
  receivedQuantity: integer("received_quantity").default(0),
  pendingQuantity: integer("pending_quantity").default(0),
  // Pricing
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  // Discount fields
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  // VAT fields
  vatPercent: decimal("vat_percent", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"),
  // Delivery
  requestedDeliveryDate: timestamp("requested_delivery_date"),
  confirmedDeliveryDate: timestamp("confirmed_delivery_date"),
  deliveryStatus: varchar("delivery_status", { length: 50 }).default("Pending"), // "Pending", "Partial", "Complete"
  // Special requirements
  urgency: varchar("urgency", { length: 50 }).default("Normal"), // "Low", "Normal", "High", "Urgent"
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Goods Receipts
export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptNumber: varchar("receipt_number", { length: 50 }).unique().notNull(),
  supplierLpoId: uuid("supplier_lpo_id").references(() => supplierLpos.id).notNull(),
  receiptDate: timestamp("receipt_date").defaultNow(),
  status: goodsReceiptStatusEnum("status").default("Pending"),
  storageLocation: varchar("storage_location", { length: 100 }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legacy Goods Receipt Items (keeping for existing data)
export const legacyGoodsReceiptItems = pgTable("goods_receipt_items_legacy", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  goodsReceiptId: uuid("goods_receipt_id").references(() => goodsReceipts.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  orderedQuantity: integer("ordered_quantity").notNull(),
  receivedQuantity: integer("received_quantity").notNull(),
  damagedQuantity: integer("damaged_quantity").default(0),
  notes: text("notes"),
});

// Material Receipt - Header table for receipt wizard submissions
export const materialReceipt = pgTable("material_receipt", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptNumber: varchar("receipt_number", { length: 50 }).unique().notNull(),
  goodsReceiptId: uuid("goods_receipt_id").references(() => goodsReceiptHeaders.id), // Link to source goods receipt
  supplierLpoId: uuid("supplier_lpo_id").references(() => supplierLpos.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  receiptDate: timestamp("receipt_date").defaultNow(),
  receivedBy: varchar("received_by", { length: 255 }),
  status: varchar("status", { length: 50 }).default("Pending"), // "Pending", "Partial", "Completed", "Discrepancy"
  notes: text("notes"),
  // Additional header fields from receipt wizard
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  invoiceDate: timestamp("invoice_date"),
  supplierName: varchar("supplier_name", { length: 255 }),
  paymentTerms: text("payment_terms"),
  dueDate: timestamp("due_date"),
  supplierAddress: text("supplier_address"),
  supplierContactPerson: varchar("supplier_contact_person", { length: 255 }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Material Receipt Items - Line items table for receipt wizard submissions
export const materialReceiptItems = pgTable("material_receipt_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  materialReceiptId: uuid("material_receipt_id").references(() => materialReceipt.id, { onDelete: "cascade" }).notNull(),
  serialNo: integer("serial_no"),
  itemCode: varchar("item_code", { length: 100 }),
  itemDescription: text("item_description").notNull(),
  barcode: varchar("barcode", { length: 100 }),
  supplierCode: varchar("supplier_code", { length: 100 }),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  netTotal: decimal("net_total", { precision: 12, scale: 2 }).default("0"),
  vatPercent: decimal("vat_percent", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).default("0"),
  // Legacy fields for backward compatibility
  itemName: varchar("item_name", { length: 255 }),
  description: text("description"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).default("0"),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deliveries - Enhanced with barcode picking and comprehensive tracking
export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  deliveryNumber: varchar("delivery_number", { length: 50 }).unique().notNull(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id).notNull(),
  deliveryDate: timestamp("delivery_date"),
  status: deliveryStatusEnum("status").default("Pending"),
  deliveryType: varchar("delivery_type", { length: 50 }).default("Full"), // "Full", "Partial"
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),
  deliveryDocument: varchar("delivery_document", { length: 500 }),
  deliveryDocumentName: varchar("delivery_document_name", { length: 255 }),
  deliveryDocumentSize: integer("delivery_document_size"),
  // Picking tracking
  pickingStartedBy: uuid("picking_started_by").references(() => users.id),
  pickingStartedAt: timestamp("picking_started_at"),
  pickingCompletedBy: uuid("picking_completed_by").references(() => users.id),
  pickingCompletedAt: timestamp("picking_completed_at"),
  pickingNotes: text("picking_notes"),
  // Delivery confirmation
  deliveryConfirmedBy: varchar("delivery_confirmed_by", { length: 255 }),
  deliveryConfirmedAt: timestamp("delivery_confirmed_at"),
  deliverySignature: text("delivery_signature"), // Base64 encoded signature
  // Tracking
  trackingNumber: varchar("tracking_number", { length: 100 }),
  carrierName: varchar("carrier_name", { length: 100 }),
  estimatedDeliveryDate: timestamp("estimated_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Delivery Items - Enhanced with barcode tracking and picking details
export const deliveryItems = pgTable("delivery_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  deliveryId: uuid("delivery_id").references(() => deliveries.id, { onDelete: "cascade" }).notNull(),
  salesOrderItemId: uuid("sales_order_item_id").references(() => salesOrderItems.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull(), // Barcode for picking verification
  supplierCode: varchar("supplier_code", { length: 100 }).notNull(),
  description: text("description").notNull(),
  orderedQuantity: integer("ordered_quantity").notNull(),
  pickedQuantity: integer("picked_quantity").notNull(),
  deliveredQuantity: integer("delivered_quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  // Picking details
  pickedBy: uuid("picked_by").references(() => users.id),
  pickedAt: timestamp("picked_at"),
  storageLocation: varchar("storage_location", { length: 100 }),
  pickingNotes: text("picking_notes"),
  // Quality control
  qualityChecked: boolean("quality_checked").default(false),
  qualityCheckedBy: uuid("quality_checked_by").references(() => users.id),
  qualityCheckedAt: timestamp("quality_checked_at"),
  qualityNotes: text("quality_notes"),
});

// Invoices - Enhanced with multi-currency and comprehensive tracking
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number", { length: 50 }).unique().notNull(),
  invoiceType: varchar("invoice_type", { length: 50 }).default("Final"), // "Proforma", "Final", "Credit Note"
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id).notNull(),
  deliveryId: uuid("delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  invoiceDate: timestamp("invoice_date").defaultNow(),
  dueDate: timestamp("due_date"),
  status: invoiceStatusEnum("status").default("Draft"),
  // Multi-currency support
  currency: varchar("currency", { length: 10 }).default("BHD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).default("1.0000"),
  baseCurrency: varchar("base_currency", { length: 10 }).default("BHD"),
  // Financial details in invoice currency
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  outstandingAmount: decimal("outstanding_amount", { precision: 12, scale: 2 }),
  // Financial details in base currency
  subtotalBase: decimal("subtotal_base", { precision: 12, scale: 2 }),
  taxAmountBase: decimal("tax_amount_base", { precision: 12, scale: 2 }),
  discountAmountBase: decimal("discount_amount_base", { precision: 12, scale: 2 }),
  totalAmountBase: decimal("total_amount_base", { precision: 12, scale: 2 }),
  // Payment tracking
  paymentTerms: varchar("payment_terms", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentReference: varchar("payment_reference", { length: 100 }),
  lastPaymentDate: timestamp("last_payment_date"),
  // Auto-generation and linking
  autoGenerated: boolean("auto_generated").default(false),
  generatedFromDeliveryId: uuid("generated_from_delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
  // Return and credit note support
  originalInvoiceId: uuid("original_invoice_id"),
  returnReason: text("return_reason"),
  // Document management
  invoiceDocument: varchar("invoice_document", { length: 500 }),
  invoiceDocumentName: varchar("invoice_document_name", { length: 255 }),
  invoiceDocumentSize: integer("invoice_document_size"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Items - Enhanced with barcode support and multi-currency
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  deliveryItemId: uuid("delivery_item_id").references(() => deliveryItems.id),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull(),
  supplierCode: varchar("supplier_code", { length: 100 }).notNull(),
  description: text("description").notNull(),
  lineNumber: integer("line_number").notNull(),
  quantity: integer("quantity").notNull(),
  // Pricing in invoice currency
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  // Pricing in base currency
  unitPriceBase: decimal("unit_price_base", { precision: 10, scale: 2 }).notNull(),
  totalPriceBase: decimal("total_price_base", { precision: 12, scale: 2 }).notNull(),
  discountAmountBase: decimal("discount_amount_base", { precision: 10, scale: 2 }).default("0"),
  taxAmountBase: decimal("tax_amount_base", { precision: 10, scale: 2 }).default("0"),
  // Return and credit note support
  returnQuantity: integer("return_quantity").default(0),
  returnReason: text("return_reason"),
  notes: text("notes"),
});

// Delivery Picking Sessions - Track barcode scanning during picking
export const deliveryPickingSessions = pgTable("delivery_picking_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  deliveryId: uuid("delivery_id").references(() => deliveries.id).notNull(),
  sessionNumber: varchar("session_number", { length: 50 }).notNull(),
  startedBy: uuid("started_by").references(() => users.id).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 50 }).default("In Progress"), // "In Progress", "Completed", "Cancelled"
  totalItemsExpected: integer("total_items_expected").notNull(),
  totalItemsPicked: integer("total_items_picked").default(0),
  notes: text("notes"),
});

// Delivery Picked Items - Individual barcode scans during picking
export const deliveryPickedItems = pgTable("delivery_picked_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  pickingSessionId: uuid("picking_session_id").references(() => deliveryPickingSessions.id).notNull(),
  deliveryItemId: uuid("delivery_item_id").references(() => deliveryItems.id).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull(),
  quantityPicked: integer("quantity_picked").notNull(),
  storageLocation: varchar("storage_location", { length: 100 }),
  pickedBy: uuid("picked_by").references(() => users.id).notNull(),
  pickedAt: timestamp("picked_at").defaultNow(),
  verified: boolean("verified").default(false),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
});

// Credit Notes - For returns and adjustments
export const creditNotes = pgTable("credit_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creditNoteNumber: varchar("credit_note_number", { length: 50 }).unique().notNull(),
  originalInvoiceId: uuid("original_invoice_id").references(() => invoices.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  creditNoteDate: timestamp("credit_note_date").defaultNow(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 50 }).default("Draft"), // "Draft", "Issued", "Applied", "Cancelled"
  // Multi-currency support
  currency: varchar("currency", { length: 10 }).default("BHD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).default("1.0000"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  appliedAmount: decimal("applied_amount", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit Note Items
export const creditNoteItems = pgTable("credit_note_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creditNoteId: uuid("credit_note_id").references(() => creditNotes.id).notNull(),
  originalInvoiceItemId: uuid("original_invoice_item_id").references(() => invoiceItems.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  barcode: varchar("barcode", { length: 100 }).notNull(),
  description: text("description").notNull(),
  returnQuantity: integer("return_quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  returnReason: text("return_reason"),
  condition: varchar("condition", { length: 50 }), // "Good", "Damaged", "Defective"
});

// Audit Log
export const auditLogs = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  userId: uuid("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Customer Acceptance tracking
export const customerAcceptances = pgTable("customer_acceptances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id).notNull(),
  acceptanceType: text("acceptance_type").notNull(), // "Full" or "Partial"
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  acceptedBy: varchar("accepted_by", { length: 255 }).notNull(), // Customer contact person
  customerEmail: varchar("customer_email", { length: 255 }),
  customerNotes: text("customer_notes"),
  totalAcceptedAmount: decimal("total_accepted_amount", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 50 }).default("Active").notNull(), // "Active", "Superseded", "Cancelled"
  internalNotes: text("internal_notes"),
  processedBy: uuid("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Purchase Order uploads
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }).notNull(),
  customerAcceptanceId: uuid("customer_acceptance_id").references(() => customerAcceptances.id),
  poNumber: varchar("po_number", { length: 100 }).notNull(),
  poDate: timestamp("po_date").notNull(),
  customerReference: varchar("customer_reference", { length: 255 }),
  documentPath: varchar("document_path", { length: 500 }).notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentSize: integer("document_size"),
  documentType: varchar("document_type", { length: 50 }).notNull(), // PDF, PNG, JPG, etc.
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  validationStatus: varchar("validation_status", { length: 50 }).default("Pending").notNull(), // "Pending", "Valid", "Invalid", "Requires Review"
  validationNotes: text("validation_notes"),
  validatedBy: uuid("validated_by").references(() => users.id),
  validatedAt: timestamp("validated_at"),
  totalPoAmount: decimal("total_po_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("BHD").notNull(),
  paymentTerms: varchar("payment_terms", { length: 255 }),
  deliveryTerms: varchar("delivery_terms", { length: 255 }),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Item-level acceptance tracking with enhanced details
export const quotationItemAcceptances = pgTable("quotation_item_acceptances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerAcceptanceId: uuid("customer_acceptance_id").references(() => customerAcceptances.id).notNull(),
  quotationItemId: uuid("quotation_item_id").references(() => quotationItems.id).notNull(),
  isAccepted: boolean("is_accepted").notNull(),
  originalQuantity: integer("original_quantity").notNull(),
  acceptedQuantity: integer("accepted_quantity"),
  rejectedQuantity: integer("rejected_quantity"),
  rejectionReason: text("rejection_reason"),
  customerNotes: text("customer_notes"),
  acceptedUnitPrice: decimal("accepted_unit_price", { precision: 12, scale: 4 }),
  acceptedLineTotal: decimal("accepted_line_total", { precision: 12, scale: 2 }),
  deliveryRequirement: text("delivery_requirement"),
  priority: varchar("priority", { length: 50 }).default("Medium"), // "Low", "Medium", "High", "Urgent"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PO Line Items for detailed validation
export const poLineItems = pgTable("po_line_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  quotationItemId: uuid("quotation_item_id").references(() => quotationItems.id),
  itemDescription: text("item_description").notNull(),
  poQuantity: integer("po_quantity").notNull(),
  poUnitPrice: decimal("po_unit_price", { precision: 12, scale: 4 }),
  poLineTotal: decimal("po_line_total", { precision: 12, scale: 2 }),
  matchStatus: varchar("match_status", { length: 50 }).default("Not Validated").notNull(), // "Matched", "Quantity Mismatch", "Price Mismatch", "Item Not Found", "Not Validated"
  discrepancyNotes: text("discrepancy_notes"),
  validatedBy: uuid("validated_by").references(() => users.id),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Acceptance confirmation log for audit trail
export const acceptanceConfirmations = pgTable("acceptance_confirmations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerAcceptanceId: uuid("customer_acceptance_id").references(() => customerAcceptances.id).notNull(),
  confirmationType: varchar("confirmation_type", { length: 50 }).notNull(), // "Email", "Phone", "Portal", "Document", "Meeting"
  confirmationMethod: varchar("confirmation_method", { length: 255 }).notNull(),
  confirmedBy: varchar("confirmed_by", { length: 255 }).notNull(),
  confirmedAt: timestamp("confirmed_at").notNull(),
  confirmationReference: varchar("confirmation_reference", { length: 255 }),
  confirmationDetails: text("confirmation_details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shipments - Comprehensive tracking and logistics management
export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentNumber: varchar("shipment_number", { length: 50 }).unique().notNull(),
  trackingNumber: varchar("tracking_number", { length: 100 }).unique().notNull(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  carrierId: uuid("carrier_id").references(() => carriers.id), // Reference to carriers table
  carrierName: varchar("carrier_name", { length: 255 }).notNull(),
  serviceType: shipmentServiceTypeEnum("service_type").default("Standard").notNull(),
  status: shipmentStatusEnum("status").default("Pending").notNull(),
  priority: shipmentPriorityEnum("priority").default("Medium").notNull(),
  origin: varchar("origin", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  weight: decimal("weight", { precision: 8, scale: 2 }),
  dimensions: varchar("dimensions", { length: 100 }),
  declaredValue: decimal("declared_value", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("AED"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  customerReference: varchar("customer_reference", { length: 100 }),
  customerName: varchar("customer_name", { length: 255 }), // Added for customer name
  specialInstructions: text("special_instructions"),
  packageCount: integer("package_count").default(1),
  isInsured: boolean("is_insured").default(false),
  requiresSignature: boolean("requires_signature").default(false),
  currentLocation: varchar("current_location", { length: 255 }),
  lastUpdate: timestamp("last_update").defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Additional LPO-related fields
  lpoId: uuid("lpo_id").references(() => supplierLpos.id), // Link to supplier LPO
  lpoNumber: varchar("lpo_number", { length: 100 }), // LPO number for reference
  items: jsonb("items"), // Store items as JSON
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  paymentTerms: varchar("payment_terms", { length: 255 }),
  deliveryTerms: varchar("delivery_terms", { length: 255 }),
});

// Shipment Tracking Events - Detailed tracking history
export const shipmentTrackingEvents = pgTable("shipment_tracking_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: uuid("shipment_id").references(() => shipments.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  status: varchar("status", { length: 100 }).notNull(),
  description: text("description").notNull(),
  scanType: trackingEventTypeEnum("scan_type").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  employeeId: uuid("employee_id").references(() => users.id),
  facilityId: varchar("facility_id", { length: 100 }),
  nextExpectedLocation: varchar("next_expected_location", { length: 255 }),
  estimatedArrival: timestamp("estimated_arrival"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  enquiries: many(enquiries),
  quotations: many(quotations),
  salesOrders: many(salesOrders),
  invoices: many(invoices),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  items: many(items),
  supplierLpos: many(supplierLpos),
}));

export const carriersRelations = relations(carriers, ({ many }) => ({
  shipments: many(shipments),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [items.supplierId],
    references: [suppliers.id],
  }),
  enquiryItems: many(enquiryItems),
  quotationItems: many(quotationItems),
  salesOrderItems: many(salesOrderItems),
}));

export const enquiriesRelations = relations(enquiries, ({ one, many }) => ({
  customer: one(customers, {
    fields: [enquiries.customerId],
    references: [customers.id],
  }),
  items: many(enquiryItems),
  quotations: many(quotations),
}));

export const requisitionsRelations = relations(requisitions, ({ many }) => ({
  items: many(requisitionItems),
}));

export const requisitionItemsRelations = relations(requisitionItems, ({ one }) => ({
  requisition: one(requisitions, {
    fields: [requisitionItems.requisitionId],
    references: [requisitions.id],
  }),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  enquiry: one(enquiries, {
    fields: [quotations.enquiryId],
    references: [enquiries.id],
  }),
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  items: many(quotationItems),
  salesOrders: many(salesOrders),
  customerAcceptances: many(customerAcceptances),
  purchaseOrders: many(purchaseOrders),
}));

export const customerAcceptancesRelations = relations(customerAcceptances, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [customerAcceptances.quotationId],
    references: [quotations.id],
  }),
  itemAcceptances: many(quotationItemAcceptances),
  purchaseOrders: many(purchaseOrders),
  confirmations: many(acceptanceConfirmations),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [purchaseOrders.quotationId],
    references: [quotations.id],
  }),
  customerAcceptance: one(customerAcceptances, {
    fields: [purchaseOrders.customerAcceptanceId],
    references: [customerAcceptances.id],
  }),
  lineItems: many(poLineItems),
}));

export const quotationItemAcceptancesRelations = relations(quotationItemAcceptances, ({ one }) => ({
  customerAcceptance: one(customerAcceptances, {
    fields: [quotationItemAcceptances.customerAcceptanceId],
    references: [customerAcceptances.id],
  }),
  quotationItem: one(quotationItems, {
    fields: [quotationItemAcceptances.quotationItemId],
    references: [quotationItems.id],
  }),
}));

export const poLineItemsRelations = relations(poLineItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [poLineItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  quotationItem: one(quotationItems, {
    fields: [poLineItems.quotationItemId],
    references: [quotationItems.id],
  }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [salesOrders.quotationId],
    references: [quotations.id],
  }),
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  items: many(salesOrderItems),
  deliveries: many(deliveries),
  invoices: many(invoices),
  shipments: many(shipments),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  salesOrder: one(salesOrders, {
    fields: [shipments.salesOrderId],
    references: [salesOrders.id],
  }),
  supplier: one(suppliers, {
    fields: [shipments.supplierId],
    references: [suppliers.id],
  }),
  carrier: one(suppliers, {
    fields: [shipments.carrierId],
    references: [suppliers.id],
  }),
  createdBy: one(users, {
    fields: [shipments.createdBy],
    references: [users.id],
  }),
  trackingEvents: many(shipmentTrackingEvents),
}));

export const shipmentTrackingEventsRelations = relations(shipmentTrackingEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentTrackingEvents.shipmentId],
    references: [shipments.id],
  }),
  employee: one(users, {
    fields: [shipmentTrackingEvents.employeeId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCarrierSchema = createInsertSchema(carriers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEnquirySchema = createInsertSchema(enquiries, {
  targetDeliveryDate: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  referralCustomerId: z.string().uuid().optional(),
  referralName: z.string().optional(),
}).omit({ id: true, enquiryNumber: true, createdAt: true, updatedAt: true });

// Update schema for enquiries with proper UUID validation
export const updateEnquirySchema = createInsertSchema(enquiries, {
  targetDeliveryDate: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),  // Make customerId optional for updates
  referralCustomerId: z.string().uuid().optional(),
  referralName: z.string().optional(),
}).omit({ id: true, enquiryNumber: true, createdAt: true, updatedAt: true }).partial().extend({
  // Override customerId to handle empty strings and null values gracefully
  customerId: z.union([
    z.string().uuid(),
    z.string().length(0),  // Allow empty string
    z.null()
  ]).optional().transform(val => {
    // Convert empty strings to undefined, keep valid UUIDs
    if (val === "" || val === null) return undefined;
    return val;
  })
});

export const insertEnquiryItemSchema = createInsertSchema(enquiryItems).omit({ id: true }).extend({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null) return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  discountPercent: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  discountAmount: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  vatPercent: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  vatAmount: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  itemId: z.string().optional().transform((val) => {
    if (val === "" || val === undefined || val === null) return undefined;
    return val;
  }),
});

export const insertRequisitionSchema = createInsertSchema(requisitions, {
  requiredDate: z.string().transform(val => new Date(val)),
  totalEstimatedCost: z.union([z.number(), z.string().transform(val => parseFloat(val))]),
  createdBy: z.string().uuid().optional(),
}).omit({ id: true, requisitionNumber: true, createdAt: true, updatedAt: true });

export const insertRequisitionItemSchema = createInsertSchema(requisitionItems, {
  estimatedCost: z.union([z.number(), z.string().transform(val => parseFloat(val))]),
  vatPercentage: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().default(0),
  vatAmount: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().default(0),
  discountPercentage: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().default(0),
  discountAmount: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().default(0),
}).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  itemDescription: z.string().min(1, "Item description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitOfMeasure: z.string().min(1, "Unit of measure is required"),
});

export const insertQuotationSchema = createInsertSchema(quotations, {
  validUntil: z.union([z.string(), z.date()]).optional().transform(val => val ? new Date(val) : undefined),
  createdBy: z.string().uuid().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, parentQuotationId: true, quoteNumber: true });

// Revision creation schema
export const createQuotationRevisionSchema = z.object({
  revisionReason: z.string().min(1, "Revision reason is required"),
  quoteDate: z.string().optional(),
  validUntil: z.string().optional(),
  subtotal: z.string().optional(),
  discountPercentage: z.string().optional(),
  discountAmount: z.string().optional(),
  taxAmount: z.string().optional(),
  totalAmount: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(1),
    costPrice: z.string().optional(),
    markup: z.string().optional(),
    unitPrice: z.string().min(1),
    lineTotal: z.string().min(1),
    isAccepted: z.boolean().optional(),
    rejectionReason: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
});
// Quotation Item insert schema with numeric coercion for decimal fields
export const insertQuotationItemSchema = z.object({
  quotationId: z.string().uuid(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  costPrice: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional().transform(v => (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) ? undefined : v),
  markup: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional().transform(v => (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) ? undefined : v),
  unitPrice: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).transform(v => (typeof v === 'string' ? parseFloat(v) : v)),
  discountPercentage: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional(),
  discountAmount: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional(),
  vatPercent: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional(),
  vatAmount: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional(),
  lineTotal: z.union([
    z.number(),
    z.string().min(1).transform(v => parseFloat(v))
  ]).optional(),
  isAccepted: z.boolean().optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.lineTotal === undefined) {
    if (typeof data.quantity === 'number' && typeof data.unitPrice === 'number') {
      const gross = data.quantity * data.unitPrice;
      const discPct = typeof data.discountPercentage === 'number' ? data.discountPercentage : 0;
      const discAmt = typeof data.discountAmount === 'number' ? data.discountAmount : 0;
      const pctAmt = discPct > 0 ? (gross * discPct) / 100 : 0;
      const afterDiscount = Math.max(gross - pctAmt - discAmt, 0);
      const vPct = typeof data.vatPercent === 'number' ? Math.max(0, data.vatPercent) : 0;
      const vAmt = typeof data.vatAmount === 'number' ? Math.max(0, data.vatAmount) : 0;
      const computedVat = vPct > 0 ? (afterDiscount * vPct / 100) : vAmt;
      (data as any).lineTotal = parseFloat(Math.max(afterDiscount + computedVat, 0).toFixed(2));
    } else {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cannot compute lineTotal without numeric quantity and unitPrice' });
    }
  }
});
export const insertApprovalRuleSchema = createInsertSchema(approvalRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuotationApprovalSchema = createInsertSchema(quotationApprovals).omit({ id: true, createdAt: true });
export const insertCustomerAcceptanceSchema = createInsertSchema(customerAcceptances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders, {
  poDate: z.union([
    z.string().min(1).transform(v => new Date(v)),
    z.date()
  ]).transform(v => (v instanceof Date ? v : new Date(v as any)))
}).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuotationItemAcceptanceSchema = createInsertSchema(quotationItemAcceptances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPoLineItemSchema = createInsertSchema(poLineItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAcceptanceConfirmationSchema = createInsertSchema(acceptanceConfirmations, {
  confirmedAt: z.string(),
}).omit({ id: true, createdAt: true });
export const insertSalesOrderSchema = createInsertSchema(salesOrders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  version: true, 
  customerLpoValidatedAt: true,
  orderNumber: true  // Auto-generated in storage layer
});
export const insertSalesOrderItemSchema = createInsertSchema(salesOrderItems).omit({ id: true });
export const insertSupplierLpoSchema = createInsertSchema(supplierLpos).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  version: true, 
  approvedAt: true,
  sentToSupplierAt: true,
  confirmedBySupplierAt: true 
});
export const insertSupplierLpoItemSchema = createInsertSchema(supplierLpoItems).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertInvoiceSchema = createInsertSchema(invoices);

// Inventory Management Tables - Imported from dedicated schema
// Import inventory tables from the dedicated inventory schema
import { 
  inventoryItems, 
  inventoryVariants, 
  inventoryLevels, 
  stockMovements,
  insertInventoryItemSchema,
  insertInventoryVariantSchema,
  insertInventoryLevelSchema,
  insertStockMovementSchema,
  type InventoryItem,
  type InventoryVariant,
  type InventoryLevel,
  type StockMovement,
  type InsertInventoryItem,
  type InsertInventoryVariant,
  type InsertInventoryLevel,
  type InsertStockMovement
} from './schemas/inventory';

// Re-export inventory tables
export { 
  inventoryItems, 
  inventoryVariants, 
  inventoryLevels, 
  stockMovements,
  insertInventoryItemSchema,
  insertInventoryVariantSchema,
  insertInventoryLevelSchema,
  insertStockMovementSchema,
  type InventoryItem,
  type InventoryVariant,
  type InventoryLevel,
  type StockMovement,
  type InsertInventoryItem,
  type InsertInventoryVariant,
  type InsertInventoryLevel,
  type InsertStockMovement
};

// Import scanning and returns schemas
import {
  scanningSessions,
  scannedItems,
  supplierReturns,
  supplierReturnItems,
  insertScanningSessionSchema,
  insertScannedItemSchema,
  insertSupplierReturnSchema,
  insertSupplierReturnItemSchema,
  type ScanningSession,
  type ScannedItem,
  type SupplierReturn,
  type SupplierReturnItem,
  type InsertScanningSession,
  type InsertScannedItem,
  type InsertSupplierReturn,
  type InsertSupplierReturnItem
} from './schemas/scanning-returns';

// Goods Receipt Management
// UPDATED: goods receipt IDs migrated from nanoid(text) to uuid for consistency.
export const goodsReceiptHeaders = pgTable("goods_receipt_headers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptNumber: text("receipt_number").notNull().unique(),
  supplierLpoId: uuid("supplier_lpo_id").references(() => supplierLpos.id),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  lpoNumber: varchar("lpo_number", { length: 100 }), // LPO number for reference
  receiptDate: date("receipt_date").notNull(),
  expectedDeliveryDate: date("expected_delivery_date"),
  actualDeliveryDate: date("actual_delivery_date"),
  receivedBy: text("received_by"),
  status: text("status").notNull().default("Draft"), // Draft, Partial, Complete, Discrepancy, Approved
  notes: text("notes"),
  totalItems: integer("total_items").default(0),
  totalQuantityExpected: integer("total_quantity_expected").default(0),
  totalQuantityReceived: integer("total_quantity_received").default(0),
  discrepancyFlag: boolean("discrepancy_flag").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Invoices
export const purchaseInvoices = pgTable("purchase_invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }).notNull(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  goodsReceiptId: uuid("goods_receipt_id").notNull().references(() => goodsReceiptHeaders.id),
  lpoId: uuid("lpo_id").references(() => supplierLpos.id),
  status: varchar("status", { length: 50 }).notNull().default("Draft"), // Draft, Sent, Paid, Overdue, Cancelled
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("Unpaid"), // Unpaid, Partial, Paid
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  receivedDate: date("received_date"),
  paymentDate: date("payment_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0.00"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  currency: varchar("currency", { length: 10 }).notNull().default("BHD"),
  paymentTerms: text("payment_terms").notNull(),
  notes: text("notes"),
  attachments: jsonb("attachments"),
  isRecurring: boolean("is_recurring").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Invoice Items
export const purchaseInvoiceItems = pgTable("purchase_invoice_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseInvoiceId: uuid("purchase_invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  goodsReceiptItemId: uuid("goods_receipt_item_id").references(() => goodsReceiptItems.id),
  lpoItemId: uuid("lpo_item_id").references(() => supplierLpoItems.id),
  itemId: uuid("item_id").references(() => inventoryItems.id),
  variantId: uuid("variant_id").references(() => inventoryVariants.id),
  barcode: text("barcode"),
  supplierCode: text("supplier_code"),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  unitOfMeasure: text("unit_of_measure"),
  storageLocation: text("storage_location"),
  batchNumber: text("batch_number"),
  expiryDate: date("expiry_date"),
  condition: text("condition").default("Good"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const goodsReceiptItems = pgTable("goods_receipt_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptHeaderId: uuid("receipt_header_id").notNull().references(() => goodsReceiptHeaders.id, { onDelete: "cascade" }),
  lpoItemId: uuid("lpo_item_id").references(() => supplierLpoItems.id),
  itemId: uuid("item_id").references(() => inventoryItems.id),
  variantId: uuid("variant_id").references(() => inventoryVariants.id),
  barcode: text("barcode"),
  supplierCode: text("supplier_code"),
  itemDescription: text("item_description").notNull(),
  quantityExpected: integer("quantity_expected").notNull(),
  quantityReceived: integer("quantity_received").default(0),
  quantityDamaged: integer("quantity_damaged").default(0),
  quantityShort: integer("quantity_short").default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  // Tax and discount fields
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0.00"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }).default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
  storageLocation: text("storage_location"),
  batchNumber: text("batch_number"),
  expiryDate: date("expiry_date"),
  condition: text("condition").default("Good"), // Good, Damaged, Defective
  discrepancyReason: text("discrepancy_reason"),
  scannedAt: timestamp("scanned_at"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Note: scanningSessions table is imported from './schemas/scanning-returns.js'

// Note: scannedItems table is imported from './schemas/scanning-returns.js'

// Note: supplierReturns table is imported from './schemas/scanning-returns.js'

// Note: supplierReturnItems table is imported from './schemas/scanning-returns.js'

// Note: stockMovements table is imported from './schemas/inventory.js'

// Note: Inventory insert schemas are imported from './schemas/inventory.js'
// Note: Supplier return schemas are imported from './schemas/scanning-returns.js'

// Type definitions for inventory management - removed duplicates
// Note: This schema was replaced by insertInventoryLevelSchema above
export const insertGoodsReceiptHeaderSchema = createInsertSchema(goodsReceiptHeaders, {
  receiptDate: z.string(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertGoodsReceiptItemSchema = createInsertSchema(goodsReceiptItems, {
  expiryDate: z.string().optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices, {
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  receivedDate: z.string().optional(),
  paymentDate: z.string().optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertPurchaseInvoiceItemSchema = createInsertSchema(purchaseInvoiceItems, {
  expiryDate: z.string().optional(),
}).omit({ 
  id: true, 
  purchaseInvoiceId: true, // This gets added by the storage layer
  createdAt: true, 
  updatedAt: true 
});
// Note: insertStockMovementSchema is imported from './schemas/inventory.js'

// Types
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Carrier = typeof carriers.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;
export type EnquiryItem = typeof enquiryItems.$inferSelect;
export type Requisition = typeof requisitions.$inferSelect;
export type RequisitionItem = typeof requisitionItems.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type QuotationItem = typeof quotationItems.$inferSelect;
export type ApprovalRule = typeof approvalRules.$inferSelect;
export type QuotationApproval = typeof quotationApprovals.$inferSelect;
export type CustomerAcceptance = typeof customerAcceptances.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type QuotationItemAcceptance = typeof quotationItemAcceptances.$inferSelect;
export type PoLineItem = typeof poLineItems.$inferSelect;
export type AcceptanceConfirmation = typeof acceptanceConfirmations.$inferSelect;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type SalesOrderItem = typeof salesOrderItems.$inferSelect;
export type SupplierLpo = typeof supplierLpos.$inferSelect;
export type SupplierLpoItem = typeof supplierLpoItems.$inferSelect;
// ItemVariant type removed - table doesn't exist yet
export type InventoryLevel = typeof inventoryLevels.$inferSelect;
export type GoodsReceiptHeader = typeof goodsReceiptHeaders.$inferSelect;
export type GoodsReceiptItem = typeof goodsReceiptItems.$inferSelect;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;
// Removed duplicate definitions - already defined above
export type StockMovement = typeof stockMovements.$inferSelect;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertCarrier = z.infer<typeof insertCarrierSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type UpdateEnquiry = z.infer<typeof updateEnquirySchema>;
export type InsertEnquiryItem = z.infer<typeof insertEnquiryItemSchema>;
export type InsertRequisition = z.infer<typeof insertRequisitionSchema>;
export type InsertRequisitionItem = z.infer<typeof insertRequisitionItemSchema>;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;
export type InsertApprovalRule = z.infer<typeof insertApprovalRuleSchema>;
export type InsertQuotationApproval = z.infer<typeof insertQuotationApprovalSchema>;
export type InsertCustomerAcceptance = z.infer<typeof insertCustomerAcceptanceSchema>;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type InsertQuotationItemAcceptance = z.infer<typeof insertQuotationItemAcceptanceSchema>;
export type InsertPoLineItem = z.infer<typeof insertPoLineItemSchema>;
export type InsertAcceptanceConfirmation = z.infer<typeof insertAcceptanceConfirmationSchema>;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type InsertSalesOrderItem = z.infer<typeof insertSalesOrderItemSchema>;
export type InsertSupplierLpo = z.infer<typeof insertSupplierLpoSchema>;
export type InsertSupplierLpoItem = z.infer<typeof insertSupplierLpoItemSchema>;
// InsertItemVariant type removed - schema doesn't exist yet
export type InsertInventoryLevel = z.infer<typeof insertInventoryLevelSchema>;
export type InsertGoodsReceiptHeader = z.infer<typeof insertGoodsReceiptHeaderSchema>;
export type InsertGoodsReceiptItem = z.infer<typeof insertGoodsReceiptItemSchema>;
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type InsertPurchaseInvoiceItem = z.infer<typeof insertPurchaseInvoiceItemSchema>;
// Removed duplicate definitions - already defined above
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Additional type exports for inventory management
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryVariant = typeof inventoryVariants.$inferSelect;
export type ScanningSession = typeof scanningSessions.$inferSelect;
export type ScannedItem = typeof scannedItems.$inferSelect;
export type SupplierReturn = typeof supplierReturns.$inferSelect;
export type SupplierReturnItem = typeof supplierReturnItems.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InsertInventoryVariant = z.infer<typeof insertInventoryVariantSchema>;
export type InsertScanningSession = z.infer<typeof insertScanningSessionSchema>;
export type InsertScannedItem = z.infer<typeof insertScannedItemSchema>;
export type InsertSupplierReturn = z.infer<typeof insertSupplierReturnSchema>;
export type InsertSupplierReturnItem = z.infer<typeof insertSupplierReturnItemSchema>;

// Insert schemas for new delivery and invoicing tables
export const insertDeliverySchema = createInsertSchema(deliveries).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertDeliveryItemSchema = createInsertSchema(deliveryItems).omit({ 
  id: true 
});
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ 
  id: true 
});
export const insertDeliveryPickingSessionSchema = createInsertSchema(deliveryPickingSessions).omit({ 
  id: true, 
  startedAt: true 
});
export const insertDeliveryPickedItemSchema = createInsertSchema(deliveryPickedItems).omit({ 
  id: true, 
  pickedAt: true 
});

// Insert schemas for shipment tracking
export const insertShipmentSchema = createInsertSchema(shipments).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastUpdate: true
});
export const insertShipmentTrackingEventSchema = createInsertSchema(shipmentTrackingEvents).omit({ 
  id: true, 
  createdAt: true
});
export const insertCreditNoteSchema = createInsertSchema(creditNotes).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertCreditNoteItemSchema = createInsertSchema(creditNoteItems).omit({ 
  id: true 
});

// New type exports for delivery and invoicing
export type DeliveryItem = typeof deliveryItems.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type DeliveryPickingSession = typeof deliveryPickingSessions.$inferSelect;
export type DeliveryPickedItem = typeof deliveryPickedItems.$inferSelect;
export type CreditNote = typeof creditNotes.$inferSelect;
export type CreditNoteItem = typeof creditNoteItems.$inferSelect;

export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type InsertDeliveryItem = z.infer<typeof insertDeliveryItemSchema>;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InsertDeliveryPickingSession = z.infer<typeof insertDeliveryPickingSessionSchema>;
export type InsertDeliveryPickedItem = z.infer<typeof insertDeliveryPickedItemSchema>;
export type InsertCreditNote = z.infer<typeof insertCreditNoteSchema>;
export type InsertCreditNoteItem = z.infer<typeof insertCreditNoteItemSchema>;
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type InsertShipmentTrackingEvent = z.infer<typeof insertShipmentTrackingEventSchema>;

// PRICING & COSTING ENGINE TABLES
export const pricingMarkupLevelEnum = pgEnum("pricing_markup_level", ["System", "Category", "Item"]);
export const pricingRuleTypeEnum = pgEnum("pricing_rule_type", ["Retail", "Wholesale", "Custom"]);

// Product Categories for pricing hierarchy
export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  parentCategoryId: uuid("parent_category_id"),
  retailMarkupPercentage: decimal("retail_markup_percentage", { precision: 5, scale: 2 }),
  wholesaleMarkupPercentage: decimal("wholesale_markup_percentage", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System-wide markup configuration
export const markupConfiguration = pgTable("markup_configuration", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  level: pricingMarkupLevelEnum("level").notNull(),
  entityId: uuid("entity_id"), // null for system-wide, category_id for category, item_id for item
  retailMarkupPercentage: decimal("retail_markup_percentage", { precision: 5, scale: 2 }).notNull(),
  wholesaleMarkupPercentage: decimal("wholesale_markup_percentage", { precision: 5, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Item pricing with calculated prices
export const itemPricing = pgTable("item_pricing", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: uuid("item_id").notNull(),
  supplierCost: decimal("supplier_cost", { precision: 12, scale: 2 }).notNull(),
  retailPrice: decimal("retail_price", { precision: 12, scale: 2 }).notNull(),
  wholesalePrice: decimal("wholesale_price", { precision: 12, scale: 2 }).notNull(),
  retailMarkupPercentage: decimal("retail_markup_percentage", { precision: 5, scale: 2 }),
  wholesaleMarkupPercentage: decimal("wholesale_markup_percentage", { precision: 5, scale: 2 }),
  isManualOverride: boolean("is_manual_override").default(false),
  overrideReason: text("override_reason"),
  currency: varchar("currency", { length: 3 }).default("BHD"),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer-specific pricing overrides
export const customerPricing = pgTable("customer_pricing", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").notNull(),
  itemId: uuid("item_id").notNull(),
  specialPrice: decimal("special_price", { precision: 12, scale: 2 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }),
  minimumQuantity: integer("minimum_quantity").default(1),
  maximumQuantity: integer("maximum_quantity"),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pricing rule engine for complex calculations
export const pricingRules = pgTable("pricing_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ruleType: pricingRuleTypeEnum("rule_type").notNull(),
  conditions: jsonb("conditions").notNull(), // JSON conditions for rule application
  actions: jsonb("actions").notNull(), // JSON actions for price calculation
  priority: integer("priority").default(100),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Price list generation and management
export const priceLists = pgTable("price_lists", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // "retail", "wholesale", "custom"
  customerId: uuid("customer_id"), // for customer-specific price lists
  categoryId: uuid("category_id"), // for category-specific price lists
  currency: varchar("currency", { length: 3 }).default("BHD"),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  generatedAt: timestamp("generated_at"),
  fileUrl: varchar("file_url", { length: 500 }),
  downloadCount: integer("download_count").default(0),
  isActive: boolean("is_active").default(true),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Price list items for generated lists
export const priceListItems = pgTable("price_list_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  priceListId: uuid("price_list_id").notNull(),
  itemId: uuid("item_id").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  effectivePrice: decimal("effective_price", { precision: 12, scale: 2 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }),
  minimumQuantity: integer("minimum_quantity").default(1),
  notes: text("notes"),
});

// Price change history for audit trail
export const priceChangeHistory = pgTable("price_change_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: uuid("item_id").notNull(),
  changeType: varchar("change_type", { length: 50 }).notNull(), // "cost_update", "markup_change", "manual_override"
  oldSupplierCost: decimal("old_supplier_cost", { precision: 12, scale: 2 }),
  newSupplierCost: decimal("new_supplier_cost", { precision: 12, scale: 2 }),
  oldRetailPrice: decimal("old_retail_price", { precision: 12, scale: 2 }),
  newRetailPrice: decimal("new_retail_price", { precision: 12, scale: 2 }),
  oldWholesalePrice: decimal("old_wholesale_price", { precision: 12, scale: 2 }),
  newWholesalePrice: decimal("new_wholesale_price", { precision: 12, scale: 2 }),
  reason: text("reason"),
  triggeredBy: varchar("triggered_by", { length: 100 }), // "system", "manual", "supplier_update"
  userId: uuid("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bulk pricing operations for efficient updates
export const bulkPricingOperations = pgTable("bulk_pricing_operations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  operationType: varchar("operation_type", { length: 50 }).notNull(), // "markup_update", "cost_update", "price_override"
  criteria: jsonb("criteria").notNull(), // JSON criteria for operation
  changes: jsonb("changes").notNull(), // JSON changes to apply
  status: varchar("status", { length: 50 }).default("pending"), // "pending", "processing", "completed", "failed"
  affectedItemsCount: integer("affected_items_count").default(0),
  processedItemsCount: integer("processed_items_count").default(0),
  errorLog: text("error_log"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// PRICING RELATIONS
export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  parentCategory: one(productCategories, {
    fields: [productCategories.parentCategoryId],
    references: [productCategories.id],
  }),
  subCategories: many(productCategories),
  items: many(inventoryItems),
  markupConfigurations: many(markupConfiguration),
  priceLists: many(priceLists),
}));

export const markupConfigurationRelations = relations(markupConfiguration, ({ one }) => ({
  createdByUser: one(users, {
    fields: [markupConfiguration.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [markupConfiguration.updatedBy],
    references: [users.id],
  }),
}));

export const itemPricingRelations = relations(itemPricing, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [itemPricing.itemId],
    references: [inventoryItems.id],
  }),
  createdByUser: one(users, {
    fields: [itemPricing.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [itemPricing.updatedBy],
    references: [users.id],
  }),
}));

export const customerPricingRelations = relations(customerPricing, ({ one }) => ({
  customer: one(customers, {
    fields: [customerPricing.customerId],
    references: [customers.id],
  }),
  item: one(inventoryItems, {
    fields: [customerPricing.itemId],
    references: [inventoryItems.id],
  }),
  createdByUser: one(users, {
    fields: [customerPricing.createdBy],
    references: [users.id],
  }),
}));

export const pricingRulesRelations = relations(pricingRules, ({ one }) => ({
  createdByUser: one(users, {
    fields: [pricingRules.createdBy],
    references: [users.id],
  }),
}));

export const priceListsRelations = relations(priceLists, ({ one, many }) => ({
  customer: one(customers, {
    fields: [priceLists.customerId],
    references: [customers.id],
  }),
  category: one(productCategories, {
    fields: [priceLists.categoryId],
    references: [productCategories.id],
  }),
  items: many(priceListItems),
  createdByUser: one(users, {
    fields: [priceLists.createdBy],
    references: [users.id],
  }),
}));

export const priceListItemsRelations = relations(priceListItems, ({ one }) => ({
  priceList: one(priceLists, {
    fields: [priceListItems.priceListId],
    references: [priceLists.id],
  }),
  item: one(inventoryItems, {
    fields: [priceListItems.itemId],
    references: [inventoryItems.id],
  }),
}));

export const priceChangeHistoryRelations = relations(priceChangeHistory, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [priceChangeHistory.itemId],
    references: [inventoryItems.id],
  }),
  user: one(users, {
    fields: [priceChangeHistory.userId],
    references: [users.id],
  }),
}));

export const bulkPricingOperationsRelations = relations(bulkPricingOperations, ({ one }) => ({
  createdByUser: one(users, {
    fields: [bulkPricingOperations.createdBy],
    references: [users.id],
  }),
}));

// PRICING INSERT SCHEMAS
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarkupConfigurationSchema = createInsertSchema(markupConfiguration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertItemPricingSchema = createInsertSchema(itemPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerPricingSchema = createInsertSchema(customerPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriceListSchema = createInsertSchema(priceLists).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriceListItemSchema = createInsertSchema(priceListItems).omit({
  id: true,
});

export const insertPriceChangeHistorySchema = createInsertSchema(priceChangeHistory).omit({
  id: true,
  createdAt: true,
});

export const insertBulkPricingOperationSchema = createInsertSchema(bulkPricingOperations).omit({
  id: true,
  createdAt: true,
});

// Physical Stock Management Tables
export const physicalStockCounts = pgTable("physical_stock_counts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  countNumber: varchar("count_number", { length: 50 }).notNull().unique(),
  description: text("description"),
  countDate: timestamp("count_date").defaultNow(),
  storageLocation: varchar("storage_location", { length: 255 }),
  countType: varchar("count_type", { length: 50 }).default("Full Count"), // "Full Count", "Cycle Count", "Spot Check"
  status: physicalStockStatusEnum("status").default("Draft"),
  scheduledDate: timestamp("scheduled_date"),
  startedBy: uuid("started_by").references(() => users.id),
  startedAt: timestamp("started_at"),
  completedBy: uuid("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  totalItemsExpected: integer("total_items_expected").default(0),
  totalItemsCounted: integer("total_items_counted").default(0),
  totalDiscrepancies: integer("total_discrepancies").default(0),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const physicalStockCountItems = pgTable("physical_stock_count_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  physicalStockCountId: uuid("physical_stock_count_id").references(() => physicalStockCounts.id, { onDelete: "cascade" }).notNull(),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id).notNull(),
  lineNumber: integer("line_number"),
  supplierCode: varchar("supplier_code", { length: 255 }).notNull(),
  barcode: varchar("barcode", { length: 255 }),
  description: text("description").notNull(),
  storageLocation: varchar("storage_location", { length: 255 }),
  // System quantities
  systemQuantity: integer("system_quantity").default(0),
  reservedQuantity: integer("reserved_quantity").default(0),
  availableQuantity: integer("available_quantity").default(0),
  // Physical count quantities
  firstCountQuantity: integer("first_count_quantity"),
  firstCountBy: uuid("first_count_by").references(() => users.id),
  firstCountAt: timestamp("first_count_at"),
  secondCountQuantity: integer("second_count_quantity"),
  secondCountBy: uuid("second_count_by").references(() => users.id),
  secondCountAt: timestamp("second_count_at"),
  finalCountQuantity: integer("final_count_quantity"),
  // Discrepancy tracking
  variance: integer("variance").default(0), // final_count - system_quantity
  varianceValue: decimal("variance_value", { precision: 12, scale: 2 }).default("0"),
  status: stockCountStatusEnum("status").default("Pending"),
  requiresRecount: boolean("requires_recount").default(false),
  discrepancyReason: text("discrepancy_reason"),
  adjustmentRequired: boolean("adjustment_required").default(false),
  adjustmentApplied: boolean("adjustment_applied").default(false),
  adjustmentAppliedBy: uuid("adjustment_applied_by").references(() => users.id),
  adjustmentAppliedAt: timestamp("adjustment_applied_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Physical Stock Scanning Sessions for barcode-based counting
export const physicalStockScanningSessions = pgTable("physical_stock_scanning_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  physicalStockCountId: uuid("physical_stock_count_id").references(() => physicalStockCounts.id, { onDelete: "cascade" }).notNull(),
  sessionName: varchar("session_name", { length: 255 }).notNull(),
  sessionType: varchar("session_type", { length: 50 }).default("First Count"), // "First Count", "Second Count", "Recount"
  storageLocation: varchar("storage_location", { length: 255 }),
  status: varchar("status", { length: 50 }).default("Active"), // "Active", "Paused", "Completed", "Cancelled"
  startedBy: uuid("started_by").references(() => users.id).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  totalScansExpected: integer("total_scans_expected").default(0),
  totalScansCompleted: integer("total_scans_completed").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const physicalStockScannedItems = pgTable("physical_stock_scanned_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  scanningSessionId: uuid("scanning_session_id").references(() => physicalStockScanningSessions.id, { onDelete: "cascade" }).notNull(),
  physicalStockCountItemId: uuid("physical_stock_count_item_id").references(() => physicalStockCountItems.id),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id),
  barcode: varchar("barcode", { length: 255 }).notNull(),
  supplierCode: varchar("supplier_code", { length: 255 }),
  quantityScanned: integer("quantity_scanned").notNull().default(1),
  storageLocation: varchar("storage_location", { length: 255 }),
  scannedBy: uuid("scanned_by").references(() => users.id).notNull(),
  scannedAt: timestamp("scanned_at").defaultNow(),
  verified: boolean("verified").default(false),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Physical Stock Adjustments - Track inventory adjustments from physical counts
export const physicalStockAdjustments = pgTable("physical_stock_adjustments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adjustmentNumber: varchar("adjustment_number", { length: 50 }).notNull().unique(),
  physicalStockCountId: uuid("physical_stock_count_id").references(() => physicalStockCounts.id).notNull(),
  adjustmentDate: timestamp("adjustment_date").defaultNow(),
  totalAdjustmentValue: decimal("total_adjustment_value", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("Draft"), // "Draft", "Applied", "Cancelled"
  appliedBy: uuid("applied_by").references(() => users.id),
  appliedAt: timestamp("applied_at"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  reason: text("reason"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const physicalStockAdjustmentItems = pgTable("physical_stock_adjustment_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adjustmentId: uuid("adjustment_id").references(() => physicalStockAdjustments.id, { onDelete: "cascade" }).notNull(),
  physicalStockCountItemId: uuid("physical_stock_count_item_id").references(() => physicalStockCountItems.id).notNull(),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id).notNull(),
  supplierCode: varchar("supplier_code", { length: 255 }).notNull(),
  description: text("description").notNull(),
  storageLocation: varchar("storage_location", { length: 255 }),
  systemQuantity: integer("system_quantity").notNull(),
  physicalQuantity: integer("physical_quantity").notNull(),
  adjustmentQuantity: integer("adjustment_quantity").notNull(), // physical - system
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  adjustmentValue: decimal("adjustment_value", { precision: 12, scale: 2 }),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for physical stock management
export const insertPhysicalStockCountSchema = createInsertSchema(physicalStockCounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhysicalStockCountItemSchema = createInsertSchema(physicalStockCountItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhysicalStockScanningSessionSchema = createInsertSchema(physicalStockScanningSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhysicalStockScannedItemSchema = createInsertSchema(physicalStockScannedItems).omit({
  id: true,
  createdAt: true,
});

export const insertPhysicalStockAdjustmentSchema = createInsertSchema(physicalStockAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhysicalStockAdjustmentItemSchema = createInsertSchema(physicalStockAdjustmentItems).omit({
  id: true,
  createdAt: true,
});

// PRICING TYPE EXPORTS
export type ProductCategory = typeof productCategories.$inferSelect;
export type MarkupConfiguration = typeof markupConfiguration.$inferSelect;
export type ItemPricing = typeof itemPricing.$inferSelect;
export type CustomerPricing = typeof customerPricing.$inferSelect;
export type PricingRule = typeof pricingRules.$inferSelect;
export type PriceList = typeof priceLists.$inferSelect;
export type PriceListItem = typeof priceListItems.$inferSelect;
export type PriceChangeHistory = typeof priceChangeHistory.$inferSelect;
export type BulkPricingOperation = typeof bulkPricingOperations.$inferSelect;

export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type InsertMarkupConfiguration = z.infer<typeof insertMarkupConfigurationSchema>;
export type InsertItemPricing = z.infer<typeof insertItemPricingSchema>;
export type InsertCustomerPricing = z.infer<typeof insertCustomerPricingSchema>;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type InsertPriceList = z.infer<typeof insertPriceListSchema>;
export type InsertPriceListItem = z.infer<typeof insertPriceListItemSchema>;
export type InsertPriceChangeHistory = z.infer<typeof insertPriceChangeHistorySchema>;
export type InsertBulkPricingOperation = z.infer<typeof insertBulkPricingOperationSchema>;

// SUPPLIER QUOTES
export const supplierQuotes = pgTable("supplier_quotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: varchar("quote_number", { length: 50 }).unique().notNull(),
  revision: integer("revision").default(1),
  // Revision tracking for audit purposes
  parentQuoteId: uuid("parent_quote_id"),
  revisionReason: text("revision_reason"),
  supersededAt: timestamp("superseded_at"),
  supersededBy: uuid("superseded_by").references(() => users.id),
  isSuperseded: boolean("is_superseded").default(false),
  enquiryId: uuid("enquiry_id").references(() => enquiries.id),
  requisitionId: uuid("requisition_id").references(() => requisitions.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  status: quotationStatusEnum("status").default("Draft"),
  priority: varchar("priority", { length: 20 }).default("Medium"), // "Low", "Medium", "High", "Urgent"
  quoteDate: timestamp("quote_date").defaultNow(),
  validUntil: timestamp("valid_until"),
  responseDate: timestamp("response_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).default("BHD"), // "BHD", "AED", "USD", "EUR", "GBP"
  terms: text("terms"),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  rfqNumber: varchar("rfq_number", { length: 100 }),
  evaluationScore: decimal("evaluation_score", { precision: 3, scale: 1 }), // 0-10
  competitiveRank: integer("competitive_rank"),
  approvalStatus: varchar("approval_status", { length: 50 }).default("Pending"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  supplierQuotationDocument: text("supplier_quotation_document"), // File path or URL to supplier's quotation document
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplier Quote Items
export const supplierQuoteItems = pgTable("supplier_quote_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierQuoteId: uuid("supplier_quote_id").references(() => supplierQuotes.id).notNull(),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
  // Discount fields
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  // VAT fields
  vatPercent: decimal("vat_percent", { precision: 5, scale: 2 }).default("0"),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"),
  specification: text("specification"),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  warranty: varchar("warranty", { length: 100 }),
  leadTime: varchar("lead_time", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for supplier quotes
export const insertSupplierQuoteSchema = createInsertSchema(supplierQuotes).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertSupplierQuoteItemSchema = createInsertSchema(supplierQuoteItems).omit({ 
  id: true, 
  createdAt: true
});

// PHYSICAL STOCK TYPE EXPORTS
export type PhysicalStockCount = typeof physicalStockCounts.$inferSelect;
export type PhysicalStockCountItem = typeof physicalStockCountItems.$inferSelect;
export type PhysicalStockScanningSession = typeof physicalStockScanningSessions.$inferSelect;
export type PhysicalStockScannedItem = typeof physicalStockScannedItems.$inferSelect;
export type PhysicalStockAdjustment = typeof physicalStockAdjustments.$inferSelect;
export type PhysicalStockAdjustmentItem = typeof physicalStockAdjustmentItems.$inferSelect;

export type InsertPhysicalStockCount = z.infer<typeof insertPhysicalStockCountSchema>;
export type InsertPhysicalStockCountItem = z.infer<typeof insertPhysicalStockCountItemSchema>;
export type InsertPhysicalStockScanningSession = z.infer<typeof insertPhysicalStockScanningSessionSchema>;
export type InsertPhysicalStockScannedItem = z.infer<typeof insertPhysicalStockScannedItemSchema>;
export type InsertPhysicalStockAdjustment = z.infer<typeof insertPhysicalStockAdjustmentSchema>;
export type InsertPhysicalStockAdjustmentItem = z.infer<typeof insertPhysicalStockAdjustmentItemSchema>;

// SUPPLIER QUOTES TYPE EXPORTS
export type SupplierQuote = typeof supplierQuotes.$inferSelect;
export type SupplierQuoteItem = typeof supplierQuoteItems.$inferSelect;

export type InsertSupplierQuote = z.infer<typeof insertSupplierQuoteSchema>;
export type InsertSupplierQuoteItem = z.infer<typeof insertSupplierQuoteItemSchema>;

// RECEIPT RETURNS TABLES
export const receiptReturns = pgTable("receipt_returns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  returnNumber: varchar("return_number", { length: 64 }).notNull(),
  goodsReceiptId: uuid("goods_receipt_id"),
  supplierId: uuid("supplier_id"),
  returnDate: timestamp("return_date", { withTimezone: true }).defaultNow(),
  returnReason: varchar("return_reason", { length: 128 }),
  status: varchar("status", { length: 32 }).default("Draft"),
  notes: text("notes"),
  receiptNumber: varchar("receipt_number", { length: 64 }),
  receiptDate: timestamp("receipt_date", { withTimezone: true }),
  receivedBy: varchar("received_by", { length: 128 }),
  expectedDate: timestamp("expected_date", { withTimezone: true }),
  actualDate: timestamp("actual_date", { withTimezone: true }),
  itemsExpected: integer("items_expected"),
  itemsReceived: integer("items_received"),
  discrepancy: varchar("discrepancy", { length: 16 }),
  supplierName: varchar("supplier_name", { length: 255 }),
  supplierAddress: text("supplier_address"),
  supplierContactPerson: varchar("supplier_contact_person", { length: 255 }),
  supplierLpoNumber: varchar("supplier_lpo_number", { length: 64 }),
  customerLpoNumber: varchar("customer_lpo_number", { length: 64 }),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).default("0"),
  supplierIdDisplay: varchar("supplier_id_display", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const receiptReturnItems = pgTable("receipt_returns_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptReturnId: uuid("receipt_return_id").notNull().references(() => receiptReturns.id, { onDelete: "cascade" }),
  serialNo: integer("serial_no"),
  itemId: uuid("item_id"),
  itemDescription: text("item_description"),
  quantityReturned: integer("quantity_returned").notNull().default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).default("0"),
  returnReason: varchar("return_reason", { length: 128 }),
  conditionNotes: text("condition_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Zod insert schemas
export const insertReceiptReturnSchema = createInsertSchema(receiptReturns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReceiptReturnItemSchema = createInsertSchema(receiptReturnItems).omit({ id: true, createdAt: true, updatedAt: true });

// Material Receipt insert schemas
export const insertMaterialReceiptSchema = createInsertSchema(materialReceipt)
  .omit({ id: true, createdAt: true, updatedAt: true, receiptDate: true, invoiceDate: true, dueDate: true })
  .extend({
    receiptDate: z.union([z.date(), z.string(), z.null()]).optional(),
    invoiceDate: z.union([z.date(), z.string(), z.null()]).optional(),
    dueDate: z.union([z.date(), z.string(), z.null()]).optional(),
  });
export const insertMaterialReceiptItemSchema = createInsertSchema(materialReceiptItems).omit({ id: true, createdAt: true, updatedAt: true });

// TypeScript types
export type ReceiptReturn = typeof receiptReturns.$inferSelect;
export type ReceiptReturnItem = typeof receiptReturnItems.$inferSelect;
export type InsertReceiptReturn = z.infer<typeof insertReceiptReturnSchema>;
export type InsertReceiptReturnItem = z.infer<typeof insertReceiptReturnItemSchema>;

// Material Receipt types
export type MaterialReceipt = typeof materialReceipt.$inferSelect;
export type MaterialReceiptItem = typeof materialReceiptItems.$inferSelect;
export type InsertMaterialReceipt = z.infer<typeof insertMaterialReceiptSchema>;
export type InsertMaterialReceiptItem = z.infer<typeof insertMaterialReceiptItemSchema>;

// Re-export schemas from sub-modules
export {
  // Removed duplicate exports
  scanningSessions,
  scannedItems,
  supplierReturns,
  supplierReturnItems,
  // Removed duplicate export
  // Removed duplicate export
  // Removed duplicate export
  // Removed duplicate export
  insertScanningSessionSchema,
  insertScannedItemSchema,
  insertSupplierReturnSchema,
  insertSupplierReturnItemSchema,
  // Removed duplicate exports
  type ScanningSession,
  type ScannedItem,
  type SupplierReturn,
  type SupplierReturnItem,
  // Removed duplicate exports
  type InsertInventoryLevel,
  type InsertStockMovement,
  type InsertScanningSession,
  type InsertScannedItem,
  type InsertSupplierReturn,
  type InsertSupplierReturnItem
};
