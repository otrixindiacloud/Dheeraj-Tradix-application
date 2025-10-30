import { db } from "../db";
import { invoices, invoiceItems, InsertInvoice, InsertInvoiceItem, salesOrders, deliveryItems, deliveries, salesOrderItems, items as itemsTable, enquiryItems, customers, InvoiceItem, quotationItems, quotations } from '@shared/schema';
import { and, desc, eq, sql, inArray } from 'drizzle-orm';
import { BaseStorage } from './base';

// Helper to coerce numeric strings -> number safely
function num(val: any): number { if (val === null || val === undefined) return 0; const n = typeof val === 'number' ? val : parseFloat(val); return isNaN(n) ? 0 : n; }

export class InvoiceStorage extends BaseStorage {
  // Basic list with lightweight filtering & pagination
  async getInvoices(filters?: { status?: string; customerId?: string; type?: string; salesOrderId?: string; dateFrom?: string; dateTo?: string; search?: string; currency?: string; limit?: number; offset?: number; }) {
    const limit = filters?.limit ?? 50; const offset = filters?.offset ?? 0;
    let q: any = db.select().from(invoices);
    const conds: any[] = [];
    if (filters) {
      if (filters.status) conds.push(eq(invoices.status, filters.status as any));
      if (filters.type) conds.push(eq(invoices.invoiceType, filters.type as any));
      if (filters.customerId) conds.push(eq(invoices.customerId, filters.customerId));
      if (filters.salesOrderId) conds.push(eq(invoices.salesOrderId, filters.salesOrderId));
      if (filters.currency) conds.push(eq(invoices.currency, filters.currency));
      if (filters.dateFrom) conds.push(sql`${invoices.invoiceDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conds.push(sql`${invoices.invoiceDate} <= ${filters.dateTo}`);
      if (filters.search) conds.push(sql`${invoices.invoiceNumber} ILIKE ${`%${filters.search}%`}`);
      if (conds.length) q = (q as any).where(and(...conds));
    }
    return (q as any).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset);
  }

  async getInvoice(id: string) {
    const r = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return r[0];
  }

  async getInvoiceByNumber(invoiceNumber: string) {
    const r = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
    return r[0];
  }

  // Comprehensive invoice data fetching with all related information
  async getInvoiceWithCompleteDetails(invoiceNumber: string) {
    try {
      console.log(`[InvoiceStorage] Fetching complete details for invoice: ${invoiceNumber}`);
      
      // Get the invoice
      const invoice = await this.getInvoiceByNumber(invoiceNumber);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get invoice items
  const invoiceItemsData = await this.getInvoiceItems(invoice.id);
      console.log(`[InvoiceStorage] Found ${invoiceItemsData.length} invoice items`);

      // Get customer details
      const customerData = await db
        .select()
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .limit(1);
      const customer = customerData[0] || null;

      // Get sales order details if exists
      let salesOrder = null;
      if (invoice.salesOrderId) {
        const salesOrderData = await db
          .select()
          .from(salesOrders)
          .where(eq(salesOrders.id, invoice.salesOrderId))
          .limit(1);
        salesOrder = salesOrderData[0] || null;

        // Get sales order items if sales order exists
        if (salesOrder) {
          const salesOrderItemsData = await db
            .select()
            .from(salesOrderItems)
            .where(eq(salesOrderItems.salesOrderId, salesOrder.id));
          salesOrder.items = salesOrderItemsData;
        }
      }

      // Get delivery details if exists
      let delivery = null;
      if (invoice.deliveryId) {
        const deliveryData = await db
          .select()
          .from(deliveries)
          .where(eq(deliveries.id, invoice.deliveryId))
          .limit(1);
        delivery = deliveryData[0] || null;

        // Get delivery items if delivery exists
        if (delivery) {
          const deliveryItemsData = await db
            .select()
            .from(deliveryItems)
            .where(eq(deliveryItems.deliveryId, delivery.id));
          delivery.items = deliveryItemsData;
        }
      }

      // Get item details for each invoice item
      const enrichedInvoiceItems = await Promise.all(
        invoiceItemsData.map(async (item) => {
          const existingDetails = (item as any).itemDetails || null;
          if (existingDetails) {
            return {
              ...item,
              productName: (item as any).productName ?? existingDetails.description ?? item.description,
              itemDetails: existingDetails
            };
          }

          const itemData = await db
            .select()
            .from(itemsTable)
            .where(eq(itemsTable.id, item.itemId))
            .limit(1);
          const resolvedDetails = itemData[0] || null;
          return {
            ...item,
            productName: (item as any).productName ?? resolvedDetails?.description ?? item.description,
            itemDetails: resolvedDetails
          };
        })
      );

      // Compile complete invoice data
      const completeInvoiceData = {
        invoice: {
          ...invoice,
          items: enrichedInvoiceItems
        },
        customer,
        salesOrder,
        delivery,
        metadata: {
          totalItems: enrichedInvoiceItems.length,
          hasSalesOrder: !!salesOrder,
          hasDelivery: !!delivery,
          hasCustomer: !!customer,
          fetchedAt: new Date().toISOString()
        }
      };

      console.log(`[InvoiceStorage] Successfully fetched complete invoice data for: ${invoiceNumber}`);
      return completeInvoiceData;
    } catch (error) {
      console.error(`[InvoiceStorage] Error fetching complete invoice data:`, error);
      throw error;
    }
  }

  // Get all invoice data from sales order or quotation with complete financial details
  async getInvoiceDataFromSource(sourceType: string, sourceId: string) {
    try {
      console.log(`[InvoiceStorage] Fetching invoice data from ${sourceType}: ${sourceId}`);
      
      let sourceData: any = null;
      let sourceItems: any[] = [];
      let customer: any = null;
      
      if (sourceType === 'sales-order') {
        // Fetch sales order data
        const salesOrderData = await db
          .select()
          .from(salesOrders)
          .where(eq(salesOrders.id, sourceId))
          .limit(1);
        sourceData = salesOrderData[0];
        
        if (!sourceData) {
          throw new Error('Sales order not found');
        }
        
        // Fetch sales order items with complete financial details
        sourceItems = await db
          .select({
            id: salesOrderItems.id,
            salesOrderId: salesOrderItems.salesOrderId,
            itemId: salesOrderItems.itemId,
            lineNumber: salesOrderItems.lineNumber,
            quantity: salesOrderItems.quantity,
            unitPrice: salesOrderItems.unitPrice,
            totalPrice: salesOrderItems.totalPrice,
            deliveryRequirement: salesOrderItems.deliveryRequirement,
            specialInstructions: salesOrderItems.specialInstructions,
            // Item details
            description: itemsTable.description,
            barcode: itemsTable.barcode,
            supplierCode: itemsTable.supplierCode,
            category: itemsTable.category,
            unitOfMeasure: itemsTable.unitOfMeasure,
            costPrice: itemsTable.costPrice,
            // Financial calculations - these will be calculated below
            discountPercentage: sql`0`.as('discountPercentage'),
            discountAmount: sql`0`.as('discountAmount'),
            vatPercentage: sql`0`.as('vatPercentage'),
            vatAmount: sql`0`.as('vatAmount'),
            netAmount: sql`0`.as('netAmount'),
            grossAmount: sql`0`.as('grossAmount')
          })
          .from(salesOrderItems)
          .leftJoin(itemsTable, eq(salesOrderItems.itemId, itemsTable.id))
          .where(eq(salesOrderItems.salesOrderId, sourceId));
        
        // Get customer details
        const customerData = await db
          .select()
          .from(customers)
          .where(eq(customers.id, sourceData.customerId))
          .limit(1);
        customer = customerData[0] || null;
        
      } else if (sourceType === 'quotation') {
        // Fetch quotation data
        const quotationData = await db
          .select()
          .from(quotations)
          .where(eq(quotations.id, sourceId))
          .limit(1);
        sourceData = quotationData[0];
        
        if (!sourceData) {
          throw new Error('Quotation not found');
        }
        
        // Fetch quotation items with complete financial details
        sourceItems = await db
          .select({
            id: quotationItems.id,
            quotationId: quotationItems.quotationId,
            description: quotationItems.description,
            quantity: quotationItems.quantity,
            costPrice: quotationItems.costPrice,
            markup: quotationItems.markup,
            unitPrice: quotationItems.unitPrice,
            lineTotal: quotationItems.lineTotal,
            discountPercentage: quotationItems.discountPercentage,
            discountAmount: quotationItems.discountAmount,
            vatPercentage: quotationItems.vatPercent,
            vatAmount: quotationItems.vatAmount,
            isAccepted: quotationItems.isAccepted,
            rejectionReason: quotationItems.rejectionReason,
            notes: quotationItems.notes,
            // Financial calculations
            netAmount: sql`0`.as('netAmount'),
            grossAmount: sql`0`.as('grossAmount')
          })
          .from(quotationItems)
          .where(eq(quotationItems.quotationId, sourceId));
        
        // Get customer details
        const customerData = await db
          .select()
          .from(customers)
          .where(eq(customers.id, sourceData.customerId))
          .limit(1);
        customer = customerData[0] || null;
      }
      
      // Calculate financial details for each item
      const enrichedItems = sourceItems.map((item) => {
        const qty = num(item.quantity) || 0;
        const unitPrice = num(item.unitPrice) || 0;
        const grossAmount = qty * unitPrice;
        
        // Get discount details
        const discountPercentage = num(item.discountPercentage) || 0;
        const discountAmount = num(item.discountAmount) || 0;
        const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercentage / 100);
        const netAmount = grossAmount - calculatedDiscountAmount;
        
        // Get VAT details
        const vatPercentage = num(item.vatPercentage) || 0;
        const vatAmount = num(item.vatAmount) || 0;
        const calculatedVatAmount = vatAmount > 0 ? vatAmount : (netAmount * vatPercentage / 100);
        
        return {
          ...item,
          grossAmount: Math.round(grossAmount * 100) / 100,
          discountAmount: Math.round(calculatedDiscountAmount * 100) / 100,
          netAmount: Math.round(netAmount * 100) / 100,
          vatAmount: Math.round(calculatedVatAmount * 100) / 100,
          totalAmount: Math.round((netAmount + calculatedVatAmount) * 100) / 100
        };
      });
      
      // Calculate totals
      const totals = enrichedItems.reduce((acc, item) => {
        acc.grossTotal += item.grossAmount;
        acc.discountTotal += item.discountAmount;
        acc.netTotal += item.netAmount;
        acc.vatTotal += item.vatAmount;
        acc.finalTotal += item.totalAmount;
        return acc;
      }, {
        grossTotal: 0,
        discountTotal: 0,
        netTotal: 0,
        vatTotal: 0,
        finalTotal: 0
      });
      
      // Round totals
      Object.keys(totals).forEach(key => {
        totals[key] = Math.round(totals[key] * 100) / 100;
      });
      
      const completeData = {
        source: {
          type: sourceType,
          id: sourceId,
          data: sourceData
        },
        customer,
        items: enrichedItems,
        totals,
        metadata: {
          totalItems: enrichedItems.length,
          hasCustomer: !!customer,
          fetchedAt: new Date().toISOString()
        }
      };
      
      console.log(`[InvoiceStorage] Successfully fetched invoice data from ${sourceType}: ${sourceId}`);
      return completeData;
    } catch (error) {
      console.error(`[InvoiceStorage] Error fetching invoice data from source:`, error);
      throw error;
    }
  }

  // Create invoice from sales order or quotation with all financial data
  async createInvoiceFromSource(sourceType: string, sourceId: string, invoiceType: string = 'Final', userId?: string) {
    try {
      console.log(`[InvoiceStorage] Creating invoice from ${sourceType}: ${sourceId}`);
      
      // First get the complete data from source
      const sourceData = await this.getInvoiceDataFromSource(sourceType, sourceId);
      
      // Generate invoice number
      const invoiceNumber = this.generateNumber('INV');
      const now = new Date();
      
      // Create invoice record
      const invoiceData: any = {
        invoiceNumber,
        invoiceType,
        customerId: sourceData.customer.id,
        invoiceDate: now,
        dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'Draft',
        currency: 'BHD',
        exchangeRate: '1.0000',
        baseCurrency: 'BHD',
        subtotal: sourceData.totals.netTotal.toString(),
        taxRate: sourceData.totals.vatTotal > 0 ? 
          ((sourceData.totals.vatTotal / sourceData.totals.netTotal) * 100).toFixed(2) : '0',
        taxAmount: sourceData.totals.vatTotal.toString(),
        discountPercentage: sourceData.totals.discountTotal > 0 ? 
          ((sourceData.totals.discountTotal / sourceData.totals.grossTotal) * 100).toFixed(2) : '0',
        discountAmount: sourceData.totals.discountTotal.toString(),
        totalAmount: sourceData.totals.finalTotal.toString(),
        paidAmount: '0',
        outstandingAmount: sourceData.totals.finalTotal.toString(),
        subtotalBase: sourceData.totals.netTotal.toString(),
        taxAmountBase: sourceData.totals.vatTotal.toString(),
        discountAmountBase: sourceData.totals.discountTotal.toString(),
        totalAmountBase: sourceData.totals.finalTotal.toString(),
        paymentTerms: 'Net 30',
        autoGenerated: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      };
      
      // Add source reference
      if (sourceType === 'sales-order') {
        invoiceData.salesOrderId = sourceId;
      }
      
      // Create the invoice
      const createdInvoice = await this.createInvoice(invoiceData);
      
      // Create invoice items
      const invoiceItemsData = sourceData.items.map((item, index) => ({
        invoiceId: createdInvoice.id,
        itemId: item.itemId,
        barcode: item.barcode || 'N/A',
        supplierCode: item.supplierCode || 'N/A',
        description: item.description,
        lineNumber: index + 1,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalAmount.toString(),
        discountPercentage: item.discountPercentage.toString(),
        discountAmount: item.discountAmount.toString(),
        taxRate: item.vatPercentage.toString(),
        taxAmount: item.vatAmount.toString(),
        unitPriceBase: item.unitPrice.toString(),
        totalPriceBase: item.totalAmount.toString(),
        discountAmountBase: item.discountAmount.toString(),
        taxAmountBase: item.vatAmount.toString(),
        notes: item.notes || item.specialInstructions || ''
      }));
      
      // Insert invoice items
      if (invoiceItemsData.length > 0) {
        await db.insert(invoiceItems).values(invoiceItemsData);
      }
      
      // Get the complete invoice with items
      const completeInvoice = await this.getInvoiceWithCompleteDetails(createdInvoice.invoiceNumber);
      
      console.log(`[InvoiceStorage] Successfully created invoice ${createdInvoice.invoiceNumber} from ${sourceType}: ${sourceId}`);
      return completeInvoice;
    } catch (error) {
      console.error(`[InvoiceStorage] Error creating invoice from source:`, error);
      throw error;
    }
  }

  async createInvoice(data: InsertInvoice) {
    const invoiceNumber = data.invoiceNumber || this.generateNumber('INV');
    const now = new Date();
    const record: any = { ...data, invoiceNumber, createdAt: now, updatedAt: now };
    try {
      const inserted = await db.insert(invoices).values(record).returning();
      return inserted[0];
    } catch (err: any) {
      // If FK constraint on created_by fails (system test user not in users table), retry with null
      if (err?.code === '23503' && String(err?.detail || '').includes('created_by')) {
        const fallback = { ...record, createdBy: null };
        const inserted = await db.insert(invoices).values(fallback).returning();
        return inserted[0];
      }
      throw err;
    }
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>) {
    const updated = await db.update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
    return updated[0];
  }

  async deleteInvoice(id: string) {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Generation from delivery: derive customer, sales order, sums from delivered items
  async generateInvoiceFromDelivery(deliveryId: string, invoiceType: string = 'Final', userId?: string, selectedDeliveryItemIds?: string[]) {
    console.log(`[DEBUG] Starting invoice generation for delivery: ${deliveryId}`);
    
    let deliveryRec: any;
    let soId: string;
    let so: any;
    let items: any[];
    
    try {
      const deliveryRecArr = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1);
      deliveryRec = deliveryRecArr[0];
      if (!deliveryRec) throw new Error('Delivery not found');
      console.log(`[DEBUG] Found delivery: ${deliveryRec.deliveryNumber}`);
      soId = deliveryRec.salesOrderId;
      console.log(`[DEBUG] Sales order ID: ${soId}`);
      
      // Sales order ID is required for invoice generation
      if (!soId) {
        throw new Error('Delivery must be linked to a sales order to generate an invoice');
      }
      
      const soArr = await db.select().from(salesOrders).where(eq(salesOrders.id, soId)).limit(1);
      so = soArr[0];
      if (!so) {
        throw new Error('Sales order not found for the delivery');
      }
      console.log(`[DEBUG] Found sales order: ${so.orderNumber}`);
      items = await db.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, deliveryId));
      console.log(`[DEBUG] Found ${items.length} delivery items`);
      
      // Filter items if specific delivery items are selected for partial invoice
      if (selectedDeliveryItemIds && selectedDeliveryItemIds.length > 0) {
        items = items.filter(item => selectedDeliveryItemIds.includes(item.id));
        console.log(`[DEBUG] Filtered to ${items.length} selected delivery items for partial invoice`);
      }
      
      console.log(`[DEBUG] Delivery items data:`, items.map(item => ({
        id: item.id,
        itemId: item.itemId,
        salesOrderItemId: item.salesOrderItemId,
        description: item.description,
        barcode: item.barcode,
        supplierCode: item.supplierCode
      })));
    } catch (error) {
      console.error(`[DEBUG] Error in initial data fetching:`, error);
      throw error;
    }
    
    // If no delivery items found, create them from sales order items
    let itemsToProcess = items;
    if (items.length === 0 && soId) {
      console.log(`[DEBUG] No delivery items found, creating from sales order items`);
      const salesOrderItemsData = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, soId));
      console.log(`[DEBUG] Found ${salesOrderItemsData.length} sales order items`);
      
      // PERFORMANCE OPTIMIZATION: Batch load all item data upfront for virtual items
      const virtualItemIds = new Set<string>();
      for (const soItem of salesOrderItemsData) {
        if (soItem.itemId) {
          virtualItemIds.add(soItem.itemId);
        }
      }
      
      const virtualItemsMap = new Map<string, any>();
      if (virtualItemIds.size > 0) {
        try {
          const allVirtualItems = await db.select()
            .from(itemsTable)
            .where(inArray(itemsTable.id, Array.from(virtualItemIds)));
          for (const item of allVirtualItems) {
            virtualItemsMap.set(item.id, item);
          }
          console.log(`[DEBUG] Batch loaded ${allVirtualItems.length} items for virtual delivery items`);
        } catch (e) {
          console.log('[DEBUG] Error batch loading items for virtual delivery items:', e);
        }
      }
      
      // Create virtual delivery items from sales order items
      itemsToProcess = [];
      for (const soItem of salesOrderItemsData) {
        // Skip if specific items are selected and this item is not in the selection
        if (selectedDeliveryItemIds && selectedDeliveryItemIds.length > 0) {
          // For virtual items, we'll use the salesOrderItemId as the identifier
          if (!selectedDeliveryItemIds.includes(soItem.id)) {
            continue;
          }
        }
        // PERFORMANCE OPTIMIZATION: Use pre-loaded item data from map instead of querying
        const itemData = soItem.itemId ? virtualItemsMap.get(soItem.itemId) : null;
        
        // Use actual item data if available, otherwise use sales order item data
        const barcode = itemData?.barcode || soItem.barcode || `SO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const supplierCode = itemData?.supplierCode || soItem.supplierCode || `SO-${Date.now()}`;
        const description = soItem.description || itemData?.description || soItem.specialInstructions || 'Item from Sales Order';
        
        itemsToProcess.push({
          id: `virtual-${soItem.id}`,
          deliveryId: deliveryId,
          salesOrderItemId: soItem.id,
          itemId: soItem.itemId,
          lineNumber: soItem.lineNumber || itemsToProcess.length + 1,
          barcode: barcode,
          supplierCode: supplierCode,
          description: description,
          orderedQuantity: soItem.quantity,
          pickedQuantity: soItem.quantity,
          deliveredQuantity: soItem.quantity,
          unitPrice: soItem.unitPrice,
          totalPrice: soItem.totalPrice,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`[DEBUG] Created ${itemsToProcess.length} virtual delivery items`);
    }
    
    // Attempt to get pricing from related sales order items if present
    // Preload related quotation header and items (if any) so we can apply discounts properly
    let quotationHeader: any = null;
    let quotationItemsRows: any[] = [];
    if (so?.quotationId) {
      try {
        const qHdrArr: any[] = await db.select().from(quotations).where(eq(quotations.id, so.quotationId)).limit(1);
        quotationHeader = qHdrArr[0] || null;
      } catch (e) {
        console.log('[DEBUG] Could not fetch quotation header:', e);
      }
      try {
        // Fetch quotation items list
        quotationItemsRows = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, so.quotationId));
        console.log(`[DEBUG] Preloaded ${quotationItemsRows.length} quotation items for discount mapping`);
      } catch (e) {
        console.log('[DEBUG] Could not fetch quotation items upfront:', e);
        quotationItemsRows = [];
      }
    }

    // PERFORMANCE OPTIMIZATION: Batch load all sales order items, enquiry items, and item master data upfront
    // Collect all unique IDs we need to fetch
    const salesOrderItemIds = new Set<string>();
    const enquiryItemIds = new Set<string>();
    const itemIds = new Set<string>();
    
    // Collect all IDs from itemsToProcess
    for (const di of itemsToProcess as any[]) {
      if (di.salesOrderItemId && 
          typeof di.salesOrderItemId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(di.salesOrderItemId)) {
        salesOrderItemIds.add(di.salesOrderItemId);
      }
      if (di.itemId && 
          typeof di.itemId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(di.itemId)) {
        itemIds.add(di.itemId);
      }
    }
    
    // Also collect from regular items array
    for (const di of items as any[]) {
      if (di.salesOrderItemId && 
          typeof di.salesOrderItemId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(di.salesOrderItemId)) {
        salesOrderItemIds.add(di.salesOrderItemId);
      }
      if (di.itemId && 
          typeof di.itemId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(di.itemId)) {
        itemIds.add(di.itemId);
      }
    }
    
    // Batch load all sales order items
    const salesOrderItemsMap = new Map<string, any>();
    if (salesOrderItemIds.size > 0) {
      try {
        const allSalesOrderItems = await db.select()
          .from(salesOrderItems)
          .where(inArray(salesOrderItems.id, Array.from(salesOrderItemIds)));
        for (const soItem of allSalesOrderItems) {
          salesOrderItemsMap.set(soItem.id, soItem);
          // Collect enquiry item IDs from sales order items
          if (soItem.enquiryItemId) {
            enquiryItemIds.add(soItem.enquiryItemId);
          }
          // Collect item IDs from sales order items
          if (soItem.itemId) {
            itemIds.add(soItem.itemId);
          }
        }
        console.log(`[DEBUG] Batch loaded ${allSalesOrderItems.length} sales order items`);
      } catch (e) {
        console.log('[DEBUG] Error batch loading sales order items:', e);
      }
    }
    
    // Batch load all enquiry items (by ID and by itemId)
    const enquiryItemsByIdMap = new Map<string, any>();
    const enquiryItemsByItemIdMap = new Map<string, any>();
    if (enquiryItemIds.size > 0) {
      try {
        const allEnquiryItemsById = await db.select()
          .from(enquiryItems)
          .where(inArray(enquiryItems.id, Array.from(enquiryItemIds)));
        for (const ei of allEnquiryItemsById) {
          enquiryItemsByIdMap.set(ei.id, ei);
        }
        console.log(`[DEBUG] Batch loaded ${allEnquiryItemsById.length} enquiry items by ID`);
      } catch (e) {
        console.log('[DEBUG] Error batch loading enquiry items by ID:', e);
      }
    }
    
    // Also batch load enquiry items by itemId if we have itemIds
    if (itemIds.size > 0) {
      try {
        const allEnquiryItemsByItemId = await db.select()
          .from(enquiryItems)
          .where(inArray(enquiryItems.itemId, Array.from(itemIds)));
        for (const ei of allEnquiryItemsByItemId) {
          enquiryItemsByItemIdMap.set(ei.itemId, ei);
        }
        console.log(`[DEBUG] Batch loaded ${allEnquiryItemsByItemId.length} enquiry items by itemId`);
      } catch (e) {
        console.log('[DEBUG] Error batch loading enquiry items by itemId:', e);
      }
    }
    
    // Batch load all item master data
    const itemsMap = new Map<string, any>();
    if (itemIds.size > 0) {
      try {
        const allItems = await db.select()
          .from(itemsTable)
          .where(inArray(itemsTable.id, Array.from(itemIds)));
        for (const item of allItems) {
          itemsMap.set(item.id, item);
        }
        console.log(`[DEBUG] Batch loaded ${allItems.length} items from master table`);
      } catch (e) {
        console.log('[DEBUG] Error batch loading items from master table:', e);
      }
    }

    // Compute a gross basis for proration when quotation has header discountAmount
    let precomputedGrossBasis = 0;
    if (items && items.length) {
      for (const di of items as any[]) {
        // Use pre-loaded sales order item data
        const soItem = di.salesOrderItemId ? salesOrderItemsMap.get(di.salesOrderItemId) : null;
        const soItemUnitPrice = soItem ? num(soItem.unitPrice) : 0;
        const qty = num((di as any).deliveredQuantity || (di as any).pickedQuantity || (di as any).orderedQuantity || 0);
        const unit = soItemUnitPrice || num((di as any).unitPrice);
        precomputedGrossBasis += qty * unit;
      }
    }
    let subtotal = 0; // subtotal after discount (net)
    let taxTotal = 0;
    let totalDiscount = 0;
    const invoiceItemsToInsert: any[] = [];
    let lineNumber = 1;
    for (const di of itemsToProcess as any[]) {
      console.log(`[DEBUG] Processing delivery item: ${di.id}`);
      console.log(`[DEBUG] Current subtotal before processing item: ${subtotal}`);
      
      // PERFORMANCE OPTIMIZATION: Use pre-loaded sales order item from map instead of querying
      const isValidSalesOrderItemId = di.salesOrderItemId && 
        di.salesOrderItemId !== null && 
        di.salesOrderItemId !== undefined && 
        di.salesOrderItemId !== 'null' &&
        typeof di.salesOrderItemId === 'string' &&
        di.salesOrderItemId.length > 0 &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(di.salesOrderItemId);
      
      // Get sales order item from pre-loaded map
      const soItem: any = isValidSalesOrderItemId ? salesOrderItemsMap.get(di.salesOrderItemId) : null;
      
      // PERFORMANCE OPTIMIZATION: Use pre-loaded enquiry item from map instead of querying
      let linkedEnquiryItem: any = null;
      if (soItem?.enquiryItemId) {
        linkedEnquiryItem = enquiryItemsByIdMap.get(soItem.enquiryItemId) || null;
      } else if (soItem?.itemId) {
        linkedEnquiryItem = enquiryItemsByItemIdMap.get(soItem.itemId) || null;
      }
      
      if (soItem && !linkedEnquiryItem && soItem.itemId) {
        // Try fallback lookup by itemId if not found yet
        linkedEnquiryItem = enquiryItemsByItemIdMap.get(soItem.itemId) || null;
      }
      console.log(`[DEBUG] Sales order item: ${soItem?.id || 'None'}`);
      console.log(`[DEBUG] Sales order item data:`, soItem ? {
        id: soItem.id,
        itemId: soItem.itemId,
        quantity: soItem.quantity,
        unitPrice: soItem.unitPrice,
        totalPrice: soItem.totalPrice,
        discountPercentage: (soItem as any)?.discountPercentage,
        vatPercentage: (soItem as any)?.vatPercentage
      } : 'None');
      
      const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
      const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
      const lineGross = qty * unitPrice;
      
      console.log(`[DEBUG] Quantity calculation: deliveredQuantity=${di.deliveredQuantity}, pickedQuantity=${di.pickedQuantity}, orderedQuantity=${di.orderedQuantity}, soItem.quantity=${soItem?.quantity}, final qty=${qty}`);
      console.log(`[DEBUG] Unit price calculation: soItem.unitPrice=${soItem?.unitPrice}, di.unitPrice=${di.unitPrice}, final unitPrice=${unitPrice}`);
      console.log(`[DEBUG] Line gross calculation: qty=${qty} * unitPrice=${unitPrice} = ${lineGross}`);
      
      // Add error logging if qty or unitPrice is 0
      if (qty === 0) {
        console.log(`[ERROR] Quantity is 0 for delivery item ${di.id}:`, {
          deliveredQuantity: di.deliveredQuantity,
          pickedQuantity: di.pickedQuantity,
          orderedQuantity: di.orderedQuantity,
          soItemQuantity: soItem?.quantity
        });
      }
      if (unitPrice === 0) {
        console.log(`[ERROR] Unit price is 0 for delivery item ${di.id}:`, {
          soItemUnitPrice: soItem?.unitPrice,
          diUnitPrice: di.unitPrice
        });
      }
      const lineTotal = qty * unitPrice; // Correct total calculation
      const barcode = di.barcode || soItem?.barcode || `AUTO-${lineNumber}`;
      const supplierCode = di.supplierCode || soItem?.supplierCode || 'AUTO-SUP';
  // Get itemId first
  const itemId = soItem?.itemId || di.itemId || null;
  
  // Try to get original quotation item description if available
  let quotationItemDescription = null;
  // We'll also try to capture discount info from related quotation item if available
      let matchingQuotationItem: any = null;
      if (so?.quotationId && quotationItemsRows.length) {
        // Try multiple matching strategies to find the correct quotation item
        const norm = (s: any) => (s ? String(s).replace(/\s+/g, ' ').trim().toLowerCase() : '');
        const soDesc = norm(soItem?.description);
        const soItemId = soItem?.itemId;
        
        // Strategy 1: Match by itemId if available
        if (soItemId) {
          matchingQuotationItem = quotationItemsRows.find(qi => qi.itemId === soItemId);
          console.log(`[DEBUG] Strategy 1 - Matching by itemId ${soItemId}: ${matchingQuotationItem ? 'Found' : 'Not found'}`);
        }
        
        // Strategy 2: Match by description if itemId match failed
        if (!matchingQuotationItem && soDesc) {
          matchingQuotationItem = quotationItemsRows.find(qi => norm(qi.description) === soDesc);
          console.log(`[DEBUG] Strategy 2 - Matching by description "${soDesc}": ${matchingQuotationItem ? 'Found' : 'Not found'}`);
        }
        
        // Strategy 3: Match by partial description if exact match failed
        if (!matchingQuotationItem && soDesc) {
          matchingQuotationItem = quotationItemsRows.find(qi => 
            norm(qi.description).includes(soDesc) || soDesc.includes(norm(qi.description))
          );
          console.log(`[DEBUG] Strategy 3 - Matching by partial description: ${matchingQuotationItem ? 'Found' : 'Not found'}`);
        }
        
        // Strategy 4: Match by line number if available
        if (!matchingQuotationItem && soItem?.lineNumber) {
          matchingQuotationItem = quotationItemsRows.find(qi => qi.lineNumber === soItem.lineNumber);
          console.log(`[DEBUG] Strategy 4 - Matching by line number ${soItem.lineNumber}: ${matchingQuotationItem ? 'Found' : 'Not found'}`);
        }
        
        // Strategy 5: Match by position in the array (based on current item index)
        if (!matchingQuotationItem) {
          const currentItemIndex = itemsToProcess.findIndex(item => item.id === di.id);
          const itemIndex = Math.min(currentItemIndex, quotationItemsRows.length - 1);
          matchingQuotationItem = quotationItemsRows[itemIndex];
          console.log(`[DEBUG] Strategy 5 - Using quotation item at position ${itemIndex} (current item index: ${currentItemIndex}) as fallback`);
        }
        
        // Strategy 6: Fall back to first item (absolute last resort)
        if (!matchingQuotationItem) {
          matchingQuotationItem = quotationItemsRows[0];
          console.log(`[DEBUG] Strategy 6 - Using first quotation item as absolute fallback`);
        }
        
        if (matchingQuotationItem && matchingQuotationItem.description) {
          quotationItemDescription = matchingQuotationItem.description;
          console.log(`[DEBUG] Using quotation item description for invoice: ${quotationItemDescription.substring(0, 50)}...`);
          console.log(`[DEBUG] Quotation item discount: ${(matchingQuotationItem as any)?.discountPercentage || 0}%, VAT: ${(matchingQuotationItem as any)?.vatPercent || 0}%`);
          console.log(`[DEBUG] Quotation item raw data:`, {
            id: matchingQuotationItem.id,
            description: matchingQuotationItem.description,
            discountPercentage: (matchingQuotationItem as any)?.discountPercentage,
            vatPercent: (matchingQuotationItem as any)?.vatPercent,
            vatPercentage: (matchingQuotationItem as any)?.vatPercentage
          });
        } else {
          console.log(`[DEBUG] No quotation item found for delivery item ${di.id}`);
        }
      }

  // Compose richer description: priority order -> item master description, quotation item description, sales order item description, delivery item description, enquiry item description
  // plus notes/specifications appended.
  let baseDesc: string = 'Item';
  
  // PERFORMANCE OPTIMIZATION: Use pre-loaded item master data from map instead of querying
  if (itemId) {
    const item = itemsMap.get(itemId);
    if (item && item.description && item.description !== 'Generic Item' && item.description !== 'Item from Sales Order') {
      baseDesc = item.description;
      console.log(`[DEBUG] Using item master description: ${baseDesc.substring(0, 50)}...`);
    }
  }
  
  // Fallback to other sources if item master description is not suitable
  if (baseDesc === 'Item' || baseDesc === 'Generic Item' || baseDesc === 'Item from Sales Order') {
    baseDesc = quotationItemDescription || soItem?.description || di.description || linkedEnquiryItem?.description || 'Item';
    console.log(`[DEBUG] Using fallback description: ${baseDesc.substring(0, 50)}...`);
  }
  const extraNotes: string[] = [];
  if (linkedEnquiryItem?.notes) extraNotes.push(linkedEnquiryItem.notes);
  if (soItem?.notes) extraNotes.push(soItem.notes);
  if (di?.pickingNotes) extraNotes.push(di.pickingNotes);
  const composedDescription = extraNotes.length ? `${baseDesc}\n${extraNotes.join('\n')}` : baseDesc;
      console.log(`[DEBUG] Item ID: ${itemId}, Barcode: ${barcode}, Supplier Code: ${supplierCode}`);
      
      // Check if the item exists in the items table - validate itemId more strictly
      const isValidItemId = itemId && 
        itemId !== null && 
        itemId !== undefined && 
        itemId !== 'null' && 
        itemId !== 'undefined' &&
        typeof itemId === 'string' &&
        itemId.length > 0 &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId);
      
      // PERFORMANCE OPTIMIZATION: Use pre-loaded item master data from map instead of querying
      if (isValidItemId) {
        const item: any = itemsMap.get(itemId);
        console.log(`[DEBUG] Item master data:`, item ? {
          id: item.id,
          supplierCode: item.supplierCode,
          barcode: item.barcode,
          description: item.description
        } : 'Item not found in master data');
        
        // If item exists, use its data for better accuracy
        if (item) {
          const finalBarcode = di.barcode || item.barcode || `AUTO-${lineNumber}`;
          const finalSupplierCode = di.supplierCode || item.supplierCode || 'AUTO-SUP';
          const finalDescription = di.description || item.description || 'Item';
          
          console.log(`[DEBUG] Using item master data - Barcode: ${finalBarcode}, Supplier Code: ${finalSupplierCode}, Description: ${finalDescription}`);
        }
      }
      
      if (!isValidItemId) {
        console.log(`[DEBUG] WARNING: No itemId found for delivery item ${di.id}, attempting to create minimal item...`);
        console.log(`[DEBUG] Taking minimal item creation path for item ${di.id}`);
        
        // Try to create a minimal item as a last resort
        try {
          const minimalItem = {
            supplierCode: di.supplierCode || 'AUTO-SUP',
            barcode: di.barcode || `AUTO-${Date.now()}-${lineNumber}`,
            description: di.description || 'Auto-generated item for invoice',
            category: 'Auto-generated',
            unitOfMeasure: 'EA',
            costPrice: '0.00',
            isActive: true
          };
          
          const [createdItem]: any[] = await db.insert(itemsTable).values(minimalItem as any).returning();
          console.log(`[DEBUG] Created minimal item: ${createdItem.id}`);
          
          // Update the itemId for this delivery item
          const updatedItemId = createdItem.id;
          console.log(`[DEBUG] Using created item ID: ${updatedItemId}`);
          
          // Continue with the created item
          const finalBarcode = di.barcode || createdItem.barcode || `AUTO-${lineNumber}`;
          const finalSupplierCode = di.supplierCode || createdItem.supplierCode || 'AUTO-SUP';
          const finalDescription = di.description || createdItem.description || 'Item';
          
      // Determine discount percent/amount from various sources
      // Priority: LPO item > quotation item > sales order item > quotation header > delivery item > default 0
      const rawDiscPerc = (
        (di as any)?.lpoDiscountPercent ??
        (di as any)?.lpoDiscountPercentage ??
        (matchingQuotationItem as any)?.discountPercentage ??
        (matchingQuotationItem as any)?.discountPercent ??
        (soItem as any)?.discountPercentage ??
        (soItem as any)?.discountPercent ??
        (quotationHeader as any)?.discountPercentage ??
        (quotationHeader as any)?.discountPercent ??
        (di as any)?.discountPercentage ??
        (di as any)?.discountPercent ??
        0
      );
      const discPerc = num(rawDiscPerc);
      // Calculate discount amount - ALWAYS calculate from percentage to ensure per-item calculation
      const percDiscAmt = (lineGross * discPerc) / 100;
      let lineDiscount = percDiscAmt;
      
      console.log(`[DEBUG] Discount sources for item ${di.id} (path 1): matchingQuotationItem.discountPercentage=${(matchingQuotationItem as any)?.discountPercentage}, soItem.discountPercentage=${(soItem as any)?.discountPercentage}, quotationHeader.discountPercentage=${(quotationHeader as any)?.discountPercentage}, di.discountPercentage=${(di as any)?.discountPercentage}, discPerc=${discPerc}, lineGross=${lineGross}, percDiscAmt=${percDiscAmt}, lineDiscount=${lineDiscount}`);
      console.log(`[DEBUG] Final discount calculation for item ${di.id}: discPerc=${discPerc}%, lineGross=${lineGross}, lineDiscount=${lineDiscount}`);
      // Guard: discount should never be 100% of the gross amount (cap at 99.9%)
      const maxDiscount = lineGross * 0.999;
      if (lineDiscount >= lineGross) {
        console.log(`[WARNING] Discount ${lineDiscount} equals or exceeds gross ${lineGross} for item ${di.id}, capping at 99.9%`);
        lineDiscount = maxDiscount;
      }
      console.log(`[DEBUG] Discount calc for item ${di.id}: lineGross=${lineGross}, discPerc=${discPerc}, percDiscAmt=${percDiscAmt}, lineDiscount=${lineDiscount}`);
      totalDiscount += lineDiscount;
      const lineNet = Math.max(0.01, lineGross - lineDiscount); // Ensure minimum of 0.01
      console.log(`[DEBUG] After item ${di.id}: lineNet=${lineNet}, lineGross=${lineGross}, lineDiscount=${lineDiscount}, subtotal now=${subtotal + lineNet}`);
      subtotal += lineNet; // Use net amount after discount for subtotal

      // Get VAT percentage from various sources, with proper fallback
      // Priority: LPO item > quotation item > sales order item > quotation header > delivery item > default 10%
      const rawVatPerc = (
        (di as any)?.lpoVatPercent ??
        (di as any)?.lpoVatPercentage ??
        (matchingQuotationItem as any)?.vatPercent ??
        (matchingQuotationItem as any)?.vatPercentage ??
        (soItem as any)?.vatPercent ??
        (soItem as any)?.vatPercentage ??
        (quotationHeader as any)?.vatPercent ??
        (quotationHeader as any)?.vatPercentage ??
        (di as any)?.vatPercent ??
        (di as any)?.vatPercentage ??
        0 // Default to 0% if no VAT percentage is found
      );
      const vatPerc = num(rawVatPerc);
      
      console.log(`[DEBUG] VAT sources for item ${di.id} (path 1): soItem.vatPercentage=${(soItem as any)?.vatPercentage}, soItem.vatPercent=${(soItem as any)?.vatPercent}, matchingQuotationItem.vatPercentage=${(matchingQuotationItem as any)?.vatPercentage}, matchingQuotationItem.vatPercent=${(matchingQuotationItem as any)?.vatPercent}, di.vatPercentage=${(di as any)?.vatPercentage}, di.vatPercent=${(di as any)?.vatPercent}, quotationHeader.vatPercentage=${(quotationHeader as any)?.vatPercentage}, quotationHeader.vatPercent=${(quotationHeader as any)?.vatPercent}, rawVatPerc=${rawVatPerc}, vatPerc=${vatPerc}`);
      console.log(`[DEBUG] Final VAT calculation for item ${di.id}: vatPerc=${vatPerc}%, lineNet=${lineNet}, lineTax=${lineTax}`);
      
      // Calculate VAT amount based on net amount after discount
      const lineTax = Math.round((lineNet * vatPerc / 100) * 100) / 100;
      taxTotal += lineTax;
      
      console.log(`[DEBUG] VAT calc for item ${di.id}: lineNet=${lineNet}, vatPerc=${vatPerc}, lineTax=${lineTax}`);
      
          invoiceItemsToInsert.push({
            invoiceId: 'TEMP',
            deliveryItemId: di.id.startsWith('virtual-') ? null : di.id,
            salesOrderItemId: di.salesOrderItemId || soItem?.id || null,
            itemId: updatedItemId,
            barcode: finalBarcode,
            supplierCode: finalSupplierCode,
            description: finalDescription,
            lineNumber,
            quantity: qty,
            unitPrice: unitPrice,
        totalPrice: lineNet,
        discountPercentage: String(discPerc),
        discountAmount: lineDiscount,
            taxRate: String(vatPerc),
            taxAmount: lineTax,
        unitPriceBase: unitPrice,
        totalPriceBase: lineNet,
        discountAmountBase: lineDiscount,
            taxAmountBase: lineTax,
            returnQuantity: 0,
            notes: null
          });
          lineNumber++;
          continue;
        } catch (createError) {
          console.log(`[DEBUG] ERROR: Failed to create minimal item:`, createError);
          console.log(`[DEBUG] WARNING: Skipping delivery item ${di.id} due to missing itemId and failed item creation`);
          continue;
        }
      }
      
      console.log(`[DEBUG] Taking normal item processing path for item ${di.id}`);
      
      // Ensure we have all required fields - but be more lenient with barcode and supplierCode
      // since they might not be available in sales order items due to schema limitations
      if (!baseDesc) {
        console.log(`[DEBUG] WARNING: Missing description for delivery item ${di.id}, skipping...`);
        continue;
      }
      
      const rawDiscPerc2 = (
        (di as any)?.lpoDiscountPercent ??
        (di as any)?.lpoDiscountPercentage ??
        (matchingQuotationItem as any)?.discountPercentage ??
        (matchingQuotationItem as any)?.discountPercent ??
        (soItem as any)?.discountPercentage ??
        (soItem as any)?.discountPercent ??
        (quotationHeader as any)?.discountPercentage ??
        (quotationHeader as any)?.discountPercent ??
        (di as any)?.discountPercentage ??
        (di as any)?.discountPercent ??
        0
      );
      const discPerc2 = num(rawDiscPerc2);
      // Calculate discount amount - ALWAYS calculate from percentage to ensure per-item calculation
      const percDiscAmt2 = Math.round(((lineGross * discPerc2) / 100) * 100) / 100;
      let lineDiscount2 = percDiscAmt2;
      
      console.log(`[DEBUG] Discount sources for item ${di.id} (path 2): matchingQuotationItem.discountPercentage=${(matchingQuotationItem as any)?.discountPercentage}, soItem.discountPercentage=${(soItem as any)?.discountPercentage}, quotationHeader.discountPercentage=${(quotationHeader as any)?.discountPercentage}, di.discountPercentage=${(di as any)?.discountPercentage}, discPerc2=${discPerc2}, lineGross=${lineGross}, percDiscAmt2=${percDiscAmt2}, lineDiscount2=${lineDiscount2}`);
      // Guard: discount should never be 100% of the gross amount (cap at 99.9%)
      const maxDiscount2 = lineGross * 0.999;
      if (lineDiscount2 >= lineGross) {
        console.log(`[WARNING] Discount ${lineDiscount2} equals or exceeds gross ${lineGross} for item ${di.id}, capping at 99.9%`);
        lineDiscount2 = maxDiscount2;
      }
      console.log(`[DEBUG] Discount calc for item ${di.id} (path 2): lineGross=${lineGross}, discPerc2=${discPerc2}, percDiscAmt2=${percDiscAmt2}, lineDiscount2=${lineDiscount2}`);
      totalDiscount += lineDiscount2;
      const lineNet2 = Math.max(0.01, Math.round((lineGross - lineDiscount2) * 100) / 100); // Ensure minimum of 0.01
      console.log(`[DEBUG] After item ${di.id} (path 2): lineNet2=${lineNet2}, lineGross=${lineGross}, lineDiscount2=${lineDiscount2}, subtotal now=${subtotal + lineNet2}`);
      subtotal += lineNet2; // Use net amount after discount for subtotal

      // Get VAT percentage from various sources, with proper fallback
      const rawVatPerc2 = (
        (di as any)?.lpoVatPercent ??
        (di as any)?.lpoVatPercentage ??
        (matchingQuotationItem as any)?.vatPercent ??
        (matchingQuotationItem as any)?.vatPercentage ??
        (soItem as any)?.vatPercent ??
        (soItem as any)?.vatPercentage ??
        (quotationHeader as any)?.vatPercent ??
        (quotationHeader as any)?.vatPercentage ??
        (di as any)?.vatPercent ??
        (di as any)?.vatPercentage ??
        0 // Default to 0% if no VAT percentage is found
      );
      const vatPerc = num(rawVatPerc2);
      
      console.log(`[DEBUG] VAT sources for item ${di.id}: soItem.vatPercentage=${(soItem as any)?.vatPercentage}, soItem.vatPercent=${(soItem as any)?.vatPercent}, matchingQuotationItem.vatPercentage=${(matchingQuotationItem as any)?.vatPercentage}, matchingQuotationItem.vatPercent=${(matchingQuotationItem as any)?.vatPercent}, di.vatPercentage=${(di as any)?.vatPercentage}, di.vatPercent=${(di as any)?.vatPercent}, quotationHeader.vatPercentage=${(quotationHeader as any)?.vatPercentage}, quotationHeader.vatPercent=${(quotationHeader as any)?.vatPercent}, rawVatPerc2=${rawVatPerc2}, vatPerc=${vatPerc}`);
      
      // Calculate VAT amount based on net amount after discount
      const lineTax = Math.round((lineNet2 * vatPerc / 100) * 100) / 100;
      taxTotal += lineTax;
      
      console.log(`[DEBUG] VAT calc for item ${di.id} (path 2): lineNet2=${lineNet2}, vatPerc=${vatPerc}, lineTax=${lineTax}`);
      invoiceItemsToInsert.push({
        invoiceId: 'TEMP',
        deliveryItemId: di.id.startsWith('virtual-') ? null : di.id,
        salesOrderItemId: di.salesOrderItemId || soItem?.id || null,
        itemId: itemId,
        barcode,
        supplierCode,
        description: composedDescription,
        lineNumber,
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: lineNet2,
        discountPercentage: String(discPerc2),
        discountAmount: lineDiscount2,
        taxRate: String(vatPerc),
        taxAmount: lineTax,
        unitPriceBase: unitPrice,
        totalPriceBase: lineNet2,
        discountAmountBase: lineDiscount2,
        taxAmountBase: lineTax,
        returnQuantity: 0,
        notes: linkedEnquiryItem?.notes || soItem?.notes || null
      });
      lineNumber++;
    }
    console.log(`[DEBUG] Subtotal calculated: ${subtotal}`);
    console.log(`[DEBUG] Invoice items to insert: ${invoiceItemsToInsert.length}`);
    console.log(`[DEBUG] Items processed: ${itemsToProcess.length}`);
    console.log(`[DEBUG] Invoice items total prices:`, invoiceItemsToInsert.map(item => ({
      deliveryItemId: item.deliveryItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    })));
    
