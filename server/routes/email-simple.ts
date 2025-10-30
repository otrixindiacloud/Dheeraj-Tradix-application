import { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { generateInvoicePdf, generateQuotationPdf } from '../pdf/pdf-utils';

export function registerEmailRoutes(app: Express) {
  console.log("[EMAIL ROUTES] Registering email routes...");

  // Send invoice via email
  app.post("/api/email/invoice/:id", async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const { email, customMessage } = req.body;

      console.log(`Preparing invoice ${invoiceId} for email...`);

      // Get invoice data
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get customer information
      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Generate PDF
      const invoiceItems = await storage.getInvoiceItems(invoiceId);
      const enhancedItems = await Promise.all(
        invoiceItems.map(async (invoiceItem) => {
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

      const pdfResult = generateInvoicePdf({
        invoice: invoice as any,
        items: enhancedItems as any,
        customer: customer as any,
        mode: 'enhanced'
      });

      // Generate a temporary download URL for the PDF
      const pdfBase64 = pdfResult.buffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      // Update invoice status to sent
      await storage.updateInvoice(invoiceId, { status: 'Sent' } as any);

      res.json({
        success: true,
        message: 'Invoice prepared for email sending',
        data: {
          invoiceId,
          customerEmail: customer.email || email,
          customerName: customer.name,
          documentNumber: invoice.invoiceNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing invoice for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare invoice for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send quotation via email
  app.post("/api/email/quotation/:id", async (req, res) => {
    try {
      const quotationId = req.params.id;
      const { email, customMessage } = req.body;

      console.log(`Preparing quotation ${quotationId} for email...`);

      // Get quotation data
      const quotation = await storage.getQuotation(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get customer information
      const customer = await storage.getCustomer(quotation.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Generate PDF
      const items = await storage.getQuotationItems(quotationId);
      const pdfResult = generateQuotationPdf({ 
        quotation: quotation as any, 
        items: items as any, 
        customer: customer as any 
      });

      // Generate a temporary download URL for the PDF
      const pdfBase64 = pdfResult.buffer.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

      res.json({
        success: true,
        message: 'Quotation prepared for email sending',
        data: {
          quotationId,
          customerEmail: customer.email || email,
          customerName: customer.name,
          documentNumber: quotation.quoteNumber,
          pdfDataUrl,
          customMessage: customMessage || null
        }
      });
    } catch (error) {
      console.error("Error preparing quotation for email:", error);
      res.status(500).json({ 
        message: "Failed to prepare quotation for email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Health check endpoint
  app.get("/api/email/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Email service is running",
      timestamp: new Date().toISOString()
    });
  });
}
