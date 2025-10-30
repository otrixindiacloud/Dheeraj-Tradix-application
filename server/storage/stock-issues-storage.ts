
import { db } from "../db";
import { stockIssue, inventoryItems, stockIssueItems, customers, suppliers } from "../../shared/schema";
import { eq } from "drizzle-orm";

export class StockIssuesStorage {
  async getAllStockIssues() {
    // Join stockIssue with inventoryItem to get item description
    const results = await db
      .select({
        id: stockIssue.id,
        issueNumber: stockIssue.issueNumber,
        itemId: stockIssue.itemId,
        quantity: stockIssue.quantity,
        issueDate: stockIssue.issueDate,
        status: stockIssue.status,
        issuedTo: stockIssue.issuedTo,
        departmentId: stockIssue.departmentId,
        notes: stockIssue.notes,
        reason: stockIssue.reason,
        itemName: inventoryItems.description,
        itemCode: inventoryItems.barcode,
      })
      .from(stockIssue)
      .leftJoin(inventoryItems, eq(stockIssue.itemId, inventoryItems.id));
    
    // Process results to ensure proper data formatting
    return results.map(issue => ({
      ...issue,
      itemName: issue.itemName || 'N/A',
      itemCode: issue.itemCode || 'N/A',
      issuedTo: issue.issuedTo || 'N/A',
      reason: issue.reason || 'N/A',
      quantity: issue.quantity || 0,
      issueNumber: issue.issueNumber || 'N/A',
    }));
  }

  async getStockIssueById(id: string) {
    const result = await db
      .select({
        id: stockIssue.id,
        issueNumber: stockIssue.issueNumber,
        itemId: stockIssue.itemId,
        quantity: stockIssue.quantity,
        issueDate: stockIssue.issueDate,
        status: stockIssue.status,
        issuedTo: stockIssue.issuedTo,
        departmentId: stockIssue.departmentId,
        notes: stockIssue.notes,
        reason: stockIssue.reason,
        deliveryNumber: stockIssue.deliveryNumber,
        customerId: stockIssue.customerId,
        supplierId: stockIssue.supplierId,
        issueReason: stockIssue.issueReason,
        itemName: inventoryItems.description,
        itemCode: inventoryItems.barcode,
        customerName: customers.name,
        supplierName: suppliers.name,
      })
      .from(stockIssue)
      .leftJoin(inventoryItems, eq(stockIssue.itemId, inventoryItems.id))
      .leftJoin(customers, eq(stockIssue.customerId, customers.id))
      .leftJoin(suppliers, eq(stockIssue.supplierId, suppliers.id))
      .where(eq(stockIssue.id, id));
    
    if (!result[0]) return null;
    
    const issue = result[0];
    return {
      ...issue,
      itemName: issue.itemName || 'N/A',
      itemCode: issue.itemCode || 'N/A',
      issuedTo: issue.issuedTo || 'N/A',
      reason: issue.reason || 'N/A',
      quantity: issue.quantity || 0,
      issueNumber: issue.issueNumber || 'N/A',
    };
  }

  async createStockIssue(data: any) {
    // Validate quantity is positive
    if (data.quantity !== undefined && data.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    
    // Defensive normalization: ensure issueDate is a Date object or remove it so DB default applies
    if (data && 'issueDate' in data) {
      const v = data.issueDate;
      if (v == null || v === '') {
        delete data.issueDate; // allow default
      } else if (!(v instanceof Date)) {
        try {
          const d = new Date(v);
            if (!isNaN(d.getTime())) data.issueDate = d; else delete data.issueDate;
        } catch {
          delete data.issueDate;
        }
      }
    }
    console.log('[DEBUG][createStockIssue] Final payload to insert:', {
      ...data,
      issueDate: data.issueDate instanceof Date ? data.issueDate.toISOString() : data.issueDate
    });
    const [created] = await db.insert(stockIssue).values(data).returning();
    return created;
  }

  async updateStockIssue(id: string, data: any) {
    // Validate quantity is positive
    if (data.quantity !== undefined && data.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    
    if (data && 'issueDate' in data) {
      const v = data.issueDate;
      if (v == null || v === '') {
        delete data.issueDate;
      } else if (!(v instanceof Date)) {
        try {
          const d = new Date(v);
          if (!isNaN(d.getTime())) data.issueDate = d; else delete data.issueDate;
        } catch { delete data.issueDate; }
      }
    }
    console.log('[DEBUG][updateStockIssue] Payload:', {
      ...data,
      issueDate: data.issueDate instanceof Date ? data.issueDate.toISOString() : data.issueDate
    });
    const [updated] = await db.update(stockIssue).set(data).where(eq(stockIssue.id, id)).returning();
    return updated || null;
  }

  async deleteStockIssue(id: string) {
    await db.delete(stockIssue).where(eq(stockIssue.id, id));
  }

  async createStockIssueItem(data: any) {
    const [item] = await db.insert(stockIssueItems).values(data).returning();
    return item;
  }

  async getStockIssueItems(stockIssueId: string) {
    const items = await db
      .select()
      .from(stockIssueItems)
      .where(eq(stockIssueItems.stockIssueId, stockIssueId));
    return items;
  }

  async deleteStockIssueItems(stockIssueId: string) {
    await db.delete(stockIssueItems).where(eq(stockIssueItems.stockIssueId, stockIssueId));
  }
}