    // Summary of discount and VAT percentages used for each item
    console.log(`[DEBUG] DISCOUNT AND VAT SUMMARY:`);
    invoiceItemsToInsert.forEach((item, index) => {
      console.log(`[DEBUG] Item ${index + 1}: Discount=${item.discountPercentage}%, VAT=${item.taxRate}%`);
    });
    
    if (invoiceItemsToInsert.length === 0) {
      console.log(`[DEBUG] ERROR: No valid items found for invoice generation`);
      console.log(`[DEBUG] Items to process:`, itemsToProcess.map(item => ({
        id: item.id,
        itemId: item.itemId,
        barcode: item.barcode,
        supplierCode: item.supplierCode,
        description: item.description
      })));
      
      // Provide more helpful error message
      if (itemsToProcess.length === 0) {
        throw new Error('No delivery items found for this delivery. Please ensure the delivery has items before generating an invoice.');
      } else {
        throw new Error(`Found ${itemsToProcess.length} delivery items but none could be processed for invoice generation. This may be due to missing item references or invalid data.`);
      }
    }
    
    // Validate that we have all required data
    if (!so.customerId) {
      throw new Error('Sales order is missing customer ID');
    }
    
    // Additional validation for required fields
    if (!soId) {
      throw new Error('Sales order ID is required for invoice generation');
    }
    
