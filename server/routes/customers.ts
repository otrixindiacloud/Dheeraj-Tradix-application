import type { Express } from "express";
import { storage } from "../storage";
import { insertCustomerSchema } from "@shared/schema";
import { z } from "zod";

export function registerCustomerRoutes(app: Express) {
  // Customer routes
  app.get("/api/customers", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const page = Math.floor(offset / limit) + 1;
      
      // Extract filter parameters
      const filters = {
        customerType: req.query.customerType as string,
        classification: req.query.classification as string,
        isActive: req.query.isActive as string,
        search: req.query.search as string,
        // Legacy support for name/email search
        name: req.query.name as string,
        email: req.query.email as string
      };
      
      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });
      
      
      let customers;
      let totalCount;
      
      // Check if using legacy name/email search
      if (filters.name || filters.email) {
        customers = await (storage as any).searchCustomers({ name: filters.name, email: filters.email }, limit, offset);
        // For legacy search, we'll use the stats total (not ideal but maintains compatibility)
        const stats = await (storage as any).getCustomerStats();
        totalCount = stats.totalCustomers;
      } else {
        // Use new filter system
        customers = await (storage as any).getCustomers(limit, offset, filters);
        totalCount = await (storage as any).getCustomersCount(filters);
      }
      
      const pagination = {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      };
      
      res.json({
        customers,
        pagination
      });
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/stats", async (req, res) => {
    try {
      const stats = await (storage as any).getCustomerStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching customer stats:", error);
      res.status(500).json({ message: "Failed to fetch customer statistics" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers/:id/details", async (req, res) => {
    try {
      const customerDetails = await (storage as any).getCustomerDetails(req.params.id);
      if (!customerDetails) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customerDetails);
    } catch (error) {
      console.error("Error fetching customer details:", error);
      res.status(500).json({ message: "Failed to fetch customer details" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      console.log("Creating customer with data:", JSON.stringify(req.body, null, 2));
      
      const customerData = insertCustomerSchema.parse(req.body);
      console.log("Parsed customer data:", JSON.stringify(customerData, null, 2));
      
      const customer = await storage.createCustomer(customerData);
      console.log("Customer created successfully:", customer.id);
      
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      
      if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Invalid customer data", 
          errors: error.errors,
          details: "Validation failed for the following fields"
        });
      }
      
      // Handle duplicate constraint violations
      if (error instanceof Error && error.message.includes("already exists")) {
        console.error("Duplicate customer error:", error.message);
        return res.status(409).json({ 
          message: "Duplicate customer", 
          error: error.message,
          details: "A customer with this name or email already exists"
        });
      }
      
      // Handle database constraint violations
      if (error instanceof Error && error.message.includes("duplicate key")) {
        console.error("Database constraint violation:", error.message);
        return res.status(409).json({ 
          message: "Duplicate customer", 
          error: "A customer with this name or email already exists",
          details: error.message
        });
      }
      
      console.error("Unexpected error creating customer:", error);
      res.status(500).json({ 
        message: "Failed to create customer",
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Check server logs for more information"
      });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, customerData);
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      
      // Handle duplicate constraint violations
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(409).json({ 
          message: "Duplicate customer", 
          error: error.message 
        });
      }
      
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });
}
