import type { Express } from "express";
import { storage } from "../storage";
import { 
  insertDeliverySchema,
  insertDeliveryItemSchema
} from "@shared/schema";
import { z } from "zod";
import { generateDeliveryNotePdf } from "../pdf/pdf-utils";

export function registerDeliveryRoutes(app: Express) {
  // Delivery routes
  app.get("/api/deliveries", async (req, res) => {
    try {
      const { customerId, status, dateFrom, dateTo, limit, offset } = req.query;
      const filters = {
        customerId: customerId as string,
        status: status as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };
      const deliveries = await storage.getDeliveries(filters);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });

  app.get("/api/deliveries/:id", async (req, res) => {
    try {
      const delivery = await storage.getDelivery(req.params.id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      res.json(delivery);
    } catch (error) {
      console.error("Error fetching delivery:", error);
      res.status(500).json({ message: "Failed to fetch delivery" });
    }
  });

  // GET /api/deliveries/details/:deliveryNumber
  app.get("/api/deliveries/details/:deliveryNumber", async (req, res) => {
    try {
      const { deliveryNumber } = req.params;
      const delivery = await storage.getDeliveryByNumber(deliveryNumber);

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found"
        });
      }

      // Get customer information
      const customer = await storage.getCustomer(delivery.customerId);

      // Get supplier information
      const supplier = await storage.getSupplier(delivery.supplierId);

      // Get delivery items
      const items = await storage.getDeliveryItems(delivery.id);

      res.json({
        success: true,
        data: {
          delivery,
          customer,
          supplier,
          items
        }
      });
    } catch (err) {
      console.error("Error fetching complete delivery data:", err);
      res.status(500).json({
        success: false,
        message: "Failed to fetch delivery data",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.post("/api/deliveries", async (req, res) => {
    try {
      const raw = { ...req.body } as any;
      if (raw.deliveryDate && typeof raw.deliveryDate === 'string') {
        const parsedDate = new Date(raw.deliveryDate);
        if (!isNaN(parsedDate.getTime())) raw.deliveryDate = parsedDate;
      }
      if (!raw.deliveryDate) raw.deliveryDate = new Date();
      
      // Ensure salesOrderId is present
      if (!raw.salesOrderId) {
        return res.status(400).json({ message: "Sales Order ID is required" });
      }
      
      // Accept minimal payload; storage will generate deliveryNumber & default status
      if (raw.deliveryNumber === undefined) delete raw.deliveryNumber; // ensure absent so storage layer generates
      // The insertDeliverySchema is generated from an expanded deliveries table (not the delivery_note table actually used)
      // and marks deliveryNumber as required. Frontend intentionally omits deliveryNumber so storage can generate it.
      // This mismatch caused "Invalid delivery data" errors. We therefore use a relaxed schema here.
      const createDeliveryInputSchema = z.object({
        salesOrderId: z.string().uuid("Invalid sales order ID format"),
        deliveryAddress: z.string().min(1).optional(),
        deliveryNotes: z.string().optional(),
        deliveryDate: z.date().optional(),
        deliveryType: z.string().optional(),
        status: z.string().optional(), // allow callers to override if needed
      });

      const deliveryData = createDeliveryInputSchema.parse(raw);

      // Reuse an existing open delivery for the same sales order (avoid duplicates)
      const existing = await storage.getDeliveries({ salesOrderId: deliveryData.salesOrderId });
      const open = existing.find(d => d.status === 'Pending' || d.status === 'Partial');
      if (open) {
        return res.status(200).json(open);
      }

      const delivery = await storage.createDelivery(deliveryData as any);
      res.status(201).json(delivery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid delivery data", errors: error.errors });
      }
      console.error("Error creating delivery:", error);
      res.status(500).json({ message: "Failed to create delivery" });
    }
  });

  app.put("/api/deliveries/:id", async (req, res) => {
    try {
      const deliveryData = insertDeliverySchema.partial().parse(req.body);
      const delivery = await storage.updateDelivery(req.params.id, deliveryData);
      res.json(delivery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid delivery data", errors: error.errors });
      }
      console.error("Error updating delivery:", error);
      res.status(500).json({ message: "Failed to update delivery" });
    }
  });

  app.delete("/api/deliveries/:id", async (req, res) => {
    try {
      await storage.deleteDelivery(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting delivery:", error);
      res.status(500).json({ message: "Failed to delete delivery" });
    }
  });

    // Delivery item operations
  app.post("/api/deliveries/:deliveryId/items", async (req, res) => {
    try {
      const itemData = { ...req.body, deliveryId: req.params.deliveryId };
      const item = await storage.createDeliveryItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating delivery item:", error);
      res.status(500).json({ message: "Failed to create delivery item" });
    }
  });

  // Scan item for picking
  app.post("/api/deliveries/scan-item", async (req, res) => {
    try {
      const { barcode, sessionId, quantity, storageLocation } = req.body;
      const pickedItem = await storage.scanItemForPicking(barcode, sessionId, quantity, "system", storageLocation);
      res.json(pickedItem);
    } catch (error) {
      console.error("Error scanning item for picking:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to scan item" });
    }
  });

  // Get available items for picking
  app.get("/api/deliveries/:id/available-items", async (req, res) => {
    try {
      const items = await storage.getAvailableItemsForPicking(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching available items for picking:", error);
      res.status(500).json({ message: "Failed to fetch available items" });
    }
  });
  app.get("/api/deliveries/:deliveryId/items", async (req, res) => {
    try {
      console.log('API: Fetching delivery items for delivery ID:', req.params.deliveryId);
      const items = await storage.getDeliveryItems(req.params.deliveryId);
      console.log('API: Retrieved delivery items:', items);
      console.log('API: Number of items returned:', items.length);
      res.json(items);
    } catch (error) {
      console.error("Error fetching delivery items:", error);
      res.status(500).json({ message: "Failed to fetch delivery items" });
    }
  });

  app.get("/api/delivery-items/:id", async (req, res) => {
    try {
      const item = await storage.getDeliveryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Delivery item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching delivery item:", error);
      res.status(500).json({ message: "Failed to fetch delivery item" });
    }
  });

  // Get invoiced items for a delivery
  app.get("/api/deliveries/:id/invoiced-items", async (req, res) => {
    try {
      const invoicedItems = await storage.getInvoicedItemsForDelivery(req.params.id);
      res.json(invoicedItems);
    } catch (error) {
      console.error("Error fetching invoiced items for delivery:", error);
      res.status(500).json({ message: "Failed to fetch invoiced items" });
    }
  });

  // Get delivery history for same sales order or same customer
  app.get("/api/deliveries/:id/history", async (req, res) => {
    try {
      const delivery = await storage.getDelivery(req.params.id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // scope: 'customer' | 'salesOrder' (default 'salesOrder')
      const scope = (req.query.scope as string) || 'salesOrder';
      let deliveriesToInclude: any[] = [];
      if (scope === 'customer') {
        const customerId = (delivery as any).customer?.id || delivery.salesOrder?.customer?.id;
        if (!customerId) {
          return res.status(400).json({ message: "Customer not found for this delivery" });
        }
        deliveriesToInclude = await storage.getDeliveries({ customerId });
      } else {
        if (!delivery.salesOrder?.id) {
          return res.status(400).json({ message: "Sales order not found for this delivery" });
        }
        deliveriesToInclude = await storage.getDeliveries({ salesOrderId: delivery.salesOrder.id });
      }

      // For each delivery, fetch its items and map to history item shape
      const history: any[] = [];
      for (const d of deliveriesToInclude) {
        const items = await storage.getDeliveryItems(d.id);
        for (const it of items) {
          history.push({
            id: it.id,
            deliveryId: d.id,
            salesOrderItemId: it.salesOrderItemId,
            itemId: it.itemId,
            deliveryNumber: (d as any).deliveryNumber || d.id,
            customerName: (d as any).customer?.name || (d as any).salesOrder?.customer?.name || null,
            trackingNumber: (d as any).trackingNumber || null,
            itemDescription: it.description,
            orderedQuantity: it.orderedQuantity || 0,
            deliveredQuantity: it.deliveredQuantity || 0,
            remainingQuantity: it.remainingQuantity ?? Math.max(0, (it.orderedQuantity || 0) - (it.deliveredQuantity || 0)),
            deliveryType: (d as any).deliveryType || 'Full',
            deliveryStatus: (d as any).status || 'Pending',
            deliveryDate: (d as any).deliveryDate || null,
            deliveredBy: (d as any).deliveryConfirmedBy || null,
            createdAt: (d as any).createdAt || null,
          });
        }
      }

      // Sort by delivery date ascending
      history.sort((a, b) => new Date(a.deliveryDate || a.createdAt || 0).getTime() - new Date(b.deliveryDate || b.createdAt || 0).getTime());

      res.json(history);
    } catch (error) {
      console.error("Error fetching delivery history:", error);
      res.status(500).json({ message: "Failed to fetch delivery history" });
    }
  });

  app.post("/api/delivery-items", async (req, res) => {
    try {
      const itemData = insertDeliveryItemSchema.parse(req.body);
      const item = await storage.createDeliveryItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid delivery item data", errors: error.errors });
      }
      console.error("Error creating delivery item:", error);
      res.status(500).json({ message: "Failed to create delivery item" });
    }
  });

  app.put("/api/delivery-items/:id", async (req, res) => {
    try {
      const itemData = insertDeliveryItemSchema.partial().parse(req.body);
      const item = await storage.updateDeliveryItem(req.params.id, itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid delivery item data", errors: error.errors });
      }
      console.error("Error updating delivery item:", error);
      res.status(500).json({ message: "Failed to update delivery item" });
    }
  });

  app.delete("/api/delivery-items/:id", async (req, res) => {
    try {
      await storage.deleteDeliveryItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting delivery item:", error);
      res.status(500).json({ message: "Failed to delete delivery item" });
    }
  });

  app.post("/api/delivery-items/bulk", async (req, res) => {
    try {
      // Accept a minimal payload; storage will enrich with lineNumber, barcode, pricing, etc.
      const minimalItemSchema = z.object({
        deliveryId: z.string().uuid("Invalid delivery ID"),
        salesOrderItemId: z.string().uuid("Invalid SO item ID"),
        itemId: z.string().uuid("Invalid item ID"),
        orderedQuantity: z.number().int().min(0),
        pickedQuantity: z.number().int().min(0),
        deliveredQuantity: z.number().int().min(0)
      });
      const itemsData = z.array(minimalItemSchema).parse(req.body);
      const items = await storage.bulkCreateDeliveryItems(itemsData as any);
      // After creating items, recalc delivery status based on remaining quantities
      const first = itemsData[0];
      if (first?.deliveryId) {
        try {
          const allItems = await storage.getDeliveryItems(first.deliveryId);
          const allRemaining = allItems.reduce((sum: number, it: any) => sum + Number(it.remainingQuantity || 0), 0);
          const newStatus = allRemaining === 0 ? 'Complete' : 'Partial';
          await storage.updateDelivery(first.deliveryId, { status: newStatus as any });
        } catch (e) {
          console.warn('Warning: failed to auto-update delivery status after bulk create', e);
        }
      }
      res.status(201).json(items);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid delivery items data", errors: error.errors });
      }
      console.error("Error bulk creating delivery items:", error);
      res.status(500).json({ message: "Failed to bulk create delivery items" });
    }
  });

  // Bulk update delivery items (for partial delivery editing)
  app.patch("/api/deliveries/:deliveryId/items", async (req, res) => {
    try {
      const { deliveryId } = req.params;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Items must be an array" });
      }

      // Validate each item update
      const updateSchema = z.object({
        id: z.string().uuid("Invalid item ID format"),
        deliveredQuantity: z.number().int().min(0, "Delivered quantity must be non-negative")
      });

      const validatedItems = z.array(updateSchema).parse(items);

      // Update each item
      const updatedItems = [];
      for (const item of validatedItems) {
        const updatedItem = await storage.updateDeliveryItem(item.id, {
          deliveredQuantity: item.deliveredQuantity
        });
        updatedItems.push(updatedItem);
      }

      // Recalculate and update status for the delivery
      try {
        const allItems = await storage.getDeliveryItems(deliveryId);
        const allRemaining = allItems.reduce((sum: number, it: any) => sum + Number(it.remainingQuantity || 0), 0);
        const newStatus = allRemaining === 0 ? 'Complete' : 'Partial';
        await storage.updateDelivery(deliveryId, { status: newStatus as any });
      } catch (e) {
        console.warn('Warning: failed to auto-update delivery status after bulk update', e);
      }

      res.json(updatedItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid delivery items data", errors: error.errors });
      }
      console.error("Error bulk updating delivery items:", error);
      res.status(500).json({ message: "Failed to bulk update delivery items" });
    }
  });

  // Delivery management actions
  app.post("/api/deliveries/:id/start-picking", async (req, res) => {
    try {
      const { userId } = req.body;
      const delivery = await storage.startDeliveryPicking(req.params.id, userId);
      res.json(delivery);
    } catch (error) {
      console.error("Error starting delivery picking:", error);
      res.status(500).json({ message: "Failed to start delivery picking" });
    }
  });

  app.post("/api/deliveries/:id/complete-picking", async (req, res) => {
    try {
      const { userId, notes } = req.body;
      const delivery = await storage.completeDeliveryPicking(req.params.id, userId, notes);
      res.json(delivery);
    } catch (error) {
      console.error("Error completing delivery picking:", error);
      res.status(500).json({ message: "Failed to complete delivery picking" });
    }
  });

  app.post("/api/deliveries/:id/confirm", async (req, res) => {
    try {
      const { confirmedBy, signature } = req.body;
      const delivery = await storage.confirmDelivery(req.params.id, confirmedBy, signature);
      res.json(delivery);
    } catch (error) {
      console.error("Error confirming delivery:", error);
      res.status(500).json({ message: "Failed to confirm delivery" });
    }
  });

  // Delivery Notes routes (aliases to delivery routes for UI consistency)
  app.get("/api/delivery-notes", async (req, res) => {
    try {
      // Accept both legacy limit/offset and page/pageSize params
      const { customerId, status, dateFrom, dateTo, limit, offset, search, page, pageSize, salesOrderId } = req.query as any;

      let resolvedLimit: number | undefined = limit ? parseInt(limit, 10) : undefined;
      let resolvedOffset: number | undefined = offset ? parseInt(offset, 10) : undefined;

      if (pageSize) {
        const ps = parseInt(pageSize, 10);
        if (!isNaN(ps)) resolvedLimit = ps;
      }
      if (page) {
        const pg = parseInt(page, 10);
        if (!isNaN(pg) && resolvedLimit) {
          resolvedOffset = (pg - 1) * resolvedLimit;
        }
      }

      const filters = {
        status: status as string,
        salesOrderId: salesOrderId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        limit: resolvedLimit,
        offset: resolvedOffset,
        search: (search as string) || undefined
      };
      const deliveries = await storage.getDeliveries(filters);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching delivery notes:", error);
      res.status(500).json({ message: "Failed to fetch delivery notes" });
    }
  });

  app.get("/api/delivery-notes/:id", async (req, res) => {
    try {
      const delivery = await storage.getDelivery(req.params.id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery note not found" });
      }
      res.json(delivery);
    } catch (error) {
      console.error("Error fetching delivery note:", error);
      res.status(500).json({ message: "Failed to fetch delivery note" });
    }
  });

  app.post("/api/delivery-notes", async (req, res) => {
    try {
      const raw = { ...req.body } as any;
      if (raw.deliveryDate && typeof raw.deliveryDate === 'string') {
        const parsedDate = new Date(raw.deliveryDate);
        if (!isNaN(parsedDate.getTime())) raw.deliveryDate = parsedDate;
      }
      if (!raw.deliveryDate) raw.deliveryDate = new Date();

      // Accept minimal payload; storage will generate deliveryNumber & default status
      if (raw.deliveryNumber === undefined) delete raw.deliveryNumber;

      // Use relaxed schema matching /api/deliveries creation to avoid requiring deliveryNumber
      const createDeliveryInputSchema = z.object({
        salesOrderId: z.string().uuid("Invalid sales order ID format"),
        deliveryAddress: z.string().min(1).optional(),
        deliveryNotes: z.string().optional(),
        deliveryDate: z.date().optional(),
        deliveryType: z.string().optional(),
        status: z.string().optional(),
        trackingNumber: z.string().optional(),
        carrierName: z.string().optional(),
        estimatedDeliveryDate: z.date().optional(),
        actualDeliveryDate: z.date().optional(),
        createdBy: z.string().uuid().optional(),
      });

      const validated = createDeliveryInputSchema.parse(raw);

      // Reuse an existing open delivery for the same sales order (avoid duplicates)
      const existing = await storage.getDeliveries({ salesOrderId: validated.salesOrderId });
      const open = existing.find(d => d.status === 'Pending' || d.status === 'Partial');
      if (open) {
        return res.status(200).json(open);
      }

      const delivery = await storage.createDelivery(validated as any);
      res.status(201).json(delivery);
    } catch (error) {
      console.error("Error creating delivery note:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create delivery note" });
    }
  });

  app.patch("/api/delivery-notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const raw = { ...req.body } as any;

      // Validate ID format
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: "Invalid delivery ID format" });
      }

      // Handle date parsing
      if (raw.deliveryDate && typeof raw.deliveryDate === 'string') {
        const parsedDate = new Date(raw.deliveryDate);
        if (!isNaN(parsedDate.getTime())) {
          raw.deliveryDate = parsedDate;
        } else {
          delete raw.deliveryDate; // Remove invalid date
        }
      }

      // Handle other timestamp fields
      const timestampFields = ['pickingStartedAt', 'pickingCompletedAt', 'deliveryConfirmedAt', 'actualDeliveryDate', 'estimatedDeliveryDate'];
      timestampFields.forEach(field => {
        if (raw[field] && typeof raw[field] === 'string') {
          const parsedDate = new Date(raw[field]);
          if (!isNaN(parsedDate.getTime())) {
            raw[field] = parsedDate;
          } else {
            delete raw[field]; // Remove invalid date
          }
        }
      });

      console.log('PATCH /api/delivery-notes/:id', { id, body: raw });

      const delivery = await storage.updateDelivery(id, raw);
      res.json(delivery);
    } catch (error) {
      console.error("Error updating delivery note:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ 
        message: "Failed to update delivery note",
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  app.delete("/api/delivery-notes/:id", async (req, res) => {
    try {
      await storage.deleteDelivery(req.params.id);
      res.json({ message: "Delivery note deleted successfully" });
    } catch (error) {
      console.error("Error deleting delivery note:", error);
      res.status(500).json({ message: "Failed to delete delivery note" });
    }
  });

  // Generate delivery note PDF
  app.get("/api/delivery-notes/:id/pdf", async (req, res) => {
    try {
      const deliveryId = req.params.id;
      const delivery = await storage.getDelivery(deliveryId);
      
      if (!delivery) {
        return res.status(404).json({ message: "Delivery note not found" });
      }

      // Get delivery items
      const deliveryItems = await storage.getDeliveryItems(deliveryId);
      
      // Aggregate quantities across Delivery History for the same Sales Order (if available)
      let soTotals: { totalOrdered: number; totalDelivered: number; totalRemaining: number } | undefined = undefined;
      try {
        const salesOrderId = (delivery as any).salesOrderId;
        if (salesOrderId) {
          // Fetch all deliveries for this sales order
          const relatedDeliveries = await storage.getDeliveries({ salesOrderId });
          const relatedIds = relatedDeliveries.map((d: any) => d.id);
          // Fetch all items for these deliveries in parallel
          const allItemsGroups = await Promise.all(
            relatedIds.map((id: string) => storage.getDeliveryItems(id).catch(() => []))
          );
          const allItems = allItemsGroups.flat();

          // Group by salesOrderItemId to compute delivered-to-date and remaining
          const bySoItem: Record<string, { ordered: number; delivered: number }> = {};
          for (const it of allItems as any[]) {
            const key = String(it.salesOrderItemId || it.itemId || it.id);
            const ordered = Number(it.orderedQuantity || 0);
            const delivered = Number(it.deliveredQuantity || it.pickedQuantity || 0);
            if (!bySoItem[key]) bySoItem[key] = { ordered: 0, delivered: 0 };
            // ordered can vary per split; take the max seen
            bySoItem[key].ordered = Math.max(bySoItem[key].ordered, ordered);
            bySoItem[key].delivered += delivered;
          }

          const totals = Object.values(bySoItem).reduce(
            (acc, v) => {
              acc.totalOrdered += v.ordered;
              acc.totalDelivered += v.delivered;
              return acc;
            },
            { totalOrdered: 0, totalDelivered: 0 }
          ) as any;
          totals.totalRemaining = Math.max(0, totals.totalOrdered - totals.totalDelivered);
          soTotals = totals as any;

          // Enrich current delivery items' remainingQuantity with overall remaining across SO
          const remainingByKey: Record<string, number> = {};
          for (const [key, v] of Object.entries(bySoItem)) {
            const rem = Math.max(0, v.ordered - v.delivered);
            remainingByKey[key] = rem;
          }
          for (const it of deliveryItems as any[]) {
            const key = String(it.salesOrderItemId || it.itemId || it.id);
            if (remainingByKey[key] != null) {
              (it as any).remainingQuantity = remainingByKey[key];
            }
          }
        }
      } catch (aggErr) {
        console.warn("[PDF] Failed to compute SO-wide delivery aggregates:", aggErr);
      }
      
      // Get customer information
      const customer = delivery.salesOrder?.customer || {};
      
      // Generate PDF
      const pdfResult = generateDeliveryNotePdf({
        deliveryNote: delivery,
        items: deliveryItems,
        customer: customer,
        salesOrder: delivery.salesOrder,
        soTotals,
        mode: 'enhanced'
      });

      res.setHeader('Content-Type', pdfResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.fileName}"`);
      res.setHeader('Content-Length', pdfResult.byteLength);
      res.send(pdfResult.buffer);
    } catch (error) {
      console.error("Error generating delivery note PDF:", error);
      res.status(500).json({ message: "Failed to generate delivery note PDF" });
    }
  });
}
