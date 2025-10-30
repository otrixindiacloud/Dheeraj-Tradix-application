import type { Express } from "express";
import { storage } from "../storage";
import { 
  insertInvoiceSchema,
  insertInvoiceItemSchema
} from "@shared/schema";
import { z } from "zod";
// Unified PDF utilities
import { generateInvoicePdf } from '../pdf/pdf-utils';
import { sendPdf } from '../utils/pdf-response';

// Helper function for number parsing
function num(val: any): number { 
  if (val === null || val === undefined) return 0; 
  const n = typeof val === 'number' ? val : parseFloat(val); 
  return isNaN(n) ? 0 : n; 
}

export function registerInvoiceRoutes(app: Express) {
  console.log("[INVOICE ROUTES] Registering invoice routes...");
  
  // Simple health check
  app.get("/api/invoices/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Invoice routes are loaded",
      timestamp: new Date().toISOString()
    });
  });

  // Test endpoint to check database connection
  app.get("/api/invoices/test", async (req, res) => {
    try {
      console.log("[TEST] Testing database connection...");
      const testQuery = await storage.getInvoices({ limit: 1 });
      console.log("[TEST] Database connection successful");
      res.json({ 
        status: "success", 
        message: "Database connection working",
        invoiceCount: Array.isArray(testQuery) ? testQuery.length : 0
      });
    } catch (error) {
      console.error("[TEST] Database connection failed:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Database connection failed",
        error: error.message 
      });
    }
  });

  // Diagnostic endpoint to check delivery data
  app.get("/api/invoices/diagnose/:deliveryId", async (req, res) => {
    try {
      const { deliveryId } = req.params;
      console.log(`[DIAGNOSE] Checking delivery: ${deliveryId}`);
      
      // Check if delivery exists
      const delivery = await storage.getDelivery(deliveryId);
      if (!delivery) {
        return res.status(404).json({ 
          status: "error", 
          message: "Delivery not found",
          deliveryId 
        });
      }
      
      console.log(`[DIAGNOSE] Delivery found:`, {
        id: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        status: delivery.status,
        salesOrderId: delivery.salesOrderId
      });
      
      // Check sales order
      let salesOrder = null;
      if (delivery.salesOrderId) {
        salesOrder = await storage.getSalesOrder(delivery.salesOrderId);
        console.log(`[DIAGNOSE] Sales order found:`, {
          id: salesOrder?.id,
          orderNumber: salesOrder?.orderNumber,
          customerId: salesOrder?.customerId
        });
      }
      
      // Check delivery items
      const deliveryItems = await storage.getDeliveryItems(deliveryId);
      console.log(`[DIAGNOSE] Delivery items:`, deliveryItems.length);
      
      res.json({
        status: "success",
        delivery: {
          id: delivery.id,
          deliveryNumber: delivery.deliveryNumber,
          status: delivery.status,
          salesOrderId: delivery.salesOrderId
        },
        salesOrder: salesOrder ? {
          id: salesOrder.id,
          orderNumber: salesOrder.orderNumber,
          customerId: salesOrder.customerId
        } : null,
        deliveryItemsCount: deliveryItems.length,
        canGenerateInvoice: delivery.status === "Complete" && delivery.salesOrderId && salesOrder?.customerId
      });
    } catch (error) {
      console.error("[DIAGNOSE] Error:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Diagnostic failed",
        error: error.message 
      });
    }
  });

  // Invoice routes - specific routes first to avoid conflicts
  app.get("/api/invoices", async (req, res) => {
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
      const invoices = await storage.getInvoices(filters);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/by-number/:invoiceNumber", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByNumber(req.params.invoiceNumber);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice by number:", error);
      res.status(500).json({ message: "Failed to fetch invoice by number" });
    }
  });

  // Get complete invoice data with all related information by ID
  app.get("/api/invoices/complete/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get invoice
      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ 
          success: false,
          message: "Invoice not found" 
        });
      }

      // Get invoice items
      const items = await storage.getInvoiceItems(id);
      
      // Get customer information
      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ 
          success: false,
          message: "Customer not found" 
        });
      }

      // Get related sales order if exists
      let salesOrder = null;
      if (invoice.salesOrderId) {
        try {
          salesOrder = await storage.getSalesOrder(invoice.salesOrderId);
        } catch (error) {
          console.warn("Could not fetch sales order:", error);
        }
      }

      // Get related delivery if exists
      let delivery = null;
      if (invoice.deliveryId) {
        try {
          delivery = await storage.getDelivery(invoice.deliveryId);
        } catch (error) {
          console.warn("Could not fetch delivery:", error);
        }
      }

      // Calculate financial data
      const subtotal = parseFloat(invoice.subtotal || "0");
      const taxAmount = parseFloat(invoice.taxAmount || "0");
      const discountAmount = parseFloat(invoice.discountAmount || "0");
      const totalAmount = parseFloat(invoice.totalAmount || "0");
      const paidAmount = parseFloat(invoice.paidAmount || "0");
      const outstandingAmount = totalAmount - paidAmount;

      const completeData = {
        ...invoice,
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstandingAmount.toString(),
        paymentStatus: invoice.status, // Add paymentStatus as alias for status
        customer: {
          id: customer.id,
          name: customer.name,
          type: customer.customerType,
          classification: customer.classification,
          email: customer.email,
          phone: customer.phone,
          address: customer.address
        },
        items: items || [],
        salesOrder: salesOrder ? {
          id: salesOrder.id,
          orderNumber: salesOrder.orderNumber
        } : null,
        delivery: delivery ? {
          id: delivery.id,
          deliveryNumber: delivery.deliveryNumber
        } : null
      };

      res.json({
        success: true,
        data: completeData
      });
    } catch (error) {
      console.error("Error fetching complete invoice data:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch complete invoice data",
        error: error.message 
      });
    }
  });

  // Get complete invoice data with all related information by invoice number
  app.get("/api/invoices/complete-by-number/:invoiceNumber", async (req, res) => {
    try {
      const completeData = await storage.getInvoiceWithCompleteDetails(req.params.invoiceNumber);
      res.json({
        success: true,
        data: completeData
      });
    } catch (error) {
      console.error("Error fetching complete invoice data:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch complete invoice data",
        error: error.message 
      });
    }
  });

  // Get all invoice data from sales order or quotation with complete financial details
  app.get("/api/invoices/from-source/:sourceType/:sourceId", async (req, res) => {
    try {
      const { sourceType, sourceId } = req.params;
      
      if (sourceType !== 'sales-order' && sourceType !== 'quotation') {
        return res.status(400).json({
          success: false,
          message: "Invalid source type. Must be 'sales-order' or 'quotation'"
        });
      }

      const completeData = await storage.getInvoiceDataFromSource(sourceType, sourceId);
      res.json({
        success: true,
        data: completeData
      });
    } catch (error) {
      console.error("Error fetching invoice data from source:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch invoice data from source",
        error: error.message 
      });
    }
  });

  // Create invoice from sales order or quotation with all financial data
  app.post("/api/invoices/from-source/:sourceType/:sourceId", async (req, res) => {
    try {
      const { sourceType, sourceId } = req.params;
      const { invoiceType = 'Final', userId } = req.body;
      
      if (sourceType !== 'sales-order' && sourceType !== 'quotation') {
        return res.status(400).json({
          success: false,
          message: "Invalid source type. Must be 'sales-order' or 'quotation'"
        });
      }

      const createdInvoice = await storage.createInvoiceFromSource(sourceType, sourceId, invoiceType, userId);
      res.status(201).json({
        success: true,
        data: createdInvoice
      });
    } catch (error) {
      console.error("Error creating invoice from source:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create invoice from source",
        error: error.message 
      });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, invoiceData);
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      await storage.deleteInvoice(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Invoice Items routes
  app.get("/api/invoices/:invoiceId/items", async (req, res) => {
    try {
      const items = await storage.getInvoiceItems(req.params.invoiceId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      res.status(500).json({ message: "Failed to fetch invoice items" });
    }
  });

  app.get("/api/invoice-items/:id", async (req, res) => {
    try {
      const item = await storage.getInvoiceItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Invoice item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching invoice item:", error);
      res.status(500).json({ message: "Failed to fetch invoice item" });
    }
  });

  app.post("/api/invoice-items", async (req, res) => {
    try {
      const itemData = insertInvoiceItemSchema.parse(req.body);
      const item = await storage.createInvoiceItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice item data", errors: error.errors });
      }
      console.error("Error creating invoice item:", error);
      res.status(500).json({ message: "Failed to create invoice item" });
    }
  });

  app.put("/api/invoice-items/:id", async (req, res) => {
    try {
      const itemData = insertInvoiceItemSchema.partial().parse(req.body);
      const item = await storage.updateInvoiceItem(req.params.id, itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice item data", errors: error.errors });
      }
      console.error("Error updating invoice item:", error);
      res.status(500).json({ message: "Failed to update invoice item" });
    }
  });

  app.delete("/api/invoice-items/:id", async (req, res) => {
    try {
      await storage.deleteInvoiceItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice item:", error);
      res.status(500).json({ message: "Failed to delete invoice item" });
    }
  });

  app.post("/api/invoice-items/bulk", async (req, res) => {
    try {
      const itemsData = z.array(insertInvoiceItemSchema).parse(req.body);
      const items = await storage.bulkCreateInvoiceItems(itemsData);
      res.status(201).json(items);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice items data", errors: error.errors });
      }
      console.error("Error bulk creating invoice items:", error);
      res.status(500).json({ message: "Failed to bulk create invoice items" });
    }
  });

  // Invoice management actions
  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const { email } = req.body;
      const result = await storage.sendInvoice(req.params.id, email);
      res.json(result);
    } catch (error) {
      console.error("Error sending invoice:", error);
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", async (req, res) => {
    try {
      const { paidAmount, paymentMethod, paymentReference, userId } = req.body;
      const invoice = await storage.markInvoicePaid(req.params.id, paidAmount, paymentMethod, paymentReference, userId);
      res.json(invoice);
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  app.post("/api/invoices/:id/cancel", async (req, res) => {
    try {
      const { reason } = req.body;
      // Cancel by updating status - storage may not have a dedicated cancelInvoice method
      const invoice = await storage.updateInvoice(req.params.id, { status: "Cancelled", notes: reason });
      res.json(invoice);
    } catch (error) {
      console.error("Error cancelling invoice:", error);
      res.status(500).json({ message: "Failed to cancel invoice" });
    }
  });

  // Test endpoint to debug delivery items
  app.post("/api/invoices/debug-delivery-items", async (req, res) => {
    try {
      const { deliveryId, selectedDeliveryItemIds } = req.body;
      
      if (!deliveryId) {
        return res.status(400).json({ message: "Delivery ID is required" });
      }
      
      // Get delivery items
      const deliveryItems = await storage.getDeliveryItems(deliveryId);
      const filteredItems = selectedDeliveryItemIds ? 
        deliveryItems.filter(item => selectedDeliveryItemIds.includes(item.id)) : 
        deliveryItems;
      
      // Get sales order items for each delivery item
      const debugInfo = await Promise.all(filteredItems.map(async (di) => {
        const soItem = di.salesOrderItemId ? 
          await storage.getSalesOrderItem(di.salesOrderItemId) : null;
        
        const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
        const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
        const lineGross = qty * unitPrice;
        
        return {
          deliveryItem: {
            id: di.id,
            deliveredQuantity: di.deliveredQuantity,
            pickedQuantity: di.pickedQuantity,
            orderedQuantity: di.orderedQuantity,
            unitPrice: di.unitPrice,
            totalPrice: di.totalPrice
          },
          salesOrderItem: soItem ? {
            id: soItem.id,
            quantity: soItem.quantity,
            unitPrice: soItem.unitPrice,
            totalPrice: soItem.totalPrice
          } : null,
          calculated: {
            qty,
            unitPrice,
            lineGross
          }
        };
      }));
      
      res.json({ debugInfo });
    } catch (error) {
      console.error("Error debugging delivery items:", error);
      res.status(500).json({ message: "Failed to debug delivery items", error: error.message });
    }
  });

  // Generate invoice from delivery
  app.post("/api/invoices/generate-from-delivery", async (req, res) => {
    try {
      console.log(`[ROUTE] Invoice generation request received:`, req.body);
      const { deliveryId, invoiceType, userId, selectedDeliveryItemIds } = req.body;
      
      if (!deliveryId) {
        console.log(`[ROUTE] ERROR: No delivery ID provided`);
        return res.status(400).json({ message: "Delivery ID is required" });
      }
      
      console.log(`[ROUTE] Calling storage.generateInvoiceFromDelivery with:`, { deliveryId, invoiceType, userId, selectedDeliveryItemIds });
      
      // PERFORMANCE OPTIMIZATION: Removed redundant storage test query that was adding unnecessary delay
      const invoice = await storage.generateInvoiceFromDelivery(deliveryId, invoiceType, userId, selectedDeliveryItemIds);
      console.log(`[ROUTE] Invoice generation successful:`, invoice?.id);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error generating invoice from delivery:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      });
      res.status(500).json({ 
        message: "Failed to generate invoice from delivery",
        error: error.message,
        details: error.stack
      });
    }
  });

  // Generate proforma invoice
  app.post("/api/invoices/generate-proforma", async (req, res) => {
    try {
      const { salesOrderId, userId } = req.body;
      const invoice = await storage.generateProformaInvoice(salesOrderId, userId);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error generating proforma invoice:", error);
      res.status(500).json({ message: "Failed to generate proforma invoice" });
    }
  });

  // Update invoice currency (original route)
  app.put("/api/invoices/:id/currency", async (req, res) => {
    try {
      const { newCurrency, exchangeRate, userId } = req.body;
      const invoice = await storage.updateInvoiceCurrency(req.params.id, newCurrency, exchangeRate, userId);
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice currency:", error);
      res.status(500).json({ message: "Failed to update invoice currency" });
    }
  });

  // Create invoice item (original route)
  app.post("/api/invoices/:invoiceId/items", async (req, res) => {
    try {
      const itemData = { ...req.body, invoiceId: req.params.invoiceId };
      const item = await storage.createInvoiceItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating invoice item:", error);
      res.status(500).json({ message: "Failed to create invoice item" });
    }
  });

  // Test endpoint to verify server connectivity
  app.get("/api/invoices/test", (req, res) => {
    res.json({ message: "Invoice API is working", timestamp: new Date().toISOString() });
  });

  // Generate PDF for invoice (unified service)
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    const startTime = Date.now();
    const invoiceId = req.params.id;
    const { invoiceType } = req.query;
    
    try {
      console.log(`[PDF Generation] Starting PDF generation for Invoice ID: ${invoiceId}, Query invoiceType: ${invoiceType}`);
      
      // Get invoice with all related data
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        console.log(`[PDF Generation] Invoice not found for ID: ${invoiceId}`);
        return res.status(404).json({ message: "Invoice not found" });
      }

      console.log(`[PDF Generation] Invoice data:`, {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        status: invoice.status
      });

      // Get invoice items with item details
      const invoiceItems = await storage.getInvoiceItems(invoiceId);
      console.log(`[PDF Generation] Found ${invoiceItems.length} invoice items`);
      
      // Enhance items with full item data for material specifications
      let enhancedItems = await Promise.all(
        invoiceItems.map(async (invoiceItem, index) => {
          let itemDetails = null;
          if (invoiceItem.itemId) {
            try {
              itemDetails = await storage.getItem(invoiceItem.itemId);
            } catch (error) {
              console.warn(`Could not fetch item details for ${invoiceItem.itemId}:`, error);
            }
          }
          return {
            ...invoiceItem,
            item: itemDetails
          };
        })
      );

      // Get customer information
      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Get markup configuration for the customer type
      let markupConfig = null;
      try {
        const { db } = await import('../db');
        const { markupConfiguration } = await import('@shared/schema');
        const { and, eq, isNull } = await import('drizzle-orm');
        
        const configData = await db
          .select()
          .from(markupConfiguration)
          .where(
            and(
              eq(markupConfiguration.isActive, true),
              isNull(markupConfiguration.entityId) // System-wide config
            )
          )
          .limit(1);
        
        if (configData.length > 0) {
          markupConfig = configData[0];
        }
      } catch (error) {
        console.warn('Could not fetch markup configuration:', error);
        // Provide default markup configuration if table doesn't exist
        markupConfig = {
          retailMarkupPercentage: '70.00',
          wholesaleMarkupPercentage: '40.00',
          isActive: true
        };
      }

      // Get related sales order and delivery for additional context
      let salesOrder = null;
      let delivery = null;
      let quotationItems = [];
      
      try {
        if (invoice.salesOrderId) {
          salesOrder = await storage.getSalesOrder(invoice.salesOrderId);
          
          // If sales order has a quotation, fetch quotation items
          if (salesOrder?.quotationId) {
            const { db } = await import('../db');
            const { quotationItems: quotationItemsTable } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');
            
            try {
              const quotationItemsData = await db
                .select()
                .from(quotationItemsTable)
                .where(eq(quotationItemsTable.quotationId, salesOrder.quotationId));
              
              quotationItems = quotationItemsData;
              console.log(`[PDF Generation] Loaded ${quotationItems.length} quotation items for markup data`);
            } catch (error) {
              console.warn('Could not fetch quotation items:', error);
            }
          }
        }
        if (invoice.deliveryId) {
          delivery = await storage.getDelivery(invoice.deliveryId);
        }
      } catch (error) {
        console.warn('Could not fetch related order/delivery data:', error);
      }

      // Enhance invoice items with quotation item data (for markup)
      if (quotationItems.length > 0) {
        enhancedItems = enhancedItems.map((invoiceItem: any, index: number) => {
          // Try to match quotation item by multiple strategies
          let matchingQuotationItem = null;
          
          // Strategy 1: Match by description (most reliable)
          if (invoiceItem.description) {
            const norm = (s: any) => (s ? String(s).replace(/\s+/g, ' ').trim().toLowerCase() : '');
            matchingQuotationItem = quotationItems.find((qi: any) => norm(qi.description) === norm(invoiceItem.description));
          }
          
          // Strategy 2: Match by position/index alias (fallback)
          if (!matchingQuotationItem && quotationItems[index]) {
            matchingQuotationItem = quotationItems[index];
          }
          
          // If we found a matching quotation item, add its markup and costPrice
          if (matchingQuotationItem) {
            return {
              ...invoiceItem,
              quotationItem: matchingQuotationItem,
              quotationMarkup: matchingQuotationItem.markup || null,
              quotationCostPrice: matchingQuotationItem.costPrice || null
            };
          }
          
          return invoiceItem;
        });
      }

      console.log(`[PDF Generation] Building PDF for invoice ${invoice.invoiceNumber}...`);
      
      // Build PDF with error handling
      let result;
      try {
        result = generateInvoicePdf({
          invoice: invoice as any,
          items: enhancedItems as any,
          customer: customer as any,
          related: { salesOrder, delivery, markupConfig },
          mode: 'enhanced'
        });
        console.log(`[PDF Generation] PDF generated successfully, size: ${result.byteLength} bytes`);
      } catch (pdfError) {
        console.error(`[PDF Generation] Error building PDF:`, pdfError);
        throw new Error(`Failed to build PDF: ${pdfError.message}`);
      }

      const endTime = Date.now();
      console.log(`[PDF Generation] Total PDF generation time: ${endTime - startTime}ms for invoice ${invoice.invoiceNumber}`);
      
      sendPdf(res, result);
    } catch (error) {
      const endTime = Date.now();
      console.error(`[PDF Generation] Error generating PDF for invoice ${invoiceId} (${endTime - startTime}ms):`, error);
      res.status(500).json({ 
        message: "Failed to generate invoice PDF", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
}
