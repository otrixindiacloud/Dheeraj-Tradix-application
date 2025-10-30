import { db } from "../db";
import { salesOrders, salesOrderItems, quotations, quotationItems, items, customers, purchaseOrders, suppliers, users, type Customer, type SalesOrder } from "@shared/schema";
import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { validateUUID, SYSTEM_USER_ID } from "@shared/utils/uuid";
import { ISalesOrderStorage } from "./interfaces";
import { BaseStorage } from "./base";

export class SalesOrderStorage extends BaseStorage implements ISalesOrderStorage {
  
  // Calculate financial totals from sales order items
  private async calculateFinancialTotals(salesOrderId: string): Promise<{ subtotal: string; taxAmount: string; totalAmount: string; discountAmount: string }> {
    const items = await db
      .select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, salesOrderId));
    
    let grossSubtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    
    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountPercentage = Number(item.discountPercentage) || 0;
      const discountAmount = Number(item.discountAmount) || 0;
      
      // Calculate gross amount (before discount)
      const grossAmount = quantity * unitPrice;
      grossSubtotal += grossAmount;
      
      // Calculate discount (use explicit amount if provided, otherwise calculate from percentage)
      let appliedDiscount = discountAmount;
      if (discountAmount === 0 && discountPercentage > 0) {
        appliedDiscount = (grossAmount * discountPercentage) / 100;
      }
      totalDiscount += appliedDiscount;
      
      // For now, assume no tax is applied to sales orders unless explicitly set
      // The totalPrice should already include any discounts and taxes
      const lineTotal = Number(item.totalPrice) || 0;
      totalTax += Math.max(0, lineTotal - (grossAmount - appliedDiscount));
    }
    
    const subtotal = grossSubtotal - totalDiscount;
    const totalAmount = subtotal + totalTax;
    
    return {
      subtotal: (Math.round(subtotal * 100) / 100).toFixed(3),
      taxAmount: (Math.round(totalTax * 100) / 100).toFixed(3),
      totalAmount: (Math.round(totalAmount * 100) / 100).toFixed(3),
      discountAmount: (Math.round(totalDiscount * 100) / 100).toFixed(3)
    };
  }

  async getSalesOrders(limit = 50, offset = 0, filters?: {
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    pendingSupplierLpo?: boolean;
  }) {
    // Build query with left join to customers so we can embed minimal customer object
    const conditions = [] as any[];
    if (filters) {
      if (filters.status) conditions.push(eq(salesOrders.status, filters.status as any));
      if (filters.customerId) conditions.push(eq(salesOrders.customerId, filters.customerId));
      if (filters.dateFrom) conditions.push(sql`${salesOrders.orderDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${salesOrders.orderDate} <= ${filters.dateTo}`);
      if (filters.search) conditions.push(sql`${salesOrders.orderNumber} ILIKE ${`%${filters.search}%`}`);
    }

    const baseQuery = db
      .select({ 
        so: salesOrders, 
        cust: customers,
        quot: quotations,
        createdByUser: users
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .leftJoin(quotations, eq(salesOrders.quotationId, quotations.id))
      .leftJoin(users, eq(salesOrders.createdBy, users.id));

    // Drizzle ORM chaining: .where() must come after .leftJoin()
    const conditionedQuery = (conditions.length ? baseQuery.where(and(...conditions)) : baseQuery) as typeof baseQuery;

    const rows = await conditionedQuery.orderBy(desc(salesOrders.createdAt)).limit(limit).offset(offset);
    // Return sales orders with embedded quotation, customer, and user data
    return rows.map(r => {
      const quotation = r.quot ? {
        id: (r.quot as any).id,
        quoteNumber: (r.quot as any).quoteNumber,
        revision: (r.quot as any).revision,
        status: (r.quot as any).status,
      } : null;
      const customer = r.cust ? {
        id: (r.cust as any).id,
        name: (r.cust as any).name || (r.cust as any).customerName || (r.cust as any).companyName || (r.cust as any).fullName,
        customerType: (r.cust as any).customerType || null,
        address: (r.cust as any).address || (r.cust as any).billingAddress || null,
      } : null;
      const createdByUsername = r.createdByUser ? (r.createdByUser as any).username : null;
      return { ...r.so, customer, quotation, createdByUsername } as any;
    });
  }

  async getSalesOrder(id: string): Promise<(SalesOrder & { customer: Customer | null }) | null> {
    const result = await db
      .select({
        salesOrder: salesOrders,
        customer: customers,
        quotation: quotations,
        createdByUser: users,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .leftJoin(quotations, eq(salesOrders.quotationId, quotations.id))
      .leftJoin(users, eq(salesOrders.createdBy, users.id))
      .where(eq(salesOrders.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    const row = result[0];
    const customer = row.customer ? (row.customer as unknown as Customer) : null;
    const createdByUsername = row.createdByUser ? (row.createdByUser as any).username : null;
    return { ...(row.salesOrder as unknown as SalesOrder), customer, createdByUsername };
  }

  async createSalesOrder(salesOrder: any) {
    const orderNumber = `SO-${new Date().getFullYear()}-${String(await this.getNextSequenceNumber()).padStart(3, '0')}`;
    
    // Calculate financial totals if not provided
    let subtotal = Number(salesOrder.subtotal) || 0;
    let taxAmount = Number(salesOrder.taxAmount) || 0;
    let totalAmount = Number(salesOrder.totalAmount) || 0;
    
    // If financial totals are not provided, calculate from items if available
    if (!salesOrder.subtotal && !salesOrder.taxAmount && !salesOrder.totalAmount && salesOrder.items) {
      subtotal = 0;
      let calculatedTax = 0;
      for (const item of salesOrder.items) {
        const qty = Number(item.quantity) || 0;
        const unit = Number(item.unitPrice) || 0;
        
        // Calculate line total using quantity * unit price
        // For sales orders, we'll use simple calculation without discount/tax fields
        const lineTotal = Math.round((qty * unit) * 100) / 100;
        
        subtotal += lineTotal;
      }
      // For sales orders, no tax by default unless explicitly specified
      taxAmount = 0;
      totalAmount = subtotal + taxAmount;
    }
    
    const newSalesOrder = {
      // id omitted -> DB default gen_random_uuid()
      orderNumber,
      ...salesOrder,
      subtotal: subtotal.toFixed(3),
      taxAmount: taxAmount.toFixed(3),
      totalAmount: totalAmount.toFixed(3),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await db.insert(salesOrders).values(newSalesOrder).returning();
    return result[0];
  }

  async updateSalesOrder(id: string, salesOrder: any) {
    const updatedSalesOrder = {
      ...salesOrder,
      updatedAt: new Date(),
    };

    const result = await db
      .update(salesOrders)
      .set(updatedSalesOrder)
      .where(eq(salesOrders.id, id))
      .returning();
    
    return result[0];
  }

  // Update financial totals for a sales order
  async updateFinancialTotals(salesOrderId: string): Promise<void> {
    const totals = await this.calculateFinancialTotals(salesOrderId);
    await db.update(salesOrders)
      .set({
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        updatedAt: new Date()
      })
      .where(eq(salesOrders.id, salesOrderId));
  }

  // Recalculate financial totals for all sales orders (useful for fixing existing data)
  async recalculateAllFinancialTotals(): Promise<void> {
    const allSalesOrders = await db.select({ id: salesOrders.id }).from(salesOrders);
    
    for (const order of allSalesOrders) {
      await this.updateFinancialTotals(order.id);
    }
  }

  async deleteSalesOrder(id: string) {
    await db.delete(salesOrders).where(eq(salesOrders.id, id));
  }

  async createSalesOrderFromQuotation(quotationId: string, userId?: string) {
    // Get the quotation with its items
    const quotation = await db.select().from(quotations).where(eq(quotations.id, quotationId)).limit(1);
    if (!quotation[0]) {
      throw new Error('Quotation not found');
    }

    const quotationData = quotation[0];

    // Validate that quotation is accepted
    if (quotationData.status !== 'Accepted') {
      throw new Error('Quotation must be accepted before creating sales order');
    }

    // Get customer PO information from purchaseOrders table
    const customerPo = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.quotationId, quotationId))
      .limit(1);
    
    if (!customerPo[0]) {
      throw new Error('Customer PO must be uploaded before creating sales order');
    }
    const quotationItemsData = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quotationId));

    // Generate sales order number
    const orderNumber = `SO-${new Date().getFullYear()}-${String(await this.getNextSequenceNumber()).padStart(3, '0')}`;

    // Calculate financial totals from quotation items
    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;
    
    if (quotationItemsData.length > 0) {
      for (const qi of quotationItemsData) {
        const qty = Number(qi.quantity) || 0;
        const unit = Number(qi.unitPrice) || 0;
        
        // Use simple calculation for sales orders
        // The quotation items may have discount/tax fields, but sales orders don't
        const lineTotal = Math.round((qty * unit) * 100) / 100;
        
        subtotal += lineTotal;
      }
      // For sales orders created from quotations, no tax by default
      taxAmount = 0;
      totalAmount = subtotal + taxAmount;
    }

    // Create the sales order
    const salesOrderData = {
      orderNumber,
      quotationId,
      customerId: quotationData.customerId,
      customerPoNumber: customerPo[0].poNumber,
      customerPoDocument: customerPo[0].documentPath,
      orderDate: new Date(),
      status: 'Draft' as const,
      subtotal: subtotal.toFixed(3),
      taxAmount: taxAmount.toFixed(3),
      totalAmount: totalAmount.toFixed(3),
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await db.insert(salesOrders).values(salesOrderData).returning();
    const createdSalesOrder = result[0];

    // Create sales order items from quotation items
    if (quotationItemsData.length > 0) {
      const salesOrderItemsData = [];
      
      for (const qi of quotationItemsData) {
        const qty = Number(qi.quantity) || 0;
        const unit = Number(qi.unitPrice) || 0;
        const lineTotal = Number(qi.lineTotal) || unit * qty;
        
        // Create a new item for this quotation item using quotation data
        const itemName = qi.description || 'Item from Quotation';
        // Ensure name is never null or empty
        const safeItemName = itemName.trim() || 'Item from Quotation';
        const newItemData = {
          name: safeItemName, // Ensure name is never null
          supplierCode: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          description: safeItemName,
          barcode: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          category: 'Quotation',
          unitOfMeasure: 'PCS',
          costPrice: unit.toFixed(2),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        let itemId: string;
        let itemData: any;
        
        try {
          const created = await db.insert(items).values(newItemData).returning();
          itemData = created[0];
          itemId = itemData.id;
          console.log(`[DEBUG] Created new item for quotation: ${itemData.description}`);
        } catch (error) {
          console.error(`[ERROR] Failed to create item for quotation item:`, error);
          // Fallback to existing item or create minimal item
          const fallbackItem = (await db.select().from(items).limit(1))[0];
          if (!fallbackItem) {
            const fallbackName = qi.description || 'Item';
            // Ensure name is never null or empty
            const safeFallbackName = fallbackName.trim() || 'Item';
            const minimalItem = await db.insert(items).values({
              name: safeFallbackName, // Ensure name is never null
              supplierCode: `FALLBACK-${Date.now()}`,
              description: safeFallbackName,
              barcode: `FALLBACK-${Date.now()}`,
              category: 'General',
              unitOfMeasure: 'PCS',
              costPrice: '0.00',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();
            itemData = minimalItem[0];
            itemId = itemData.id;
          } else {
            itemData = fallbackItem;
            itemId = fallbackItem.id;
          }
        }
        
        salesOrderItemsData.push({
          salesOrderId: createdSalesOrder.id,
          itemId: itemId,
          quantity: qty,
          unitPrice: unit.toFixed(2),
          totalPrice: lineTotal.toFixed(2),
          description: qi.description || itemData?.description || 'Item',
          specialInstructions: qi.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      await db.insert(salesOrderItems).values(salesOrderItemsData);
    }

    return createdSalesOrder;
  }

  async createAmendedSalesOrder(parentOrderId: string, reason: string, userId?: string) {
    // Get the parent sales order
    const parentOrder = await this.getSalesOrder(parentOrderId);
    if (!parentOrder) {
      throw new Error('Parent sales order not found');
    }
    
    // Instead of creating a new row, update the existing sales order with amendment information
    const updatedSalesOrder = {
      amendmentReason: reason,
      amendedBy: userId,
      amendedAt: new Date(),
      updatedAt: new Date(),
      // Keep the same order number and version - no new v2 data
      // Just mark it as amended
      isAmended: true,
    };

    const result = await db
      .update(salesOrders)
      .set(updatedSalesOrder)
      .where(eq(salesOrders.id, parentOrderId))
      .returning();
    
    return result[0];
  }

  async validateCustomerLpo(id: string, validationData: { status: string; notes?: string; validatedBy: string }) {
    const salesOrder = await this.getSalesOrder(id);
    if (!salesOrder) {
      throw new Error('Sales order not found');
    }

    const updatedSalesOrder = {
      customerLpoValidationStatus: validationData.status,
      customerLpoValidatedBy: validationData.validatedBy,
      customerLpoValidatedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .update(salesOrders)
      .set(updatedSalesOrder)
      .where(eq(salesOrders.id, id))
      .returning();
    
    return result[0];
  }

  // Sales Order Item operations
  async getSalesOrderItems(salesOrderId: string) {
    return db
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
        // Discount fields
        discountPercentage: salesOrderItems.discountPercentage,
        discountAmount: salesOrderItems.discountAmount,
        // Use original item description as primary description
        description: items.description,
        // Additional item details
        supplierCode: items.supplierCode,
        barcode: items.barcode,
        category: items.category,
        unitOfMeasure: items.unitOfMeasure,
        costPrice: items.costPrice,
        isActive: items.isActive,
        // Supplier details
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        supplierEmail: suppliers.email,
        supplierPhone: suppliers.phone,
        supplierAddress: suppliers.address,
        supplierContactPerson: suppliers.contactPerson,
      })
      .from(salesOrderItems)
      .leftJoin(items, eq(salesOrderItems.itemId, items.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(salesOrderItems.salesOrderId, salesOrderId));
  }

  async getSalesOrderItem(id: string) {
    const result = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, id)).limit(1);
    return result[0];
  }

  async createSalesOrderItem(item: any) {
    const newItem = {
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await db.insert(salesOrderItems).values(newItem).returning();
    
    // Recalculate financial totals for the sales order
    if (item.salesOrderId) {
      await this.updateFinancialTotals(item.salesOrderId);
    }
    
    return result[0];
  }

  async updateSalesOrderItem(id: string, item: any) {
    const updatedItem = {
      ...item,
      updatedAt: new Date(),
    };

    const result = await db
      .update(salesOrderItems)
      .set(updatedItem)
      .where(eq(salesOrderItems.id, id))
      .returning();
    
    // Recalculate financial totals for the sales order
    if (result[0]?.salesOrderId) {
      await this.updateFinancialTotals(result[0].salesOrderId);
    }
    
    return result[0];
  }

  async deleteSalesOrderItem(id: string) {
    // Get the sales order ID before deleting
    const item = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, id)).limit(1);
    const salesOrderId = item[0]?.salesOrderId;
    
    await db.delete(salesOrderItems).where(eq(salesOrderItems.id, id));
    
    // Recalculate financial totals for the sales order
    if (salesOrderId) {
      await this.updateFinancialTotals(salesOrderId);
    }
  }

  async bulkCreateSalesOrderItems(items: any[]) {
    const itemsWithIds = items.map(item => ({
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await db.insert(salesOrderItems).values(itemsWithIds).returning();
    
    // Recalculate financial totals for the sales order if items have salesOrderId
    const salesOrderId = items[0]?.salesOrderId;
    if (salesOrderId) {
      await this.updateFinancialTotals(salesOrderId);
    }
    
    return result;
  }

  private async getNextSequenceNumber(): Promise<number> {
    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'SO-\\d{4}-(\\d+)') AS INTEGER)), 0) + 1 AS next_number
      FROM sales_orders
      WHERE order_number LIKE 'SO-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'
    `);
    const row: any = result.rows?.[0];
    return row?.next_number || 1;
  }

  /**
   * Get lineage (root + amendments) for a given order id. Root first then amendments by amendment_sequence.
   */
  async getSalesOrderLineage(orderId: string) {
    const current = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId)).limit(1);
    if (!current.length) return [];
    let root = current[0];
    if (root.parentOrderId) {
      const maybeRoot = await db.select().from(salesOrders).where(eq(salesOrders.id, root.parentOrderId)).limit(1);
      if (maybeRoot.length) root = maybeRoot[0];
    }
    const lineage: any = await db.execute(sql`
      SELECT * FROM sales_orders
      WHERE id = ${root.id} OR parent_order_id = ${root.id}
      ORDER BY CASE WHEN amendment_sequence IS NULL THEN 0 ELSE amendment_sequence END
    `);
    return lineage.rows;
  }
}
