import type { Express } from "express";
import { storage } from "../storage";
import { insertSupplierLpoSchema, insertSupplierLpoItemSchema } from "@shared/schema";
import { z } from "zod";
import { getAttributingUserId, getOptionalUserId } from '../utils/user';
import { generateSupplierLpoPdf } from "../pdf/pdf-utils";
import { SupplierQuoteStorage } from "../storage/supplier-quote-storage-new";
import { 
  validateLpoData, 
  validateLpoUpdateData, 
  validateLpoItemData,
  validateCreateLpoFromQuotesData,
  validateCreateLpoFromSalesOrdersData,
  validateLpoStatusTransition,
  validateLpoFinancialData,
  validateLpoItemFinancialData,
  lpoStatusUpdateSchema,
  lpoApprovalSchema,
  lpoRejectionSchema,
  lpoConfirmationSchema,
  lpoDeliveryDateUpdateSchema
} from '../utils/lpo-validation';

export function registerSupplierLpoRoutes(app: Express) {
  // Create new supplier LPO
  app.post("/api/supplier-lpos", async (req, res) => {
    try {
      console.log("Received LPO data:", req.body);
      // Convert date strings to Date objects if needed
      const data = { ...req.body };
      if (data.lpoDate && typeof data.lpoDate === 'string') {
        data.lpoDate = new Date(data.lpoDate);
        console.log("Converted lpoDate to:", data.lpoDate);
      }
      if (data.expectedDeliveryDate && typeof data.expectedDeliveryDate === 'string') {
        data.expectedDeliveryDate = new Date(data.expectedDeliveryDate);
        console.log("Converted expectedDeliveryDate to:", data.expectedDeliveryDate);
      }
      if (data.requestedDeliveryDate && typeof data.requestedDeliveryDate === 'string') {
        data.requestedDeliveryDate = new Date(data.requestedDeliveryDate);
      }

      console.log("Processed data:", data);
      const validatedData = insertSupplierLpoSchema.parse(data);
      const supplierLpo = await storage.createSupplierLpo(validatedData);
      res.status(201).json(supplierLpo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation error:", error.errors);
        return res.status(400).json({ 
          message: "Invalid supplier LPO data", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      console.error("Error creating supplier LPO:", error);
      res.status(500).json({ message: "Failed to create supplier LPO" });
    }
  });

  // Supplier LPO routes
  app.get("/api/supplier-lpos", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const filters = {
        status: req.query.status as string,
        supplierId: req.query.supplierId as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        requiresApproval: req.query.requiresApproval === "true",
        pendingSupplierConfirmation: req.query.pendingSupplierConfirmation === "true",
      };
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });
      const supplierLpos = await storage.getSupplierLpos(limit, offset, Object.keys(filters).length > 0 ? filters : undefined);
      const totalCount = await storage.getSupplierLposCount(Object.keys(filters).length > 0 ? filters : undefined);
      res.json({
        data: supplierLpos,
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit)
      });
    } catch (error) {
      console.error("Error fetching supplier LPOs:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPOs" });
    }
  });

  // Convenience: create Supplier LPO from a single sales order
  app.post("/api/supplier-lpos/from-sales-order", async (req, res) => {
    try {
      const { salesOrderId, supplierId } = req.body;
      if (!salesOrderId) {
        return res.status(400).json({ message: "salesOrderId required" });
      }
        const lpos = await storage.createSupplierLposFromSalesOrders([salesOrderId], "supplier", getAttributingUserId(req));
      if (!lpos || lpos.length === 0) {
        return res.status(500).json({ message: "No Supplier LPO created" });
      }
      res.status(201).json(lpos[0]);
    } catch (error) {
      console.error("[SUPPLIER-LPO:SINGLE] Error creating supplier LPO from sales order. Payload=", req.body);
      console.error(error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: "Failed to create supplier LPO from sales order" });
      }
    }
  });

  // Create Supplier LPO from supplier quotes
  app.post("/api/supplier-lpos/from-supplier-quotes", async (req, res) => {
    try {
      console.log("[SUPPLIER-LPO:FROM-QUOTES] Request received:", req.body);
      
      // Validate request data
      const validatedData = validateCreateLpoFromQuotesData(req.body);
      const { quoteIds, groupBy } = validatedData;
      
      console.log(`[SUPPLIER-LPO:FROM-QUOTES] Processing ${quoteIds.length} quotes with groupBy: ${groupBy}`);
      const lpos = await storage.createSupplierLposFromSupplierQuotes(quoteIds, groupBy, getAttributingUserId(req));
      
      if (!lpos || lpos.length === 0) {
        console.log("[SUPPLIER-LPO:FROM-QUOTES] No LPOs created");
        return res.status(500).json({ message: "No Supplier LPO created" });
      }
      
      console.log(`[SUPPLIER-LPO:FROM-QUOTES] Successfully created ${lpos.length} LPO(s)`);
      res.status(201).json(lpos);
    } catch (error) {
      console.error("[SUPPLIER-LPO:FROM-QUOTES] Error creating supplier LPO from quotes. Payload=", req.body);
      console.error("[SUPPLIER-LPO:FROM-QUOTES] Error details:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      
      if (error instanceof Error) {
        res.status(500).json({ message: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: "Failed to create supplier LPO from quotes" });
      }
    }
  });

  // Batch: create Supplier LPOs from multiple sales orders
  app.post("/api/supplier-lpos/from-sales-orders", async (req, res) => {
    try {
      const { salesOrderIds, groupBy = 'supplier', supplierId } = req.body;
      if (!Array.isArray(salesOrderIds) || salesOrderIds.length === 0) {
        return res.status(400).json({ message: "salesOrderIds array required" });
      }
      const lpos = await storage.createSupplierLposFromSalesOrders(salesOrderIds, groupBy, getAttributingUserId(req));
      res.status(201).json(lpos);
    } catch (error) {
      console.error("[SUPPLIER-LPO:BATCH] Error creating supplier LPOs from sales orders. Payload=", req.body);
      console.error(error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: "Failed to create supplier LPOs" });
      }
    }
  });

  // Update supplier LPO status
  app.patch("/api/supplier-lpos/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      // Validate request data
      const validatedData = lpoStatusUpdateSchema.parse(req.body);
      const { status, notes } = validatedData;
      
      console.log(`[PATCH] /api/supplier-lpos/${id}/status - Received status:`, status);
      
      // Get current LPO to validate status transition
      const currentLpo = await storage.getSupplierLpo(id);
      if (!currentLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      // Validate status transition
      if (!validateLpoStatusTransition(currentLpo.status, status)) {
        return res.status(400).json({ 
          message: `Invalid status transition from ${currentLpo.status} to ${status}`,
          currentStatus: currentLpo.status,
          requestedStatus: status
        });
      }
      
      const updatedLpo = await (storage as any).updateSupplierLpoStatus(id, status, getAttributingUserId(req));
      console.log(`[PATCH] /api/supplier-lpos/${id}/status - Update result:`, updatedLpo);
      
      if (!updatedLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      res.json(updatedLpo);
    } catch (error) {
      console.error("Error updating supplier LPO status:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      
      res.status(500).json({ message: "Failed to update supplier LPO status" });
    }
  });

  app.get("/api/supplier-lpos/:id", async (req, res) => {
    try {
      const supplierLpo = await storage.getSupplierLpo(req.params.id);
      if (!supplierLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error fetching supplier LPO:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO" });
    }
  });

  // Update supplier LPO
  app.patch("/api/supplier-lpos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`[PATCH] /api/supplier-lpos/${id} - Received data:`, updateData);
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      // Validate the update data - allow null values and handle type conversions
      const updateSchema = z.object({
        status: z.string().optional(),
        expectedDeliveryDate: z.string().nullable().optional(),
        requestedDeliveryDate: z.string().nullable().optional(),
        specialInstructions: z.string().nullable().optional(),
        deliveryTerms: z.string().nullable().optional(),
        paymentTerms: z.string().nullable().optional(),
        termsAndConditions: z.string().nullable().optional(),
        currency: z.string().optional(),
        totalAmount: z.union([z.number(), z.string()]).optional().transform(val => val ? Number(val) : undefined),
        subtotal: z.union([z.number(), z.string()]).optional().transform(val => val ? Number(val) : undefined),
        taxAmount: z.union([z.number(), z.string(), z.null()]).optional().transform(val => val ? Number(val) : undefined),
        supplierContactPerson: z.string().nullable().optional(),
        supplierEmail: z.string().email().nullable().optional(),
        supplierPhone: z.string().nullable().optional(),
        supplierConfirmationReference: z.string().nullable().optional()
      });
      
      const validatedData = updateSchema.parse(updateData);
      
      // Filter out undefined values to only update fields that are actually provided
      const filteredData = Object.fromEntries(
        Object.entries(validatedData).filter(([_, value]) => value !== undefined)
      );
      
      // Convert date strings to Date objects
      if (filteredData.expectedDeliveryDate) {
        filteredData.expectedDeliveryDate = new Date(filteredData.expectedDeliveryDate);
      }
      if (filteredData.requestedDeliveryDate) {
        filteredData.requestedDeliveryDate = new Date(filteredData.requestedDeliveryDate);
      }
      
      // Validate financial data if provided
      if (filteredData.subtotal !== undefined || filteredData.taxAmount !== undefined || filteredData.totalAmount !== undefined) {
        const currentLpo = await storage.getSupplierLpo(id);
        if (currentLpo) {
          const subtotal = filteredData.subtotal ?? Number(currentLpo.subtotal || 0);
          const taxAmount = filteredData.taxAmount ?? Number(currentLpo.taxAmount || 0);
          const totalAmount = filteredData.totalAmount ?? Number(currentLpo.totalAmount || 0);
          
          if (!validateLpoFinancialData(subtotal, taxAmount, totalAmount)) {
            return res.status(400).json({ 
              message: "Invalid financial data: subtotal + taxAmount must equal totalAmount",
              subtotal,
              taxAmount,
              totalAmount
            });
          }
        }
      }
      
      console.log(`[PATCH] /api/supplier-lpos/${id} - Filtered data for update:`, filteredData);
      
      // Update the LPO
      const updatedLpo = await (storage as any).updateSupplierLpo(id, filteredData);
      
      if (!updatedLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      console.log(`[PATCH] /api/supplier-lpos/${id} - Update successful:`, updatedLpo);
      res.json(updatedLpo);
    } catch (error) {
      console.error("Error updating supplier LPO:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to update supplier LPO" });
    }
  });

  // Create amended LPO
  app.post("/api/supplier-lpos/:id/amend", async (req, res) => {
    try {
      const { reason, amendmentType } = req.body;
      if (!reason || !amendmentType) {
        return res.status(400).json({ message: "Amendment reason and type are required" });
      }
      const amendedLpo = await storage.createAmendedSupplierLpo(req.params.id, reason, amendmentType, getAttributingUserId(req));
      res.status(201).json(amendedLpo);
    } catch (error) {
      console.error("Error creating amended supplier LPO:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create amended supplier LPO" });
    }
  });

  // Workflow actions
  app.post("/api/supplier-lpos/:id/submit-for-approval", async (req, res) => {
    try {
      const supplierLpo = await storage.submitForApproval(req.params.id, getAttributingUserId(req));
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error submitting supplier LPO for approval:", error);
      res.status(500).json({ message: "Failed to submit supplier LPO for approval" });
    }
  });

  app.post("/api/supplier-lpos/:id/approve", async (req, res) => {
    try {
      const { notes } = req.body;
      const supplierLpo = await storage.approveSupplierLpo(req.params.id, getAttributingUserId(req), notes);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error approving supplier LPO:", error);
      res.status(500).json({ message: "Failed to approve supplier LPO" });
    }
  });

  app.post("/api/supplier-lpos/:id/reject", async (req, res) => {
    try {
      const { notes } = req.body;
      if (!notes) {
        return res.status(400).json({ message: "Rejection notes are required" });
      }
      const supplierLpo = await storage.rejectSupplierLpo(req.params.id, getAttributingUserId(req), notes);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error rejecting supplier LPO:", error);
      res.status(500).json({ message: "Failed to reject supplier LPO" });
    }
  });

  app.post("/api/supplier-lpos/:id/send-to-supplier", async (req, res) => {
    try {
      const supplierLpo = await storage.sendToSupplier(req.params.id, getAttributingUserId(req));
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error sending supplier LPO to supplier:", error);
      res.status(500).json({ message: "Failed to send supplier LPO to supplier" });
    }
  });

  app.post("/api/supplier-lpos/:id/confirm-by-supplier", async (req, res) => {
    try {
      const { confirmationReference } = req.body;
      const supplierLpo = await storage.confirmBySupplier(req.params.id, confirmationReference);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error confirming supplier LPO:", error);
      res.status(500).json({ message: "Failed to confirm supplier LPO" });
    }
  });

  // Update expected delivery date
  app.patch("/api/supplier-lpos/:id/expected-delivery", async (req, res) => {
    try {
      console.log("PATCH /api/supplier-lpos/:id/expected-delivery called with:", req.params.id, req.body);
      const { expectedDeliveryDate, userId } = req.body;
      if (!expectedDeliveryDate) {
        console.log("Missing expectedDeliveryDate in request body");
        return res.status(400).json({ message: "Expected delivery date is required" });
      }
      const supplierLpo = await storage.updateExpectedDeliveryDate(req.params.id, expectedDeliveryDate, userId);
      console.log("Successfully updated expected delivery date:", supplierLpo);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error updating expected delivery date:", error);
      res.status(500).json({ message: "Failed to update expected delivery date" });
    }
  });

  // Backlog reporting
  app.get("/api/supplier-lpos/backlog", async (req, res) => {
    try {
      const backlog = await storage.getSupplierLpoBacklog();
      res.json(backlog);
    } catch (error) {
      console.error("Error fetching supplier LPO backlog:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO backlog" });
    }
  });

  // Update LPO item discount and VAT data
  app.patch("/api/supplier-lpos/:id/items/:itemId", async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const { discountPercent, discountAmount, vatPercent, vatAmount } = req.body;
      
      console.log(`[LPO-ITEM-UPDATE] Updating item ${itemId} for LPO ${id} with:`, {
        discountPercent, discountAmount, vatPercent, vatAmount
      });

      // Validate the data
      const updateData: any = {};
      if (discountPercent !== undefined) updateData.discountPercent = discountPercent.toString();
      if (discountAmount !== undefined) updateData.discountAmount = discountAmount.toString();
      if (vatPercent !== undefined) updateData.vatPercent = vatPercent.toString();
      if (vatAmount !== undefined) updateData.vatAmount = vatAmount.toString();

      // Update the LPO item
      const updatedItem = await storage.updateSupplierLpoItem(itemId, updateData);
      
      // Update LPO tax amount based on all items
      await (storage as any).updateLpoTaxAmountFromItems(id);
      
      console.log(`[LPO-ITEM-UPDATE] Successfully updated item ${itemId} and LPO totals`);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating LPO item:", error);
      res.status(500).json({ message: "Failed to update LPO item" });
    }
  });

  // Update LPO tax amount from items
  app.post("/api/supplier-lpos/:id/update-tax-amount", async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`[LPO-TAX-UPDATE] Updating tax amount for LPO ${id}`);
      
      const updatedLpo = await (storage as any).updateLpoTaxAmountFromItems(id);
      
      if (!updatedLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      console.log(`[LPO-TAX-UPDATE] Successfully updated LPO ${id} tax amount`);
      res.json(updatedLpo);
    } catch (error) {
      console.error("Error updating LPO tax amount:", error);
      res.status(500).json({ message: "Failed to update LPO tax amount" });
    }
  });

  app.get("/api/customer-orders/backlog", async (req, res) => {
    try {
      const backlog = await storage.getCustomerOrderBacklog();
      res.json(backlog);
    } catch (error) {
      console.error("Error fetching customer order backlog:", error);
      res.status(500).json({ message: "Failed to fetch customer order backlog" });
    }
  });

  // Supplier LPO Items routes
  app.get("/api/supplier-lpos/:lpoId/items", async (req, res) => {
    try {
      const items = await storage.getSupplierLpoItems(req.params.lpoId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching supplier LPO items:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO items" });
    }
  });

  app.get("/api/supplier-lpo-items/:id", async (req, res) => {
    try {
      const item = await storage.getSupplierLpoItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Supplier LPO item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching supplier LPO item:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO item" });
    }
  });

  app.post("/api/supplier-lpo-items", async (req, res) => {
    try {
      const itemData = insertSupplierLpoItemSchema.parse(req.body);
      const item = await storage.createSupplierLpoItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid supplier LPO item data", errors: error.errors });
      }
      console.error("Error creating supplier LPO item:", error);
      res.status(500).json({ message: "Failed to create supplier LPO item" });
    }
  });
  // Update item
  app.put("/api/supplier-lpo-items/:id", async (req, res) => {
    try {
      const itemData = insertSupplierLpoItemSchema.partial().parse(req.body);
      const item = await storage.updateSupplierLpoItem(req.params.id, itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid supplier LPO item data", errors: error.errors });
      }
      console.error("Error updating supplier LPO item:", error);
      res.status(500).json({ message: "Failed to update supplier LPO item" });
    }
  });

  // Delete item
  app.delete("/api/supplier-lpo-items/:id", async (req, res) => {
    try {
      await storage.deleteSupplierLpoItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting supplier LPO item:", error);
      res.status(500).json({ message: "Failed to delete supplier LPO item" });
    }
  });

  // Bulk create items
  app.post("/api/supplier-lpo-items/bulk", async (req, res) => {
    try {
      const itemsData = req.body.items;
      const validatedItems = z.array(insertSupplierLpoItemSchema).parse(itemsData);
      const items = await storage.bulkCreateSupplierLpoItems(validatedItems);
      res.status(201).json(items);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid supplier LPO items data", errors: error.errors });
      }
      console.error("Error bulk creating supplier LPO items:", error);
      res.status(500).json({ message: "Failed to bulk create supplier LPO items" });
    }
  });

  // Fetch quantities from delivery notes or invoices for LPO
  app.post("/api/supplier-lpos/:id/fetch-quantities", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      console.log(`[LPO-FETCH-QUANTITIES] Fetching quantities for LPO ID: ${id}`);
      
      // Get LPO data to verify it exists
      const lpo = await storage.getSupplierLpo(id);
      if (!lpo) {
        console.warn(`[LPO-FETCH-QUANTITIES] LPO not found for ID: ${id}`);
        return res.status(404).json({ message: "Supplier LPO not found" });
      }

      console.log(`[LPO-FETCH-QUANTITIES] Found LPO: ${lpo.lpoNumber}`);

      // Fetch quantities from delivery notes or invoices
      const updatedItems = await storage.fetchQuantitiesFromDeliveryOrInvoice(id);
      
      console.log(`[LPO-FETCH-QUANTITIES] Successfully updated ${updatedItems.length} items for LPO ${id}`);
      
      res.json({
        success: true,
        message: `Successfully updated quantities for ${updatedItems.length} items`,
        updatedItems: updatedItems,
        lpoId: id,
        lpoNumber: lpo.lpoNumber
      });
      
    } catch (error) {
      console.error(`[LPO-FETCH-QUANTITIES] Error fetching quantities for LPO ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Failed to fetch quantities from delivery notes or invoices",
        error: error.message 
      });
    }
  });

  // Generate PDF for supplier LPO
  app.get("/api/supplier-lpos/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      console.log(`[LPO-PDF] Generating PDF for LPO ID: ${id}`);
      
      // Get LPO data
      const lpo = await storage.getSupplierLpo(id);
      if (!lpo) {
        console.warn(`[LPO-PDF] LPO not found for ID: ${id}`);
        return res.status(404).json({ message: "Supplier LPO not found" });
      }

      console.log(`[LPO-PDF] Found LPO: ${lpo.lpoNumber}`);

      // Try to fetch items from supplier quotes first (if LPO was created from quotes)
      let quoteItems: any[] = [];
      let items = [];
      
      // Check if LPO was created from supplier quotes
      if (lpo.sourceQuotationIds && Array.isArray(lpo.sourceQuotationIds) && lpo.sourceQuotationIds.length > 0) {
        console.log(`[LPO-PDF] LPO ${lpo.lpoNumber} was created from ${lpo.sourceQuotationIds.length} supplier quote(s)`);
        try {
          // Fetch items from all source supplier quotes
          for (const quoteId of lpo.sourceQuotationIds) {
            try {
              const itemsFromQuote = await SupplierQuoteStorage.getItems(quoteId);
              if (Array.isArray(itemsFromQuote) && itemsFromQuote.length > 0) {
                quoteItems.push(...itemsFromQuote.map((item: any) => ({
                  ...item,
                  sourceQuoteId: quoteId,
                  // Map quote item fields to LPO item structure
                  itemDescription: item.itemDescription || item.description || '',
                  quantity: item.quantity || 0,
                  unitCost: parseFloat(item.unitPrice || '0'),
                  unitPrice: parseFloat(item.unitPrice || '0'),
                  discountPercent: parseFloat(item.discountPercent || '0'),
                  discountAmount: parseFloat(item.discountAmount || '0'),
                  vatPercent: parseFloat(item.vatPercent || '0'),
                  vatAmount: parseFloat(item.vatAmount || '0'),
                  lineTotal: parseFloat(item.lineTotal || '0'),
                  specification: item.specification || item.specifications || ''
                })));
                console.log(`[LPO-PDF] Fetched ${itemsFromQuote.length} items from quote ${quoteId}`);
              }
            } catch (error) {
              console.warn(`[LPO-PDF] Error fetching items from quote ${quoteId}:`, error);
            }
          }
          console.log(`[LPO-PDF] Total ${quoteItems.length} items fetched from supplier quotes`);
        } catch (error) {
          console.warn(`[LPO-PDF] Error fetching quote items, will fall back to LPO items:`, error);
        }
      }
      
      // If we have quote items, use them; otherwise fall back to LPO items
      if (quoteItems.length > 0) {
        items = quoteItems;
        console.log(`[LPO-PDF] Using ${items.length} items from supplier quotes for PDF`);
      } else {
        // Fall back to LPO items
        try {
          // First fetch the latest quantities from delivery notes or invoices
          console.log(`[LPO-PDF] Fetching latest quantities for LPO ${id}`);
          await storage.fetchQuantitiesFromDeliveryOrInvoice(id);
          
          // Then get the updated items
          items = await storage.getSupplierLpoItems(id);
          console.log(`[LPO-PDF] Found ${items.length} items for LPO ${id} with updated quantities`);
        } catch (error) {
          console.error(`[LPO-PDF] Error fetching LPO items for ${id}:`, error);
          // Continue with empty items array rather than failing completely
          items = [];
        }
      }
      
      // Get supplier information
      let supplier = {};
      if (lpo.supplierId) {
        try {
          supplier = await storage.getSupplier(lpo.supplierId) || {};
          console.log(`[LPO-PDF] Found supplier: ${supplier.name || 'Unknown'}`);
        } catch (error) {
          console.warn(`[LPO-PDF] Could not fetch supplier information for ${lpo.supplierId}:`, error);
          // Continue with empty supplier object
          supplier = {};
        }
      } else {
        console.warn(`[LPO-PDF] LPO ${id} has no supplierId`);
      }

      // Generate PDF using the utility function
      let pdfResult;
      try {
        pdfResult = generateSupplierLpoPdf({
          lpo,
          items,
          supplier,
          mode: 'enhanced'
        });
        console.log(`[LPO-PDF] Successfully generated PDF for LPO ${lpo.lpoNumber}`);
      } catch (pdfError: any) {
        console.error(`[LPO-PDF] Error generating PDF for LPO ${id}:`, pdfError);
        return res.status(500).json({ 
          message: "Failed to generate LPO PDF", 
          error: pdfError.message,
          lpoId: id 
        });
      }

      // Validate PDF buffer before sending
      if (!pdfResult || !pdfResult.buffer) {
        console.error(`[LPO-PDF] Generated PDF buffer is empty or invalid for LPO ${id}`);
        return res.status(500).json({ 
          message: "Generated PDF buffer is empty or invalid", 
          lpoId: id 
        });
      }

      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${pdfResult.fileName}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Send PDF buffer
      res.send(pdfResult.buffer);
      console.log(`[LPO-PDF] Successfully sent PDF response for LPO ${lpo.lpoNumber}`);
    } catch (error) {
      console.error(`[LPO-PDF] Unexpected error generating LPO PDF for ${id}:`, error);
      res.status(500).json({ 
        message: "Failed to generate LPO PDF", 
        error: error.message,
        lpoId: id 
      });
    }
  });

  // Fetch LPO PDF table data
  app.get("/api/supplier-lpos/:id/pdf-table-data", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[LPO-PDF-TABLE] Fetching PDF table data for LPO: ${id}`);

      // Get LPO details
      const lpo = await storage.getSupplierLpo(id);
      if (!lpo) {
        return res.status(404).json({ 
          success: false, 
          error: "LPO not found",
          lpoId: id 
        });
      }

      // Get LPO items
      const items = await storage.getSupplierLpoItems(id);
      console.log(`[LPO-PDF-TABLE] Found ${items.length} items for LPO ${id}`);

      // Get supplier details
      const supplier = await storage.getSupplier(lpo.supplierId);
      if (!supplier) {
        console.warn(`[LPO-PDF-TABLE] Supplier not found for LPO ${id}, supplierId: ${lpo.supplierId}`);
      }

      // Define table headers without Cost Price and Markup
      const tableHeaders = ['S.I.', 'Item Description & Specifications', 'Qty', 'Unit', 'Unit Price', 'Disc. %', 'Disc. Amt', 'VAT %', 'VAT Amt', 'Total Amount'];
      
      // Helper function to parse financial values
      const parseFinancialValue = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined || value === '') return defaultValue;
        const parsed = parseFloat(String(value));
        return isNaN(parsed) ? defaultValue : parsed;
      };

      // Process items into table data format
      const tableData = items.map((it: any, idx: number) => {
        try {
          if (!it || typeof it !== 'object') {
            console.log(`[LPO-PDF-TABLE] Invalid item data at index ${idx}:`, it);
            return {
              serialNumber: idx + 1,
              itemDescription: 'Invalid item data',
              quantity: '',
              unitRate: '',
              discountPercent: '',
              discountAmount: '',
              netTotal: '',
              vatPercent: '',
              vatAmount: ''
            };
          }
          
          console.log(`[LPO-PDF-TABLE] Processing item ${idx + 1}:`, {
            itemDescription: it.itemDescription,
            quantity: it.quantity,
            unitCost: it.unitCost,
            discountPercent: it.discountPercent,
            discountAmount: it.discountAmount,
            vatPercent: it.vatPercent,
            vatAmount: it.vatAmount
          });
          
          const qty = parseFinancialValue(it.quantity, 0);
          const unit = String((it as any).unitOfMeasure || 'PCS').toUpperCase();
          const unitPrice = parseFinancialValue(it.unitPrice ?? it.unitCost ?? (it as any).costPrice, 0);
          const grossAmount = qty * unitPrice;
          const discountPercent = parseFinancialValue(it.discountPercent, 0);
          const discountAmount = parseFinancialValue(it.discountAmount, 0);
          const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
          const lineNet = grossAmount - calculatedDiscountAmount;
          
          // For VAT, use actual VAT data from the item if available, otherwise calculate proportionally
          const itemVatPercent = parseFinancialValue(it.vatPercent, 0);
          const itemVatAmount = parseFinancialValue(it.vatAmount, 0);
          const calculatedVatAmount = itemVatAmount > 0 ? itemVatAmount : (lineNet * itemVatPercent / 100);
          const calculatedVatPercent = lineNet > 0 ? ((calculatedVatAmount / lineNet) * 100) : itemVatPercent;
          
          const lineTotal = lineNet + calculatedVatAmount;
          return {
            serialNumber: idx + 1,
            itemDescription: it.itemDescription || 'No description',
            quantity: qty.toString(),
            unit: unit,
            unitPrice: unitPrice.toFixed(3),
            discountPercent: discountPercent.toFixed(1),
            discountAmount: calculatedDiscountAmount.toFixed(3),
            vatPercent: calculatedVatPercent.toFixed(1),
            vatAmount: calculatedVatAmount.toFixed(3),
            totalAmount: lineTotal.toFixed(3),
            rawData: {
              quantity: it.quantity,
              unit: unit,
              unitPrice: unitPrice,
              discountPercent: it.discountPercent,
              discountAmount: it.discountAmount,
              vatPercent: it.vatPercent,
              vatAmount: it.vatAmount,
              grossAmount: grossAmount,
              calculatedDiscountAmount: calculatedDiscountAmount,
              calculatedVatAmount: calculatedVatAmount,
              calculatedVatPercent: calculatedVatPercent
            }
          };
        } catch (error) {
          console.error(`[LPO-PDF-TABLE] Error processing item ${idx + 1}:`, error);
          return {
            serialNumber: idx + 1,
            itemDescription: 'Error processing item',
            quantity: '',
            unitRate: '',
            discountPercent: '',
            discountAmount: '',
            netTotal: '',
            vatPercent: '',
            vatAmount: '',
            error: error.message
          };
        }
      });

      // Calculate totals
      let totalGrossAmount = 0;
      let totalDiscountAmount = 0;
      let totalNetAmount = 0;
      let totalVatAmount = 0;
      let totalAmount = 0;

      items.forEach((it: any) => {
        const qty = parseFinancialValue(it.quantity, 0);
        const unitCost = parseFinancialValue(it.unitCost, 0);
        const grossAmount = qty * unitCost;
        const discountPercent = parseFinancialValue(it.discountPercent, 0);
        const discountAmount = parseFinancialValue(it.discountAmount, 0);
        const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
        const lineNet = grossAmount - calculatedDiscountAmount;
        
        const itemVatPercent = parseFinancialValue(it.vatPercent, 0);
        const itemVatAmount = parseFinancialValue(it.vatAmount, 0);
        const calculatedVatAmount = itemVatAmount > 0 ? itemVatAmount : (lineNet * itemVatPercent / 100);
        
        totalGrossAmount += grossAmount;
        totalDiscountAmount += calculatedDiscountAmount;
        totalNetAmount += lineNet;
        totalVatAmount += calculatedVatAmount;
      });

      totalAmount = totalNetAmount + totalVatAmount;

      const response = {
        success: true,
        lpoId: id,
        lpoNumber: lpo.lpoNumber,
        currency: lpo.currency || 'BHD',
        tableHeaders,
        tableData,
        totals: {
          totalGrossAmount: totalGrossAmount.toFixed(3),
          totalDiscountAmount: totalDiscountAmount.toFixed(3),
          totalNetAmount: totalNetAmount.toFixed(3),
          totalVatAmount: totalVatAmount.toFixed(3),
          totalAmount: totalAmount.toFixed(3)
        },
        lpoDetails: {
          lpoDate: lpo.lpoDate,
          supplierName: supplier?.name || 'Unknown Supplier',
          supplierId: lpo.supplierId,
          status: lpo.status,
          subtotal: lpo.subtotal,
          taxAmount: lpo.taxAmount,
          totalAmount: lpo.totalAmount
        },
        itemCount: items.length,
        generatedAt: new Date().toISOString()
      };

      console.log(`[LPO-PDF-TABLE] Successfully generated table data for LPO ${id} with ${items.length} items`);
      res.json(response);

    } catch (error) {
      console.error(`[LPO-PDF-TABLE] Error fetching PDF table data for LPO ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        lpoId: req.params.id 
      });
    }
  });
}

