import type { Express } from "express";
import { storage } from "../storage";
import { insertCarrierSchema } from "@shared/schema";
import { z } from "zod";

export function registerCarrierRoutes(app: Express) {
  // Get all carriers
  app.get("/api/carriers", async (req, res) => {
    try {
      const carriers = await storage.getCarriers();
      res.json(carriers);
    } catch (error) {
      console.error("Error fetching carriers:", error);
      res.status(500).json({ message: "Failed to fetch carriers" });
    }
  });

  // Get single carrier
  app.get("/api/carriers/:id", async (req, res) => {
    try {
      const carrier = await storage.getCarrier(req.params.id);
      if (!carrier) {
        return res.status(404).json({ message: "Carrier not found" });
      }
      res.json(carrier);
    } catch (error) {
      console.error("Error fetching carrier:", error);
      res.status(500).json({ message: "Failed to fetch carrier" });
    }
  });

  // Create carrier
  app.post("/api/carriers", async (req, res) => {
    try {
      const carrierData = insertCarrierSchema.parse(req.body);
      const carrier = await storage.createCarrier(carrierData);
      res.status(201).json(carrier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid carrier data", errors: error.errors });
      }
      const pgError = error as { code?: string; detail?: string };
      // Handle unique constraint violation from Postgres
      if (pgError?.code === '23505') {
        return res.status(409).json({ message: "Carrier code already exists" });
      }
      console.error("Error creating carrier:", error);
      res.status(500).json({ message: "Failed to create carrier" });
    }
  });

  // Update carrier
  app.put("/api/carriers/:id", async (req, res) => {
    try {
      const carrierData = insertCarrierSchema.partial().parse(req.body);
      const carrier = await storage.updateCarrier(req.params.id, carrierData);
      res.json(carrier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid carrier data", errors: error.errors });
      }
      console.error("Error updating carrier:", error);
      res.status(500).json({ message: "Failed to update carrier" });
    }
  });

  // Delete carrier (soft delete)
  app.delete("/api/carriers/:id", async (req, res) => {
    try {
      await storage.deleteCarrier(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting carrier:", error);
      res.status(500).json({ message: "Failed to delete carrier" });
    }
  });

  // Get carrier details (enhanced with stats and activities)
  app.get("/api/carriers/:id/details", async (req, res) => {
    try {
      const details = await storage.getCarrierDetails(req.params.id);
      if (!details) {
        return res.status(404).json({ message: "Carrier not found" });
      }
      res.json(details);
    } catch (error) {
      console.error("Error fetching carrier details:", error);
      res.status(500).json({ message: "Failed to fetch carrier details" });
    }
  });

  // Get carrier shipments with pagination
  app.get("/api/carriers/:id/shipments", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const shipments = await storage.getCarrierShipments(req.params.id, page, limit);
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching carrier shipments:", error);
      res.status(500).json({ message: "Failed to fetch carrier shipments" });
    }
  });

  // Get carrier performance metrics
  app.get("/api/carriers/:id/performance", async (req, res) => {
    try {
      const metrics = await storage.getCarrierPerformanceMetrics(req.params.id);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching carrier performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch carrier performance metrics" });
    }
  });
}

