import { db } from "../db";
import { supplierLpos, supplierLpoItems, salesOrders, salesOrderItems, items, suppliers, supplierQuotes, supplierQuoteItems, enquiries, customers, InsertSupplierLpo, InsertSupplierLpoItem, type SupplierLpo } from "@shared/schema";
import { and, desc, eq, sql, inArray, or } from "drizzle-orm";
import { BaseStorage } from "./base";

export class SupplierLpoStorage extends BaseStorage {
  async getSupplierLpos(limit = 50, offset = 0, filters?: { status?: string; supplierId?: string; dateFrom?: string; dateTo?: string; search?: string; }) {
    // First, get the LPOs with supplier data
    let base = db.select({
      id: supplierLpos.id,
      lpoNumber: supplierLpos.lpoNumber,
      supplierId: supplierLpos.supplierId,
      supplierName: suppliers.name,
      status: supplierLpos.status,
      lpoDate: supplierLpos.lpoDate,
      expectedDeliveryDate: supplierLpos.expectedDeliveryDate,
      requestedDeliveryDate: supplierLpos.requestedDeliveryDate,
      subtotal: supplierLpos.subtotal,
      taxAmount: supplierLpos.taxAmount,
      totalAmount: supplierLpos.totalAmount,
      currency: supplierLpos.currency,
      requiresApproval: supplierLpos.requiresApproval,
      paymentTerms: supplierLpos.paymentTerms,
      deliveryTerms: supplierLpos.deliveryTerms,
      version: supplierLpos.version,
      createdAt: supplierLpos.createdAt,
      updatedAt: supplierLpos.updatedAt,
      createdBy: supplierLpos.createdBy,
      sourceType: supplierLpos.sourceType,
      sourceSalesOrderIds: supplierLpos.sourceSalesOrderIds,
      sourceQuotationIds: supplierLpos.sourceQuotationIds,
      groupingCriteria: supplierLpos.groupingCriteria,
      termsAndConditions: supplierLpos.termsAndConditions,
      specialInstructions: supplierLpos.specialInstructions,
      parentLpoId: supplierLpos.parentLpoId,
      amendmentReason: supplierLpos.amendmentReason,
      amendmentType: supplierLpos.amendmentType,
      approvedBy: supplierLpos.approvedBy,
      approvedAt: supplierLpos.approvedAt,
      approvalNotes: supplierLpos.approvalNotes,
      sentToSupplierAt: supplierLpos.sentToSupplierAt,
      confirmedBySupplierAt: supplierLpos.confirmedBySupplierAt,
      supplierConfirmationReference: supplierLpos.supplierConfirmationReference,
      supplierContactPerson: supplierLpos.supplierContactPerson,
      supplierEmail: supplierLpos.supplierEmail,
      supplierPhone: supplierLpos.supplierPhone
    }).from(supplierLpos)
    .leftJoin(suppliers, eq(supplierLpos.supplierId, suppliers.id));
    
    const conditions: any[] = [];
    if (filters) {
      if (filters.status) conditions.push(eq(supplierLpos.status, filters.status as any));
      if (filters.supplierId) conditions.push(eq(supplierLpos.supplierId, filters.supplierId));
      if (filters.dateFrom) conditions.push(sql`${supplierLpos.lpoDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${supplierLpos.lpoDate} <= ${filters.dateTo}`);
      if (filters.search) conditions.push(sql`(${supplierLpos.lpoNumber} ILIKE ${`%${filters.search}%`} OR ${suppliers.name} ILIKE ${`%${filters.search}%`})`);
      if (conditions.length) base = (base as any).where(and(...conditions));
    }
    const lpos = await (base as any).orderBy(desc(supplierLpos.createdAt)).limit(limit).offset(offset);
    
    // Enrich with customer data from source sales orders
    const enrichedLpos = await Promise.all(lpos.map(async (lpo: any) => {
      if (lpo.sourceSalesOrderIds && Array.isArray(lpo.sourceSalesOrderIds) && lpo.sourceSalesOrderIds.length > 0) {
        try {
          // Get customer data from the first source sales order
          const firstSalesOrderId = lpo.sourceSalesOrderIds[0];
          const salesOrderWithCustomer = await db
            .select({
              customerId: customers.id,
              customerName: customers.name
            })
            .from(salesOrders)
            .leftJoin(customers, eq(salesOrders.customerId, customers.id))
            .where(eq(salesOrders.id, firstSalesOrderId))
            .limit(1);
          
          if (salesOrderWithCustomer[0]) {
            return {
              ...lpo,
              customerId: salesOrderWithCustomer[0].customerId,
              customerName: salesOrderWithCustomer[0].customerName
            };
          }
        } catch (error) {
          console.error('Error fetching customer data for LPO:', lpo.id, error);
        }
      }
      
      // Try to extract customer name from notes/special instructions as fallback
      let customerName = null;
      if (lpo.specialInstructions) {
        const customerMatch = lpo.specialInstructions.match(/from customer\s+([^,\s]+)/i);
        if (customerMatch && customerMatch[1]) {
          customerName = customerMatch[1];
        }
      }
      
      return {
        ...lpo,
        customerId: null,
        customerName: customerName
      };
    }));
    
    return enrichedLpos;
  }
  async getSupplierLpo(id: string) { const r = await db.select().from(supplierLpos).where(eq(supplierLpos.id, id)).limit(1); return r[0]; }
  
