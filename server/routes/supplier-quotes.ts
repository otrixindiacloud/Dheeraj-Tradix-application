import { Request, Response, type Express } from "express";
import { z } from "zod";
import { SupplierQuoteStorage } from "../storage/supplier-quote-storage";
import { db } from "../db";
import { enquiries, enquiryItems, customers, suppliers, quotations, quotationItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseStorage } from "../storage/base";
import { SYSTEM_USER_ID } from "@shared/utils/uuid";

// Validation schemas
const supplierQuoteSearchSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  supplier: z.string().optional(),
  currency: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const supplierQuoteCreateSchema = z.object({
  supplierId: z.string().uuid(),
  requisitionId: z.string().uuid().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  validUntil: z.string(),
  paymentTerms: z.string(),
  deliveryTerms: z.string(),
  notes: z.string().optional(),
  currency: z.enum(["BHD", "AED", "USD", "EUR", "GBP"]).optional(),
  items: z.array(z.object({
    itemDescription: z.string(),
    quantity: z.number().positive(),
    unitOfMeasure: z.string(),
    unitPrice: z.number().min(0),
    specification: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    warranty: z.string().optional(),
    leadTime: z.string().optional(),
    discountPercent: z.number().min(0).optional(),
    discountAmount: z.number().min(0).optional(),
    vatPercent: z.number().min(0).optional(),
    vatAmount: z.number().min(0).optional(),
  }))
});

