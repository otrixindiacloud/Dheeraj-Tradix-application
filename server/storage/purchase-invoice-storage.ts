import { db, pool } from "../db";
import { purchaseInvoices, purchaseInvoiceItems, suppliers, goodsReceiptHeaders, goodsReceiptItems, supplierLpos, supplierLpoItems, inventoryItems, inventoryVariants } from "../../shared/schema";
import { eq, and, desc, sql, isNotNull, inArray } from "drizzle-orm";
import { InsertPurchaseInvoice, InsertPurchaseInvoiceItem } from "../../shared/schema";

export class PurchaseInvoiceStorage {
  async createPurchaseInvoice(data: InsertPurchaseInvoice, items?: InsertPurchaseInvoiceItem[]) {
    try {
      console.log('[PurchaseInvoiceStorage.createPurchaseInvoice][START]', data, items);
      
      const assignedId = crypto.randomUUID();
      const toInsert = {
        ...data,
        id: assignedId,
      };

      const projected = {
        id: toInsert.id,
        invoiceNumber: toInsert.invoiceNumber,
        supplierInvoiceNumber: toInsert.supplierInvoiceNumber,
        supplierId: toInsert.supplierId,
        goodsReceiptId: toInsert.goodsReceiptId,
        lpoId: toInsert.lpoId,
        status: toInsert.status,
        paymentStatus: toInsert.paymentStatus,
        invoiceDate: toInsert.invoiceDate,
        dueDate: toInsert.dueDate,
        receivedDate: toInsert.receivedDate,
        paymentDate: toInsert.paymentDate,
        subtotal: toInsert.subtotal,
        taxAmount: toInsert.taxAmount,
        discountAmount: toInsert.discountAmount,
        totalAmount: toInsert.totalAmount,
        paidAmount: toInsert.paidAmount,
        remainingAmount: toInsert.remainingAmount,
        currency: toInsert.currency,
        paymentTerms: toInsert.paymentTerms,
        notes: toInsert.notes,
        attachments: toInsert.attachments,
        isRecurring: toInsert.isRecurring,
      };

      const inserted = await db
        .insert(purchaseInvoices)
        .values(projected)
        .returning();

      const createdInvoice = inserted[0];

      // Create purchase invoice items if provided
      if (items && items.length > 0) {
        const itemsWithInvoiceId = items.map(item => ({
          ...item,
          purchaseInvoiceId: createdInvoice.id,
        }));

        await db
          .insert(purchaseInvoiceItems)
          .values(itemsWithInvoiceId);
      }

      console.log('[PurchaseInvoiceStorage.createPurchaseInvoice][SUCCESS]', createdInvoice);
      return createdInvoice;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.createPurchaseInvoice] Error', err, data);
      throw err;
    }
  }

  async getPurchaseInvoices(filters: any = {}) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoices][START]', filters);
      
      const query = db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          goodsReceiptId: purchaseInvoices.goodsReceiptId,
          lpoId: purchaseInvoices.lpoId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          receivedDate: purchaseInvoices.receivedDate,
          paymentDate: purchaseInvoices.paymentDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          discountAmount: purchaseInvoices.discountAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          remainingAmount: purchaseInvoices.remainingAmount,
          currency: purchaseInvoices.currency,
          paymentTerms: purchaseInvoices.paymentTerms,
          notes: purchaseInvoices.notes,
          attachments: purchaseInvoices.attachments,
          isRecurring: purchaseInvoices.isRecurring,
          createdAt: purchaseInvoices.createdAt,
          updatedAt: purchaseInvoices.updatedAt,
          // Supplier information
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          supplierPhone: suppliers.phone,
          supplierAddress: suppliers.address,
          // Goods receipt information
          goodsReceiptNumber: goodsReceiptHeaders.receiptNumber,
          // LPO information
          lpoNumber: supplierLpos.lpoNumber,
          lpoDate: supplierLpos.lpoDate,
          lpoStatus: supplierLpos.status,
          lpoTotalAmount: supplierLpos.totalAmount,
          lpoCurrency: supplierLpos.currency,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .leftJoin(goodsReceiptHeaders, eq(purchaseInvoices.goodsReceiptId, goodsReceiptHeaders.id))
        .leftJoin(supplierLpos, eq(purchaseInvoices.lpoId, supplierLpos.id))
        .orderBy(desc(purchaseInvoices.createdAt));

      const results = await query;
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoices][SUCCESS]', results.length, 'records');
      return results;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoices] Error', err, filters);
      throw err;
    }
  }

  async getPurchaseInvoicesByLpoId(lpoId: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoicesByLpoId][START]', { lpoId });
      
      const query = db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          goodsReceiptId: purchaseInvoices.goodsReceiptId,
          lpoId: purchaseInvoices.lpoId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          receivedDate: purchaseInvoices.receivedDate,
          paymentDate: purchaseInvoices.paymentDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          discountAmount: purchaseInvoices.discountAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          remainingAmount: purchaseInvoices.remainingAmount,
          currency: purchaseInvoices.currency,
          paymentTerms: purchaseInvoices.paymentTerms,
          notes: purchaseInvoices.notes,
          attachments: purchaseInvoices.attachments,
          isRecurring: purchaseInvoices.isRecurring,
          createdAt: purchaseInvoices.createdAt,
          updatedAt: purchaseInvoices.updatedAt,
          // Supplier information
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          supplierPhone: suppliers.phone,
          supplierAddress: suppliers.address,
          // Goods receipt information
          goodsReceiptNumber: goodsReceiptHeaders.receiptNumber,
          // LPO information
          lpoNumber: supplierLpos.lpoNumber,
          lpoDate: supplierLpos.lpoDate,
          lpoStatus: supplierLpos.status,
          lpoTotalAmount: supplierLpos.totalAmount,
          lpoCurrency: supplierLpos.currency,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .leftJoin(goodsReceiptHeaders, eq(purchaseInvoices.goodsReceiptId, goodsReceiptHeaders.id))
        .leftJoin(supplierLpos, eq(purchaseInvoices.lpoId, supplierLpos.id))
        .where(eq(purchaseInvoices.lpoId, lpoId))
        .orderBy(desc(purchaseInvoices.createdAt));

      const results = await query;
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoicesByLpoId][SUCCESS]', results.length, 'records');
      return results;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoicesByLpoId] Error', err, { lpoId });
      throw err;
    }
  }

  async getPurchaseInvoicesBySupplierQuoteId(supplierQuoteId: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoicesBySupplierQuoteId][START]', { supplierQuoteId });
      
      // First, find all LPOs that were created from this supplier quote
      // LPOs have sourceQuotationIds as a JSONB array containing supplier quote IDs
      const allLpos = await db
        .select({ id: supplierLpos.id, sourceQuotationIds: supplierLpos.sourceQuotationIds })
        .from(supplierLpos);

      // Filter LPOs that contain this supplier quote ID in their sourceQuotationIds array
      const relatedLpos = allLpos.filter((lpo: any) => {
        if (!lpo.sourceQuotationIds) return false;
        const ids = Array.isArray(lpo.sourceQuotationIds) 
          ? lpo.sourceQuotationIds 
          : (typeof lpo.sourceQuotationIds === 'string' ? JSON.parse(lpo.sourceQuotationIds) : []);
        return ids.includes(supplierQuoteId);
      });

      if (relatedLpos.length === 0) {
        console.log('[PurchaseInvoiceStorage.getPurchaseInvoicesBySupplierQuoteId][NO_LPOS]', { supplierQuoteId });
        return [];
      }

      const lpoIds = relatedLpos.map(l => l.id);
      
      // Now get purchase invoices for those LPOs
      const query = db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          goodsReceiptId: purchaseInvoices.goodsReceiptId,
          lpoId: purchaseInvoices.lpoId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          receivedDate: purchaseInvoices.receivedDate,
          paymentDate: purchaseInvoices.paymentDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          discountAmount: purchaseInvoices.discountAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          remainingAmount: purchaseInvoices.remainingAmount,
          currency: purchaseInvoices.currency,
          paymentTerms: purchaseInvoices.paymentTerms,
          notes: purchaseInvoices.notes,
          attachments: purchaseInvoices.attachments,
          isRecurring: purchaseInvoices.isRecurring,
          createdAt: purchaseInvoices.createdAt,
          updatedAt: purchaseInvoices.updatedAt,
          // Supplier information
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          supplierPhone: suppliers.phone,
          supplierAddress: suppliers.address,
          // Goods receipt information
          goodsReceiptNumber: goodsReceiptHeaders.receiptNumber,
          // LPO information
          lpoNumber: supplierLpos.lpoNumber,
          lpoDate: supplierLpos.lpoDate,
          lpoStatus: supplierLpos.status,
          lpoTotalAmount: supplierLpos.totalAmount,
          lpoCurrency: supplierLpos.currency,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .leftJoin(goodsReceiptHeaders, eq(purchaseInvoices.goodsReceiptId, goodsReceiptHeaders.id))
        .leftJoin(supplierLpos, eq(purchaseInvoices.lpoId, supplierLpos.id))
        .where(inArray(purchaseInvoices.lpoId, lpoIds))
        .orderBy(desc(purchaseInvoices.createdAt));

      const results = await query;
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoicesBySupplierQuoteId][SUCCESS]', results.length, 'records');
      return results;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoicesBySupplierQuoteId] Error', err, { supplierQuoteId });
      throw err;
    }
  }

  async getPurchaseInvoice(id: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoice][START]', { id });
      
      // First check if the invoice exists
      const invoiceExists = await db
        .select({ id: purchaseInvoices.id })
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.id, id))
        .limit(1);

      if (!invoiceExists.length) {
        console.log('[PurchaseInvoiceStorage.getPurchaseInvoice][NOT_FOUND]', { id });
        return null;
      }

      // Get invoice with joined data - use sql for nullable joined fields to avoid Object.entries errors
      const r = await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: sql<string | null>`${suppliers.name}`,
          supplierEmail: sql<string | null>`${suppliers.email}`,
          supplierPhone: sql<string | null>`${suppliers.phone}`,
          supplierAddress: sql<string | null>`${suppliers.address}`,
          goodsReceiptId: purchaseInvoices.goodsReceiptId,
          goodsReceiptNumber: sql<string | null>`${goodsReceiptHeaders.receiptNumber}`,
          lpoId: purchaseInvoices.lpoId,
          purchaseOrderNumber: sql<string | null>`${supplierLpos.lpoNumber}`,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          receivedDate: purchaseInvoices.receivedDate,
          paymentDate: purchaseInvoices.paymentDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          discountAmount: purchaseInvoices.discountAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          remainingAmount: purchaseInvoices.remainingAmount,
          currency: purchaseInvoices.currency,
          paymentTerms: purchaseInvoices.paymentTerms,
          notes: purchaseInvoices.notes,
          attachments: purchaseInvoices.attachments,
          isRecurring: purchaseInvoices.isRecurring,
          createdAt: purchaseInvoices.createdAt,
          updatedAt: purchaseInvoices.updatedAt,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .leftJoin(goodsReceiptHeaders, eq(purchaseInvoices.goodsReceiptId, goodsReceiptHeaders.id))
        .leftJoin(supplierLpos, eq(purchaseInvoices.lpoId, supplierLpos.id))
        .where(eq(purchaseInvoices.id, id))
        .limit(1);

      if (!r.length) {
        console.log('[PurchaseInvoiceStorage.getPurchaseInvoice][NOT_FOUND]', { id });
        return null;
      }

      // Get item count separately
      const invoiceWithCount = r[0];
      const items = await this.getPurchaseInvoiceItems(id);
      
      return {
        ...invoiceWithCount,
        itemCount: items.length,
      };
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoice] Error', err, { id });
      throw err;
    }
  }

  async updatePurchaseInvoice(id: string, data: Partial<InsertPurchaseInvoice>) {
    try {
      console.log('[PurchaseInvoiceStorage.updatePurchaseInvoice][START]', { id, data });
      
      // Filter out fields that shouldn't be updated
      const { id: _, createdAt, updatedAt, ...cleanData } = data as any;
      
      const updated = await db
        .update(purchaseInvoices)
        .set({
          ...cleanData,
          updatedAt: new Date(),
        })
        .where(eq(purchaseInvoices.id, id))
        .returning();

      if (!updated.length) {
        console.log('[PurchaseInvoiceStorage.updatePurchaseInvoice][NOT_FOUND]', { id });
        return null;
      }

      console.log('[PurchaseInvoiceStorage.updatePurchaseInvoice][SUCCESS]', updated[0]);
      return updated[0];
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.updatePurchaseInvoice] Error', err, { id, data });
      throw err;
    }
  }

  async deletePurchaseInvoice(id: string) {
    try {
      console.log('[PurchaseInvoiceStorage.deletePurchaseInvoice][START]', { id });
      
      const deleted = await db
        .delete(purchaseInvoices)
        .where(eq(purchaseInvoices.id, id))
        .returning();

      if (!deleted.length) {
        return false; // Not found
      }

      console.log('[PurchaseInvoiceStorage.deletePurchaseInvoice][SUCCESS]', { id });
      return true;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.deletePurchaseInvoice] Error', err, { id });
      throw err;
    }
  }

  async getPurchaseInvoiceItems(purchaseInvoiceId: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoiceItems][START]', { purchaseInvoiceId });
      
      // Use raw SQL via pool directly to completely bypass Drizzle schema validation
      // This avoids issues with goods_receipt_item_id and lpo_item_id columns which may not exist in the database
      // Join through LPO items to supplier quote items to get specifications and other details
      let query = `
        SELECT 
          pi.id,
          pi.purchase_invoice_id as "purchaseInvoiceId",
          pi.item_id as "itemId",
          pi.variant_id as "variantId",
          pi.lpo_item_id as "lpoItemId",
          pi.barcode,
          pi.supplier_code as "supplierCode",
          pi.item_description as "itemDescription",
          pi.quantity,
          pi.unit_price as "unitPrice",
          pi.total_price as "totalPrice",
          pi.tax_rate as "taxRate",
          pi.tax_amount as "taxAmount",
          pi.discount_rate as "discountRate",
          pi.discount_amount as "discountAmount",
          pi.unit_of_measure as "unitOfMeasure",
          pi.storage_location as "storageLocation",
          pi.batch_number as "batchNumber",
          pi.expiry_date as "expiryDate",
          pi.condition,
          pi.notes,
          ii.description as "itemDescriptionFromItem",
          ii.category as "itemCategory",
          ii.storage_location as "itemStorageLocation",
          ii.dimensions as "itemDimensions",
          ii.weight as "itemWeight",
          ii.supplier_code as "itemSupplierCode",
          ii.barcode as "itemBarcode",
          iv.variant_name as "variantName",
          iv.variant_value as "variantValue",
          iv.additional_cost as "variantAdditionalCost",
          -- Supplier quote item details (via LPO item)
          sqi.specification as "specification",
          sqi.brand as "brand",
          sqi.model as "model",
          sqi.warranty as "warranty",
          sqi.lead_time as "leadTime",
          sqi.notes as "supplierQuoteNotes",
          pi.created_at as "createdAt",
          pi.updated_at as "updatedAt"
        FROM purchase_invoice_items pi
        LEFT JOIN inventory_items ii ON pi.item_id = ii.id
        LEFT JOIN inventory_variants iv ON pi.variant_id = iv.id
        LEFT JOIN supplier_lpo_items lpoi ON pi.lpo_item_id = lpoi.id
        LEFT JOIN supplier_quote_items sqi ON lpoi.quotation_item_id = sqi.id
        WHERE pi.purchase_invoice_id = $1
        ORDER BY pi.item_description
      `;
      
      let result;
      try {
        result = await pool.query(query, [purchaseInvoiceId]);
      } catch (err: any) {
        // If error is about missing column lpo_item_id, retry without it
        if (err.code === '42703' && err.message?.includes('lpo_item_id')) {
          console.log('[PurchaseInvoiceStorage.getPurchaseInvoiceItems] lpo_item_id column does not exist, retrying without it');
          query = `
            SELECT 
              pi.id,
              pi.purchase_invoice_id as "purchaseInvoiceId",
              pi.item_id as "itemId",
              pi.variant_id as "variantId",
              NULL as "lpoItemId",
              pi.barcode,
              pi.supplier_code as "supplierCode",
              pi.item_description as "itemDescription",
              pi.quantity,
              pi.unit_price as "unitPrice",
              pi.total_price as "totalPrice",
              pi.tax_rate as "taxRate",
              pi.tax_amount as "taxAmount",
              pi.discount_rate as "discountRate",
              pi.discount_amount as "discountAmount",
              pi.unit_of_measure as "unitOfMeasure",
              pi.storage_location as "storageLocation",
              pi.batch_number as "batchNumber",
              pi.expiry_date as "expiryDate",
              pi.condition,
              pi.notes,
              ii.description as "itemDescriptionFromItem",
              ii.category as "itemCategory",
              ii.storage_location as "itemStorageLocation",
              ii.dimensions as "itemDimensions",
              ii.weight as "itemWeight",
              ii.supplier_code as "itemSupplierCode",
              ii.barcode as "itemBarcode",
              iv.variant_name as "variantName",
              iv.variant_value as "variantValue",
              iv.additional_cost as "variantAdditionalCost",
              NULL as "specification",
              NULL as "brand",
              NULL as "model",
              NULL as "warranty",
              NULL as "leadTime",
              NULL as "supplierQuoteNotes",
              pi.created_at as "createdAt",
              pi.updated_at as "updatedAt"
            FROM purchase_invoice_items pi
            LEFT JOIN inventory_items ii ON pi.item_id = ii.id
            LEFT JOIN inventory_variants iv ON pi.variant_id = iv.id
            WHERE pi.purchase_invoice_id = $1
            ORDER BY pi.item_description
          `;
          result = await pool.query(query, [purchaseInvoiceId]);
        } else {
          // Re-throw if it's a different error
          throw err;
        }
      }
      
      const rows = result.rows;

      // Map results to add item object for PDF generation and structure related data
      const items = rows.map(row => ({
        ...row,
        // Set goodsReceiptItemId to null since column doesn't exist
        goodsReceiptItemId: null,
        // Structured variant information
        variant: row.variantId && row.variantName ? {
          id: row.variantId,
          variantName: row.variantName,
          variantValue: row.variantValue,
          additionalCost: row.variantAdditionalCost,
        } : undefined,
        // Goods receipt item information not available (column doesn't exist in DB)
        goodsReceiptItem: undefined,
        // Supplier quote item information
        supplierQuoteItem: row.specification ? {
          specification: row.specification,
          brand: row.brand,
          model: row.model,
          warranty: row.warranty,
          leadTime: row.leadTime,
          notes: row.supplierQuoteNotes,
        } : undefined,
        // Item object for PDF generation (maintain backward compatibility)
        item: row.itemDescriptionFromItem ? {
          itemName: row.itemDescriptionFromItem,
          description: row.itemDescriptionFromItem,
          category: row.itemCategory,
          storageLocation: row.itemStorageLocation,
          dimensions: row.itemDimensions,
          weight: row.itemWeight,
          itemCode: row.supplierCode || row.itemSupplierCode,
          barcode: row.barcode || row.itemBarcode,
        } : undefined,
        // Enhanced item description with specifications
        itemDescriptionWithSpecs: row.specification 
          ? `${row.itemDescription}${row.specification ? '\n' + row.specification : ''}${row.brand ? '\nBrand: ' + row.brand : ''}${row.model ? ' | Model: ' + row.model : ''}`
          : row.itemDescription
      }));

      console.log('[PurchaseInvoiceStorage.getPurchaseInvoiceItems][SUCCESS]', { 
        purchaseInvoiceId, 
        itemsCount: items.length,
        itemsWithVariants: items.filter(i => i.variant).length,
        itemsWithGoodsReceipt: items.filter(i => i.goodsReceiptItem).length,
        itemsWithInventory: items.filter(i => i.itemId).length
      });
      return items;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoiceItems] Error', err, { purchaseInvoiceId });
      throw err;
    }
  }

  async getUniqueSupplierInvoiceNumbers() {
    try {
      console.log('[PurchaseInvoiceStorage.getUniqueSupplierInvoiceNumbers][START]');
      
      const result = await db
        .selectDistinct({
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
        })
        .from(purchaseInvoices)
        .where(isNotNull(purchaseInvoices.supplierInvoiceNumber));

      const supplierInvoiceNumbers = result
        .map((row: any) => row.supplierInvoiceNumber)
        .filter(Boolean) // Remove null/undefined values
        .sort();

      console.log('[PurchaseInvoiceStorage.getUniqueSupplierInvoiceNumbers][RESULT]', supplierInvoiceNumbers.length, 'unique supplier invoice numbers found');
      return supplierInvoiceNumbers;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getUniqueSupplierInvoiceNumbers][ERROR]', err);
      throw err;
    }
  }

  async getLpoDiscountVatDetails(lpoId: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getLpoDiscountVatDetails][START]', { lpoId });
      
      // Get LPO header details
      const lpoHeader = await db
        .select({
          id: supplierLpos.id,
          lpoNumber: supplierLpos.lpoNumber,
          supplierId: supplierLpos.supplierId,
          lpoDate: supplierLpos.lpoDate,
          subtotal: supplierLpos.subtotal,
          taxAmount: supplierLpos.taxAmount,
          totalAmount: supplierLpos.totalAmount,
          currency: supplierLpos.currency,
          status: supplierLpos.status,
        })
        .from(supplierLpos)
        .where(eq(supplierLpos.id, lpoId))
        .limit(1);

      if (!lpoHeader.length) {
        console.log('[PurchaseInvoiceStorage.getLpoDiscountVatDetails][NOT_FOUND]', { lpoId });
        return null;
      }

      // Get LPO items with discount and VAT details
      const lpoItems = await db
        .select({
          id: supplierLpoItems.id,
          lineNumber: supplierLpoItems.lineNumber,
          itemDescription: supplierLpoItems.itemDescription,
          quantity: supplierLpoItems.quantity,
          unitCost: supplierLpoItems.unitCost,
          totalCost: supplierLpoItems.totalCost,
          discountPercent: supplierLpoItems.discountPercent,
          discountAmount: supplierLpoItems.discountAmount,
          vatPercent: supplierLpoItems.vatPercent,
          vatAmount: supplierLpoItems.vatAmount,
          supplierCode: supplierLpoItems.supplierCode,
          barcode: supplierLpoItems.barcode,
        })
        .from(supplierLpoItems)
        .where(eq(supplierLpoItems.supplierLpoId, lpoId))
        .orderBy(supplierLpoItems.lineNumber);

      console.log('[PurchaseInvoiceStorage.getLpoDiscountVatDetails][SUCCESS]', { 
        lpoId, 
        headerFound: !!lpoHeader[0], 
        itemsCount: lpoItems.length 
      });

      return {
        lpo: lpoHeader[0],
        items: lpoItems
      };
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getLpoDiscountVatDetails][ERROR]', err, { lpoId });
      throw err;
    }
  }
}

export const purchaseInvoiceStorage = new PurchaseInvoiceStorage();
