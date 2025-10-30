import { Router } from "express";

console.log("[DEBUG] stock-issues route loaded");
import { StockIssuesStorage } from "../storage/stock-issues-storage";

const router = Router();
const storage = new StockIssuesStorage();

// GET /api/stock-issues
router.get("/", async (req, res) => {
  console.log("[DEBUG] GET /api/stock-issues called");
  try {
    const issues = await storage.getAllStockIssues();
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch stock issues" });
  }
});

// GET /api/stock-issues/:id
router.get("/:id", async (req, res) => {
  try {
    const issue = await storage.getStockIssueById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Not found" });
    
    // Fetch items for this issue
    const items = await storage.getStockIssueItems(req.params.id);
    
    // Return issue with items
    res.json({ ...issue, items });
  } catch (err) {
    console.error("Error fetching stock issue:", err);
    res.status(500).json({ message: "Failed to fetch stock issue" });
  }
});

// POST /api/stock-issues
router.post("/", async (req, res) => {
  try {
    // Accept both camelCase and snake_case from client
    const body = req.body || {};
    console.log("[DEBUG][POST /api/stock-issues] Raw body received:", body);
    const rawIssueDate = body.issueDate ?? body.issue_date;

    // Check if this is a wizard request with multiple items
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      // Handle wizard request with multiple items
      const issueData = {
        issueNumber: body.issueNumber ?? body.issue_number,
        deliveryNumber: body.deliveryNumber ?? body.delivery_number,
        customerId: body.customerId ?? body.customer_id,
        supplierId: body.supplierId ?? body.supplier_id,
        issueDate: rawIssueDate,
        issueReason: body.issueReason ?? body.issue_reason,
        status: body.status || 'Draft',
        notes: body.notes,
      };

      // Normalize issueDate -> Date | undefined
      if (issueData.issueDate) {
        if (issueData.issueDate instanceof Date) {
          if (isNaN(issueData.issueDate.getTime())) issueData.issueDate = undefined;
        } else if (typeof issueData.issueDate === "string" || typeof issueData.issueDate === "number") {
          const d = new Date(issueData.issueDate);
          if (!isNaN(d.getTime())) issueData.issueDate = d; else issueData.issueDate = undefined;
        } else {
          issueData.issueDate = undefined;
        }
      }

      // Remove undefined so Drizzle can apply defaults
      Object.keys(issueData).forEach(k => (issueData as Record<string, any>)[k] === undefined && delete (issueData as Record<string, any>)[k]);

      // Create the main stock issue record
      const issue = await storage.createStockIssue(issueData);
      
      // Create individual item records
      for (const item of body.items) {
        const itemData = {
          stockIssueId: issue.id,
          itemId: item.itemId || null,
          itemDescription: item.itemDescription || '',
          quantityIssued: item.quantityIssued || 0,
          unitCost: item.unitCost || 0,
          totalCost: item.totalCost || 0,
          issueReason: item.issueReason || 'Quality Issue',
          conditionNotes: item.conditionNotes || ''
        };
        await storage.createStockIssueItem(itemData);
      }

      res.json(issue);
      return;
    }

    // Handle single item request (legacy)
    const payload: any = {
      issueNumber: body.issueNumber ?? body.issue_number,
      itemId: body.itemId ?? body.item_id,
      issuedTo: body.issuedTo ?? body.issued_to,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      issueDate: rawIssueDate,
      reason: body.reason,
      departmentId: body.departmentId ?? body.department_id,
      notes: body.notes,
      status: body.status,
    };

    // Basic validation (avoid silent 500s)
    const problems: string[] = [];
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (!payload.itemId || typeof payload.itemId !== 'string' || !uuidRegex.test(payload.itemId)) {
      problems.push('itemId (UUID) is required');
    }
    if (payload.quantity == null || isNaN(payload.quantity) || payload.quantity <= 0) {
      problems.push('quantity must be > 0');
    }
    if (problems.length) {
      return res.status(422).json({ message: 'Validation failed', issues: problems, payload });
    }

    // Normalize issueDate -> Date | undefined
    if (payload.issueDate) {
      if (payload.issueDate instanceof Date) {
        if (isNaN(payload.issueDate.getTime())) payload.issueDate = undefined;
      } else if (typeof payload.issueDate === "string" || typeof payload.issueDate === "number") {
        const d = new Date(payload.issueDate);
        if (!isNaN(d.getTime())) payload.issueDate = d; else payload.issueDate = undefined;
      } else {
        // Unknown type; drop it so DB default applies
        payload.issueDate = undefined;
      }
    }
    // Failsafe: ensure final is Date or undefined
    if (payload.issueDate && !(payload.issueDate instanceof Date)) {
      const d = new Date(payload.issueDate as any);
      payload.issueDate = isNaN(d.getTime()) ? undefined : d;
    }
    console.log('[DEBUG][POST] issueDate final type:', typeof payload.issueDate, 'value:', payload.issueDate instanceof Date ? payload.issueDate.toISOString() : payload.issueDate);

    // Remove undefined so Drizzle can apply defaults
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    console.log("[DEBUG][POST] Normalized Stock Issue Payload", payload);
    const issue = await storage.createStockIssue(payload);
    res.json(issue);
  } catch (err) {
    console.error("Stock Issue Creation Error:", err, "Raw Payload:", req.body);
    const errorMessage = (err instanceof Error && err.message) ? err.message : String(err);
    res.status(500).json({ 
      message: "Failed to create stock issue", 
      error: errorMessage,
      received: req.body,
      hint: "Verify itemId references an existing inventory item and that migrations for stock_issue table are applied.",
    });
  }
});

