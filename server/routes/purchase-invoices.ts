import type { Express } from "express";
import { storage } from "../storage";
import { insertPurchaseInvoiceSchema, insertPurchaseInvoiceItemSchema } from "../../shared/schema";
import { generatePurchaseInvoicePdf } from "../pdf/pdf-utils";
import { z } from "zod";
import { SupplierQuoteStorage } from "../storage/supplier-quote-storage-new";

export function registerPurchaseInvoiceRoutes(app: Express) {
  // Create purchase invoice
  app.post("/api/purchase-invoices", async (req, res) => {
    try {
      console.log('[PURCHASE INVOICE][RAW BODY]', JSON.stringify(req.body, null, 2));
      
      // Handle both old format (just invoice data) and new format (invoice + items)
      if (req.body.invoice && req.body.items) {
        // New format with items
        console.log('[PURCHASE INVOICE][INVOICE]', req.body.invoice);
        console.log('[PURCHASE INVOICE][ITEMS]', req.body.items);
        
        const validatedInvoice = insertPurchaseInvoiceSchema.parse(req.body.invoice);
        console.log('[PURCHASE INVOICE][INVOICE PARSED]', validatedInvoice);
        
        const validatedItems = z.array(insertPurchaseInvoiceItemSchema).parse(req.body.items);
        console.log('[PURCHASE INVOICE][ITEMS PARSED]', validatedItems);
        
        const purchaseInvoice = await storage.createPurchaseInvoice(validatedInvoice, validatedItems);
        res.status(201).json(purchaseInvoice);
      } else {
        // Old format without items
        const validatedData = insertPurchaseInvoiceSchema.parse(req.body);
        const purchaseInvoice = await storage.createPurchaseInvoice(validatedData);
        res.status(201).json(purchaseInvoice);
      }
    } catch (error) {
      console.error("Error creating purchase invoice:", error);
      res.status(400).json({ message: "Failed to create purchase invoice", error: error.message });
    }
  });

  // List purchase invoices
  app.get("/api/purchase-invoices", async (req, res) => {
    try {
      const purchaseInvoices = await storage.getPurchaseInvoices();
      res.json(purchaseInvoices);
    } catch (error) {
      console.error("Error fetching purchase invoices:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoices" });
    }
  });

  // Get purchase invoices by LPO ID
  app.get("/api/purchase-invoices/by-lpo/:lpoId", async (req, res) => {
    try {
      const { lpoId } = req.params;
      const purchaseInvoices = await storage.getPurchaseInvoicesByLpoId(lpoId);
      res.json(purchaseInvoices);
    } catch (error) {
      console.error("Error fetching purchase invoices by LPO ID:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoices" });
    }
  });

  // Get purchase invoices by supplier quote ID
  app.get("/api/purchase-invoices/by-supplier-quote/:supplierQuoteId", async (req, res) => {
    try {
      const { supplierQuoteId } = req.params;
      const purchaseInvoices = await storage.getPurchaseInvoicesBySupplierQuoteId(supplierQuoteId);
      res.json(purchaseInvoices);
    } catch (error) {
      console.error("Error fetching purchase invoices by supplier quote ID:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoices" });
    }
  });

  // Get unique supplier invoice numbers for suggestions
  app.get("/api/purchase-invoices/supplier-invoice-numbers", async (req, res) => {
    try {
      const supplierInvoiceNumbers = await storage.getUniqueSupplierInvoiceNumbers();
      res.json(supplierInvoiceNumbers);
    } catch (error) {
      console.error("Error fetching supplier invoice numbers:", error);
      res.status(500).json({ message: "Failed to fetch supplier invoice numbers" });
    }
  });

  // Get single purchase invoice
  app.get("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      
      // Get purchase invoice items - fetch ALL items without any limits
      let items = await storage.getPurchaseInvoiceItems(id);

      // If no persisted purchase invoice items exist, fall back to LPO or Goods Receipt items
      if (!items || items.length === 0) {
        try {
          if (purchaseInvoice.lpoId) {
            const lpoItems = await storage.getSupplierLpoItems(purchaseInvoice.lpoId);
            items = (lpoItems || []).map((lpoItem: any) => ({
              id: lpoItem.id,
              itemDescription: lpoItem.itemDescription,
              quantity: Number(lpoItem.quantity) || 0,
              unitPrice: String(lpoItem.unitCost ?? '0'),
              totalPrice: String(lpoItem.totalCost ?? (Number(lpoItem.quantity || 0) * Number(lpoItem.unitCost || 0))),
              discountRate: Number(lpoItem.discountPercent) || 0,
              discountAmount: Number(lpoItem.discountAmount) || 0,
              taxRate: Number(lpoItem.vatPercent) || 0,
              taxAmount: Number(lpoItem.vatAmount) || 0,
              unitOfMeasure: lpoItem.unitOfMeasure || 'PCS',
              supplierCode: lpoItem.supplierCode,
              barcode: lpoItem.barcode,
              notes: lpoItem.specialInstructions
            }));
          } else if (purchaseInvoice.goodsReceiptId) {
            const grItems = await storage.getGoodsReceiptItems(purchaseInvoice.goodsReceiptId);
            items = (grItems || []).map((grItem: any) => ({
              id: grItem.id,
              itemDescription: grItem.itemDescription,
              quantity: Number(grItem.quantityReceived || grItem.quantityExpected || 0),
              unitPrice: String(grItem.unitCost ?? '0'),
              totalPrice: String(grItem.totalCost ?? (Number(grItem.quantityReceived || grItem.quantityExpected || 0) * Number(grItem.unitCost || 0))),
              discountRate: Number(grItem.discountRate) || 0,
              discountAmount: Number(grItem.discountAmount) || 0,
              taxRate: Number(grItem.taxRate) || 0,
              taxAmount: Number(grItem.vatAmount) || 0,
              unitOfMeasure: grItem.unitOfMeasure || 'PCS',
              supplierCode: grItem.supplierCode,
              barcode: grItem.barcode,
              notes: grItem.notes
            }));
          }
        } catch (fallbackErr) {
          console.warn('[PurchaseInvoiceRoutes.GET] Fallback item resolution failed', fallbackErr);
        }
      }
      
      console.log('[PurchaseInvoiceRoutes.GET]', { invoiceId: id, itemsCount: items?.length || 0, hasItems: !!(items && items.length > 0) });
      
      // Calculate financial data from items if not present
      let calculatedSubtotal = 0;
      let calculatedTaxAmount = 0;
      let calculatedTotalAmount = 0;
      let calculatedVatRate = 0;
      
      if (items && items.length > 0) {
        calculatedSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
        calculatedTaxAmount = items.reduce((sum, item) => sum + (parseFloat(item.taxAmount) || 0), 0);
        calculatedTotalAmount = calculatedSubtotal + calculatedTaxAmount;
        
        // Calculate average VAT rate from items
        const itemsWithTax = items.filter(item => parseFloat(item.taxRate || 0) > 0);
        if (itemsWithTax.length > 0) {
          calculatedVatRate = itemsWithTax.reduce((sum, item) => sum + (parseFloat(item.taxRate) || 0), 0) / itemsWithTax.length;
        }
      }
      
      // Return invoice with items and calculated financial data
      // Ensure items array is always present, even if empty
      const response = {
        ...purchaseInvoice,
        items: items || [],
        subtotalBeforeTax: purchaseInvoice.subtotal || calculatedSubtotal.toString(),
        vatAmount: purchaseInvoice.taxAmount || calculatedTaxAmount.toString(),
        vatRate: calculatedVatRate || 0, // Use calculated VAT rate or 0 if no VAT
        totalAmount: purchaseInvoice.totalAmount || calculatedTotalAmount.toString(),
        paidAmount: purchaseInvoice.paidAmount || "0",
        outstandingAmount: purchaseInvoice.remainingAmount || (calculatedTotalAmount - (parseFloat(purchaseInvoice.paidAmount) || 0)).toString(),
        paymentProgress: purchaseInvoice.paidAmount ? 
          Math.round((parseFloat(purchaseInvoice.paidAmount) / parseFloat(purchaseInvoice.totalAmount || calculatedTotalAmount.toString())) * 100) : 0
      };
      
      console.log('[PurchaseInvoiceRoutes.GET][SUCCESS]', { 
        invoiceId: id,
        responseItemsCount: response.items.length 
      });
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching purchase invoice:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoice" });
    }
  });

  // Get purchase invoice items
  app.get("/api/purchase-invoices/:id/items", async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getPurchaseInvoiceItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase invoice items:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoice items" });
    }
  });

  // Get LPO discount and VAT details for purchase invoice generation
  app.get("/api/purchase-invoices/lpo-discount-vat-details/:lpoId", async (req, res) => {
    try {
      const { lpoId } = req.params;
      const lpoDetails = await storage.getLpoDiscountVatDetails(lpoId);
      if (!lpoDetails) {
        return res.status(404).json({ message: "LPO not found" });
      }
      res.json(lpoDetails);
    } catch (error) {
      console.error("Error fetching LPO discount and VAT details:", error);
      res.status(500).json({ message: "Failed to fetch LPO discount and VAT details" });
    }
  });

  // Generate purchase invoice from supplier quote with all item details
  app.post("/api/purchase-invoices/generate-from-supplier-quote", async (req, res) => {
    try {
      const { supplierQuoteId, invoiceData } = req.body;
      
      if (!supplierQuoteId) {
        return res.status(400).json({ message: "Supplier Quote ID is required" });
      }

      // Get supplier quote details with items
      const quote = await SupplierQuoteStorage.getById(supplierQuoteId);
      if (!quote) {
        return res.status(404).json({ message: "Supplier quote not found" });
      }

      const quoteItems = await SupplierQuoteStorage.getItems(supplierQuoteId);
      if (!quoteItems || quoteItems.length === 0) {
        return res.status(404).json({ message: "Supplier quote items not found" });
      }

      // Generate purchase invoice items from supplier quote items with all details
      const purchaseInvoiceItems = quoteItems.map((quoteItem: any) => {
        const qty = Number(quoteItem.quantity) || 0;
        const unitPrice = parseFloat(quoteItem.unitPrice?.toString() || "0") || 0;
        const grossAmount = qty * unitPrice;
        
        // Calculate discount
        const discountPercent = parseFloat(quoteItem.discountPercent?.toString() || "0") || 0;
        const discountAmount = parseFloat(quoteItem.discountAmount?.toString() || "0") || 0;
        const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
        const netAmount = grossAmount - calculatedDiscountAmount;
        
        // Calculate VAT
        const vatPercent = parseFloat(quoteItem.vatPercent?.toString() || "0") || 0;
        const vatAmount = parseFloat(quoteItem.vatAmount?.toString() || "0") || 0;
        const calculatedVatAmount = vatAmount > 0 ? vatAmount : (netAmount * vatPercent / 100);
        const totalAmount = netAmount + calculatedVatAmount;
        
        return {
          itemDescription: quoteItem.itemDescription || "",
          quantity: qty,
          unitPrice: unitPrice.toString(),
          totalPrice: totalAmount.toString(),
          discountRate: discountPercent,
          discountAmount: calculatedDiscountAmount,
          taxRate: vatPercent,
          taxAmount: calculatedVatAmount,
          unitOfMeasure: quoteItem.unitOfMeasure || "PCS",
          notes: (quoteItem.notes || quoteItem.specification || "").toString()
        };
      });

      // Calculate totals
      const subtotal = purchaseInvoiceItems.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const grossAmount = qty * unitPrice;
        const discountAmount = Number(item.discountAmount) || 0;
        return sum + (grossAmount - discountAmount);
      }, 0);

      const totalDiscount = purchaseInvoiceItems.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0);
      const totalTax = purchaseInvoiceItems.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
      const totalAmount = subtotal + totalTax;

      // Create purchase invoice data
      const purchaseInvoiceData = {
        ...invoiceData,
        supplierId: quote.supplierId,
        subtotal: subtotal.toFixed(2),
        discountAmount: totalDiscount.toFixed(2),
        taxAmount: totalTax.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: quote.currency || "BHD",
        paymentTerms: invoiceData.paymentTerms || quote.paymentTerms || "Net 30",
        notes: invoiceData.notes || `Generated from supplier quote ${quote.quoteNumber}. ${quote.notes || ''}`
      };

      // Create the purchase invoice with items
      const purchaseInvoice = await storage.createPurchaseInvoice(purchaseInvoiceData, purchaseInvoiceItems);
      
      res.status(201).json({
        success: true,
        purchaseInvoice,
        message: "Purchase invoice generated successfully from supplier quote with all item details"
      });
    } catch (error) {
      console.error("Error generating purchase invoice from supplier quote:", error);
      res.status(500).json({ message: "Failed to generate purchase invoice from supplier quote", error: error.message });
    }
  });

  // Generate purchase invoice from LPO with discount and VAT details
  app.post("/api/purchase-invoices/generate-from-lpo", async (req, res) => {
    try {
      const { lpoId, invoiceData } = req.body;
      
      if (!lpoId) {
        return res.status(400).json({ message: "LPO ID is required" });
      }

      // Get LPO details with discount and VAT information
      const lpoDetails = await storage.getLpoDiscountVatDetails(lpoId);
      if (!lpoDetails) {
        return res.status(404).json({ message: "LPO not found" });
      }

      // Generate purchase invoice items from LPO items with discount and VAT details
      const purchaseInvoiceItems = lpoDetails.items.map((lpoItem, index) => {
        const qty = Number(lpoItem.quantity) || 0;
        const unitCost = Number(lpoItem.unitCost) || 0;
        const grossAmount = qty * unitCost;
        
        // Calculate discount
        const discountPercent = Number(lpoItem.discountPercent) || 0;
        const discountAmount = Number(lpoItem.discountAmount) || 0;
        const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
        const netAmount = grossAmount - calculatedDiscountAmount;
        
        // Calculate VAT
        const vatPercent = Number(lpoItem.vatPercent) || 0;
        const vatAmount = Number(lpoItem.vatAmount) || 0;
        const calculatedVatAmount = vatAmount > 0 ? vatAmount : (netAmount * vatPercent / 100);
        
        return {
          lpoItemId: lpoItem.id,
          itemDescription: lpoItem.itemDescription,
          quantity: qty,
          unitPrice: unitCost.toString(),
          totalPrice: grossAmount.toString(),
          discountRate: discountPercent,
          discountAmount: calculatedDiscountAmount,
          taxRate: vatPercent,
          taxAmount: calculatedVatAmount,
          supplierCode: lpoItem.supplierCode,
          barcode: lpoItem.barcode,
          unitOfMeasure: "PCS"
        };
      });

      // Calculate totals
      const subtotal = purchaseInvoiceItems.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const grossAmount = qty * unitPrice;
        const discountAmount = Number(item.discountAmount) || 0;
        return sum + (grossAmount - discountAmount);
      }, 0);

      const totalDiscount = purchaseInvoiceItems.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0);
      const totalTax = purchaseInvoiceItems.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
      const totalAmount = subtotal + totalTax;

      // Create purchase invoice data
      const purchaseInvoiceData = {
        ...invoiceData,
        lpoId: lpoId,
        supplierId: lpoDetails.lpo.supplierId,
        subtotal: subtotal.toFixed(2),
        discountAmount: totalDiscount.toFixed(2),
        taxAmount: totalTax.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: lpoDetails.lpo.currency || "USD"
      };

      // Create the purchase invoice with items
      const purchaseInvoice = await storage.createPurchaseInvoice(purchaseInvoiceData, purchaseInvoiceItems);
      
      res.status(201).json({
        success: true,
        purchaseInvoice,
        message: "Purchase invoice generated successfully from LPO with discount and VAT details"
      });
    } catch (error) {
      console.error("Error generating purchase invoice from LPO:", error);
      res.status(500).json({ message: "Failed to generate purchase invoice from LPO" });
    }
  });

  // Update purchase invoice
  app.patch("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.updatePurchaseInvoice(id, req.body);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error updating purchase invoice:", error);
      res.status(400).json({ message: "Failed to update purchase invoice", error: error.message });
    }
  });

  // Update purchase invoice status
  app.patch("/api/purchase-invoices/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      // Validate status
      const validStatuses = ["Draft", "Pending Approval", "Approved", "Overdue", "Discrepancy"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: "Invalid status", 
          validStatuses: validStatuses 
        });
      }

      const purchaseInvoice = await storage.updatePurchaseInvoice(id, { status });
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error updating purchase invoice status:", error);
      res.status(400).json({ message: "Failed to update purchase invoice status", error: error.message });
    }
  });

  // Update purchase invoice payment status
  app.patch("/api/purchase-invoices/:id/payment-status", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;
      
      // Validate payment status
      const validPaymentStatuses = ["Unpaid", "Partially Paid", "Paid", "Overdue"];
      if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({ 
          message: "Invalid payment status", 
          validPaymentStatuses: validPaymentStatuses 
        });
      }

      const purchaseInvoice = await storage.updatePurchaseInvoice(id, { paymentStatus });
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error updating purchase invoice payment status:", error);
      res.status(400).json({ message: "Failed to update purchase invoice payment status", error: error.message });
    }
  });

  // Record payment for purchase invoice
  app.post("/api/purchase-invoices/:id/payment", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, method, reference, paymentDate } = req.body;

      // Validate required fields
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Payment amount must be greater than zero" });
      }

      // Get current invoice
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }

      // Calculate new paid amount
      const currentPaid = parseFloat(purchaseInvoice.paidAmount || "0");
      const totalAmount = parseFloat(purchaseInvoice.totalAmount || "0");
      const paymentAmount = parseFloat(amount);
      const newPaidAmount = currentPaid + paymentAmount;

      // Validate payment doesn't exceed total amount
      if (newPaidAmount > totalAmount) {
        return res.status(400).json({ message: "Payment amount exceeds total invoice amount" });
      }

      // Determine payment status
      let paymentStatus = "Partially Paid";
      if (newPaidAmount >= totalAmount) {
        paymentStatus = "Paid";
      }

      // Update invoice with payment information
      const updatedData: any = {
        paidAmount: newPaidAmount.toFixed(2),
        remainingAmount: (totalAmount - newPaidAmount).toFixed(2),
        paymentStatus: paymentStatus
      };

      // Add payment date if provided
      if (paymentDate) {
        updatedData.paymentDate = paymentDate;
      }

      // Add payment method and reference if provided
      if (method) {
        updatedData.paymentMethod = method;
      }
      if (reference) {
        updatedData.bankReference = reference;
      }

      const updatedInvoice = await storage.updatePurchaseInvoice(id, updatedData);

      if (!updatedInvoice) {
        return res.status(404).json({ message: "Failed to update purchase invoice" });
      }

      res.json({
        success: true,
        message: "Payment recorded successfully",
        purchaseInvoice: updatedInvoice
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ message: "Failed to record payment", error: error.message });
    }
  });

  // Delete purchase invoice
  app.delete("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePurchaseInvoice(id);
      if (!deleted) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json({ message: "Purchase invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting purchase invoice:", error);
      res.status(500).json({ message: "Failed to delete purchase invoice", error: error.message });
    }
  });

  // Generate PDF for purchase invoice
  app.get("/api/purchase-invoices/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      const { mode = 'enhanced' } = req.query;
      
      // Get purchase invoice
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }

      // Get purchase invoice items with discount and VAT data
      let invoiceItems = [] as any[];
      try {
        // First try to get purchase invoice items
        invoiceItems = await storage.getPurchaseInvoiceItems(id);
        console.log('[PURCHASE INVOICE PDF] Fetched invoice items:', invoiceItems.length);
      } catch (error) {
        console.warn("Could not fetch purchase invoice items:", error);
      }

      // If items are missing/empty, apply explicit fallbacks (LPO → GR)
      if (!invoiceItems || invoiceItems.length === 0) {
        if (purchaseInvoice.lpoId) {
          try {
            console.log('[PURCHASE INVOICE PDF] Fetching LPO items for discount/VAT data...');
            const lpoItems = await storage.getSupplierLpoItems(purchaseInvoice.lpoId);
            invoiceItems = (lpoItems || []).map((lpoItem: any) => ({
              id: lpoItem.id,
              itemDescription: lpoItem.itemDescription,
              quantity: lpoItem.quantity || 0,
              unitPrice: lpoItem.unitCost || '0',
              totalPrice: lpoItem.totalCost || '0',
              discountRate: lpoItem.discountPercent || 0,
              discountAmount: lpoItem.discountAmount || 0,
              taxRate: lpoItem.vatPercent || 0,
              taxAmount: lpoItem.vatAmount || 0,
              unitOfMeasure: lpoItem.unitOfMeasure || 'PCS',
              barcode: lpoItem.barcode,
              supplierCode: lpoItem.supplierCode,
              notes: lpoItem.specialInstructions
            }));
            console.log('[PURCHASE INVOICE PDF] Mapped LPO items with discount/VAT data:', invoiceItems.length);
          } catch (lpoError) {
            console.warn("Could not fetch LPO items:", lpoError);
          }
        }
      }

      if ((!invoiceItems || invoiceItems.length === 0) && purchaseInvoice.goodsReceiptId) {
        try {
          const grItems = await storage.getGoodsReceiptItems(purchaseInvoice.goodsReceiptId);
          invoiceItems = (grItems || []).map((grItem: any) => ({
            id: grItem.id,
            itemDescription: grItem.itemDescription,
            quantity: grItem.quantityReceived || grItem.quantityExpected || 0,
            unitPrice: grItem.unitCost || '0',
            totalPrice: grItem.totalCost || '0',
            taxRate: grItem.taxRate || '0',
            discountRate: grItem.discountRate || '0',
            discountAmount: grItem.discountAmount || '0',
            unitOfMeasure: grItem.unitOfMeasure || 'PCS',
            barcode: grItem.barcode,
            supplierCode: grItem.supplierCode,
            notes: grItem.notes
          }));
          console.log('[PURCHASE INVOICE PDF] Mapped goods receipt items:', invoiceItems.length);
        } catch (grError) {
          console.warn("Could not fetch goods receipt items as fallback:", grError);
        }
      }

      // Get supplier information
      let supplier = {};
      if (purchaseInvoice.supplierId) {
        try {
          supplier = await storage.getSupplier(purchaseInvoice.supplierId) || {};
        } catch (error) {
          console.warn("Could not fetch supplier information:", error);
        }
      }

      // Generate PDF
      const pdfResult = generatePurchaseInvoicePdf({
        invoice: purchaseInvoice,
        items: invoiceItems,
        supplier: supplier,
        mode: mode as 'enhanced' | 'simple'
      });

      // Set response headers
      res.setHeader('Content-Type', pdfResult.contentType);
      res.setHeader('Content-Length', pdfResult.byteLength);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.fileName}"`);
      
      // Send PDF buffer
      res.send(pdfResult.buffer);
    } catch (error) {
      console.error("Error generating purchase invoice PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF", error: error.message });
    }
  });

  // Fetch Purchase Invoice PDF table data (for testing/validation)
  app.get("/api/purchase-invoices/:id/pdf-table-data", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ success: false, message: "Purchase invoice not found", purchaseInvoiceId: id });
      }

      // Resolve items with discount/VAT similar to PDF generation route
      let items: any[] = [];
      try {
        items = await storage.getPurchaseInvoiceItems(id);
      } catch (error) {
        // ignore; we'll apply explicit fallbacks
      }
      if (!items || items.length === 0) {
        if (purchaseInvoice.lpoId) {
          try {
            const lpoItems = await storage.getSupplierLpoItems(purchaseInvoice.lpoId);
            items = (lpoItems || []).map((lpoItem: any) => ({
              itemDescription: lpoItem.itemDescription,
              quantity: lpoItem.quantity || 0,
              unitPrice: lpoItem.unitCost || '0',
              discountRate: lpoItem.discountPercent || 0,
              discountAmount: lpoItem.discountAmount || 0,
              taxRate: lpoItem.vatPercent || 0,
              taxAmount: lpoItem.vatAmount || 0,
              unitOfMeasure: lpoItem.unitOfMeasure || 'PCS',
              notes: lpoItem.specialInstructions
            }));
          } catch {}
        }
      }
      if ((!items || items.length === 0) && purchaseInvoice.goodsReceiptId) {
        try {
          const grItems = await storage.getGoodsReceiptItems(purchaseInvoice.goodsReceiptId);
          items = (grItems || []).map((grItem: any) => ({
            itemDescription: grItem.itemDescription,
            quantity: grItem.quantityReceived || grItem.quantityExpected || 0,
            unitPrice: grItem.unitCost || '0',
            discountRate: grItem.discountRate || 0,
            discountAmount: grItem.discountAmount || 0,
            taxRate: grItem.taxRate || 0,
            taxAmount: grItem.vatAmount || 0,
            unitOfMeasure: grItem.unitOfMeasure || 'PCS',
            notes: grItem.notes
          }));
        } catch {}
      }

      const currency = purchaseInvoice.currency || 'BHD';
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

      const tableData = items.map((it: any, idx: number) => {
        const qty = toNumber(it.quantity, 0);
        const unit = toNumber(it.unitPrice || it.price || 0, 0);
        const gross = qty * unit;

        const discPerc = toNumber(it.discountRate || it.discountPercent || it.discountPercentage, 0);
        const discAmtRaw = toNumber(it.discountAmount, 0);
        const discountAmount = discAmtRaw > 0 ? discAmtRaw : (gross * discPerc / 100);

        const vatPerc = toNumber(it.taxRate || it.vatPercent || it.vatPercentage, 0);
        const vatAmtRaw = toNumber(it.taxAmount || it.vatAmount, 0);
        const net = gross - discountAmount;
        const vatAmount = vatAmtRaw > 0 ? vatAmtRaw : (net * vatPerc / 100);

        return {
          serialNumber: idx + 1,
          itemDescription: it.itemDescription || it.description || 'Item',
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
      items.forEach((it: any) => {
        const qty = toNumber(it.quantity, 0);
        const unit = toNumber(it.unitPrice || it.price || 0, 0);
        const gross = qty * unit;
        const discPerc = toNumber(it.discountRate || it.discountPercent || it.discountPercentage, 0);
        const discAmtRaw = toNumber(it.discountAmount, 0);
        const discountAmount = discAmtRaw > 0 ? discAmtRaw : (gross * discPerc / 100);
        const vatPerc = toNumber(it.taxRate || it.vatPercent || it.vatPercentage, 0);
        const vatAmtRaw = toNumber(it.taxAmount || it.vatAmount, 0);
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
        purchaseInvoiceId: id,
        invoiceNumber: purchaseInvoice.invoiceNumber || id,
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
      console.error("[PURCHASE-INVOICE:PDF-TABLE] Error:", error);
      res.status(500).json({ success: false, message: "Failed to build PDF table data", error: error.message });
    }
  });

  // Test endpoint to create a purchase invoice with comprehensive sample data
  app.post("/api/purchase-invoices/test-sample", async (req, res) => {
    try {
      const sampleInvoiceData = {
        invoiceNumber: `PI-TEST-${Date.now()}`,
        supplierInvoiceNumber: `SUP-TEST-${Date.now()}`,
        supplierId: "98392c6b-bb4f-4686-886a-60eb0b1abd16", // Valid supplier ID from database
        goodsReceiptId: null, // Make goods receipt optional for testing
        status: "Draft",
        paymentStatus: "Unpaid",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: "1500.00",
        taxAmount: "150.00",
        discountAmount: "0.00",
        totalAmount: "1650.00",
        paidAmount: "0.00",
        remainingAmount: "1650.00",
        currency: "BHD",
        paymentTerms: "Net 30",
        notes: "Test purchase invoice with comprehensive sample data",
        attachments: [],
        isRecurring: false
      };

      const sampleItems = [
        {
          itemDescription: "Test Item 1 - High Quality Widget",
          quantity: 10,
          unitPrice: "50.00",
          totalPrice: "500.00",
          unitOfMeasure: "PCS",
          taxRate: "10.00",
          taxAmount: "50.00",
          discountRate: "0.00",
          discountAmount: "0.00",
          supplierCode: "WGT-001",
          barcode: "1234567890123"
        },
        {
          itemDescription: "Test Item 2 - Premium Component",
          quantity: 5,
          unitPrice: "100.00",
          totalPrice: "500.00",
          unitOfMeasure: "EA",
          taxRate: "10.00",
          taxAmount: "50.00",
          discountRate: "5.00",
          discountAmount: "25.00",
          supplierCode: "PRC-002",
          barcode: "1234567890124"
        },
        {
          itemDescription: "Test Item 3 - Standard Part",
          quantity: 20,
          unitPrice: "25.00",
          totalPrice: "500.00",
          unitOfMeasure: "PCS",
          taxRate: "10.00",
          taxAmount: "50.00",
          discountRate: "0.00",
          discountAmount: "0.00",
          supplierCode: "STP-003",
          barcode: "1234567890125"
        }
      ];

      const purchaseInvoice = await storage.createPurchaseInvoice(sampleInvoiceData, sampleItems);
      res.status(201).json(purchaseInvoice);
    } catch (error) {
      console.error("Error creating test purchase invoice:", error);
      res.status(500).json({ message: "Failed to create test purchase invoice", error: error.message });
    }
  });

  // Test endpoint to fetch purchase invoice data with all required fields
  app.get("/api/purchase-invoices/:id/test-data", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get purchase invoice
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }

      // Get purchase invoice items with all fields
      const invoiceItems = await storage.getPurchaseInvoiceItems(id);
      
      // Get supplier information
      const supplier = await storage.getSupplier(purchaseInvoice.supplierId);
      
      // Format the data with all required fields for PDF
      const formattedData = {
        invoice: purchaseInvoice,
        items: invoiceItems.map(item => ({
          // Required fields for PDF table
          itemDescription: item.itemDescription || 'N/A',
          quantity: item.quantity || 0,
          unitCost: parseFloat(item.unitPrice || '0'),
          discountPercent: parseFloat(item.discountRate || '0'),
          discountAmount: parseFloat(item.discountAmount || '0'),
          vatPercent: parseFloat(item.taxRate || '0'),
          vatAmount: parseFloat(item.taxAmount || '0'),
          totalAmount: parseFloat(item.totalPrice || '0'),
          // Additional fields
          unitOfMeasure: item.unitOfMeasure || 'PCS',
          supplierCode: item.supplierCode || '',
          barcode: item.barcode || '',
          notes: item.notes || ''
        })),
        supplier: supplier
      };

      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching purchase invoice test data:", error);
      res.status(500).json({ message: "Failed to fetch test data", error: error.message });
    }
  });

  // Test endpoint to generate PDF and return data summary
  app.get("/api/purchase-invoices/:id/test-pdf", async (req, res) => {
    try {
      const { id } = req.params;
      const { mode = 'enhanced' } = req.query;
      
      // Get purchase invoice
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }

      // Get purchase invoice items
      const invoiceItems = await storage.getPurchaseInvoiceItems(id);
      
      // Get supplier information
      const supplier = await storage.getSupplier(purchaseInvoice.supplierId);
      
      // Generate PDF
      const pdfResult = generatePurchaseInvoicePdf({
        invoice: purchaseInvoice,
        items: invoiceItems,
        supplier: supplier,
        mode: mode as 'enhanced' | 'simple'
      });

      // Return summary data instead of PDF for testing
      const summary = {
        invoiceNumber: purchaseInvoice.invoiceNumber,
        supplierName: supplier?.name || 'Unknown Supplier',
        totalItems: invoiceItems.length,
        items: invoiceItems.map(item => ({
          description: item.itemDescription,
          quantity: item.quantity,
          unitCost: parseFloat(item.unitPrice || '0'),
          discountPercent: parseFloat(item.discountRate || '0'),
          discountAmount: parseFloat(item.discountAmount || '0'),
          vatPercent: parseFloat(item.taxRate || '0'),
          vatAmount: parseFloat(item.taxAmount || '0'),
          totalAmount: parseFloat(item.totalPrice || '0')
        })),
        totals: {
          subtotal: parseFloat(purchaseInvoice.subtotal || '0'),
          discountAmount: parseFloat(purchaseInvoice.discountAmount || '0'),
          taxAmount: parseFloat(purchaseInvoice.taxAmount || '0'),
          totalAmount: parseFloat(purchaseInvoice.totalAmount || '0')
        },
        pdfGenerated: true,
        pdfSize: pdfResult.byteLength,
        pdfFileName: pdfResult.fileName
      };

      res.json(summary);
    } catch (error) {
      console.error("Error testing purchase invoice PDF:", error);
      res.status(500).json({ message: "Failed to test PDF generation", error: error.message });
    }
  });
}

export default registerPurchaseInvoiceRoutes;