    if (subtotal <= 0) {
      console.log(`[ERROR] Subtotal is ${subtotal}, invoice items count: ${invoiceItemsToInsert.length}`);
      console.log(`[ERROR] Items processed: ${itemsToProcess.length}`);
      console.log(`[ERROR] Debug info for each item:`);
      for (let i = 0; i < itemsToProcess.length; i++) {
        const di = itemsToProcess[i];
        const soItem = Array.isArray(salesOrderItems) ? 
          salesOrderItems.find(soi => soi.id === di.salesOrderItemId) : 
          null;
        const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
        const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
        const lineGross = qty * unitPrice;
        console.log(`[ERROR] Item ${i+1}: qty=${qty}, unitPrice=${unitPrice}, lineGross=${lineGross}`);
      }
      // Calculate subtotal from invoice items as a fallback
      const calculatedSubtotal = invoiceItemsToInsert.reduce((sum, item) => sum + num(item.totalPrice), 0);
      console.log(`[ERROR] Calculated subtotal from invoice items: ${calculatedSubtotal}`);
      
      // If we have invoice items with valid totals, use that as the subtotal
      if (calculatedSubtotal > 0) {
        console.log(`[FIX] Using calculated subtotal ${calculatedSubtotal} instead of accumulated subtotal ${subtotal}`);
        subtotal = calculatedSubtotal;
      } else {
        throw new Error(`Invoice subtotal must be greater than zero. Subtotal: ${subtotal}, Calculated: ${calculatedSubtotal}, Items: ${invoiceItemsToInsert.length}, ItemsToProcess: ${itemsToProcess.length}, LineGross values: ${itemsToProcess.map(di => {
          const soItem = Array.isArray(salesOrderItems) ? salesOrderItems.find(soi => soi.id === di.salesOrderItemId) : null;
          const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
          const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
          const lineGross = qty * unitPrice;
          return `${di.id}:${lineGross}`;
        }).join(',')}`);
      }
    }
    
