import { db } from "../db";
import { receiptReturns, receiptReturnItems, suppliers } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class ReceiptReturnsStorage extends BaseStorage {
  async getAllReturns() {
    return await db
      .select({
        id: receiptReturns.id,
        returnNumber: receiptReturns.returnNumber,
        supplierId: receiptReturns.supplierId,
        goodsReceiptId: receiptReturns.goodsReceiptId,
        returnDate: receiptReturns.returnDate,
        returnReason: receiptReturns.returnReason,
        status: receiptReturns.status,
        totalValue: receiptReturns.totalValue,
        notes: receiptReturns.notes,
        receiptNumber: receiptReturns.receiptNumber,
        receiptDate: receiptReturns.receiptDate,
        receivedBy: receiptReturns.receivedBy,
        expectedDate: receiptReturns.expectedDate,
        actualDate: receiptReturns.actualDate,
        itemsExpected: receiptReturns.itemsExpected,
        itemsReceived: receiptReturns.itemsReceived,
        discrepancy: receiptReturns.discrepancy,
        supplierLpoNumber: receiptReturns.supplierLpoNumber,
        customerLpoNumber: receiptReturns.customerLpoNumber,
        supplierIdDisplay: receiptReturns.supplierIdDisplay,
        createdAt: receiptReturns.createdAt,
        updatedAt: receiptReturns.updatedAt,
        // Supplier fields from join
        supplierName: suppliers.name,
        supplierAddress: suppliers.address,
        supplierContactPerson: suppliers.contactPerson,
        supplierEmail: suppliers.email,
        supplierPhone: suppliers.phone
      })
      .from(receiptReturns)
      .leftJoin(suppliers, eq(receiptReturns.supplierId, suppliers.id))
      .orderBy(desc(receiptReturns.createdAt));
  }

  async getReturnById(id: string) {
    const [ret] = await db
      .select({
        id: receiptReturns.id,
        returnNumber: receiptReturns.returnNumber,
        supplierId: receiptReturns.supplierId,
        goodsReceiptId: receiptReturns.goodsReceiptId,
        returnDate: receiptReturns.returnDate,
        returnReason: receiptReturns.returnReason,
        status: receiptReturns.status,
        totalValue: receiptReturns.totalValue,
        notes: receiptReturns.notes,
        receiptNumber: receiptReturns.receiptNumber,
        receiptDate: receiptReturns.receiptDate,
        receivedBy: receiptReturns.receivedBy,
        expectedDate: receiptReturns.expectedDate,
        actualDate: receiptReturns.actualDate,
        itemsExpected: receiptReturns.itemsExpected,
        itemsReceived: receiptReturns.itemsReceived,
        discrepancy: receiptReturns.discrepancy,
        supplierLpoNumber: receiptReturns.supplierLpoNumber,
        customerLpoNumber: receiptReturns.customerLpoNumber,
        supplierIdDisplay: receiptReturns.supplierIdDisplay,
        createdAt: receiptReturns.createdAt,
        updatedAt: receiptReturns.updatedAt,
        // Supplier fields from join
        supplierName: suppliers.name,
        supplierAddress: suppliers.address,
        supplierContactPerson: suppliers.contactPerson,
        supplierEmail: suppliers.email,
        supplierPhone: suppliers.phone
      })
      .from(receiptReturns)
      .leftJoin(suppliers, eq(receiptReturns.supplierId, suppliers.id))
      .where(eq(receiptReturns.id, id));
    
    if (!ret) return null;
    
    // Get return items
    const items = await this.getReturnItems(id);
    
    return {
      ...ret,
      items: items
    };
  }

  async createReturn(data: any) {
    const [newReturn] = await db.insert(receiptReturns).values(data).returning();
    return newReturn;
  }

  async updateReturn(id: string, data: any) {
    const [updated] = await db
      .update(receiptReturns)
      .set({ ...data, updated_at: new Date() })
      .where(eq(receiptReturns.id, id))
      .returning();
    return updated || null;
  }

  async getReturnItems(returnId: string) {
    return await db
      .select()
      .from(receiptReturnItems)
      .where(eq(receiptReturnItems.receiptReturnId, returnId))
      .orderBy(receiptReturnItems.serialNo);
  }

  async createReturnItem(data: any) {
    const [newItem] = await db.insert(receiptReturnItems).values(data).returning();
    return newItem;
  }

  async updateReturnItem(id: string, data: any) {
    const [updated] = await db
      .update(receiptReturnItems)
      .set({ ...data, updated_at: new Date() })
      .where(eq(receiptReturnItems.id, id))
      .returning();
    return updated || null;
  }

  async deleteReturn(id: string) {
    // Items will be deleted automatically due to CASCADE
    await db.delete(receiptReturns).where(eq(receiptReturns.id, id));
  }

  async deleteReturnItem(id: string) {
    await db.delete(receiptReturnItems).where(eq(receiptReturnItems.id, id));
  }
}