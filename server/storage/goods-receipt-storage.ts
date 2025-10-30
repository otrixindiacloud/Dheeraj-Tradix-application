// Note: Not implementing full IGoodsReceiptStorage yet (subset needed for E2E).
import { db } from "../db";
import { insertGoodsReceiptHeaderSchema, insertGoodsReceiptItemSchema, goodsReceiptHeaders, goodsReceiptItems } from "@shared/schemas/goods-receipt";
import { supplierLpos, suppliers, inventoryItems, purchaseInvoices, purchaseInvoiceItems } from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { randomUUID } from 'crypto';
import { nanoid } from "nanoid";

export class GoodsReceiptStorage {
  private async generateReceiptNumber() {
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const timeSuffix = new Date().toISOString().slice(11,19).replace(/:/g, '').replace(/\./g, '');
    const randomSuffix = Math.random().toString(36).slice(2,7).toUpperCase();
    const baseNumber = `GRN-${timestamp}-${timeSuffix}-${randomSuffix}`;
    
    // Check if this receipt number already exists and generate a new one if needed
    let receiptNumber = baseNumber;
    let counter = 1;
    
    while (true) {
      try {
        const existing = await db.select().from(goodsReceiptHeaders)
          .where(eq(goodsReceiptHeaders.receiptNumber, receiptNumber))
          .limit(1);
        
        if (existing.length === 0) {
          break; // Receipt number is unique
        }
        
        // Generate a new number with counter
        receiptNumber = `${baseNumber}-${counter.toString().padStart(3, '0')}`;
        counter++;
        
        // Safety check to prevent infinite loop
        if (counter > 999) {
          receiptNumber = `${baseNumber}-${Date.now()}`;
          break;
        }
      } catch (error) {
        console.warn('Error checking receipt number uniqueness:', error);
        break; // Use the generated number if check fails
      }
    }
    
    return receiptNumber;
  }