    console.log(`[DEBUG] Validation passed - proceeding with invoice creation`);
    console.log(`[DEBUG] Sales Order ID: ${soId}`);
    console.log(`[DEBUG] Customer ID: ${so.customerId}`);
    console.log(`[DEBUG] Subtotal: ${subtotal}`);
    
    const invoiceNumber = this.generateNumber('INV');
    console.log(`[DEBUG] Generated invoice number: ${invoiceNumber}`);
    const invoiceInsert: any = {
      invoiceNumber,
      invoiceType,
      salesOrderId: soId, // This is now guaranteed to be non-null
      deliveryId,
      customerId: so.customerId, // Use sales order customer ID as primary source
      status: 'Draft',
      currency: so.currency || 'BHD',
      exchangeRate: so.exchangeRate || '1.0000',
      baseCurrency: so.baseCurrency || 'BHD',
      subtotal: subtotal,
      taxRate: '10',
      taxAmount: taxTotal,
      discountPercentage: '0',
      discountAmount: totalDiscount,
      totalAmount: subtotal + taxTotal,
      paidAmount: 0,
      remainingAmount: subtotal + taxTotal,
      outstandingAmount: subtotal + taxTotal,
      subtotalBase: subtotal,
      taxAmountBase: taxTotal,
      discountAmountBase: totalDiscount,
      totalAmountBase: subtotal + taxTotal,
      autoGenerated: true,
      generatedFromDeliveryId: deliveryId,
      createdBy: userId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log(`[DEBUG] Inserting invoice with customerId: ${invoiceInsert.customerId}`);
    let invoice: any;
    try {
      const inserted = await db.insert(invoices).values(invoiceInsert).returning();
      invoice = inserted[0];
      console.log(`[DEBUG] Invoice created successfully: ${invoice.id}`);
    } catch (err: any) {
      console.log(`[DEBUG] Invoice creation failed:`, err);
      console.log(`[DEBUG] Error code: ${err?.code}`);
      console.log(`[DEBUG] Error detail: ${err?.detail}`);
      console.log(`[DEBUG] Error message: ${err?.message}`);
      console.log(`[DEBUG] Invoice data being inserted:`, JSON.stringify(invoiceInsert, null, 2));
      
      // Handle foreign key constraint violations
      if (err?.code === '23503') {
        if (String(err?.detail || '').includes('created_by')) {
          console.log(`[DEBUG] Retrying with null createdBy`);
          const inserted = await db.insert(invoices).values({ ...invoiceInsert, createdBy: null }).returning();
          invoice = inserted[0];
          console.log(`[DEBUG] Invoice created with null createdBy: ${invoice.id}`);
        } else if (String(err?.detail || '').includes('customer_id')) {
          throw new Error(`Invalid customer ID: ${invoiceInsert.customerId}. Customer not found. Please ensure the sales order has a valid customer assigned.`);
        } else if (String(err?.detail || '').includes('sales_order_id')) {
          throw new Error(`Invalid sales order ID: ${invoiceInsert.salesOrderId}. Sales order not found. Please ensure the delivery is properly linked to a valid sales order.`);
        } else if (String(err?.detail || '').includes('delivery_id')) {
          throw new Error(`Invalid delivery ID: ${invoiceInsert.deliveryId}. Delivery not found.`);
        } else {
          throw new Error(`Database constraint violation: ${err?.detail || err?.message}`);
        }
      } else if (err?.code === '23505') {
        // Unique constraint violation
        throw new Error(`Invoice number ${invoiceInsert.invoiceNumber} already exists. Please try again.`);
      } else {
        throw new Error(`Database error: ${err?.message || 'Unknown error occurred'}`);
      }
    }
    // Insert items
    console.log(`[DEBUG] Updating invoice items with invoice ID: ${invoice.id}`);
    for (const it of invoiceItemsToInsert) it.invoiceId = invoice.id;
    if (invoiceItemsToInsert.length) {
      try {
        console.log(`[DEBUG] Inserting ${invoiceItemsToInsert.length} invoice items`);
        await db.insert(invoiceItems).values(invoiceItemsToInsert as any).returning();
        console.log(`[DEBUG] Invoice items inserted successfully`);
      } catch (err: any) {
        console.log(`[DEBUG] Invoice items insertion failed:`, err);
        console.log(`[DEBUG] Error code: ${err?.code}`);
        console.log(`[DEBUG] Error detail: ${err?.detail}`);
        console.log(`[DEBUG] Error message: ${err?.message}`);
        console.log(`[DEBUG] Full error:`, JSON.stringify(err, null, 2));
        
        if (err?.code === '23503') {
          if (String(err?.detail || '').includes('invoice_id')) {
            throw new Error(`Invalid invoice ID for items. Invoice may not have been created properly.`);
          } else if (String(err?.detail || '').includes('item_id')) {
            throw new Error(`Invalid item ID in invoice items. One or more items not found.`);
          } else {
            throw new Error(`Database constraint violation in invoice items: ${err?.detail || err?.message}`);
          }
        } else {
          throw new Error(`Database error inserting invoice items: ${err?.message || 'Unknown error occurred'}`);
        }
      }
    }
    console.log(`[DEBUG] Invoice generation completed successfully`);
    return invoice;
  }

