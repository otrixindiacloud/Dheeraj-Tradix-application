import { db } from "../db";
import { issueReturns, stockIssue, stockIssueItems, customers, suppliers } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export class IssueReturnStorage {
  // Get all issue returns
  async getIssueReturns() {
    const results = await db
      .select({
        id: issueReturns.id,
        returnNumber: issueReturns.returnNumber,
        stockIssueId: issueReturns.stockIssueId,
        returnType: issueReturns.returnType,
        priority: issueReturns.priority,
        description: issueReturns.description,
        returnedBy: issueReturns.returnedBy,
        returnDate: issueReturns.returnDate,
        status: issueReturns.status,
        resolution: issueReturns.resolution,
        assignedTo: issueReturns.assignedTo,
        estimatedResolution: issueReturns.estimatedResolution,
        notes: issueReturns.notes,
        createdAt: issueReturns.createdAt,
        updatedAt: issueReturns.updatedAt,
        // Join with stock issue to get issue number
        stockIssueNumber: stockIssue.issueNumber,
        // Join with customer via stock issue
        customerName: customers.name,
        // Join with supplier via stock issue
        supplierName: suppliers.name,
      })
      .from(issueReturns)
      .leftJoin(stockIssue, eq(issueReturns.stockIssueId, stockIssue.id))
      .leftJoin(customers, eq(stockIssue.customerId, customers.id))
      .leftJoin(suppliers, eq(stockIssue.supplierId, suppliers.id))
      .orderBy(desc(issueReturns.createdAt));

    // Add default totalValue (0) since the table doesn't have this field
    return results.map((result: any) => ({
      ...result,
      totalValue: 0,
    }));
  }

  // Get issue return by ID
  async getIssueReturnById(id: string) {
    const [result] = await db
      .select({
        id: issueReturns.id,
        returnNumber: issueReturns.returnNumber,
        stockIssueId: issueReturns.stockIssueId,
        returnType: issueReturns.returnType,
        priority: issueReturns.priority,
        description: issueReturns.description,
        returnedBy: issueReturns.returnedBy,
        returnDate: issueReturns.returnDate,
        status: issueReturns.status,
        resolution: issueReturns.resolution,
        assignedTo: issueReturns.assignedTo,
        estimatedResolution: issueReturns.estimatedResolution,
        notes: issueReturns.notes,
        createdAt: issueReturns.createdAt,
        updatedAt: issueReturns.updatedAt,
        // Join with stock issue to get issue number
        stockIssueNumber: stockIssue.issueNumber,
        // Join with customer via stock issue
        customerName: customers.name,
        // Join with supplier via stock issue
        supplierName: suppliers.name,
      })
      .from(issueReturns)
      .leftJoin(stockIssue, eq(issueReturns.stockIssueId, stockIssue.id))
      .leftJoin(customers, eq(stockIssue.customerId, customers.id))
      .leftJoin(suppliers, eq(stockIssue.supplierId, suppliers.id))
      .where(eq(issueReturns.id, id));

    return result || null;
  }

  // Create new issue return
  async createIssueReturn(data: any) {
    const [issueReturnRecord] = await db.insert(issueReturns).values({
      returnNumber: data.returnNumber || `IRN-${Date.now()}`,
      stockIssueId: data.stockIssueId || null,
      returnType: data.returnType || "",
      priority: data.priority || "Medium",
      description: data.description || "",
      returnedBy: data.returnedBy || "",
      returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
      status: data.status || "Open",
      resolution: data.resolution || null,
      assignedTo: data.assignedTo || null,
      estimatedResolution: data.estimatedResolution ? new Date(data.estimatedResolution) : null,
      notes: data.notes || null,
    }).returning();

    // Return the complete record
    return await this.getIssueReturnById(issueReturnRecord.id);
  }

  // Update issue return
  async updateIssueReturn(id: string, data: any) {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.returnNumber !== undefined) updateData.returnNumber = data.returnNumber;
    if (data.stockIssueId !== undefined) updateData.stockIssueId = data.stockIssueId;
    if (data.returnType !== undefined) updateData.returnType = data.returnType;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.returnedBy !== undefined) updateData.returnedBy = data.returnedBy;
    if (data.returnDate !== undefined) updateData.returnDate = new Date(data.returnDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.resolution !== undefined) updateData.resolution = data.resolution;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.estimatedResolution !== undefined) {
      updateData.estimatedResolution = data.estimatedResolution ? new Date(data.estimatedResolution) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db
      .update(issueReturns)
      .set(updateData)
      .where(eq(issueReturns.id, id));

    return await this.getIssueReturnById(id);
  }

  // Delete issue return
  async deleteIssueReturn(id: string) {
    const [deleted] = await db
      .delete(issueReturns)
      .where(eq(issueReturns.id, id))
      .returning();

    return deleted;
  }

  // Get stock issue details for wizard
  async getStockIssueById(id: string) {
    const [issueData] = await db
      .select()
      .from(stockIssue)
      .where(eq(stockIssue.id, id));

    if (!issueData) return null;

    // Get stock issue items
    const stockIssueItemsData = await db
      .select()
      .from(stockIssueItems)
      .where(eq(stockIssueItems.stockIssueId, id));

    // Get customer information
    const customer = await db
      .select()
      .from(customers)
      .where(eq(customers.id, issueData.customerId))
      .then((rows: any[]) => rows[0] || null);

    // Get supplier information
    const supplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, issueData.supplierId))
      .then((rows: any[]) => rows[0] || null);

    return {
      ...issueData,
      items: stockIssueItemsData,
      customer,
      supplier,
    };
  }
}

export const issueReturnStorage = new IssueReturnStorage();
