import type { Express } from "express";
import { storage } from "../storage";
import { generateReceiptPdf } from "../pdf/pdf-utils";
import { sendPdf } from "../utils/pdf-response";

export function registerReceiptRoutes(app: Express) {
  // Generate PDF for receipt
  app.get("/api/receipts/:id/pdf", async (req, res) => {
    try {
      const receiptId = req.params.id;
      
      // Get receipt with items and customer
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        console.error(`Receipt not found: ${receiptId}`);
        return res.status(404).json({ message: "Receipt not found" });
      }

      const items = await storage.getReceiptItems(receiptId);
      const customer = await storage.getCustomer(receipt.customerId);
      if (!customer) {
        console.error(`Customer not found for receipt: ${receiptId}, customerId: ${receipt.customerId}`);
        return res.status(404).json({ message: "Customer not found" });
      }

      console.log(`Generating PDF for receipt: ${receiptId}, items count: ${items.length}`);
      const result = generateReceiptPdf({ 
        receipt: receipt as any, 
        items: items as any, 
        customer: customer as any,
        mode: 'enhanced'
      });
      sendPdf(res, result);
    } catch (error) {
      console.error("Error generating receipt PDF:", error);
      res.status(500).json({ 
        message: "Failed to generate receipt PDF", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Create receipt
  app.post("/api/receipts", async (req, res) => {
    try {
      const receiptData = req.body;
      const receipt = await storage.createReceipt(receiptData);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      res.status(500).json({ 
        message: "Failed to create receipt", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get receipt by ID
  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error fetching receipt:", error);
      res.status(500).json({ message: "Failed to fetch receipt" });
    }
  });

  // Get receipt items
  app.get("/api/receipts/:id/items", async (req, res) => {
    try {
      const items = await storage.getReceiptItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching receipt items:", error);
      res.status(500).json({ message: "Failed to fetch receipt items" });
    }
  });

  // List receipts
  app.get("/api/receipts", async (req, res) => {
    try {
      const receipts = await storage.getReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  // Update receipt
  app.put("/api/receipts/:id", async (req, res) => {
    try {
      const receipt = await storage.updateReceipt(req.params.id, req.body);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error updating receipt:", error);
      res.status(500).json({ message: "Failed to update receipt" });
    }
  });

  // Delete receipt
  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      await storage.deleteReceipt(req.params.id);
      res.json({ message: "Receipt deleted successfully" });
    } catch (error) {
      console.error("Error deleting receipt:", error);
      res.status(500).json({ message: "Failed to delete receipt" });
    }
  });
}