  async generateProformaInvoice(salesOrderId: string, userId?: string) {
    // Get sales order to extract customer ID
    const salesOrder = await db.select().from(salesOrders).where(eq(salesOrders.id, salesOrderId)).limit(1);
    if (!salesOrder.length) {
      throw new Error('Sales order not found');
    }

    // Get sales order items to create invoice items
    const salesOrderItemsData = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, salesOrderId));
    if (!salesOrderItemsData.length) {
      throw new Error('No items found in sales order');
    }

    // Create proforma invoice referencing SO with proper customer ID
    const invoiceNumber = this.generateNumber('PFINV');
    const record: any = {
      invoiceNumber,
      invoiceType: 'Proforma',
      salesOrderId,
      customerId: salesOrder[0].customerId,
      status: 'Draft',
      currency: (salesOrder[0] as any).currency || 'BHD',
      exchangeRate: (salesOrder[0] as any).exchangeRate || '1.0000',
      baseCurrency: (salesOrder[0] as any).baseCurrency || 'BHD',
      subtotal: 0,
      taxRate: '10',
      taxAmount: 0,
      discountPercentage: '0',
      discountAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      outstandingAmount: 0,
      subtotalBase: 0,
      taxAmountBase: 0,
      discountAmountBase: 0,
      totalAmountBase: 0,
      autoGenerated: true,
      createdBy: userId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const inserted = await db.insert(invoices).values(record).returning();
      const invoice = inserted[0];
      
      // Get item details for better descriptions
      const itemIds = salesOrderItemsData.map(soItem => soItem.itemId);
      const itemDetails = await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds));
      const itemDetailsMap = new Map(itemDetails.map(item => [item.id, item]));

      // Get original quotation item descriptions if available
      let quotationItemsData = [];
      if (salesOrder[0].quotationId) {
        try {
          quotationItemsData = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, salesOrder[0].quotationId));
          console.log(`[DEBUG] Found ${quotationItemsData.length} quotation items for proforma invoice`);
        } catch (error) {
          console.log('[DEBUG] Could not fetch quotation items for descriptions:', error);
        }
      }

      // Create invoice items from sales order items
      let taxTotal = 0;
      const invoiceItemsData = salesOrderItemsData.map((soItem: any, index: number) => {
        const itemDetail = itemDetailsMap.get(soItem.itemId);
        
        // Try to get the best available description in priority order
        let description = 'Item';
        
        // First priority: item master description (if it's not generic)
        if (itemDetail?.description && itemDetail.description !== 'Generic Item' && itemDetail.description !== 'Item from Sales Order') {
          description = itemDetail.description;
          console.log(`[DEBUG] Using item master description for proforma: ${description.substring(0, 50)}...`);
        }
        // Second priority: sales order item description
        else if (soItem?.description && soItem.description !== 'Generic Item' && soItem.description !== 'Item from Sales Order') {
          description = soItem.description;
          console.log(`[DEBUG] Using sales order item description for proforma: ${description.substring(0, 50)}...`);
        }
        // Third priority: quotation item description
        else if (quotationItemsData.length > 0) {
          const matchingQuotationItem = quotationItemsData[index] || quotationItemsData[0];
          if (matchingQuotationItem && matchingQuotationItem.description) {
            description = matchingQuotationItem.description;
            console.log(`[DEBUG] Using quotation item description for proforma: ${description.substring(0, 50)}...`);
          }
        }
        // Last resort: generic fallback
        else {
          description = `Item from Sales Order ${soItem.id}`;
          console.log(`[DEBUG] Using fallback description for proforma: ${description}`);
        }
        
        // Get discount percentage from quotation sources
        const rawDiscPerc3 = (
          (matchingQuotationItem as any)?.discountPercentage ??
          (matchingQuotationItem as any)?.discountPercent ??
          (quotationHeader as any)?.discountPercentage ??
          (quotationHeader as any)?.discountPercent ??
          0
        );
        const discPerc3 = num(rawDiscPerc3);
        
        // Calculate discount amount
        const grossAmount = Number(soItem.totalPrice || 0);
        const discAmt3 = (grossAmount * discPerc3) / 100;
        const netAmount = grossAmount - discAmt3;
        
        // Get VAT percentage from various sources, with proper fallback
        const rawVatPerc3 = (
          (matchingQuotationItem as any)?.vatPercentage ??
          (matchingQuotationItem as any)?.vatPercent ??
          (quotationHeader as any)?.vatPercentage ??
          (quotationHeader as any)?.vatPercent ??
          0 // Default to 0% if no VAT percentage is found
        );
        const vatPerc = num(rawVatPerc3);
        
        const lineTax = Math.round((netAmount * vatPerc / 100) * 100) / 100;
        taxTotal += lineTax;
        return {
          invoiceId: invoice.id,
          itemId: soItem.itemId,
          barcode: itemDetail?.barcode || `PF-${Date.now()}-${index}`,
          supplierCode: itemDetail?.supplierCode || `PF-${Date.now()}-${index}`,
          description: description,
          lineNumber: index + 1,
          quantity: soItem.quantity,
          unitPrice: soItem.unitPrice,
          totalPrice: netAmount,
          discountPercentage: String(discPerc3),
          discountAmount: discAmt3,
          taxRate: String(vatPerc),
          taxAmount: lineTax,
          unitPriceBase: soItem.unitPrice,
          totalPriceBase: netAmount,
          discountAmountBase: discAmt3,
          taxAmountBase: lineTax,
          returnQuantity: 0,
          returnReason: null,
          notes: soItem.specialInstructions || null
        };
      });

      // Insert invoice items
      await db.insert(invoiceItems).values(invoiceItemsData);

      // Calculate totals and update invoice
      let subtotal = 0;
      let totalAmount = 0;
      
      salesOrderItemsData.forEach((soItem: any) => {
        subtotal += Number(soItem.totalPrice) || 0;
      });
      // Apply 10% VAT for proforma totals
      totalAmount = subtotal + taxTotal;
      
      await db.update(invoices)
        .set({
          subtotal: subtotal.toString(),
          taxAmount: taxTotal.toString(),
          totalAmount: totalAmount.toString(),
          remainingAmount: totalAmount.toString(),
          outstandingAmount: totalAmount.toString(),
          subtotalBase: subtotal.toString(),
          taxAmountBase: taxTotal.toString(),
          totalAmountBase: totalAmount.toString(),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoice.id));

      return invoice;
    } catch (err: any) {
      if (err?.code === '23503' && String(err?.detail || '').includes('created_by')) {
        const inserted = await db.insert(invoices).values({ ...record, createdBy: null }).returning();
        const invoice = inserted[0];
        
        // Get item details for better descriptions
        const itemIds = salesOrderItemsData.map(soItem => soItem.itemId);
        const itemDetails = await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds));
        const itemDetailsMap = new Map(itemDetails.map(item => [item.id, item]));

        // Create invoice items from sales order items
        const invoiceItemsData = salesOrderItemsData.map((soItem: any, index: number) => {
          const itemDetail = itemDetailsMap.get(soItem.itemId);
          const description = itemDetail?.description || `Item from Sales Order ${soItem.id}`;
          
          return {
            invoiceId: invoice.id,
            itemId: soItem.itemId,
            barcode: itemDetail?.barcode || `PF-${Date.now()}-${index}`,
            supplierCode: itemDetail?.supplierCode || `PF-${Date.now()}-${index}`,
            description: description,
            lineNumber: index + 1,
            quantity: soItem.quantity,
            unitPrice: soItem.unitPrice,
            totalPrice: soItem.totalPrice,
            discountPercentage: '0',
            discountAmount: '0',
            taxRate: '0',
            taxAmount: '0',
            unitPriceBase: soItem.unitPrice,
            totalPriceBase: soItem.totalPrice,
            discountAmountBase: '0',
            taxAmountBase: '0',
            returnQuantity: 0,
            returnReason: null,
            notes: soItem.specialInstructions || null
          };
        });

        // Insert invoice items
        await db.insert(invoiceItems).values(invoiceItemsData);

        // Calculate totals and update invoice
        let subtotal = 0;
        let totalAmount = 0;
        
        salesOrderItemsData.forEach((soItem: any) => {
          subtotal += Number(soItem.totalPrice) || 0;
        });
        
        totalAmount = subtotal;
        
        await db.update(invoices)
          .set({
            subtotal: subtotal.toString(),
            totalAmount: totalAmount.toString(),
            remainingAmount: totalAmount.toString(),
            outstandingAmount: totalAmount.toString(),
            subtotalBase: subtotal.toString(),
            totalAmountBase: totalAmount.toString(),
            updatedAt: new Date()
          })
          .where(eq(invoices.id, invoice.id));

        return invoice;
      }
      throw err;
    }
  }

  async sendInvoice(invoiceId: string, email?: string, userId?: string) {
    // Mark as sent; in a real implementation, trigger email sending here using provided email or customer email on record
    const updated = await this.updateInvoice(invoiceId, { status: 'Sent' } as any);
    return {
      message: 'Invoice marked as sent',
      invoice: updated,
      email: email || null,
    };
  }

  async markInvoicePaid(invoiceId: string, paidAmount: number, paymentMethod?: string, paymentReference?: string, userId?: string) {
    const inv = await this.getInvoice(invoiceId);
    if (!inv) throw new Error('Invoice not found');
    const newPaid = num(inv.paidAmount) + paidAmount;
    const outstanding = Math.max(0, num(inv.totalAmount) - newPaid);
    const status = outstanding === 0 ? 'Paid' : inv.status;
    return this.updateInvoice(invoiceId, { 
      paidAmount: newPaid as any, 
      remainingAmount: outstanding as any,
      outstandingAmount: outstanding as any, 
      status 
    } as any);
  }

  // Items
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    try {
      const rawItems = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));

      if (!rawItems.length) {
        return rawItems;
      }

      const uniqueItemIds = Array.from(new Set(rawItems.map(item => item.itemId))).filter(Boolean) as string[];
      let itemDetailsMap = new Map<string, any>();

      if (uniqueItemIds.length > 0) {
        const relatedItems = await db
          .select()
          .from(itemsTable)
          .where(inArray(itemsTable.id, uniqueItemIds));
        itemDetailsMap = new Map(relatedItems.map(item => [item.id, item]));
      }

      return rawItems.map(item => {
        const details = itemDetailsMap.get(item.itemId);
        const rawDescription = typeof item.description === 'string'
          ? item.description
          : item.description != null
            ? String(item.description)
            : '';
        const descriptionLines = rawDescription
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        const informativeLine = descriptionLines.find(line => !/^supplier code:/i.test(line) && !/^barcode:/i.test(line) && !/^notes?:/i.test(line) && !/^specs?:/i.test(line));
        const resolvedName = (item as any).productName
          || details?.description
          || informativeLine
          || descriptionLines[0]
          || rawDescription
          || 'Item';
        return {
          ...item,
          description: rawDescription,
          productName: resolvedName,
          itemDetails: details || null
        } as any;
      });
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      throw new Error('Failed to fetch invoice items');
    }
  }
  async getInvoiceItem(id: string) { const r = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id)).limit(1); return r[0]; }
  async createInvoiceItem(item: InsertInvoiceItem) { const r = await db.insert(invoiceItems).values(item as any).returning(); return r[0]; }
  async updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>) { const r = await db.update(invoiceItems).set({ ...(item as any), updatedAt: new Date() }).where(eq(invoiceItems.id, id)).returning(); return r[0]; }
  async deleteInvoiceItem(id: string) { await db.delete(invoiceItems).where(eq(invoiceItems.id, id)); }
  async bulkCreateInvoiceItems(itemsArr: InsertInvoiceItem[]) { if (!itemsArr.length) return []; return await db.insert(invoiceItems).values(itemsArr as any).returning(); }

  // Currency helpers (VERY simplified placeholder FX logic)
  async getExchangeRate(fromCurrency: string, toCurrency: string) { if (fromCurrency === toCurrency) return 1; return 1; }
  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRate?: number) { const rate = exchangeRate || await this.getExchangeRate(fromCurrency, toCurrency); return amount * rate; }
  async updateInvoiceCurrency(invoiceId: string, newCurrency: string, exchangeRate: number, userId: string) {
    const inv = await this.getInvoice(invoiceId); if (!inv) throw new Error('Invoice not found');
    const subtotalBase = await this.convertCurrency(num(inv.subtotal), inv.currency as any, newCurrency, exchangeRate);
    const taxAmountBase = await this.convertCurrency(num(inv.taxAmount), inv.currency as any, newCurrency, exchangeRate);
    const discountAmountBase = await this.convertCurrency(num(inv.discountAmount), inv.currency as any, newCurrency, exchangeRate);
    const totalAmountBase = await this.convertCurrency(num(inv.totalAmount), inv.currency as any, newCurrency, exchangeRate);
    return this.updateInvoice(invoiceId, { currency: newCurrency as any, exchangeRate: exchangeRate as any, subtotalBase: subtotalBase as any, taxAmountBase: taxAmountBase as any, discountAmountBase: discountAmountBase as any, totalAmountBase: totalAmountBase as any } as any);
  }
}