const supplierQuoteUpdateSchema = z.object({
  supplierId: z.string().uuid().optional(),
  rfqNumber: z.string().optional(), // Not stored in DB but accepted for frontend compatibility
  status: z.enum(["Draft", "Sent", "Accepted", "Rejected", "Expired"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(), // Not stored in DB but accepted for frontend compatibility
  responseDate: z.string().optional(), // Not stored in DB but accepted for frontend compatibility
  validUntil: z.string().optional(),
  totalAmount: z.string().optional(),
  currency: z.enum(["AED", "USD", "EUR", "GBP", "BHD"]).optional(), // Not stored in DB but accepted for frontend compatibility
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  notes: z.string().optional(),
  evaluationScore: z.number().min(0).max(10).optional(), // Not stored in DB but accepted for frontend compatibility
  competitiveRank: z.number().positive().optional(), // Not stored in DB but accepted for frontend compatibility
});

export function registerSupplierQuoteRoutes(app: Express) {
  
  // Get all supplier quotes with filtering
  app.get("/api/supplier-quotes", async (req: Request, res: Response) => {
    try {
      const params = supplierQuoteSearchSchema.parse(req.query);
      const quotes = await SupplierQuoteStorage.list(params);
      res.json({ data: quotes });
    } catch (error) {
      console.error("Error fetching supplier quotes:", error);
      res.status(500).json({ message: "Failed to fetch supplier quotes" });
    }
  });

  // Get supplier quote by ID
  app.get("/api/supplier-quotes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const quote = await SupplierQuoteStorage.getById(id);
      if (!quote) {
        return res.status(404).json({ message: "Supplier quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching supplier quote:", error);
      res.status(500).json({ message: "Failed to fetch supplier quote" });
    }
  });

  // Get supplier quote items
  app.get("/api/supplier-quotes/:id/items", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const items = await SupplierQuoteStorage.getItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching supplier quote items:", error);
      res.status(500).json({ message: "Failed to fetch supplier quote items" });
    }
  });

  // Create supplier quote item
  app.post("/api/supplier-quotes/:id/items", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log("Creating supplier quote item with data:", req.body);
      
      const itemData = { ...req.body, supplierQuoteId: id };
      console.log("Item data to insert:", itemData);
      
      const item = await SupplierQuoteStorage.createItem(itemData);
      console.log("Created item:", item);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating supplier quote item:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create supplier quote item";
      res.status(500).json({ message: errorMessage, error: String(error) });
    }
  });

  // Update supplier quote item
  app.put("/api/supplier-quotes/items/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log("Updating supplier quote item:", id, "with data:", req.body);
      
      const item = await SupplierQuoteStorage.updateItem(id, req.body);
      console.log("Updated item:", item);
      res.json(item);
    } catch (error) {
      console.error("Error updating supplier quote item:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update supplier quote item";
      res.status(500).json({ message: errorMessage, error: String(error) });
    }
  });

  // Delete supplier quote item
  app.delete("/api/supplier-quotes/items/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await SupplierQuoteStorage.deleteItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting supplier quote item:", error);
      res.status(500).json({ message: "Failed to delete supplier quote item" });
    }
  });

  // Create new supplier quote
  app.post("/api/supplier-quotes", async (req: Request, res: Response) => {
    try {
      const data = supplierQuoteCreateSchema.parse(req.body);
      const newQuote = await SupplierQuoteStorage.create(data);
      res.status(201).json(newQuote);
    } catch (error) {
      console.error("Error creating supplier quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplier quote" });
    }
  });

  // Update supplier quote
  app.patch("/api/supplier-quotes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log('Updating supplier quote:', id, 'with data:', req.body);
      
      const data = supplierQuoteUpdateSchema.parse(req.body);
      console.log('Parsed data:', data);
      
      // Check if the quotation exists first
      const existingQuote = await SupplierQuoteStorage.getById(id);
      if (!existingQuote) {
        console.log('Quote not found:', id);
        return res.status(404).json({ message: "Supplier quote not found" });
      }
      console.log('Existing quote found:', existingQuote.id);
      
      // Convert string dates to Date objects and map fields
      const processedData: any = {};
      
      // Map supplierId to supplierId (supplier_quotes table uses supplierId)
      if (data.supplierId) {
        console.log('Validating supplier ID:', data.supplierId);
        // Validate that the supplier exists
        const supplier = await db.select().from(suppliers).where(eq(suppliers.id, data.supplierId)).limit(1);
        console.log('Supplier query result:', supplier);
        if (supplier.length === 0) {
          console.log('Supplier not found:', data.supplierId);
          return res.status(400).json({ message: "Supplier not found" });
        }
        processedData.supplierId = data.supplierId;
        console.log('Mapped supplierId:', data.supplierId);
      }
      
      // Only update fields that actually exist in the supplier_quotes table
      if (data.status) processedData.status = data.status;
      if (data.priority) processedData.priority = data.priority;
      if (data.validUntil) {
        try {
          processedData.validUntil = new Date(data.validUntil);
        } catch (error) {
          console.error("Invalid date format for validUntil:", data.validUntil);
          return res.status(400).json({ message: "Invalid date format for validUntil" });
        }
      }
      if (data.responseDate) {
        try {
          processedData.responseDate = new Date(data.responseDate);
        } catch (error) {
          console.error("Invalid date format for responseDate:", data.responseDate);
          return res.status(400).json({ message: "Invalid date format for responseDate" });
        }
      }
      if (data.notes) processedData.notes = data.notes;
      if (data.totalAmount) {
        try {
          processedData.totalAmount = parseFloat(data.totalAmount).toString();
        } catch (error) {
          console.error("Invalid totalAmount format:", data.totalAmount);
          return res.status(400).json({ message: "Invalid totalAmount format" });
        }
      }
      if (data.currency) processedData.currency = data.currency;
      if (data.rfqNumber) processedData.rfqNumber = data.rfqNumber;
      if (data.evaluationScore) processedData.evaluationScore = data.evaluationScore;
      if (data.competitiveRank) processedData.competitiveRank = data.competitiveRank;
      
      // Store paymentTerms and deliveryTerms in their dedicated fields
      if (data.paymentTerms) processedData.paymentTerms = data.paymentTerms;
      if (data.deliveryTerms) processedData.deliveryTerms = data.deliveryTerms;
      
      // Validate that we have at least one field to update
      if (Object.keys(processedData).length === 0) {
        console.log('No valid fields to update');
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      console.log('Processed data for update:', processedData);
      
      // Note: All fields are now properly mapped to the supplier_quotes table
      
      const updatedQuote = await SupplierQuoteStorage.update(id, processedData);
      console.log('Update successful:', updatedQuote.id);
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error updating supplier quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      // Provide more specific error information
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ 
        message: "Failed to update supplier quote", 
        error: errorMessage 
      });
    }
  });

  // Delete supplier quote
  app.delete("/api/supplier-quotes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`[DELETE /api/supplier-quotes/${id}] Starting deletion process`);
      
      // Check if the quotation is referenced by other records
      const hasReferences = await SupplierQuoteStorage.hasReferences(id);
      if (hasReferences) {
        console.log(`[DELETE /api/supplier-quotes/${id}] Has references, cannot delete`);
        return res.status(400).json({ 
          message: "Cannot delete supplier quote. It is referenced by sales orders, customer acceptances, or purchase orders. Please delete the related records first." 
        });
      }
      
      console.log(`[DELETE /api/supplier-quotes/${id}] No references found, proceeding with deletion`);
      const result = await SupplierQuoteStorage.delete(id);
      console.log(`[DELETE /api/supplier-quotes/${id}] Deletion successful`);
      res.json(result);
    } catch (error) {
      console.error(`[DELETE /api/supplier-quotes/${req.params.id}] Error:`, error);
      
      if (error instanceof Error) {
        if (error.message === 'Supplier quote not found') {
          return res.status(404).json({ message: "Supplier quote not found" });
        }
        if ('code' in error && error.code === '23503') {
          return res.status(400).json({ 
            message: "Cannot delete supplier quote. It is referenced by other records. Please delete the related records first." 
          });
        }
        return res.status(500).json({ 
          message: "Failed to delete supplier quote", 
          error: error.message 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to delete supplier quote",
        error: "Unknown error occurred"
      });
    }
  });

  // Approve supplier quote
  app.post("/api/supplier-quotes/:id/approve", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if the quotation exists first
      const existingQuote = await SupplierQuoteStorage.getById(id);
      if (!existingQuote) {
        return res.status(404).json({ message: "Supplier quote not found" });
      }

      // Update the status to Approved
      const updatedQuote = await SupplierQuoteStorage.update(id, { status: "Approved" });
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error approving supplier quote:", error);
      res.status(500).json({ message: "Failed to approve supplier quote" });
    }
  });

  // Reject supplier quote
  app.post("/api/supplier-quotes/:id/reject", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if the quotation exists first
      const existingQuote = await SupplierQuoteStorage.getById(id);
      if (!existingQuote) {
        return res.status(404).json({ message: "Supplier quote not found" });
      }

      // Update the status to Rejected
      const updatedQuote = await SupplierQuoteStorage.update(id, { status: "Rejected" });
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error rejecting supplier quote:", error);
      res.status(500).json({ message: "Failed to reject supplier quote" });
    }
  });

  // Build Purchase Invoice style PDF table data from a Supplier Quote
  app.get("/api/supplier-quotes/:id/pdf-table-data", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const quote = await SupplierQuoteStorage.getById(id);
      if (!quote) {
        return res.status(404).json({ success: false, message: "Supplier quote not found", supplierQuoteId: id });
      }

      const items = await SupplierQuoteStorage.getItems(id);

      const currency = (quote as any).currency || 'BHD';
      const tableHeaders = [
        'S I',
        'Item Description & Specifications',
        'Qty',
        'Unit',
        'Cost',
        'Disc %',
        'Disc Amt',
        'VAT %',
        'VAT Amt',
        'Total Amount'
      ];

      const toNumber = (v: any, d = 0) => {
        if (v === null || v === undefined || v === '') return d;
        const n = Number(v);
        return Number.isFinite(n) ? n : d;
      };

      const tableData = (items || []).map((it: any, idx: number) => {
        const qty = toNumber(it.quantity, 0);
        const unit = toNumber(it.unitPrice, 0);
        const gross = qty * unit;
        const discPerc = toNumber(it.discountPercent || it.discountRate, 0);
        const discAmtRaw = toNumber(it.discountAmount, 0);
        const discountAmount = discAmtRaw > 0 ? discAmtRaw : (gross * discPerc / 100);
        const vatPerc = toNumber(it.vatPercent || it.taxRate, 0);
        const vatAmtRaw = toNumber(it.vatAmount || it.taxAmount, 0);
        const net = gross - discountAmount;
        const vatAmount = vatAmtRaw > 0 ? vatAmtRaw : (net * vatPerc / 100);

        return {
          serialNumber: idx + 1,
          itemDescription: it.description || it.itemDescription || 'Item',
          quantity: qty.toFixed(2),
          unit: (it.unitOfMeasure ? String(it.unitOfMeasure).toUpperCase() : 'PCS'),
          cost: unit.toFixed(3),
          discountPercent: discPerc.toFixed(1),
          discountAmount: discountAmount.toFixed(2),
          vatPercent: vatPerc.toFixed(1),
          vatAmount: vatAmount.toFixed(2),
          totalAmount: (net + vatAmount).toFixed(2)
        };
      });

      let totalGrossAmount = 0;
      let totalDiscountAmount = 0;
      let totalVatAmount = 0;
      (items || []).forEach((it: any) => {
        const qty = toNumber(it.quantity, 0);
        const unit = toNumber(it.unitPrice, 0);
        const gross = qty * unit;
        const discPerc = toNumber(it.discountPercent || it.discountRate, 0);
        const discAmtRaw = toNumber(it.discountAmount, 0);
        const discountAmount = discAmtRaw > 0 ? discAmtRaw : (gross * discPerc / 100);
        const vatPerc = toNumber(it.vatPercent || it.taxRate, 0);
        const vatAmtRaw = toNumber(it.vatAmount || it.taxAmount, 0);
        const net = gross - discountAmount;
        const vatAmount = vatAmtRaw > 0 ? vatAmtRaw : (net * vatPerc / 100);
        totalGrossAmount += gross;
        totalDiscountAmount += discountAmount;
        totalVatAmount += vatAmount;
      });
      const totalNetAmount = totalGrossAmount - totalDiscountAmount;
      const totalAmount = totalNetAmount + totalVatAmount;

      res.json({
        success: true,
        supplierQuoteId: id,
        quoteNumber: (quote as any).quoteNumber || id,
        currency,
        tableHeaders,
        tableData,
        totals: {
          totalGrossAmount: totalGrossAmount.toFixed(2),
          totalDiscountAmount: totalDiscountAmount.toFixed(2),
          totalNetAmount: totalNetAmount.toFixed(2),
          totalVatAmount: totalVatAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2)
        },
        itemCount: tableData.length,
        generatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[SUPPLIER-QUOTE:PDF-TABLE] Error:", error);
      res.status(500).json({ success: false, message: "Failed to build PDF table data from supplier quote", error: error.message });
    }
  });

  // Create supplier quote request from enquiry (customer-quotes endpoint)
  app.post("/api/customer-quotes", async (req: Request, res: Response) => {
    try {
      const { enquiryId, customerId, suppliers } = req.body;

      if (!enquiryId || !customerId || !suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields: enquiryId, customerId, and suppliers array are required" 
        });
      }

      // Get enquiry with customer details
      const enquiry = await db
        .select({
          id: enquiries.id,
          enquiryNumber: enquiries.enquiryNumber,
          customerId: enquiries.customerId,
          enquiryDate: enquiries.enquiryDate,
          status: enquiries.status,
          notes: enquiries.notes,
          targetDeliveryDate: enquiries.targetDeliveryDate,
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            address: customers.address,
            customerType: customers.customerType,
          }
        })
        .from(enquiries)
        .leftJoin(customers, eq(enquiries.customerId, customers.id))
        .where(eq(enquiries.id, enquiryId))
        .limit(1);

      if (!enquiry.length) {
        return res.status(404).json({ message: "Enquiry not found" });
      }

      const enquiryData = enquiry[0];

      // Get enquiry items
      const enquiryItemsList = await db
        .select()
        .from(enquiryItems)
        .where(eq(enquiryItems.enquiryId, enquiryId));

      // Validate all suppliers exist (simplified validation for now)
      const supplierIds = suppliers.map(s => s.supplierId);
      console.log('Validating suppliers:', supplierIds);
      
      // For now, just validate that we have supplier IDs
      if (supplierIds.length === 0) {
        return res.status(400).json({ message: "No suppliers provided" });
      }

      // Build supplier names string for notes
      const supplierNames = suppliers.map(s => s.supplierName).join(', ');

      // Generate unique quote number
      const baseStorage = new (BaseStorage as any)();
      let quoteNumber: string;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        quoteNumber = baseStorage.generateNumber("QT");
        
        // Check if this number already exists
        const existing = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.quoteNumber, quoteNumber)).limit(1);
        if (existing.length === 0) break;
        
        attempts++;
      } while (attempts < maxAttempts);
      
      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique quotation number");
      }

      // Create supplier quote request data
      const quoteData = {
        quoteNumber: quoteNumber,
        customerId: enquiryData.customerId, // Use the actual customer ID from enquiry
        customerType: enquiryData.customer?.customerType || "Retail", // Use customer's actual type
        enquiryId: enquiryId,
        status: "Draft" as const,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        subtotal: "0",
        discountPercentage: "0",
        discountAmount: "0",
        taxAmount: "0",
        totalAmount: "0",
        notes: `Quote request for enquiry ${enquiryData.enquiryNumber} from customer ${enquiryData.customer?.name || 'Unknown'} to suppliers: ${supplierNames}`,
        createdBy: SYSTEM_USER_ID, // Use system user ID
      };

      // Create the quotation
      let quotation;
      try {
        [quotation] = await db.insert(quotations).values(quoteData).returning();
      } catch (err: any) {
        // If FK constraint on created_by fails (system user not in users table), retry with null
        if (err?.code === '23503' && String(err?.detail || '').includes('created_by')) {
          const fallbackQuoteData = { ...quoteData, createdBy: null };
          [quotation] = await db.insert(quotations).values(fallbackQuoteData).returning();
        } else {
          throw err;
        }
      }

      // Create quotation items from enquiry items
      if (enquiryItemsList.length > 0) {
        const quotationItemsData = enquiryItemsList.map(item => ({
          quotationId: quotation.id,
          description: item.description, // Use correct field name
          quantity: item.quantity,
          unitPrice: item.unitPrice ? item.unitPrice.toString() : "0.00",
          discountPercentage: item.discount_percent ? item.discount_percent.toString() : (item.discountPercent ? item.discountPercent.toString() : undefined),
          discountAmount: item.discount_amount ? item.discount_amount.toString() : (item.discountAmount ? item.discountAmount.toString() : undefined),
          lineTotal: item.unitPrice ? (Number(item.unitPrice) * item.quantity).toString() : "0.00",
          notes: item.notes || `Requested for enquiry ${enquiryData.enquiryNumber}`,
        }));

        await db.insert(quotationItems).values(quotationItemsData);
      }

      // Return success response with created quote details
      res.status(201).json({
        message: "Quote request sent successfully",
        quoteId: quotation.id,
        quoteNumber: quotation.quoteNumber,
        enquiryId: enquiryId,
        suppliers: suppliers.map(s => ({ id: s.supplierId, name: s.supplierName })),
        customerName: enquiryData.customer?.name || 'Unknown',
        enquiryNumber: enquiryData.enquiryNumber,
        itemsCount: enquiryItemsList.length,
      });

    } catch (error) {
      console.error("Error creating customer quote request:", error);
      res.status(500).json({ 
        message: "Failed to create quote request", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
}