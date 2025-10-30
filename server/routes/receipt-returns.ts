import { Router } from "express";
import { ReceiptReturnsStorage } from "../storage/receipt-returns-storage";

const router = Router();
const storage = new ReceiptReturnsStorage();

// GET /api/receipt-returns
router.get("/", async (req, res) => {
  try {
    const returns = await storage.getAllReturns();
    res.json({ 
      success: true, 
      data: returns 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch receipt returns" 
    });
  }
});

// GET /api/receipt-returns/:id
router.get("/:id", async (req, res) => {
  try {
    const returnItem = await storage.getReturnById(req.params.id);
    if (!returnItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Return not found" 
      });
    }
    res.json({ 
      success: true, 
      data: returnItem 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch return" 
    });
  }
});

// POST /api/receipt-returns
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    console.log('Creating receipt return with data:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    const missing = ["returnNumber", "returnReason", "returnDate"].filter(k => !body[k]);
    if (missing.length) {
      return res.status(400).json({ 
        success: false,
        message: `Missing required fields: ${missing.join(", ")}` 
      });
    }

    // Prepare header data for receipt_returns table
    const headerPayload: any = {
      returnNumber: body.returnNumber,
      goodsReceiptId: body.goodsReceiptId || null,
      supplierId: body.supplierId || null,
      returnDate: new Date(body.returnDate),
      returnReason: body.returnReason,
      status: body.status || "Draft",
      totalValue: body.totalValue || body.totalReturnValue || "0",
      notes: body.notes || null,
      receiptNumber: body.receiptNumber || null,
      receiptDate: body.receiptDate ? new Date(body.receiptDate) : null,
      receivedBy: body.receivedBy || null,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      actualDate: body.actualDate ? new Date(body.actualDate) : null,
      itemsExpected: body.itemsExpected || null,
      itemsReceived: body.itemsReceived || null,
      discrepancy: body.discrepancy || null,
      supplierName: body.supplierName || null,
      supplierAddress: body.supplierAddress || null,
      supplierContactPerson: body.supplierContactPerson || null,
      supplierLpoNumber: body.supplierLpoNumber || null,
      customerLpoNumber: body.customerLpoNumber || null,
      supplierIdDisplay: body.supplierIdDisplay || null
    };

    console.log('Creating return header:', headerPayload);
    
    // Create the return header
    const returnHeader = await storage.createReturn(headerPayload);
    console.log('Return header created with ID:', returnHeader.id);
    
    // Create return items if provided
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      console.log('Creating return items:', body.items.length);
      
      let totalValue = 0;
      for (const item of body.items) {
        const itemPayload = {
          receiptReturnId: returnHeader.id,
          itemId: item.itemId || null,
          itemDescription: item.itemDescription || '',
          quantityReturned: parseInt(item.quantityReturned) || 0,
          unitCost: parseFloat(item.unitCost) || 0,
          totalCost: parseFloat(item.totalCost) || 0,
          returnReason: item.returnReason || '',
          conditionNotes: item.conditionNotes || null,
          serialNo: item.serialNo || null
        };
        
        console.log('Creating item:', itemPayload);
        await storage.createReturnItem(itemPayload);
        totalValue += itemPayload.totalCost;
      }
      
      // Update total value
      if (totalValue > 0) {
        await storage.updateReturn(returnHeader.id, { 
          totalValue: totalValue.toString() 
        });
      }
    }
    
    // Fetch the complete return with items
    const completeReturn = await storage.getReturnById(returnHeader.id);
    
    res.json({
      success: true,
      data: completeReturn,
      returnId: returnHeader.id
    });
  } catch (err: any) {
    console.error("Failed to create return:", err?.code, err?.message, err);
    if (err?.code === "23505") { // unique_violation
      return res.status(400).json({ 
        success: false,
        message: "Return number already exists" 
      });
    }
    res.status(500).json({ 
      success: false,
      message: "Failed to create return",
      error: err?.message 
    });
  }
});

// GET /api/receipt-returns/:id/items - list items for a return
router.get("/:id/items", async (req, res) => {
  try {
    const items = await storage.getReturnItems(req.params.id);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch return items" });
  }
});

// POST /api/receipt-returns/:id/items - create item for a return
router.post("/:id/items", async (req, res) => {
  try {
    const receiptReturnId = req.params.id;
    const body = req.body || {};
    
    // Map from frontend camelCase to database snake_case
    const data = {
      receipt_return_id: receiptReturnId,
      serial_no: body.serialNo || body.serial_no,
      item_id: body.itemId || body.item_id,
      item_description: body.itemDescription || body.item_description || '',
      quantity_returned: body.quantity || body.quantity_returned || 0,
      unit_cost: body.unitCost || body.unit_cost || 0,
      total_cost: body.totalValue || body.total_cost || 0,
      return_reason: body.returnReason || body.return_reason || '',
      condition_notes: body.conditionNotes || body.condition_notes,
    };
    
    const created = await storage.createReturnItem(data);
    res.json({ success: true, data: created, message: "Item added successfully" });
  } catch (err) {
    console.error("Error creating return item:", err);
    res.status(500).json({ success: false, message: "Failed to create return item" });
  }
});

// PUT /api/receipt-returns/:returnId/items/:itemId - update item
router.put("/:returnId/items/:itemId", async (req, res) => {
  try {
    const body = req.body || {};
    
    // Map from frontend camelCase to database snake_case
    const data: any = {};
    if (body.serialNo !== undefined) data.serial_no = body.serialNo;
    if (body.itemDescription !== undefined) data.item_description = body.itemDescription;
    if (body.quantity !== undefined) data.quantity_returned = body.quantity;
    if (body.unitCost !== undefined) data.unit_cost = body.unitCost;
    if (body.totalValue !== undefined) data.total_cost = body.totalValue;
    if (body.returnReason !== undefined) data.return_reason = body.returnReason;
    if (body.conditionNotes !== undefined) data.condition_notes = body.conditionNotes;
    
    const updated = await storage.updateReturnItem(req.params.itemId, data);
    if (!updated) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: updated, message: "Item updated successfully" });
  } catch (err) {
    console.error("Error updating return item:", err);
    res.status(500).json({ success: false, message: "Failed to update return item" });
  }
});

// DELETE /api/receipt-returns/:returnId/items/:itemId - delete item
router.delete("/:returnId/items/:itemId", async (req, res) => {
  try {
    await storage.deleteReturnItem(req.params.itemId);
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("Error deleting return item:", err);
    res.status(500).json({ success: false, message: "Failed to delete return item" });
  }
});

// PUT /api/receipt-returns/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await storage.updateReturn(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Return not found" });
    res.json({ success: true, data: updated, message: "Return updated successfully" });
  } catch (err) {
    console.error("Error updating return:", err);
    res.status(500).json({ success: false, message: "Failed to update return" });
  }
});

// DELETE /api/receipt-returns/:id
router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteReturn(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete return" });
  }
});

export default router;