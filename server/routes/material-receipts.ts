import { Router } from "express";
import { MaterialReceiptsStorage } from "../storage/material-receipts-storage";
import { ZodError } from "zod";

const router = Router();
const storage = new MaterialReceiptsStorage();

/**
 * GET /api/material-receipts
 * Get all material receipts
 */
router.get("/", async (req, res) => {
  try {
    console.log('[MATERIAL RECEIPTS API] GET /api/material-receipts');
    const receipts = await storage.getAllMaterialReceipts();
    res.json(receipts);
  } catch (err) {
    console.error('[MATERIAL RECEIPTS API] Error fetching receipts:', err);
    res.status(500).json({ 
      message: "Failed to fetch material receipts",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

/**
 * POST /api/material-receipts
 * Create a new material receipt with items
 */
router.post("/", async (req, res) => {
  try {
    console.log('[MATERIAL RECEIPTS API] POST /api/material-receipts');
    console.log('[MATERIAL RECEIPTS API] Request body:', JSON.stringify(req.body, null, 2));
    
    const result = await storage.createMaterialReceipt(req.body);
    
    console.log('[MATERIAL RECEIPTS API] Material receipt created successfully');
    res.status(201).json({
      success: true,
      message: "Material receipt created successfully",
      data: result
    });
  } catch (err) {
    console.error('[MATERIAL RECEIPTS API] Error creating material receipt:', err);
    
    if (err instanceof ZodError) {
      return res.status(400).json({ 
        success: false,
        message: "Validation error", 
        errors: err.errors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to create material receipt", 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

/**
 * GET /api/material-receipts/:id
 * Get a single material receipt by ID
 */
router.get("/:id", async (req, res) => {
  try {
    console.log('[MATERIAL RECEIPTS API] GET /api/material-receipts/:id', req.params.id);
    const receipt = await storage.getMaterialReceiptById(req.params.id);
    
    if (!receipt) {
      return res.status(404).json({ 
        success: false,
        message: "Material receipt not found" 
      });
    }
    
    res.json({
      success: true,
      data: receipt
    });
  } catch (err) {
    console.error('[MATERIAL RECEIPTS API] Error fetching material receipt:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch material receipt", 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

/**
 * GET /api/material-receipts/number/:receiptNumber
 * Get a single material receipt by receipt number
 */
router.get("/number/:receiptNumber", async (req, res) => {
  try {
    console.log('[MATERIAL RECEIPTS API] GET /api/material-receipts/number/:receiptNumber', req.params.receiptNumber);
    const receipt = await storage.getMaterialReceiptByNumber(req.params.receiptNumber);
    
    if (!receipt) {
      return res.status(404).json({ 
        success: false,
        message: "Material receipt not found" 
      });
    }
    
    res.json({
      success: true,
      data: receipt
    });
  } catch (err) {
    console.error('[MATERIAL RECEIPTS API] Error fetching material receipt:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch material receipt", 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

/**
 * PUT /api/material-receipts/:id
 * Update a material receipt
 */
router.put("/:id", async (req, res) => {
  try {
    console.log('[MATERIAL RECEIPTS API] PUT /api/material-receipts/:id', req.params.id);
    console.log('[MATERIAL RECEIPTS API] Update data:', JSON.stringify(req.body, null, 2));
    
    const updated = await storage.updateMaterialReceipt(req.params.id, req.body);
    
    if (!updated) {
      return res.status(404).json({ 
        success: false,
        message: "Material receipt not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Material receipt updated successfully",
      data: updated
    });
  } catch (err) {
    console.error('[MATERIAL RECEIPTS API] Error updating material receipt:', err);
    
    if (err instanceof ZodError) {
      return res.status(400).json({ 
        success: false,
        message: "Validation error", 
        errors: err.errors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to update material receipt", 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

/**
 * DELETE /api/material-receipts/:id
 * Delete a material receipt
 */
router.delete("/:id", async (req, res) => {
  try {
    console.log('[MATERIAL RECEIPTS API] DELETE /api/material-receipts/:id', req.params.id);
    
    await storage.deleteMaterialReceipt(req.params.id);
    
    res.json({
      success: true,
      message: "Material receipt deleted successfully"
    });
  } catch (err) {
    console.error('[MATERIAL RECEIPTS API] Error deleting material receipt:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to delete material receipt", 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

export default router;