  async getSupplierLposCount(filters?: { status?: string; supplierId?: string; dateFrom?: string; dateTo?: string; search?: string; }) {
    let base = db.select({ count: sql<number>`count(*)` }).from(supplierLpos)
      .leftJoin(suppliers, eq(supplierLpos.supplierId, suppliers.id));
    
    const conditions: any[] = [];
    if (filters) {
      if (filters.status) conditions.push(eq(supplierLpos.status, filters.status as any));
      if (filters.supplierId) conditions.push(eq(supplierLpos.supplierId, filters.supplierId));
      if (filters.dateFrom) conditions.push(sql`${supplierLpos.lpoDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${supplierLpos.lpoDate} <= ${filters.dateTo}`);
      if (filters.search) conditions.push(sql`(${supplierLpos.lpoNumber} ILIKE ${`%${filters.search}%`} OR ${suppliers.name} ILIKE ${`%${filters.search}%`})`);
      if (conditions.length) base = (base as any).where(and(...conditions));
    }
    const result = await base;
    return result[0]?.count || 0;
  }
  async createSupplierLpo(data: Partial<InsertSupplierLpo>) {
    try {
      const lpoNumber = data.lpoNumber || this.generateNumber("LPO");
      let supplierId = data.supplierId;
      
      if (!supplierId) {
        // Use raw SQL to get or create supplier
        const existing = await db.execute(sql`SELECT id FROM suppliers LIMIT 1`);
        const existingArray = existing.rows || existing;
        if (existingArray[0]) {
          supplierId = existingArray[0].id;
        } else {
          const created = await db.execute(sql`
            INSERT INTO suppliers (id, name, contact_person, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Auto Supplier', 'System', NOW(), NOW())
            RETURNING id
          `);
          const createdArray = created.rows || created;
          supplierId = createdArray[0].id;
        }
      }
      
      console.debug('[SupplierLpoStorage.createSupplierLpo] Preparing insert', { lpoNumber, supplierId });
      
      // Use raw SQL to insert LPO
      const inserted = await db.execute(sql`
        INSERT INTO supplier_lpos (
          id, lpo_number, supplier_id, status, source_type, grouping_criteria,
          subtotal, tax_amount, total_amount, currency, requires_approval, 
          created_by, source_sales_order_ids, source_quotation_ids, 
          created_at, updated_at, version
        ) VALUES (
          gen_random_uuid(), ${lpoNumber}, ${supplierId}, ${data.status || 'Draft'}, 
          ${data.sourceType || 'Manual'}, ${data.groupingCriteria || null},
          ${data.subtotal || '0'}, ${data.taxAmount || '0'}, ${data.totalAmount || '0'}, 
          ${data.currency || 'BHD'}, ${data.requiresApproval || false}, 
          ${data.createdBy || null}, 
          ${data.sourceSalesOrderIds ? JSON.stringify(data.sourceSalesOrderIds) : null}, 
          ${data.sourceQuotationIds ? JSON.stringify(data.sourceQuotationIds) : null}, 
          NOW(), NOW(), 1
        ) RETURNING *
      `);
      
      console.debug('[SupplierLpoStorage.createSupplierLpo] Insert result', inserted);
      const insertedArray = inserted.rows || inserted;
      if (!insertedArray || !insertedArray[0]) {
        console.error('[SupplierLpoStorage.createSupplierLpo] Insert returned empty result set', { data });
        throw new Error('Failed to insert supplier LPO');
      }
      return insertedArray[0];
    } catch (error) {
      console.error('[SupplierLpoStorage.createSupplierLpo] Error:', error);
      throw error;
    }
  }
  async updateSupplierLpo(id: string, data: Partial<InsertSupplierLpo>) { const updated: any = { ...data, updatedAt: new Date() }; const res = await db.update(supplierLpos).set(updated).where(eq(supplierLpos.id, id)).returning(); return res[0]; }
  async updateSupplierLpoStatus(id: string, status: string, userId?: string) {
    const allowedStatuses = ["Draft", "Pending", "Sent", "Confirmed", "Received", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      console.error(`[updateSupplierLpoStatus] Invalid status value: ${status}`);
      throw new Error(`Invalid status value: ${status}`);
    }
    console.log(`[updateSupplierLpoStatus] Attempting update: id=${id}, status=${status}, userId=${userId}`);
    const updated = {
      status: status as "Draft" | "Pending" | "Sent" | "Confirmed" | "Received" | "Cancelled",
      updatedAt: new Date(),
      updatedBy: userId || null
    };
    const res = await db.update(supplierLpos)
      .set(updated)
      .where(eq(supplierLpos.id, id))
      .returning();
    console.log(`[updateSupplierLpoStatus] Update result:`, res);
    return res[0];
  }
  async deleteSupplierLpo(id: string) { await db.delete(supplierLpos).where(eq(supplierLpos.id, id)); }
  async createSupplierLposFromSalesOrders(salesOrderIds: string[], groupBy: string, userId?: string, supplierIdOverride?: string) {
    if (!salesOrderIds.length) return [];
    const out: any[] = [];
    for (const soId of salesOrderIds) {
      const so = (await db.select().from(salesOrders).where(eq(salesOrders.id, soId)).limit(1))[0];
      if (!so) continue;
      const soItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, soId));
      
      // Skip if no sales order items found
      if (!soItems.length) {
        console.warn(`No items found for sales order ${soId}, skipping LPO creation`);
        continue;
      }
      
      let subtotal = 0; soItems.forEach(i=> subtotal += Number(i.totalPrice||0));
      const lpo = await this.createSupplierLpo({ supplierId: supplierIdOverride, sourceType: 'Auto', groupingCriteria: groupBy, subtotal: subtotal.toFixed(2), totalAmount: subtotal.toFixed(2), sourceSalesOrderIds: [soId], createdBy: userId } as any);
      