  async createGoodsReceiptHeader(receipt: any) {
    try {
      console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][START]', { incoming: receipt });
      const base: any = { ...receipt };
      if (!base.receiptNumber) base.receiptNumber = await this.generateReceiptNumber();
      if (!base.id) base.id = randomUUID(); // Workaround missing DB default
      if (!base.status) base.status = 'Draft';
      if (!base.receiptDate) base.receiptDate = new Date().toISOString().slice(0,10);
      
      // Normalize dates
      const normalizeDate = (d: any) => {
        if (!d) return d; 
        if (typeof d === 'string' && d.length >= 10) return d.slice(0,10); 
        if (d instanceof Date) return d.toISOString().slice(0,10); 
        return d;
      };
      base.receiptDate = normalizeDate(base.receiptDate);
      base.expectedDeliveryDate = normalizeDate(base.expectedDeliveryDate);
      base.actualDeliveryDate = normalizeDate(base.actualDeliveryDate);
      
      // Ensure supplierId is present
      if (!base.supplierId) {
        if (base.supplierLpoId) {
          console.warn('[GoodsReceiptStorage.createGoodsReceiptHeader] Missing supplierId; derivation from supplierLpoId not implemented');
        } else {
          throw new Error('supplierId is required for goods receipt creation');
        }
      }
      
      // Ensure numeric fields are properly typed
      base.totalItems = Number(base.totalItems) || 0;
      base.totalQuantityExpected = Number(base.totalQuantityExpected) || 0;
      base.totalQuantityReceived = Number(base.totalQuantityReceived) || 0;
      base.discrepancyFlag = Boolean(base.discrepancyFlag);
      
      // Parse without id (schema omits id)
      const parseInput = { ...base };
      delete parseInput.id;
      let toInsert: any;
      try {
        toInsert = insertGoodsReceiptHeaderSchema.parse(parseInput);
      } catch (zerr) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Validation failed', zerr, { parseInput });
        throw zerr;
      }
      const assignedId = base.id;
      console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][ID RESOLUTION]', { assignedId });
      const projected = {
        id: assignedId,
        receiptNumber: toInsert.receiptNumber,
        supplierLpoId: toInsert.supplierLpoId,
        supplierId: toInsert.supplierId,
        lpoNumber: toInsert.lpoNumber,
        lpoValue: toInsert.lpoValue,
        lpoCurrency: toInsert.lpoCurrency,
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
      console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][PROJECTED]', projected);
      try {
        const inserted = await db.insert(goodsReceiptHeaders).values(projected as any).returning();
        console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][PRIMARY OK]', { id: inserted[0]?.id });
        return inserted[0];
      } catch (errPrimary) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Primary insert failed', {
          error: errPrimary,
          message: errPrimary instanceof Error ? errPrimary.message : 'Unknown error',
          code: (errPrimary as any)?.code,
          detail: (errPrimary as any)?.detail,
          constraint: (errPrimary as any)?.constraint,
          projected: projected
        });
        const minimal = {
          id: projected.id,
          receiptNumber: projected.receiptNumber,
          supplierLpoId: projected.supplierLpoId,
          supplierId: projected.supplierId,
          receiptDate: projected.receiptDate,
          status: projected.status || 'Draft'
        };
        console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][MINIMAL RETRY]', minimal);
        try {
          const inserted2 = await db.insert(goodsReceiptHeaders).values(minimal as any).returning();
          console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][SECONDARY OK]', { id: inserted2[0]?.id });
          return inserted2[0];
        } catch (errSecondary) {
          console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Secondary insert failed', errSecondary);
          throw errPrimary;
        }
      }
    } catch (err) {
      console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Error', err, { input: receipt });
      throw err;
    }
  }

  async createGoodsReceiptItem(item: any) {
    try {
      const start = Date.now();
      const base = { ...item };
      console.log('[GoodsReceiptStorage.createGoodsReceiptItem][INPUT]', base);
      
      // Ensure required fields
      if (!base.itemDescription) base.itemDescription = base.description || 'Item';
      if (!base.quantityExpected && base.quantityReceived) base.quantityExpected = base.quantityReceived;
      
      // Normalize potential legacy field names
      if (base.goodsReceiptId && !base.receiptHeaderId) {
        base.receiptHeaderId = base.goodsReceiptId; // legacy compatibility
      }
      
      // Ensure numeric fields are properly typed
      base.quantityExpected = Number(base.quantityExpected) || 0;
      base.quantityReceived = Number(base.quantityReceived) || 0;
      base.quantityDamaged = Number(base.quantityDamaged) || 0;
      base.quantityShort = Number(base.quantityShort) || 0;
      base.unitCost = base.unitCost ? parseFloat(base.unitCost).toFixed(2) : "0.00";
      base.totalCost = base.totalCost ? parseFloat(base.totalCost).toFixed(2) : "0.00";
      
      // Ensure tax and discount fields are properly handled
      base.taxRate = base.taxRate ? parseFloat(base.taxRate).toFixed(2) : "0.00";
      base.taxAmount = base.taxAmount ? parseFloat(base.taxAmount).toFixed(2) : "0.00";
      base.discountRate = base.discountRate ? parseFloat(base.discountRate).toFixed(2) : "0.00";
      base.discountAmount = base.discountAmount ? parseFloat(base.discountAmount).toFixed(2) : "0.00";
      
      // Ensure boolean fields
      base.condition = base.condition || 'Good';
      
      try {
        const parsed = insertGoodsReceiptItemSchema.parse(base);
        console.log('[GoodsReceiptStorage.createGoodsReceiptItem][PARSED]', parsed);
        // Table currently still has legacy text PK without default; ensure id provided
        const rowToInsert: any = { id: randomUUID(), ...parsed };
        console.log('[GoodsReceiptStorage.createGoodsReceiptItem][ROW TO INSERT]', rowToInsert);
        let inserted;
        try {
          inserted = await db.insert(goodsReceiptItems).values(rowToInsert).returning();
        } catch (dbErr: any) {
          // Surface postgres error details if present
            const pgInfo = {
              code: dbErr?.code,
              detail: dbErr?.detail,
              table: dbErr?.table,
              constraint: dbErr?.constraint,
              message: dbErr?.message,
            };
            console.error('[GoodsReceiptStorage.createGoodsReceiptItem][DB ERROR]', pgInfo);
            // Attach a safe error for upper layers
            const wrapped = new Error(dbErr?.message || 'DB insert failed for goods receipt item');
            (wrapped as any).db = pgInfo;
            throw wrapped;
        }
        const row = inserted[0];
        console.log('[GoodsReceiptStorage.createGoodsReceiptItem][SUCCESS]', { id: row?.id, ms: Date.now() - start });
        return row;
      } catch (inner) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptItem][ERROR]', inner);
        throw inner;
      }
    } catch (err) {
      console.error('[GoodsReceiptStorage.createGoodsReceiptItem] Error', err, { input: item });
      throw err;
    }
  }

  async getGoodsReceiptHeaders(filters?: any) {
    try {
      // Join with supplier LPOs to get LPO number and supplier information
      const query = db
        .select({
          id: goodsReceiptHeaders.id,
          receiptNumber: goodsReceiptHeaders.receiptNumber,
          supplierLpoId: goodsReceiptHeaders.supplierLpoId,
          supplierId: goodsReceiptHeaders.supplierId,
          lpoNumber: goodsReceiptHeaders.lpoNumber,
          lpoValue: goodsReceiptHeaders.lpoValue,
          lpoCurrency: goodsReceiptHeaders.lpoCurrency,
          receiptDate: goodsReceiptHeaders.receiptDate,
          expectedDeliveryDate: goodsReceiptHeaders.expectedDeliveryDate,
          actualDeliveryDate: goodsReceiptHeaders.actualDeliveryDate,
          receivedBy: goodsReceiptHeaders.receivedBy,
          status: goodsReceiptHeaders.status,
          notes: goodsReceiptHeaders.notes,
          totalItems: goodsReceiptHeaders.totalItems,
          totalQuantityExpected: goodsReceiptHeaders.totalQuantityExpected,
          totalQuantityReceived: goodsReceiptHeaders.totalQuantityReceived,
          discrepancyFlag: goodsReceiptHeaders.discrepancyFlag,
          createdAt: goodsReceiptHeaders.createdAt,
          updatedAt: goodsReceiptHeaders.updatedAt,
          // LPO information from join
          lpoNumberFromLpo: supplierLpos.lpoNumber,
          lpoDate: supplierLpos.lpoDate,
          lpoStatus: supplierLpos.status,
          lpoTotalAmount: supplierLpos.totalAmount,
          lpoCurrencyFromLpo: supplierLpos.currency,
          // Supplier information
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          supplierPhone: suppliers.phone,
          supplierContactPerson: suppliers.contactPerson,
        })
        .from(goodsReceiptHeaders)
        .leftJoin(supplierLpos, eq(goodsReceiptHeaders.supplierLpoId, supplierLpos.id))
        .leftJoin(suppliers, eq(goodsReceiptHeaders.supplierId, suppliers.id))
        .orderBy(desc(goodsReceiptHeaders.createdAt));

      return await query;
    } catch (error) {
      console.error('[GoodsReceiptStorage.getGoodsReceiptHeaders] Error:', error);
      throw error;
    }
  }

  async getGoodsReceiptHeader(id: string) {
    const r = await db
      .select({
        id: goodsReceiptHeaders.id,
        receiptNumber: goodsReceiptHeaders.receiptNumber,
        supplierLpoId: goodsReceiptHeaders.supplierLpoId,
        supplierId: goodsReceiptHeaders.supplierId,
        lpoNumber: goodsReceiptHeaders.lpoNumber,
        lpoValue: goodsReceiptHeaders.lpoValue,
        lpoCurrency: goodsReceiptHeaders.lpoCurrency,
        receiptDate: goodsReceiptHeaders.receiptDate,
        expectedDeliveryDate: goodsReceiptHeaders.expectedDeliveryDate,
        actualDeliveryDate: goodsReceiptHeaders.actualDeliveryDate,
        receivedBy: goodsReceiptHeaders.receivedBy,
        status: goodsReceiptHeaders.status,
        notes: goodsReceiptHeaders.notes,
        totalItems: goodsReceiptHeaders.totalItems,
        totalQuantityExpected: goodsReceiptHeaders.totalQuantityExpected,
        totalQuantityReceived: goodsReceiptHeaders.totalQuantityReceived,
        discrepancyFlag: goodsReceiptHeaders.discrepancyFlag,
        createdAt: goodsReceiptHeaders.createdAt,
        updatedAt: goodsReceiptHeaders.updatedAt,
      })
      .from(goodsReceiptHeaders)
      .where(eq(goodsReceiptHeaders.id, id))
      .limit(1);
    return r[0];
  }

  // Removed duplicate getGoodsReceiptByNumber implementation

  // Removed duplicate getGoodsReceiptItems(headerId: string) implementation

  async createGoodsReceiptItemsBulk(itemsArr: any[]) {
    if (!itemsArr.length) return [];

    // Collect references for efficient lookups
    const headerIds = Array.from(new Set(itemsArr.map((it: any) => it.receiptHeaderId).filter(Boolean)));
    const itemIds = Array.from(new Set(itemsArr.map((it: any) => it.itemId).filter(Boolean)));
    const supplierCodes = Array.from(new Set(itemsArr.map((it: any) => (typeof it.supplierCode === 'string' ? it.supplierCode.trim() : '')).filter((val: string) => !!val)));
    const barcodes = Array.from(new Set(itemsArr.map((it: any) => (typeof it.barcode === "string" ? it.barcode.trim() : "")).filter((val: string) => !!val)));

    const headersById = new Map<string, any>();
    if (headerIds.length) {
      const headerRows = await db
        .select({
          id: goodsReceiptHeaders.id,
          supplierId: goodsReceiptHeaders.supplierId
        })
        .from(goodsReceiptHeaders)
        .where(inArray(goodsReceiptHeaders.id, headerIds));
      for (const row of headerRows) {
        headersById.set(row.id, row);
      }
    }

    const inventoryById = new Map<string, any>();
    if (itemIds.length) {
      const inventoryRows = await db
        .select({
          id: inventoryItems.id,
          supplierCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode
        })
        .from(inventoryItems)
        .where(inArray(inventoryItems.id, itemIds));
      for (const row of inventoryRows) {
        inventoryById.set(row.id, row);
      }
    }

    const inventoryBySupplierCode = new Map<string, any>();
    if (supplierCodes.length) {
      const codeRows = await db
        .select({
          id: inventoryItems.id,
          supplierCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode
        })
        .from(inventoryItems)
        .where(inArray(inventoryItems.supplierCode, supplierCodes));
      for (const row of codeRows) {
        if (row.supplierCode) {
          inventoryBySupplierCode.set(row.supplierCode, row);
        }
      }
    }

    const inventoryByBarcode = new Map<string, any>();
    if (barcodes.length) {
      const barcodeRows = await db
        .select({
          id: inventoryItems.id,
          supplierCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode
        })
        .from(inventoryItems)
        .where(inArray(inventoryItems.barcode, barcodes));
      for (const row of barcodeRows) {
        if (row.barcode) {
          inventoryByBarcode.set(row.barcode, row);
        }
      }
    }

    const prepared = [] as any[];

    for (const raw of itemsArr) {
      const base = { ...raw };
      if (!base.itemDescription) base.itemDescription = base.description || 'Item';
      if (!base.quantityExpected && base.quantityReceived) base.quantityExpected = base.quantityReceived;

      // Ensure numeric fields are properly typed
      base.quantityExpected = Number(base.quantityExpected) || 0;
      base.quantityReceived = Number(base.quantityReceived) || 0;
      base.quantityDamaged = Number(base.quantityDamaged) || 0;
      base.quantityShort = Number(base.quantityShort) || 0;
      base.unitCost = base.unitCost ? parseFloat(base.unitCost).toFixed(2) : "0.00";
      base.totalCost = base.totalCost ? parseFloat(base.totalCost).toFixed(2) : "0.00";
      
      // Ensure tax and discount fields are properly handled
      base.taxRate = base.taxRate ? parseFloat(base.taxRate).toFixed(2) : "0.00";
      base.taxAmount = base.taxAmount ? parseFloat(base.taxAmount).toFixed(2) : "0.00";
      base.discountRate = base.discountRate ? parseFloat(base.discountRate).toFixed(2) : "0.00";
      base.discountAmount = base.discountAmount ? parseFloat(base.discountAmount).toFixed(2) : "0.00";
      
      // Ensure boolean fields
      base.condition = base.condition || 'Good';

      base.itemId = await this.resolveInventoryItemId(
        base,
        headersById.get(base.receiptHeaderId),
        { inventoryById, inventoryBySupplierCode, inventoryByBarcode }
      );

      try {
        prepared.push(insertGoodsReceiptItemSchema.parse(base));
      } catch (err) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptItemsBulk][VALIDATION FAILED]', { base, err });
        throw err;
      }
    }

    return db.insert(goodsReceiptItems).values(prepared as any).returning();
  }

  private async resolveInventoryItemId(
    item: any,
    header: { supplierId?: string } | undefined,
    caches: {
      inventoryById: Map<string, any>;
      inventoryBySupplierCode: Map<string, any>;
      inventoryByBarcode: Map<string, any>;
    }
  ) {
    const { inventoryById, inventoryBySupplierCode, inventoryByBarcode } = caches;
    const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

    const candidateId = trimmed(item.itemId);
    const supplierCode = trimmed(item.supplierCode);
    const barcode = trimmed(item.barcode);

    if (candidateId) {
      if (inventoryById.has(candidateId)) {
        return candidateId;
      }
      const [row] = await db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, candidateId))
        .limit(1);
      if (row) {
        inventoryById.set(candidateId, row);
        return candidateId;
      }
      console.warn('[GoodsReceiptStorage.resolveInventoryItemId] Provided itemId missing in inventory_items; attempting fallback', { candidateId });
    }

    if (supplierCode) {
      const cached = inventoryBySupplierCode.get(supplierCode);
      if (cached) {
        return cached.id;
      }
      const [row] = await db
        .select({
          id: inventoryItems.id,
          supplierCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.supplierCode, supplierCode))
        .limit(1);
      if (row) {
        inventoryBySupplierCode.set(supplierCode, row);
        if (row.id) inventoryById.set(row.id, row);
        if (row.barcode) inventoryByBarcode.set(row.barcode, row);
        return row.id;
      }
    }

    if (barcode) {
      const cached = inventoryByBarcode.get(barcode);
      if (cached) {
        return cached.id;
      }
      const [row] = await db
        .select({
          id: inventoryItems.id,
          supplierCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.barcode, barcode))
        .limit(1);
      if (row) {
        inventoryByBarcode.set(barcode, row);
        if (row.id) inventoryById.set(row.id, row);
        if (row.supplierCode) inventoryBySupplierCode.set(row.supplierCode, row);
        return row.id;
      }
    }

    // Attempt to create an inventory item when enough data is available
    const autoSupplierCode = supplierCode || `AUTO-${nanoid(8).toUpperCase()}`;
    const payload: any = {
      supplierCode: autoSupplierCode,
      description: item.itemDescription || 'Auto-generated from goods receipt',
      category: item.category || 'Uncategorized',
      unitOfMeasure: item.unitOfMeasure || item.uom || 'EA',
      supplierId: header?.supplierId ?? null,
      barcode: barcode || null
    };

    try {
      const [inserted] = await db
        .insert(inventoryItems)
        .values(payload)
        .returning({
          id: inventoryItems.id,
          supplierCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode
        });
      if (inserted) {
        if (inserted.id) inventoryById.set(inserted.id, inserted);
        if (inserted.supplierCode) inventoryBySupplierCode.set(inserted.supplierCode, inserted);
        if (inserted.barcode) inventoryByBarcode.set(inserted.barcode, inserted);
        console.warn('[GoodsReceiptStorage.resolveInventoryItemId] Created inventory item fallback', { itemId: inserted.id, supplierCode: inserted.supplierCode });
        return inserted.id;
      }
    } catch (error: any) {
      if (error?.code === '23505') {
        console.warn('[GoodsReceiptStorage.resolveInventoryItemId] Unique constraint while creating inventory item; retrying lookup', { supplierCode: autoSupplierCode, barcode });
        if (supplierCode) {
          const [row] = await db
            .select({
              id: inventoryItems.id,
              supplierCode: inventoryItems.supplierCode,
              barcode: inventoryItems.barcode
            })
            .from(inventoryItems)
            .where(eq(inventoryItems.supplierCode, supplierCode))
            .limit(1);
          if (row) {
            inventoryBySupplierCode.set(supplierCode, row);
            if (row.id) inventoryById.set(row.id, row);
            if (row.barcode) inventoryByBarcode.set(row.barcode, row);
            return row.id;
          }
        }
        if (barcode) {
          const [row] = await db
            .select({
              id: inventoryItems.id,
              supplierCode: inventoryItems.supplierCode,
              barcode: inventoryItems.barcode
            })
            .from(inventoryItems)
            .where(eq(inventoryItems.barcode, barcode))
            .limit(1);
          if (row) {
            inventoryByBarcode.set(barcode, row);
            if (row.id) inventoryById.set(row.id, row);
            if (row.supplierCode) inventoryBySupplierCode.set(row.supplierCode, row);
            return row.id;
          }
        }
      } else {
        console.error('[GoodsReceiptStorage.resolveInventoryItemId] Failed to create inventory item', { error, item, payload });
      }
    }

    console.warn('[GoodsReceiptStorage.resolveInventoryItemId] Falling back to null itemId', { supplierCode: item.supplierCode, barcode: item.barcode });
    return null;
  }

  async approveGoodsReceipt(id: string, approvedBy?: string) {
    try {
      console.log('[GoodsReceiptStorage.approveGoodsReceipt][START]', { id, approvedBy });
      
      // First, get the goods receipt details with related data
      const goodsReceipt = await db
        .select({
          id: goodsReceiptHeaders.id,
          receiptNumber: goodsReceiptHeaders.receiptNumber,
          supplierId: goodsReceiptHeaders.supplierId,
          supplierLpoId: goodsReceiptHeaders.supplierLpoId,
          expectedDeliveryDate: goodsReceiptHeaders.expectedDeliveryDate,
          actualDeliveryDate: goodsReceiptHeaders.actualDeliveryDate,
          notes: goodsReceiptHeaders.notes,
          status: goodsReceiptHeaders.status,
        })
        .from(goodsReceiptHeaders)
        .where(eq(goodsReceiptHeaders.id, id))
        .limit(1);

      if (!goodsReceipt.length) {
        throw new Error('Goods receipt not found');
      }

      const receipt = goodsReceipt[0];
      
      // Update the goods receipt header status to Approved
      const updated = await db
        .update(goodsReceiptHeaders)
        .set({ 
          status: 'Approved',
          updatedAt: new Date()
        })
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!updated.length) {
        throw new Error('Goods receipt not found');
      }

      // Automatically create Purchase Invoice
      try {
        await this.createPurchaseInvoiceFromGoodsReceipt(receipt);
        console.log('[GoodsReceiptStorage.approveGoodsReceipt][PURCHASE_INVOICE_CREATED]', { goodsReceiptId: id });
      } catch (invoiceError) {
        console.error('[GoodsReceiptStorage.approveGoodsReceipt][PURCHASE_INVOICE_ERROR]', invoiceError);
        // Don't fail the approval if invoice creation fails, just log it
      }
      
      console.log('[GoodsReceiptStorage.approveGoodsReceipt][SUCCESS]', { id: updated[0]?.id });
      return updated[0];
    } catch (err) {
      console.error('[GoodsReceiptStorage.approveGoodsReceipt] Error', err, { id, approvedBy });
      throw err;
    }
  }

  async updateGoodsReceiptStatus(id: string, status: string) {
    try {
      console.log('[GoodsReceiptStorage.updateGoodsReceiptStatus][START]', { id, status });
      
      const updated = await db
        .update(goodsReceiptHeaders)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!updated.length) {
        throw new Error('Goods receipt not found');
      }
      
      // If status is "Approved", automatically create Purchase Invoice
      if (status === "Approved") {
        try {
          const goodsReceipt = updated[0];
          await this.createPurchaseInvoiceFromGoodsReceipt(goodsReceipt);
          console.log('[GoodsReceiptStorage.updateGoodsReceiptStatus][PURCHASE_INVOICE_CREATED]', { goodsReceiptId: id });
        } catch (invoiceError) {
          console.error('[GoodsReceiptStorage.updateGoodsReceiptStatus][PURCHASE_INVOICE_ERROR]', invoiceError);
          // Don't fail the status update if invoice creation fails, just log it
        }
      }
      
      console.log('[GoodsReceiptStorage.updateGoodsReceiptStatus][SUCCESS]', { id: updated[0]?.id });
      return updated[0];
    } catch (err) {
      console.error('[GoodsReceiptStorage.updateGoodsReceiptStatus] Error', err, { id, status });
      throw err;
    }
  }

  async updateGoodsReceiptHeader(id: string, data: any) {
    try {
      console.log('[GoodsReceiptStorage.updateGoodsReceiptHeader][START]', { id, data });
      
      const updateData = {
        ...data,
        updatedAt: new Date()
      };
      
      const updated = await db
        .update(goodsReceiptHeaders)
        .set(updateData)
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!updated.length) {
        throw new Error('Goods receipt not found');
      }
      
      console.log('[GoodsReceiptStorage.updateGoodsReceiptHeader][SUCCESS]', { id: updated[0]?.id });
      return updated[0];
    } catch (err) {
      console.error('[GoodsReceiptStorage.updateGoodsReceiptHeader] Error', err, { id, data });
      throw err;
    }
  }

  async deleteGoodsReceiptHeader(id: string) {
    try {
      console.log('[GoodsReceiptStorage.deleteGoodsReceiptHeader][START]', { id });
      
      // First delete related goods receipt items
      await db
        .delete(goodsReceiptItems)
        .where(eq(goodsReceiptItems.receiptHeaderId, id));
      
      // Then delete the goods receipt header
      const deleted = await db
        .delete(goodsReceiptHeaders)
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!deleted.length) {
        return false; // Not found
      }
      
      console.log('[GoodsReceiptStorage.deleteGoodsReceiptHeader][SUCCESS]', { id });
      return true;
    } catch (err) {
      console.error('[GoodsReceiptStorage.deleteGoodsReceiptHeader] Error', err, { id });
      throw err;
    }
  }

  async getGoodsReceiptByNumber(receiptNumber: string) {
    try {
      console.log('[GoodsReceiptStorage.getGoodsReceiptByNumber][START]', { receiptNumber });
      
      const [receipt] = await db
        .select()
        .from(goodsReceiptHeaders)
        .where(eq(goodsReceiptHeaders.receiptNumber, receiptNumber))
        .limit(1);
      
      console.log('[GoodsReceiptStorage.getGoodsReceiptByNumber][RESULT]', { found: !!receipt });
      return receipt || null;
    } catch (err) {
      console.error('[GoodsReceiptStorage.getGoodsReceiptByNumber] Error', err, { receiptNumber });
      throw err;
    }
  }

  async getGoodsReceiptItems(goodsReceiptId: string) {
    try {
      console.log('[GoodsReceiptStorage.getGoodsReceiptItems][START]', { goodsReceiptId });
      
      const items = await db
        .select()
        .from(goodsReceiptItems)
        .where(eq(goodsReceiptItems.receiptHeaderId, goodsReceiptId));
      
      console.log('[GoodsReceiptStorage.getGoodsReceiptItems][RESULT]', { count: items.length });
      return items;
    } catch (err) {
      console.error('[GoodsReceiptStorage.getGoodsReceiptItems] Error', err, { goodsReceiptId });
      throw err;
    }
  }

  async getSupplier(supplierId: string) {
    try {
      console.log('[GoodsReceiptStorage.getSupplier][START]', { supplierId });
      
      if (!supplierId) {
        console.log('[GoodsReceiptStorage.getSupplier][NO ID]');
        return null;
      }
      
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      
      console.log('[GoodsReceiptStorage.getSupplier][RESULT]', { found: !!supplier });
      return supplier || null;
    } catch (err) {
      console.error('[GoodsReceiptStorage.getSupplier] Error', err, { supplierId });
      throw err;
    }
  }

  async getSupplierLpo(lpoId: string) {
    try {
      console.log('[GoodsReceiptStorage.getSupplierLpo][START]', { lpoId });
      
      if (!lpoId) {
        console.log('[GoodsReceiptStorage.getSupplierLpo][NO ID]');
        return null;
      }
      
      const [lpo] = await db
        .select()
        .from(supplierLpos)
        .where(eq(supplierLpos.id, lpoId))
        .limit(1);
      
      console.log('[GoodsReceiptStorage.getSupplierLpo][RESULT]', { found: !!lpo });
      return lpo || null;
    } catch (err) {
      console.error('[GoodsReceiptStorage.getSupplierLpo] Error', err, { lpoId });
      throw err;
    }
  }

  async createPurchaseInvoiceFromGoodsReceipt(goodsReceipt: any) {
    try {
      console.log('[GoodsReceiptStorage.createPurchaseInvoiceFromGoodsReceipt][START]', { goodsReceiptId: goodsReceipt.id });
      
      // Get goods receipt items
      const items = await db
        .select()
        .from(goodsReceiptItems)
        .where(eq(goodsReceiptItems.receiptHeaderId, goodsReceipt.id));

      if (!items.length) {
        console.log('[GoodsReceiptStorage.createPurchaseInvoiceFromGoodsReceipt][NO_ITEMS]', { goodsReceiptId: goodsReceipt.id });
        return null;
      }

      // Calculate totals
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      const purchaseInvoiceItems = items.map((item) => {
        const unitPrice = parseFloat(item.unitCost || "0");
        // Use quantityReceived if it's greater than 0, otherwise use quantityExpected
        const quantity = (item.quantityReceived && item.quantityReceived > 0) ? item.quantityReceived : item.quantityExpected;
        const totalPrice = unitPrice * quantity;
        subtotal += totalPrice;
        
        // Use discount and VAT data from goods receipt item (which should have been populated from LPO)
        const taxRate = item.taxRate || "0";
        const taxAmount = parseFloat(item.taxAmount || "0");
        const discountRate = item.discountRate || "0";
        const discountAmount = parseFloat(item.discountAmount || "0");
        
        // Add to totals
        totalDiscount += discountAmount;
        totalTax += taxAmount;
        
        return {
          id: randomUUID(),
          purchaseInvoiceId: "", // Will be set after invoice creation
          goodsReceiptItemId: item.id,
          lpoItemId: item.lpoItemId,
          itemId: item.itemId,
          variantId: item.variantId,
          barcode: item.barcode,
          supplierCode: item.supplierCode,
          itemDescription: item.itemDescription,
          quantity: quantity,
          unitPrice: unitPrice.toString(),
          totalPrice: totalPrice.toString(),
          unitOfMeasure: "EA", // Default unit of measure
          taxRate: taxRate,
          taxAmount: taxAmount,
          discountRate: discountRate,
          discountAmount: discountAmount,
          storageLocation: item.storageLocation,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : undefined,
          condition: item.condition || "Good",
          notes: item.discrepancyReason,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      const netAmount = subtotal - totalDiscount;
      const totalAmount = netAmount + totalTax;
      
      // Generate invoice numbers
      const invoiceNumber = `PI-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      const supplierInvoiceNumber = `SUP-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      
      // Create purchase invoice
      const purchaseInvoiceData = {
        id: randomUUID(),
        invoiceNumber: invoiceNumber,
        supplierInvoiceNumber: supplierInvoiceNumber,
        supplierId: goodsReceipt.supplierId,
        goodsReceiptId: goodsReceipt.id,
        lpoId: goodsReceipt.supplierLpoId || null,
        status: "Draft",
        paymentStatus: "Unpaid",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: goodsReceipt.expectedDeliveryDate || new Date().toISOString().split('T')[0],
        receivedDate: goodsReceipt.actualDeliveryDate || new Date().toISOString().split('T')[0],
        subtotal: subtotal.toString(),
        taxAmount: totalTax.toString(),
        discountAmount: totalDiscount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: "0.00",
        remainingAmount: totalAmount.toString(),
        currency: "BHD",
        paymentTerms: goodsReceipt.notes || "Net 30",
        notes: `Auto-generated from approved goods receipt ${goodsReceipt.receiptNumber}`,
        attachments: [],
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert purchase invoice
      const [createdInvoice] = await db
        .insert(purchaseInvoices)
        .values(purchaseInvoiceData)
        .returning();

      // Update purchase invoice items with the correct invoice ID
      const itemsWithInvoiceId = purchaseInvoiceItems.map(item => ({
        ...item,
        purchaseInvoiceId: createdInvoice.id,
      }));

      // Insert purchase invoice items
      await db
        .insert(purchaseInvoiceItems)
        .values(itemsWithInvoiceId);

      console.log('[GoodsReceiptStorage.createPurchaseInvoiceFromGoodsReceipt][SUCCESS]', { 
        goodsReceiptId: goodsReceipt.id, 
        purchaseInvoiceId: createdInvoice.id,
        invoiceNumber: createdInvoice.invoiceNumber 
      });
      
      return createdInvoice;
    } catch (err) {
      console.error('[GoodsReceiptStorage.createPurchaseInvoiceFromGoodsReceipt] Error', err, { goodsReceiptId: goodsReceipt.id });
      throw err;
    }
  }
}
