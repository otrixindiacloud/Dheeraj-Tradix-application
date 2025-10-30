import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// GET /api/issue-returns - Get all issue returns
router.get("/", async (req, res) => {
  try {
    const issueReturns = await storage.getIssueReturns();
    res.json(issueReturns);
  } catch (err) {
    console.error("Error fetching issue returns:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch issue returns",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// GET /api/issue-returns/:id - Get issue return by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const issueReturn = await storage.getIssueReturnById(id);
    
    if (!issueReturn) {
      return res.status(404).json({
        success: false,
        message: "Issue return not found"
      });
    }
    
    res.json(issueReturn);
  } catch (err) {
    console.error("Error fetching issue return:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch issue return",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// POST /api/issue-returns - Create new issue return
router.post("/", async (req, res) => {
  try {
    const issueReturnData = req.body;
    console.log("Creating issue return with data:", issueReturnData);
    
    const issueReturn = await storage.createIssueReturn(issueReturnData);
    
    res.status(201).json(issueReturn);
  } catch (err) {
    console.error("Error creating issue return:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create issue return",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// PUT /api/issue-returns/:id - Update issue return
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const issueReturn = await storage.updateIssueReturn(id, updateData);
    
    if (!issueReturn) {
      return res.status(404).json({
        success: false,
        message: "Issue return not found"
      });
    }
    
    res.json(issueReturn);
  } catch (err) {
    console.error("Error updating issue return:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update issue return",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// DELETE /api/issue-returns/:id - Delete issue return
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await storage.deleteIssueReturn(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Issue return not found"
      });
    }
    
    res.json({
      success: true,
      message: "Issue return deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting issue return:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete issue return",
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;
