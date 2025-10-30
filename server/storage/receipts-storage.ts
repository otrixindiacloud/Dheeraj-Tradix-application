
import { db } from "../db";
import { goodsReceiptHeaders, goodsReceiptItems, insertGoodsReceiptHeaderSchema, insertGoodsReceiptItemSchema, supplierLpos, salesOrders, customers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { leftJoin } from "drizzle-orm";
import { BaseStorage } from "./base-storage";
import { randomUUID } from "crypto";

export class ReceiptsStorage extends BaseStorage {
  async getAllReceipts() {
    // Fetch all receipts with customer information through supplier LPO and sales order joins
    const results = await db
      .select({
        receipt: goodsReceiptHeaders,
        customer: customers,
      })
      .from(goodsReceiptHeaders)
      .leftJoin(supplierLpos, eq(goodsReceiptHeaders.supplierLpoId, supplierLpos.id))
      .leftJoin(
        salesOrders,
        sql`${supplierLpos.sourceSalesOrderIds} @> jsonb_build_array(${salesOrders.id}::text)`
      )
      .leftJoin(customers, eq(salesOrders.customerId, customers.id));

    // Group results by receipt ID and get the first customer (in case of multiple sales orders)
    const receiptMap = new Map();
    
    results.forEach(row => {
      const receiptId = row.receipt.id;
      if (!receiptMap.has(receiptId)) {
        const customer = row.customer ? {
          id: row.customer.id,
          name: row.customer.name,
          email: row.customer.email,
          phone: row.customer.phone,
          address: row.customer.address,
          customerType: row.customer.customerType,
        } : null;
        
        receiptMap.set(receiptId, {
          ...row.receipt,
          customer,
          __customerEmbedded: true
        });
      }
    });

    const receipts = Array.from(receiptMap.values());
    
    // Fetch items for each receipt
    for (const receipt of receipts) {
      try {
        const items = await db
          .select()
          .from(goodsReceiptItems)
          .where(eq(goodsReceiptItems.receiptHeaderId, receipt.id));
        receipt.items = items;
      } catch (error) {
        console.error(`Error fetching items for receipt ${receipt.id}:`, error);
        receipt.items = [];
      }
    }

    return receipts;
  }

  async createReceipt(data: any) {
    console.log('[RECEIPTS STORAGE] Creating receipt with data:', data);
    
    // Extract items from data
    const items = data.items || [];
    delete data.items; // Remove items from header data
    
    // Validate and insert new receipt into goodsReceiptHeaders
    const base: any = { ...data };
    if (!base.receiptNumber) base.receiptNumber = `RCPT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    if (!base.id) base.id = randomUUID();
    if (!base.status) base.status = "Pending";
    if (!base.receiptDate) base.receiptDate = new Date().toISOString().slice(0,10);
    
    // Calculate totals from items
    base.totalItems = items.length;
    base.totalQuantityExpected = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    base.totalQuantityReceived = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    
    // Parse without id (schema omits id)
    const parseInput = { ...base };
    delete parseInput.id;
    let toInsert: any;
    try {
      toInsert = insertGoodsReceiptHeaderSchema.parse(parseInput);
    } catch (zerr) {
      console.error('[RECEIPTS STORAGE] Header validation error:', zerr);
      throw zerr;
    }
    
    const projected = {
      id: base.id,
      receiptNumber: toInsert.receiptNumber,
      supplierLpoId: toInsert.supplierLpoId,
      supplierId: toInsert.supplierId,
      receiptDate: toInsert.receiptDate,
      expectedDeliveryDate: toInsert.expectedDeliveryDate,
      actualDeliveryDate: toInsert.actualDeliveryDate,
      receivedBy: toInsert.receivedBy,
      status: toInsert.status,
      notes: toInsert.notes,
      totalItems: toInsert.totalItems,
      totalQuantityExpected: toInsert.totalQuantityExpected,
      totalQuantityReceived: toInsert.totalQuantityReceived,
      discrepancyFlag: toInsert.discrepancyFlag
    };
    
    console.log('[RECEIPTS STORAGE] Inserting header:', projected);
    const [inserted] = await db.insert(goodsReceiptHeaders).values(projected).returning();
    console.log('[RECEIPTS STORAGE] Header created:', inserted);
    
    // Insert items if any
    if (items.length > 0) {
      console.log('[RECEIPTS STORAGE] Processing items:', items.length);
      const itemsToInsert = items.map((item: any, index: number) => {
        const itemData = {
          receiptHeaderId: inserted.id,
          itemDescription: item.itemDescription || item.description || '',
          quantityExpected: Number(item.quantity) || 0,
          quantityReceived: Number(item.quantity) || 0,
          unitCost: Number(item.unitCost) || Number(item.unitPrice) || 0,
          totalCost: Number(item.totalPrice) || (Number(item.quantity) || 0) * (Number(item.unitCost) || Number(item.unitPrice) || 0),
          barcode: item.barcode || '',
          supplierCode: item.supplierCode || '',
          storageLocation: item.storageLocation || '',
          condition: 'Good',
          receivedAt: new Date(),
        };
        
        try {
          return insertGoodsReceiptItemSchema.parse(itemData);
        } catch (err) {
          console.error('[RECEIPTS STORAGE] Item validation error:', err, itemData);
          throw err;
        }
      });
      
      console.log('[RECEIPTS STORAGE] Inserting items:', itemsToInsert);
      const createdItems = await db.insert(goodsReceiptItems).values(itemsToInsert).returning();
      console.log('[RECEIPTS STORAGE] Items created:', createdItems.length);
    }
    
    return inserted;
  }

  async getReceiptById(id: string) {
    // Fetch a single receipt by ID
    const [receipt] = await db.select().from(goodsReceiptHeaders).where(eq(goodsReceiptHeaders.id, id));
    return receipt || null;
  }

  async updateReceipt(id: string, data: any) {
    // Update receipt by ID
    const parseInput = { ...data };
    delete parseInput.id;
    let toUpdate: any;
    try {
      toUpdate = insertGoodsReceiptHeaderSchema.partial().parse(parseInput);
    } catch (zerr) {
      throw zerr;
    }
    const [updated] = await db.update(goodsReceiptHeaders).set(toUpdate).where(eq(goodsReceiptHeaders.id, id)).returning();
    return updated || null;
  }

  async deleteReceipt(id: string) {
    // Delete receipt by ID
    await db.delete(goodsReceiptHeaders).where(eq(goodsReceiptHeaders.id, id));
    return { success: true };
  }

  async getReceiptByNumber(receiptNumber: string) {
    // Fetch a single receipt by receipt number
    const [receipt] = await db.select().from(goodsReceiptHeaders).where(eq(goodsReceiptHeaders.receiptNumber, receiptNumber));
    return receipt || null;
  }

  async getReceiptItems(receiptId: string) {
    // Fetch items for a specific receipt
    const items = await db
      .select()
      .from(goodsReceiptItems)
      .where(eq(goodsReceiptItems.receiptHeaderId, receiptId));
    return items;
  }

  async getSupplier(supplierId: string) {
    // This method should be implemented in the base storage or suppliers storage
    // For now, return a mock supplier
    return {
      id: supplierId,
      name: "Mock Supplier",
      email: "supplier@example.com",
      phone: "+1234567890",
      address: "123 Supplier Street"
    };
  }
}