      // Get or create a fallback item
      let existingItem = (await db.select().from(items).limit(1))[0];
      if (!existingItem) {
        // Create a fallback item if none exists
        const fallbackItem = await db.insert(items).values({
          name: 'Auto-generated fallback item', // Add required name field
          supplierCode: `GEN-${Date.now()}`,
          description: 'Auto-generated fallback item',
          barcode: `AUTO-${Date.now()}`,
          category: 'Auto-generated',
          unit: 'PCS',
          retailPrice: '0.00',
          wholesalePrice: '0.00',
          costPrice: '0.00',
          stockQuantity: 0,
          minStockLevel: 0,
          maxStockLevel: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        existingItem = fallbackItem[0];
      }
      
      const fallbackBarcode = existingItem?.barcode || `AUTO-${Date.now()}`;
      const lpoItems = soItems.map((soi, idx) => ({
        supplierLpoId: lpo.id,
        itemId: soi.itemId || existingItem?.id,
        salesOrderItemId: soi.id,
        supplierCode: existingItem?.supplierCode || 'GEN-SUP',
        barcode: fallbackBarcode,
        itemDescription: soi.description || 'Auto-generated from Sales Order',
        quantity: soi.quantity,
        receivedQuantity: 0,
        pendingQuantity: soi.quantity, // initial pending equals ordered
        unitCost: soi.unitPrice as any || '0',
        totalCost: soi.totalPrice as any || '0',
        // Include discount and VAT fields from sales order item
        discountPercent: (soi as any).discountPercent || (soi as any).discountPercentage || 0,
        discountAmount: (soi as any).discountAmount || 0,
        vatPercent: (soi as any).vatPercent || (soi as any).vatPercentage || 0,
        vatAmount: (soi as any).vatAmount || 0,
        currency: 'BHD',
        lineNumber: idx + 1,
        deliveryStatus: 'Pending'
      }));
      
      if (lpoItems.length) {
        await db.insert(supplierLpoItems).values(lpoItems as any);
        console.log(`Created LPO ${lpo.id} with ${lpoItems.length} items from sales order ${soId}`);
      }
      out.push(lpo);
    }
    return out;
  }
  async createSupplierLposFromSupplierQuotes(quoteIds: string[], groupBy: string, userId?: string) {
    try {
      const out: SupplierLpo[] = [];
      if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length === 0) {
        console.warn(`[WARNING] No valid quoteIds provided for LPO creation`);
        return out;
      }
      
      console.log(`[DEBUG] Starting createSupplierLposFromSupplierQuotes with ${quoteIds.length} quoteIds:`, quoteIds);
      
      // Check if supplier_quote_items table exists
      try {
        const tableCheck = await db.execute(sql`SELECT 1 FROM supplier_quote_items LIMIT 1`);
        console.log(`[DEBUG] supplier_quote_items table exists and is accessible`);
      } catch (error) {
        console.error(`[ERROR] supplier_quote_items table check failed:`, error);
        throw new Error(`supplier_quote_items table is not accessible: ${error.message}`);
      }
    
    // Get supplier quotes with their items
    const quotes = [];
    const failedQuotes = [];
    
    for (const quoteId of quoteIds) {
      try {
        console.log(`[DEBUG] Fetching supplier quote: ${quoteId}`);
        
        // Validate quoteId format
        if (!quoteId || typeof quoteId !== 'string' || quoteId.trim().length === 0) {
          console.warn(`[WARNING] Invalid quoteId format: ${quoteId}`);
          failedQuotes.push({ quoteId, error: 'Invalid quoteId format' });
          continue;
        }
        
        // Use raw SQL to avoid Drizzle ORM issues
        const quote = await db.execute(sql`
          SELECT 
            id,
            quote_number as "quoteNumber",
            supplier_id as "supplierId",
            requisition_id as "requisitionId",
            status,
            subtotal,
            tax_amount as "taxAmount",
            total_amount as "totalAmount",
            currency,
            terms,
            notes,
            payment_terms as "paymentTerms",
            delivery_terms as "deliveryTerms",
            valid_until as "validUntil"
          FROM supplier_quotes 
          WHERE id = ${quoteId}
          LIMIT 1
        `);
        
        console.log(`[DEBUG] Quote query result for ${quoteId}:`, quote);
        
        // Convert raw SQL result to array format
        const quoteArray = quote.rows || quote;
        
        if (quoteArray && quoteArray[0]) {
          // Ensure all required fields are not null/undefined
          const quoteData = {
            id: quoteArray[0].id,
            quoteNumber: quoteArray[0].quoteNumber || `QUOTE-${quoteId.substring(0, 8)}`,
            supplierId: quoteArray[0].supplierId,
            requisitionId: quoteArray[0].requisitionId || null,
            status: quoteArray[0].status || 'Draft',
            subtotal: quoteArray[0].subtotal || '0',
            taxAmount: quoteArray[0].taxAmount || '0',
            totalAmount: quoteArray[0].totalAmount || '0',
            currency: quoteArray[0].currency || 'BHD',
            terms: quoteArray[0].terms || '',
            notes: quoteArray[0].notes || '',
            paymentTerms: quoteArray[0].paymentTerms || '30 Days',
            deliveryTerms: quoteArray[0].deliveryTerms || 'Standard',
            validUntil: quoteArray[0].validUntil,
          };
          
          // Validate required fields
          if (!quoteData.supplierId) {
            console.warn(`[WARNING] Quote ${quoteId} has no supplierId, skipping`);
            failedQuotes.push({ quoteId, error: 'Missing supplierId' });
            continue;
          }
          
          console.log(`[DEBUG] Processed quote data for ${quoteId}:`, quoteData);
          quotes.push(quoteData);
        } else {
          console.warn(`[WARNING] No quote found for ID: ${quoteId}`);
          failedQuotes.push({ quoteId, error: 'Quote not found' });
        }
      } catch (error) {
        console.error(`[ERROR] Error fetching supplier quote ${quoteId}:`, error);
        console.error(`[ERROR] Error stack:`, error.stack);
        failedQuotes.push({ quoteId, error: error.message });
        // Continue with other quotes instead of failing completely
        continue;
      }
    }
    
    // Log failed quotes for debugging
    if (failedQuotes.length > 0) {
      console.warn(`[WARNING] Failed to process ${failedQuotes.length} quotes:`, failedQuotes);
    }
    
    if (!quotes.length) return out;
    
    // Get customer name from enquiry if available - COMMENTED OUT since enquiryId column doesn't exist yet
    let customerName: string | null = null;
    /*
    const firstQuoteWithEnquiry = quotes.find(q => q.enquiryId);
    if (firstQuoteWithEnquiry?.enquiryId) {
      const enquiryResult = await db
        .select({
          customerId: enquiries.customerId,
          customerName: customers.name
        })
        .from(enquiries)
        .leftJoin(customers, eq(enquiries.customerId, customers.id))
        .where(eq(enquiries.id, firstQuoteWithEnquiry.enquiryId))
        .limit(1);
      
      if (enquiryResult[0]?.customerName) {
        customerName = enquiryResult[0].customerName;
      }
    }
    */
    
    // Group quotes by supplier if groupBy is 'supplier'
    const groupedQuotes = groupBy === 'supplier' 
      ? quotes.reduce((acc, quote) => {
          const supplierId = quote.supplierId;
          if (!acc[supplierId]) acc[supplierId] = [];
          acc[supplierId].push(quote);
          return acc;
        }, {} as Record<string, typeof quotes>)
      : { 'single': quotes };
    
    for (const [supplierId, supplierQuotes] of Object.entries(groupedQuotes)) {
      if (!supplierQuotes.length) continue;
      
      // Get quote items for all quotes in this group
      const quoteItems = [];
      const failedItems = [];
      
      for (const quote of supplierQuotes) {
        try {
          console.log(`[DEBUG] Fetching items for quote: ${quote.id}`);
          
          // Use raw SQL to avoid Drizzle ORM issues
          const items = await db.execute(sql`
            SELECT 
              id,
              supplier_quote_id as "supplierQuoteId",
              item_description as "itemDescription",
              quantity,
              unit_price as "unitPrice",
              line_total as "lineTotal",
              discount_percent as "discountPercent",
              discount_amount as "discountAmount",
              vat_percent as "vatPercent",
              vat_amount as "vatAmount"
            FROM supplier_quote_items 
            WHERE supplier_quote_id = ${quote.id}
          `);
          
          console.log(`[DEBUG] Items query result for quote ${quote.id}:`, items);
          
          // Convert raw SQL result to array format
          const itemsArray = items.rows || items;
          
          if (!itemsArray || itemsArray.length === 0) {
            console.warn(`[WARNING] No items found for quote ${quote.id}`);
            continue;
          }
          
          // Fetch requisition items if requisitionId exists
          let requisitionItems: any[] = [];
          if (quote.requisitionId) {
            try {
              console.log(`[DEBUG] Fetching requisition items for requisitionId: ${quote.requisitionId}`);
              const reqItems = await db.execute(sql`
                SELECT 
                  id,
                  requisition_id as "requisitionId",
                  item_description as "itemDescription",
                  quantity,
                  estimated_cost as "estimatedCost"
                FROM requisition_items 
                WHERE requisition_id = ${quote.requisitionId}
              `);
              const reqItemsArray = reqItems.rows || reqItems;
              requisitionItems = Array.isArray(reqItemsArray) ? reqItemsArray : [];
              console.log(`[DEBUG] Found ${requisitionItems.length} requisition items for quote ${quote.id}`);
            } catch (reqError) {
              console.warn(`[WARNING] Could not fetch requisition items for requisitionId ${quote.requisitionId}:`, reqError.message);
              requisitionItems = [];
            }
          }
          
          // Ensure all items have required fields
          const processedItems = itemsArray.map((item: any, index: number) => {
            try {
              // Validate required fields
              if (!item.id) {
                console.warn(`[WARNING] Item at index ${index} in quote ${quote.id} has no ID, skipping`);
                return null;
              }
              
              // Try to match with requisition item by description and use requisition quantity
              let finalQuantity = Math.max(0, Number(item.quantity) || 0);
              const originalQuantity = finalQuantity;
              const matchingReqItem = requisitionItems.find((reqItem: any) => 
                reqItem.itemDescription && 
                item.itemDescription &&
                reqItem.itemDescription.toLowerCase().trim() === item.itemDescription.toLowerCase().trim()
              );
              
              if (matchingReqItem) {
                const reqQuantity = Math.max(0, Number(matchingReqItem.quantity) || 0);
                console.log(`[DEBUG] Matched quote item "${item.itemDescription}" with requisition item - using requisition quantity: ${reqQuantity} (was ${finalQuantity})`);
                finalQuantity = reqQuantity;
              }
              
              // Recalculate lineTotal based on the new quantity
              const unitPrice = Number(item.unitPrice || 0);
              let lineTotal = item.lineTotal || '0';
              if (matchingReqItem && finalQuantity !== originalQuantity) {
                // Recalculate lineTotal when quantity changes
                const recalculatedLineTotal = (finalQuantity * unitPrice).toFixed(2);
                console.log(`[DEBUG] Recalculated lineTotal for "${item.itemDescription}": ${recalculatedLineTotal} (quantity: ${finalQuantity}, unitPrice: ${unitPrice})`);
                lineTotal = recalculatedLineTotal;
              }
              
              const processedItem = {
                id: item.id,
                supplierQuoteId: item.supplierQuoteId || quote.id,
                itemDescription: item.itemDescription || `Item from quote ${quote.quoteNumber}`,
                quantity: finalQuantity,
                unitPrice: item.unitPrice || '0',
                lineTotal: lineTotal,
                discountPercent: item.discountPercent || '0',
                discountAmount: item.discountAmount || '0',
                vatPercent: item.vatPercent || '0',
                vatAmount: item.vatAmount || '0',
                // Add default values for fields not in the query
                unitOfMeasure: 'PCS',
                specification: '',
                brand: '',
                model: '',
                warranty: '',
                leadTime: '',
                notes: '',
              };
              
              // Validate numeric fields
              if (isNaN(processedItem.quantity) || processedItem.quantity < 0) {
                console.warn(`[WARNING] Invalid quantity for item ${item.id}, setting to 0`);
                processedItem.quantity = 0;
              }
              
              return processedItem;
            } catch (itemError) {
              console.error(`[ERROR] Error processing item at index ${index} for quote ${quote.id}:`, itemError);
              failedItems.push({ quoteId: quote.id, itemIndex: index, error: itemError.message });
              return null;
            }
          }).filter(Boolean); // Remove null items
          
          console.log(`[DEBUG] Processed ${processedItems.length} items for quote ${quote.id}`);
          quoteItems.push(...processedItems);
        } catch (error) {
          console.error(`[ERROR] Error fetching items for quote ${quote.id}:`, error);
          console.error(`[ERROR] Error stack:`, error.stack);
          failedItems.push({ quoteId: quote.id, error: error.message });
          // Continue with other quotes instead of failing completely
          continue;
        }
      }
      
      // Log failed items for debugging
      if (failedItems.length > 0) {
        console.warn(`[WARNING] Failed to process ${failedItems.length} items:`, failedItems);
      }
      
      // Skip if no quote items found, but create a fallback item
      if (!quoteItems.length) {
        console.warn(`No items found for supplier quotes ${supplierQuotes.map(q => q.id).join(', ')}, creating fallback item`);
        
        // Create a fallback item based on the quote
        const fallbackItem = {
          id: `fallback-${Date.now()}`,
          supplierQuoteId: supplierQuotes[0].id,
          itemDescription: `Quote items from ${supplierQuotes[0].quoteNumber}`,
          quantity: 1,
          unitPrice: supplierQuotes[0].totalAmount || '0',
          lineTotal: supplierQuotes[0].totalAmount || '0',
          unitOfMeasure: 'PCS',
          specification: '',
          brand: '',
          model: '',
          warranty: '',
          leadTime: '',
          notes: 'Fallback item - original quote items not found',
        };
        quoteItems.push(fallbackItem);
      }
      
      // Calculate totals from updated quote items (which may have requisition quantities)
      let subtotal = 0;
      let taxAmount = 0;
      let totalAmount = 0;
      
      for (const item of quoteItems) {
        const lineTotal = Number(item.lineTotal || 0);
        const lineDiscount = Number(item.discountAmount || 0);
        const lineVat = Number(item.vatAmount || 0);
        
        subtotal += lineTotal - lineDiscount;
        taxAmount += lineVat;
        totalAmount += lineTotal + lineVat - lineDiscount;
      }
      
      console.log(`[DEBUG] Calculated totals - subtotal: ${subtotal}, taxAmount: ${taxAmount}, totalAmount: ${totalAmount}`);
      
      // Prepare notes with customer name
      let lpoNotes = supplierQuotes[0].notes || '';
      if (customerName) {
        // Add customer name to notes in text format
        const customerInfo = `Customer: ${customerName}`;
        lpoNotes = lpoNotes ? `${customerInfo}\n\n${lpoNotes}` : customerInfo;
      }
      
      // Create LPO
      console.log(`[DEBUG] Creating LPO for supplier ${supplierId} with ${supplierQuotes.length} quotes`);
      
      try {
        const lpo = await this.createSupplierLpo({
          supplierId: supplierId === 'single' ? supplierQuotes[0].supplierId : supplierId,
          status: 'Draft',
          sourceType: 'SupplierQuote',
          groupingCriteria: groupBy,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          totalAmount: totalAmount.toString(),
          currency: supplierQuotes[0].currency || 'BHD',
          createdBy: userId,
          requiresApproval: false,
          sourceQuotationIds: supplierQuotes.map(q => q.id),
          lpoDate: new Date(),
          expectedDeliveryDate: supplierQuotes[0].validUntil ? new Date(supplierQuotes[0].validUntil) : undefined,
          paymentTerms: supplierQuotes[0].paymentTerms,
          deliveryTerms: supplierQuotes[0].deliveryTerms,
          termsAndConditions: supplierQuotes[0].terms,
          specialInstructions: lpoNotes,
        } as any);
        
        if (!lpo || !lpo.id) {
          throw new Error('Failed to create LPO - no LPO returned');
        }
        
        console.log(`[DEBUG] Successfully created LPO ${lpo.id}`);
        
        // Create LPO items from quote items
        const lpoItems = quoteItems.map((item, idx) => ({
          supplierLpoId: lpo.id,
          quotationItemId: item.id, // Link to the original quote item
          itemId: null, // Will be filled when item is identified
          supplierCode: 'GEN-SUP', // Default supplier code
          barcode: `QUOTE-${item.id}`, // Generate barcode from quote item ID
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          receivedQuantity: 0,
          pendingQuantity: item.quantity,
          unitCost: item.unitPrice as any,
          totalCost: item.lineTotal as any, // Use lineTotal instead of totalPrice
          // Transfer discount and VAT data from quote item
          discountPercent: item.discountPercent || '0',
          discountAmount: item.discountAmount || '0',
          vatPercent: item.vatPercent || '0',
          vatAmount: item.vatAmount || '0',
          lineNumber: idx + 1,
          deliveryStatus: 'Pending',
          urgency: 'Normal',
          specialInstructions: [
            item.specification,
            item.brand ? `Brand: ${item.brand}` : '',
            item.model ? `Model: ${item.model}` : '',
            item.warranty ? `Warranty: ${item.warranty}` : '',
            item.leadTime ? `Lead Time: ${item.leadTime}` : '',
            item.notes || ''
          ].filter(Boolean).join(' | '), // Combine all item details into special instructions
        }));
        
        if (lpoItems.length) {
          // Use raw SQL to insert LPO items
          for (const item of lpoItems) {
            try {
              await db.execute(sql`
                INSERT INTO supplier_lpo_items (
                  id, supplier_lpo_id, quotation_item_id, item_id, supplier_code, barcode,
                  item_description, quantity, received_quantity, pending_quantity, unit_cost,
                  total_cost, discount_percent, discount_amount, vat_percent, vat_amount,
                  line_number, delivery_status, urgency, special_instructions,
                  created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), ${item.supplierLpoId}, ${item.quotationItemId}, 
                  ${item.itemId}, ${item.supplierCode}, ${item.barcode},
                  ${item.itemDescription}, ${item.quantity}, ${item.receivedQuantity}, 
                  ${item.pendingQuantity}, ${item.unitCost}, ${item.totalCost}, 
                  ${item.discountPercent}, ${item.discountAmount}, ${item.vatPercent}, ${item.vatAmount},
                  ${item.lineNumber}, ${item.deliveryStatus}, ${item.urgency}, 
                  ${item.specialInstructions}, NOW(), NOW()
                )
              `);
            } catch (itemError) {
              console.error(`[ERROR] Failed to insert LPO item for quote item ${item.quotationItemId}:`, itemError);
              // Continue with other items
            }
          }
          console.log(`Created LPO ${lpo.id} with ${lpoItems.length} items from supplier quotes ${supplierQuotes.map(q => q.id).join(', ')}`);
        }
        
        out.push(lpo);
        
      } catch (lpoError) {
        console.error(`[ERROR] Failed to create LPO for supplier ${supplierId}:`, lpoError);
        console.error(`[ERROR] Error stack:`, lpoError.stack);
        // Continue with other suppliers instead of failing completely
        continue;
      }
    }
    return out;
    } catch (error) {
      console.error(`[ERROR] createSupplierLposFromSupplierQuotes failed:`, error);
      console.error(`[ERROR] Error stack:`, error.stack);
      throw error;
    }
  }
  async createAmendedSupplierLpo(parentLpoId: string, reason: string, amendmentType: string, userId?: string) {
    const parent = await this.getSupplierLpo(parentLpoId); if (!parent) throw new Error('Parent LPO not found');
    return this.createSupplierLpo({ supplierId: parent.supplierId, sourceType: parent.sourceType, groupingCriteria: parent.groupingCriteria, subtotal: parent.subtotal, totalAmount: parent.totalAmount, currency: parent.currency, version: (parent.version||1)+1, parentLpoId, amendmentReason: reason, amendmentType, createdBy: userId, requiresApproval: parent.requiresApproval, sourceSalesOrderIds: parent.sourceSalesOrderIds } as any);
  }
  async submitForApproval(id: string, userId: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { requiresApproval: true } as any); }
  async approveSupplierLpo(id: string, userId: string, notes?: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { approvedBy: userId as any, approvedAt: new Date(), approvalNotes: notes } as any); }
  async rejectSupplierLpo(id: string, userId: string, notes: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { approvalNotes: notes } as any); }
  async sendToSupplier(id: string, userId: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { status: 'Sent', sentToSupplierAt: new Date() } as any); }
  async confirmBySupplier(id: string, confirmationReference?: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { status: 'Confirmed', confirmedBySupplierAt: new Date(), supplierConfirmationReference: confirmationReference } as any); }
  async updateExpectedDeliveryDate(id: string, expectedDeliveryDate: string, userId?: string) { 
    const lpo = await this.getSupplierLpo(id); 
    if (!lpo) throw new Error('Supplier LPO not found'); 
    return this.updateSupplierLpo(id, { 
      expectedDeliveryDate: new Date(expectedDeliveryDate), 
      updatedAt: new Date() 
    } as any); 
  }
  async getSupplierLpoBacklog() { return db.select().from(supplierLpos).where(sql`${supplierLpos.status} IN ('Draft','Sent')`); }
  async getCustomerOrderBacklog() { return []; }
  async getSupplierLpoItems(lpoId: string) { 
    return db.select({
      id: supplierLpoItems.id,
      supplierLpoId: supplierLpoItems.supplierLpoId,
      salesOrderItemId: supplierLpoItems.salesOrderItemId,
      quotationItemId: supplierLpoItems.quotationItemId,
      itemId: supplierLpoItems.itemId,
      lineNumber: supplierLpoItems.lineNumber,
      supplierCode: supplierLpoItems.supplierCode,
      barcode: supplierLpoItems.barcode,
      itemDescription: supplierLpoItems.itemDescription,
      quantity: supplierLpoItems.quantity,
      receivedQuantity: supplierLpoItems.receivedQuantity,
      pendingQuantity: supplierLpoItems.pendingQuantity,
      unitCost: supplierLpoItems.unitCost,
      totalCost: supplierLpoItems.totalCost,
      discountPercent: supplierLpoItems.discountPercent,
      discountAmount: supplierLpoItems.discountAmount,
      vatPercent: supplierLpoItems.vatPercent,
      vatAmount: supplierLpoItems.vatAmount,
      requestedDeliveryDate: supplierLpoItems.requestedDeliveryDate,
      confirmedDeliveryDate: supplierLpoItems.confirmedDeliveryDate,
      deliveryStatus: supplierLpoItems.deliveryStatus,
      urgency: supplierLpoItems.urgency,
      specialInstructions: supplierLpoItems.specialInstructions,
      createdAt: supplierLpoItems.createdAt,
      updatedAt: supplierLpoItems.updatedAt
    }).from(supplierLpoItems).where(eq(supplierLpoItems.supplierLpoId, lpoId)); 
  }
  async getSupplierLpoItem(id: string) { const r = await db.select().from(supplierLpoItems).where(eq(supplierLpoItems.id, id)).limit(1); return r[0]; }
  async createSupplierLpoItem(item: InsertSupplierLpoItem) { const r = await db.insert(supplierLpoItems).values(item as any).returning(); return r[0]; }
  async updateSupplierLpoItem(id: string, item: Partial<InsertSupplierLpoItem>) { const r = await db.update(supplierLpoItems).set(item as any).where(eq(supplierLpoItems.id, id)).returning(); return r[0]; }
  async deleteSupplierLpoItem(id: string) { await db.delete(supplierLpoItems).where(eq(supplierLpoItems.id, id)); }
  async bulkCreateSupplierLpoItems(itemsArr: InsertSupplierLpoItem[]) { if (!itemsArr.length) return []; const r = await db.insert(supplierLpoItems).values(itemsArr as any).returning(); return r; }
  
  // Update LPO tax amount based on item VAT amounts
  async updateLpoTaxAmountFromItems(lpoId: string) {
    try {
      // Get all items for this LPO
      const items = await this.getSupplierLpoItems(lpoId);
      
      // Calculate total VAT amount from items
      let totalVatAmount = 0;
      let totalSubtotal = 0;
      
      items.forEach(item => {
        const qty = Number(item.quantity || 0);
        const unitCost = Number(item.unitCost || 0);
        const grossAmount = Math.round((qty * unitCost) * 100) / 100;
        const discountPercent = Number(item.discountPercent || 0);
        const discountAmount = Number(item.discountAmount || 0);
        const calculatedDiscountAmount = discountAmount > 0 
          ? Math.min(discountAmount, grossAmount * 0.999) // Cap at 99.9%
          : Math.round((grossAmount * discountPercent / 100) * 100) / 100;
        const lineNet = Math.max(0.01, Math.round((grossAmount - calculatedDiscountAmount) * 100) / 100);
        
        // Use stored VAT amount if available, otherwise calculate from percentage
        const itemVatPercent = Number(item.vatPercent || 0); // Use actual VAT percentage from source
        const itemVatAmount = Number(item.vatAmount || 0);
        const calculatedVatAmount = itemVatAmount > 0 
          ? itemVatAmount 
          : Math.round((lineNet * itemVatPercent / 100) * 100) / 100;
        
        totalVatAmount += calculatedVatAmount;
        totalSubtotal += lineNet;
      });
      
      // Update the LPO with calculated tax amount and total
      const newTotalAmount = Math.round((totalSubtotal + totalVatAmount) * 100) / 100;
      
      const updatedLpo = await db.update(supplierLpos)
        .set({
          taxAmount: totalVatAmount.toFixed(3),
          totalAmount: newTotalAmount.toFixed(3),
          updatedAt: new Date()
        })
        .where(eq(supplierLpos.id, lpoId))
        .returning();
      
      console.log(`[updateLpoTaxAmountFromItems] Updated LPO ${lpoId}: taxAmount=${totalVatAmount.toFixed(3)}, totalAmount=${newTotalAmount.toFixed(3)}`);
      
      return updatedLpo[0];
    } catch (error) {
      console.error(`[updateLpoTaxAmountFromItems] Error updating LPO ${lpoId}:`, error);
      throw error;
    }
  }

  // Fetch quantities from delivery notes or invoices for LPO items
  async fetchQuantitiesFromDeliveryOrInvoice(lpoId: string) {
    try {
      console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Fetching quantities for LPO: ${lpoId}`);
      
      // Get LPO items
      const lpoItems = await this.getSupplierLpoItems(lpoId);
      if (!lpoItems.length) {
        console.log(`[fetchQuantitiesFromDeliveryOrInvoice] No LPO items found for LPO: ${lpoId}`);
        return [];
      }

      // Get the LPO to check source information
      const lpo = await this.getSupplierLpo(lpoId);
      if (!lpo) {
        throw new Error('LPO not found');
      }

      const updatedItems = [];

      for (const lpoItem of lpoItems) {
        let actualQuantity = lpoItem.quantity; // Default to original quantity
        let sourceType = 'original';
        let sourceReference = null;

        // Try to find quantities from delivery notes first
        if (lpo.sourceSalesOrderIds && Array.isArray(lpo.sourceSalesOrderIds)) {
          for (const salesOrderId of lpo.sourceSalesOrderIds) {
            try {
              // Get ALL delivery items for this sales order item (not just the first one)
              // This handles partial deliveries properly by summing up all delivered quantities
              const deliveryItems = await db.execute(sql`
                SELECT 
                  di.id,
                  di.delivered_quantity,
                  di.picked_quantity,
                  di.ordered_quantity,
                  di.item_id,
                  di.sales_order_item_id,
                  d.delivery_number,
                  d.status as delivery_status,
                  d.delivery_type,
                  d.delivery_date
                FROM delivery_items di
                JOIN deliveries d ON di.delivery_id = d.id
                WHERE d.sales_order_id = ${salesOrderId}
                AND di.item_id = ${lpoItem.itemId}
                ORDER BY d.created_at ASC
              `);

              const deliveryItemsArray = deliveryItems.rows || deliveryItems;
              if (deliveryItemsArray && deliveryItemsArray.length > 0) {
                // Sum up all delivered quantities from all deliveries for this item
                let totalDeliveredQty = 0;
                let deliveryReferences = [];
                
                for (const deliveryItem of deliveryItemsArray) {
                  const deliveredQty = Number(deliveryItem.delivered_quantity || deliveryItem.picked_quantity || deliveryItem.ordered_quantity || 0);
                  if (deliveredQty > 0) {
                    totalDeliveredQty += deliveredQty;
                    deliveryReferences.push(deliveryItem.delivery_number);
                  }
                }
                
                if (totalDeliveredQty > 0) {
                  actualQuantity = totalDeliveredQty;
                  sourceType = 'delivery';
                  sourceReference = deliveryReferences.join(', '); // Show all delivery numbers
                  console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Found total delivery quantity ${totalDeliveredQty} for item ${lpoItem.id} from deliveries: ${sourceReference}`);
                  break; // Use the first sales order found
                }
              }
            } catch (error) {
              console.warn(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching delivery items for sales order ${salesOrderId}:`, error.message);
            }
          }
        }

        // If LPO was created from supplier quotes, try to find quantities from related sales orders
        if (sourceType === 'original' && lpo.sourceQuotationIds && Array.isArray(lpo.sourceQuotationIds)) {
          for (const quotationId of lpo.sourceQuotationIds) {
            try {
              // Find sales orders that were created from this quotation
              const salesOrdersFromQuote = await db.execute(sql`
                SELECT 
                  so.id as sales_order_id,
                  so.order_number
                FROM sales_orders so
                WHERE so.source_quotation_id = ${quotationId}
                ORDER BY so.created_at ASC
              `);

              const salesOrdersArray = salesOrdersFromQuote.rows || salesOrdersFromQuote;
              if (salesOrdersArray && salesOrdersArray.length > 0) {
                for (const salesOrder of salesOrdersArray) {
                  try {
                    // Get ALL delivery items for this sales order item
                    const deliveryItems = await db.execute(sql`
                      SELECT 
                        di.id,
                        di.delivered_quantity,
                        di.picked_quantity,
                        di.ordered_quantity,
                        di.item_id,
                        di.sales_order_item_id,
                        d.delivery_number,
                        d.status as delivery_status,
                        d.delivery_type,
                        d.delivery_date
                      FROM delivery_items di
                      JOIN deliveries d ON di.delivery_id = d.id
                      WHERE d.sales_order_id = ${salesOrder.sales_order_id}
                      AND di.item_id = ${lpoItem.itemId}
                      ORDER BY d.created_at ASC
                    `);

                    const deliveryItemsArray = deliveryItems.rows || deliveryItems;
                    if (deliveryItemsArray && deliveryItemsArray.length > 0) {
                      // Sum up all delivered quantities from all deliveries for this item
                      let totalDeliveredQty = 0;
                      let deliveryReferences = [];
                      
                      for (const deliveryItem of deliveryItemsArray) {
                        const deliveredQty = Number(deliveryItem.delivered_quantity || deliveryItem.picked_quantity || deliveryItem.ordered_quantity || 0);
                        if (deliveredQty > 0) {
                          totalDeliveredQty += deliveredQty;
                          deliveryReferences.push(deliveryItem.delivery_number);
                        }
                      }
                      
                      if (totalDeliveredQty > 0) {
                        actualQuantity = totalDeliveredQty;
                        sourceType = 'delivery';
                        sourceReference = deliveryReferences.join(', '); // Show all delivery numbers
                        console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Found total delivery quantity ${totalDeliveredQty} for item ${lpoItem.id} from deliveries: ${sourceReference} (via quote ${quotationId})`);
                        break; // Use the first sales order found
                      }
                    }
                  } catch (error) {
                    console.warn(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching delivery items for sales order ${salesOrder.sales_order_id}:`, error.message);
                  }
                }
                
                if (sourceType === 'delivery') {
                  break; // Found delivery data, no need to check other quotations
                }
              }
            } catch (error) {
              console.warn(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching sales orders for quotation ${quotationId}:`, error.message);
            }
          }
        }

        // If no delivery quantity found, try to find from invoices
        let invoicePricingData = null;
        if (sourceType === 'original' && lpo.sourceSalesOrderIds && Array.isArray(lpo.sourceSalesOrderIds)) {
          for (const salesOrderId of lpo.sourceSalesOrderIds) {
            try {
              // Get ALL invoice items for this sales order item (not just the first one)
              // This handles partial invoicing properly by summing up all invoiced quantities
              const invoiceItems = await db.execute(sql`
                SELECT 
                  ii.id,
                  ii.quantity,
                  ii.item_id,
                  ii.delivery_item_id,
                  ii.unit_price,
                  ii.discount_percentage,
                  ii.discount_amount,
                  ii.tax_rate,
                  ii.tax_amount,
                  i.invoice_number,
                  i.status as invoice_status,
                  i.created_at
                FROM invoice_items ii
                JOIN invoices i ON ii.invoice_id = i.id
                WHERE i.sales_order_id = ${salesOrderId}
                AND ii.item_id = ${lpoItem.itemId}
                ORDER BY i.created_at ASC
              `);

              const invoiceItemsArray = invoiceItems.rows || invoiceItems;
              if (invoiceItemsArray && invoiceItemsArray.length > 0) {
                // Sum up all invoiced quantities from all invoices for this item
                let totalInvoicedQty = 0;
                let invoiceReferences = [];
                let latestPricingData = null;
                
                for (const invoiceItem of invoiceItemsArray) {
                  const invoiceQty = Number(invoiceItem.quantity || 0);
                  if (invoiceQty > 0) {
                    totalInvoicedQty += invoiceQty;
                    invoiceReferences.push(invoiceItem.invoice_number);
                    
                    // Use pricing data from the latest invoice
                    latestPricingData = {
                      unitPrice: Number(invoiceItem.unit_price || 0),
                      discountPercentage: Number(invoiceItem.discount_percentage || 0),
                      discountAmount: Number(invoiceItem.discount_amount || 0),
                      taxRate: Number(invoiceItem.tax_rate || 0),
                      taxAmount: Number(invoiceItem.tax_amount || 0),
                    };
                  }
                }
                
                if (totalInvoicedQty > 0) {
                  actualQuantity = totalInvoicedQty;
                  sourceType = 'invoice';
                  sourceReference = invoiceReferences.join(', '); // Show all invoice numbers
                  invoicePricingData = latestPricingData;
                  
                  console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Found total invoice quantity ${totalInvoicedQty} for item ${lpoItem.id} from invoices: ${sourceReference}`);
                  break; // Use the first sales order found
                }
              }
            } catch (error) {
              console.warn(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching invoice items for sales order ${salesOrderId}:`, error.message);
            }
          }
        }

        // If still no invoice quantity found and LPO was created from supplier quotes, try to find from related sales orders
        if (sourceType === 'original' && !invoicePricingData && lpo.sourceQuotationIds && Array.isArray(lpo.sourceQuotationIds)) {
          for (const quotationId of lpo.sourceQuotationIds) {
            try {
              // Find sales orders that were created from this quotation
              const salesOrdersFromQuote = await db.execute(sql`
                SELECT 
                  so.id as sales_order_id,
                  so.order_number
                FROM sales_orders so
                WHERE so.source_quotation_id = ${quotationId}
                ORDER BY so.created_at ASC
              `);

              const salesOrdersArray = salesOrdersFromQuote.rows || salesOrdersFromQuote;
              if (salesOrdersArray && salesOrdersArray.length > 0) {
                for (const salesOrder of salesOrdersArray) {
                  try {
                    // Get ALL invoice items for this sales order item
                    const invoiceItems = await db.execute(sql`
                      SELECT 
                        ii.id,
                        ii.quantity,
                        ii.item_id,
                        ii.delivery_item_id,
                        ii.unit_price,
                        ii.discount_percentage,
                        ii.discount_amount,
                        ii.tax_rate,
                        ii.tax_amount,
                        i.invoice_number,
                        i.status as invoice_status,
                        i.created_at
                      FROM invoice_items ii
                      JOIN invoices i ON ii.invoice_id = i.id
                      WHERE i.sales_order_id = ${salesOrder.sales_order_id}
                      AND ii.item_id = ${lpoItem.itemId}
                      ORDER BY i.created_at ASC
                    `);

                    const invoiceItemsArray = invoiceItems.rows || invoiceItems;
                    if (invoiceItemsArray && invoiceItemsArray.length > 0) {
                      // Sum up all invoiced quantities from all invoices for this item
                      let totalInvoicedQty = 0;
                      let invoiceReferences = [];
                      let latestPricingData = null;
                      
                      for (const invoiceItem of invoiceItemsArray) {
                        const invoiceQty = Number(invoiceItem.quantity || 0);
                        if (invoiceQty > 0) {
                          totalInvoicedQty += invoiceQty;
                          invoiceReferences.push(invoiceItem.invoice_number);
                          
                          // Use pricing data from the latest invoice
                          latestPricingData = {
                            unitPrice: Number(invoiceItem.unit_price || 0),
                            discountPercentage: Number(invoiceItem.discount_percentage || 0),
                            discountAmount: Number(invoiceItem.discount_amount || 0),
                            taxRate: Number(invoiceItem.tax_rate || 0),
                            taxAmount: Number(invoiceItem.tax_amount || 0),
                          };
                        }
                      }
                      
                      if (totalInvoicedQty > 0) {
                        actualQuantity = totalInvoicedQty;
                        sourceType = 'invoice';
                        sourceReference = invoiceReferences.join(', '); // Show all invoice numbers
                        invoicePricingData = latestPricingData;
                        
                        console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Found total invoice quantity ${totalInvoicedQty} for item ${lpoItem.id} from invoices: ${sourceReference} (via quote ${quotationId})`);
                        break; // Use the first sales order found
                      }
                    }
                  } catch (error) {
                    console.warn(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching invoice items for sales order ${salesOrder.sales_order_id}:`, error.message);
                  }
                }
                
                if (sourceType === 'invoice') {
                  break; // Found invoice data, no need to check other quotations
                }
              }
            } catch (error) {
              console.warn(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching sales orders for quotation ${quotationId}:`, error.message);
            }
          }
        }

        // Determine what fields to update
        const updateFields: any = {
          updatedAt: new Date()
        };
        
        let hasChanges = false;
        
        // Update quantity if different
        if (actualQuantity !== lpoItem.quantity) {
          updateFields.quantity = actualQuantity;
          updateFields.pendingQuantity = actualQuantity - Number(lpoItem.receivedQuantity || 0);
          hasChanges = true;
        }
        
        // Update pricing data from invoice if available
        if (invoicePricingData && sourceType === 'invoice') {
          const currentUnitCost = Number(lpoItem.unitCost || 0);
          const currentDiscountPercent = Number(lpoItem.discountPercent || 0);
          const currentDiscountAmount = Number(lpoItem.discountAmount || 0);
          const currentVatPercent = Number(lpoItem.vatPercent || 0);
          const currentVatAmount = Number(lpoItem.vatAmount || 0);
          
          // Update unitCost if different and valid
          if (invoicePricingData.unitPrice > 0 && invoicePricingData.unitPrice !== currentUnitCost) {
            updateFields.unitCost = invoicePricingData.unitPrice.toString();
            hasChanges = true;
          }
          
          // Update discount fields if different
          if (invoicePricingData.discountPercentage !== currentDiscountPercent) {
            updateFields.discountPercent = invoicePricingData.discountPercentage.toString();
            hasChanges = true;
          }
          if (invoicePricingData.discountAmount !== currentDiscountAmount) {
            updateFields.discountAmount = invoicePricingData.discountAmount.toString();
            hasChanges = true;
          }
          
          // Update VAT fields if different
          if (invoicePricingData.taxRate !== currentVatPercent) {
            updateFields.vatPercent = invoicePricingData.taxRate.toString();
            hasChanges = true;
          }
          if (invoicePricingData.taxAmount !== currentVatAmount) {
            updateFields.vatAmount = invoicePricingData.taxAmount.toString();
            hasChanges = true;
          }
          
          // Recalculate totalCost based on updated fields
          const newUnitCost = invoicePricingData.unitPrice || currentUnitCost;
          const newQuantity = actualQuantity || lpoItem.quantity;
          const grossAmount = newUnitCost * newQuantity;
          const newDiscountAmount = invoicePricingData.discountAmount || (grossAmount * invoicePricingData.discountPercentage / 100);
          const netAmount = grossAmount - newDiscountAmount;
          const newVatAmount = invoicePricingData.taxAmount || (netAmount * invoicePricingData.taxRate / 100);
          const newTotalCost = netAmount + newVatAmount;
          
          updateFields.totalCost = newTotalCost.toString();
          hasChanges = true;
          
          console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Updating pricing for item ${lpoItem.id}: unitCost=${updateFields.unitCost}, discount=${updateFields.discountAmount}, vat=${updateFields.vatAmount}, totalCost=${updateFields.totalCost}`);
        }

        // Update the LPO item if there are changes
        if (hasChanges) {
          try {
            await db.update(supplierLpoItems)
              .set(updateFields)
              .where(eq(supplierLpoItems.id, lpoItem.id));

            console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Updated LPO item ${lpoItem.id}: quantity ${lpoItem.quantity} -> ${actualQuantity} (source: ${sourceType})`);
          } catch (error) {
            console.error(`[fetchQuantitiesFromDeliveryOrInvoice] Error updating LPO item ${lpoItem.id}:`, error);
          }
        }

        // Build the return item with updated data
        const updatedItem = {
          ...lpoItem,
          quantity: actualQuantity,
          pendingQuantity: actualQuantity - Number(lpoItem.receivedQuantity || 0),
          sourceType,
          sourceReference
        };
        
        // If we got invoice pricing data, include it in the return
        if (invoicePricingData && sourceType === 'invoice') {
          updatedItem.unitCost = invoicePricingData.unitPrice.toString();
          updatedItem.discountPercent = invoicePricingData.discountPercentage.toString();
          updatedItem.discountAmount = invoicePricingData.discountAmount.toString();
          updatedItem.vatPercent = invoicePricingData.taxRate.toString();
          updatedItem.vatAmount = invoicePricingData.taxAmount.toString();
          
          // Recalculate totalCost for return value
          const newUnitCost = invoicePricingData.unitPrice;
          const newQuantity = actualQuantity;
          const grossAmount = newUnitCost * newQuantity;
          const newDiscountAmount = invoicePricingData.discountAmount || (grossAmount * invoicePricingData.discountPercentage / 100);
          const netAmount = grossAmount - newDiscountAmount;
          const newVatAmount = invoicePricingData.taxAmount || (netAmount * invoicePricingData.taxRate / 100);
          const newTotalCost = netAmount + newVatAmount;
          
          updatedItem.totalCost = newTotalCost.toString();
        }
        
        updatedItems.push(updatedItem);
      }

      // Recalculate LPO totals after quantity updates
      await this.updateLpoTaxAmountFromItems(lpoId);

      console.log(`[fetchQuantitiesFromDeliveryOrInvoice] Successfully updated quantities for ${updatedItems.length} items in LPO ${lpoId}`);
      return updatedItems;

    } catch (error) {
      console.error(`[fetchQuantitiesFromDeliveryOrInvoice] Error fetching quantities for LPO ${lpoId}:`, error);
      throw error;
    }
  }
}
