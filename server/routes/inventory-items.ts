import { Router } from "express";
import { InventoryItemsStorage } from "../storage/inventory-items-storage";
import { InventoryStorage } from "../storage/inventory-storage";
import { z } from "zod";
import { insertInventoryItemSchema } from "@shared/schema";

const router = Router();
const storage = new InventoryItemsStorage();
const inventoryStorage = new InventoryStorage();

// GET /api/inventory-items
router.get("/", async (req, res) => {
  try {
    const items = await storage.getAllItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch inventory items" });
  }
});

// GET /api/inventory-items/:id
router.get("/:id", async (req, res) => {
  try {
    const item = await storage.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch inventory item" });
  }
});

// POST /api/inventory-items
router.post("/", async (req, res) => {
  try {
    // Normalize payload: convert empty strings to undefined and coerce types
    const raw = req.body || {};
    const normalized = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => {
        if (value === "") return [key, undefined];
        if (key === "weight" && typeof value === "number") return [key, String(value)];
        return [key, value];
      })
    );

    const parsed = insertInventoryItemSchema.parse(normalized);
    const item = await storage.createItem(parsed);
    res.status(201).json(item);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid inventory item data", errors: err.errors });
    }
    // Handle unique constraint error (e.g., supplier_code already exists)
    if (err?.code === "23505") {
      try {
        const supplierCode: string | undefined = req.body?.supplierCode;
        if (supplierCode) {
          // Return the existing item instead of failing the request
          const existing = await inventoryStorage.getInventoryItemBySupplierCode(supplierCode);
          if (existing) {
            return res.status(200).json(existing);
          }
        }
        // Fallback: treat as conflict but with a friendlier 200 + echo payload
        return res.status(200).json({ message: "Item with this supplier code already exists" });
      } catch (lookupErr) {
        // If lookup fails for any reason, respond with conflict to avoid masking other issues
        return res.status(409).json({ message: "Supplier code already exists" });
      }
    }
    console.error("Error creating inventory item:", err);
    res.status(500).json({ message: "Failed to create item" });
  }
});

// PUT /api/inventory-items/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await storage.updateItem(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update item" });
  }
});

export default router;