// PUT /api/stock-issues/:id
router.put("/:id", async (req, res) => {
  try {
    const body = req.body || {};
    console.log("[DEBUG][PUT /api/stock-issues/:id] Raw body received:", body);
    const rawIssueDate = body.issueDate ?? body.issue_date;

    // Check if this is a wizard request with multiple items
    if (body.items && Array.isArray(body.items)) {
      // Handle wizard request with multiple items
      const issueData = {
        issueNumber: body.issueNumber ?? body.issue_number,
        deliveryNumber: body.deliveryNumber ?? body.delivery_number,
        customerId: body.customerId ?? body.customer_id,
        supplierId: body.supplierId ?? body.supplier_id,
        issueDate: rawIssueDate,
        issueReason: body.issueReason ?? body.issue_reason,
        status: body.status || 'Draft',
        notes: body.notes,
      };

      // Normalize issueDate -> Date | undefined
      if (issueData.issueDate) {
        if (issueData.issueDate instanceof Date) {
          if (isNaN(issueData.issueDate.getTime())) issueData.issueDate = undefined;
        } else if (typeof issueData.issueDate === "string" || typeof issueData.issueDate === "number") {
          const d = new Date(issueData.issueDate);
          if (!isNaN(d.getTime())) issueData.issueDate = d; else issueData.issueDate = undefined;
        } else {
          issueData.issueDate = undefined;
        }
      }

      // Remove undefined so Drizzle can apply defaults
      Object.keys(issueData).forEach(k => (issueData as any)[k] === undefined && delete (issueData as any)[k]);

      // Update the main stock issue record
      const issue = await storage.updateStockIssue(req.params.id, issueData);
      
      // Delete existing item records
      await storage.deleteStockIssueItems(req.params.id);
      
      // Create new item records
      for (const item of body.items) {
        const itemData = {
          stockIssueId: req.params.id,
          itemId: item.itemId || null,
          itemDescription: item.itemDescription || '',
          quantityIssued: item.quantityIssued || 0,
          unitCost: item.unitCost || 0,
          totalCost: item.totalCost || 0,
          issueReason: item.issueReason || 'Quality Issue',
          conditionNotes: item.conditionNotes || ''
        };
        await storage.createStockIssueItem(itemData);
      }

      res.json(issue);
      return;
    }

    // Handle single item request (legacy)
    const payload: any = {
      issueNumber: body.issueNumber ?? body.issue_number,
      itemId: body.itemId ?? body.item_id,
      issuedTo: body.issuedTo ?? body.issued_to,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      issueDate: rawIssueDate,
      reason: body.reason,
      departmentId: body.departmentId ?? body.department_id,
      notes: body.notes,
      status: body.status,
    };
    const problems: string[] = [];
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (payload.itemId && (typeof payload.itemId !== 'string' || !uuidRegex.test(payload.itemId))) {
      problems.push('itemId must be a valid UUID');
    }
    if (payload.quantity != null && (isNaN(payload.quantity) || payload.quantity <= 0)) {
      problems.push('quantity must be > 0');
    }
    if (problems.length) {
      return res.status(422).json({ message: 'Validation failed', issues: problems, payload });
    }
    if (payload.issueDate) {
      if (payload.issueDate instanceof Date) {
        if (isNaN(payload.issueDate.getTime())) payload.issueDate = undefined;
      } else if (typeof payload.issueDate === "string" || typeof payload.issueDate === "number") {
        const d = new Date(payload.issueDate);
        if (!isNaN(d.getTime())) payload.issueDate = d; else payload.issueDate = undefined;
      } else {
        payload.issueDate = undefined;
      }
    }
    if (payload.issueDate && !(payload.issueDate instanceof Date)) {
      const d = new Date(payload.issueDate as any);
      payload.issueDate = isNaN(d.getTime()) ? undefined : d;
    }
    console.log('[DEBUG][PUT] issueDate final type:', typeof payload.issueDate, 'value:', payload.issueDate instanceof Date ? payload.issueDate.toISOString() : payload.issueDate);
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    console.log("[DEBUG][PUT] Normalized Stock Issue Payload", payload);
    const updated = await storage.updateStockIssue(req.params.id, payload);
    res.json(updated);
  } catch (err) {
    console.error("Stock Issue Update Error", err);
    res.status(500).json({ message: "Failed to update stock issue" });
  }
});

// DELETE /api/stock-issues/:id
router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteStockIssue(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete stock issue" });
  }
});

export default router;
