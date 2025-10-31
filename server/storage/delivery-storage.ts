import { BaseStorage } from './base.js';
import { IDeliveryStorage } from './interfaces.js';
import { db } from "../db";
import { 
  Delivery, 
  DeliveryItem, 
  DeliveryPickingSession, 
  DeliveryPickedItem,
  InsertDelivery,
  InsertDeliveryItem,
  InsertDeliveryPickingSession,
  InsertDeliveryPickedItem,
  deliveries,
  deliveryItems,
  deliveryPickingSessions,
  deliveryPickedItems,
  salesOrders,
  salesOrderItems,
  customers,
  items,
  supplierLpoItems
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface DeliveryWithDetails extends Delivery {
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    isActive: boolean | null;
    customerType: string | null;
    vatNumber: string | null;
    trnNumber: string | null;
    companyName: string | null;
    paymentTerms: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  } | null;
  salesOrder?: {
    id: string;
    orderNumber: string;
    status: string | null;
    totalAmount: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  } | null;
}

export class DeliveryStorage extends BaseStorage implements IDeliveryStorage {
  // Normalize a delivery item record so non-nullable string fields never contain null
  private normalizeDeliveryItemRecord<T extends Partial<DeliveryItem>>(rec: T): T & Pick<DeliveryItem, 'barcode' | 'supplierCode' | 'description' | 'unitPrice' | 'totalPrice'> {
    return {
      ...rec,
      barcode: (rec as any).barcode ?? '',
      supplierCode: (rec as any).supplierCode ?? '',
      description: (rec as any).description ?? '',
      unitPrice: (rec as any).unitPrice ?? '0.00',
      totalPrice: (rec as any).totalPrice ?? '0.00'
    };
  }
  // Delivery operations
  async getDeliveries(filters?: {
    status?: string;
    salesOrderId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<DeliveryWithDetails[]> {
    try {
      // Build all filter conditions
      const conditions: any[] = [];
      if (filters?.status) {
        conditions.push(eq(deliveries.status, filters.status as any));
      }
      if (filters?.salesOrderId) {
        conditions.push(eq(deliveries.salesOrderId, filters.salesOrderId));
      }
      if (filters?.customerId) {
        conditions.push(eq(customers.id, filters.customerId));
      }
      if (filters?.dateFrom) {
        conditions.push(sql`${deliveries.deliveryDate} >= ${filters.dateFrom}`);
      }
      if (filters?.dateTo) {
        conditions.push(sql`${deliveries.deliveryDate} <= ${filters.dateTo}`);
      }

      let query = db
        .select()
        .from(deliveries)
        .leftJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id));

      // Apply search if provided (on deliveryNumber, trackingNumber, customer name)
      if (filters?.search) {
        const term = `%${filters.search.toLowerCase()}%`;
        conditions.push(sql`(lower(${deliveries.deliveryNumber}) like ${term} OR lower(${deliveries.trackingNumber}) like ${term})`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(deliveries.createdAt));

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const results = await query;
      return results.map(row => {
        const rawCust: any = (row as any).customers;
        const customer = rawCust ? {
          id: rawCust.id,
          name: rawCust.name || rawCust.customerName || rawCust.companyName || rawCust.fullName || rawCust.customer_name || null,
          customerType: rawCust.customerType || rawCust.customer_type || null,
          address: rawCust.address || rawCust.billingAddress || rawCust.billing_address || null,
          email: rawCust.email || null,
          phone: rawCust.phone || null
        } : null;
        const so: any = (row as any).sales_orders;
        const delivery: any = (row as any).deliveries;
        return {
          ...delivery,
          salesOrder: so ? { ...so, customer } : null,
          customer,
          __customerEmbedded: true
        };
      });
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      throw new Error('Failed to fetch deliveries');
    }
  }

  async getDelivery(id: string): Promise<any | undefined> {
    try {
      const result = await db
        .select()
        .from(deliveries)
        .leftJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .where(eq(deliveries.id, id))
        .limit(1);

      const first = result[0];
      if (!first) return undefined;
      const row: any = first;
      const rawCust: any = row.customers;
      const customer = rawCust ? {
        id: rawCust.id,
        name: rawCust.name || rawCust.customerName || rawCust.companyName || rawCust.fullName || rawCust.customer_name || null,
        customerType: rawCust.customerType || rawCust.customer_type || null,
        address: rawCust.address || rawCust.billingAddress || rawCust.billing_address || null,
        email: rawCust.email || null,
        phone: rawCust.phone || null
      } : null;
      const deliveryRow: any = row.deliveries || row.delivery_note || row;
      const allowedStatuses = ['Pending', 'Cancelled', 'Partial', 'Complete'];
      const rawStatus = deliveryRow?.status || '';
      const statusNorm = allowedStatuses.includes(rawStatus) ? rawStatus : 'Pending';
      return {
        ...deliveryRow,
        status: statusNorm as Delivery['status'],
        salesOrder: row.sales_orders ? { ...row.sales_orders, customer } : null,
        customer,
        __customerEmbedded: true
      };
    } catch (error) {
      console.error('Error fetching delivery:', error);
      throw new Error('Failed to fetch delivery');
    }
  }

  async getDeliveryByNumber(deliveryNumber: string): Promise<Delivery | undefined> {
    try {
      const result = await db
        .select()
        .from(deliveries)
        .where(eq(deliveries.deliveryNumber, deliveryNumber))
        .limit(1);

      if (!result[0]) return undefined;
      // Normalize status to allowed union type
      const allowedStatuses = ['Pending', 'Cancelled', 'Partial', 'Complete'];
      const statusNorm = allowedStatuses.includes(result[0].status || '') ? result[0].status : 'Pending';
      return {
        ...result[0],
        status: statusNorm as Delivery['status']
      };
    } catch (error) {
      console.error('Error fetching delivery by number:', error);
      throw new Error('Failed to fetch delivery by number');
    }
  }

  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    try {
      // Ensure a delivery number is always generated if not provided or if placeholder was supplied
      const incomingNumber = (delivery as any).deliveryNumber;
      if (!incomingNumber || incomingNumber === 'PENDING') {
        (delivery as any).deliveryNumber = this.generateNumber('DLV');
      }
      // Normalize status: some callers may attempt to send Draft/PENDING variants
      if ((delivery as any).status && (delivery as any).status.toUpperCase() === 'DRAFT') {
        (delivery as any).status = 'Pending';
      }
      // Fix status type: must be string, not null
      if (delivery.status == null) delivery.status = 'Pending';
      // Remove null values and only include fields defined in the schema
      const allowedFields = [
        'id', 'deliveryNumber', 'salesOrderId', 'deliveryDate', 'deliveryType', 'deliveryAddress',
        'status', 'pickingStartedBy', 'pickingStartedAt', 'pickingCompletedBy', 'pickingCompletedAt',
        'pickingNotes', 'deliveryConfirmedBy', 'deliveryConfirmedAt', 'deliverySignature',
        'trackingNumber', 'carrierName', 'estimatedDeliveryDate', 'actualDeliveryDate',
        'createdAt', 'createdBy', 'updatedAt', 'updatedBy'
      ];
      const sanitized: any = {};
      for (const key of allowedFields) {
        if (delivery[key as keyof typeof delivery] !== undefined && delivery[key as keyof typeof delivery] !== null) {
          sanitized[key] = delivery[key as keyof typeof delivery];
        }
      }
      // Always set status as string
      sanitized.status = delivery.status as string;
      const result = await db
        .insert(deliveries)
        .values(sanitized)
        .returning();

      // Return the result as is, since Delivery type does not have barcode, supplierCode, or description
      // Ensure status is cast to the allowed union type
      return {
        ...result[0],
        status: (['Pending', 'Cancelled', 'Partial', 'Complete'].includes(result[0].status || '')
          ? result[0].status
          : 'Pending') as Delivery['status']
      };
    } catch (error) {
      console.error('Error creating delivery:', error);
      throw new Error('Failed to create delivery');
    }
  }

  async updateDelivery(id: string, delivery: Partial<InsertDelivery>): Promise<Delivery> {
    try {
      // Validate delivery ID format
      if (!id || typeof id !== 'string' || id.length === 0) {
        throw new Error('Invalid delivery ID');
      }

      // Prepare update data with proper type handling
      const updateData: any = {
        ...delivery,
        updatedAt: new Date()
      };

      // Ensure status is valid
      if (delivery.status) {
        const allowedStatuses = ['Pending', 'Cancelled', 'Partial', 'Complete'];
        if (!allowedStatuses.includes(delivery.status)) {
          throw new Error(`Invalid status: ${delivery.status}. Must be one of: ${allowedStatuses.join(', ')}`);
        }
        updateData.status = delivery.status;
      }

      // Filter out null/undefined values but keep empty strings and 0
      const filteredData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => value !== null && value !== undefined)
      );

      console.log('Updating delivery with data:', { id, filteredData });

      const result = await db
        .update(deliveries)
        .set(filteredData)
        .where(eq(deliveries.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery not found');
      }

      console.log('Delivery updated successfully:', result[0]);

      return result[0] as Delivery;
    } catch (error) {
      console.error('Error updating delivery:', error);
      throw new Error(`Failed to update delivery: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteDelivery(id: string): Promise<void> {
    try {
      // Prevent deletion if any items from this delivery have been invoiced
      try {
        const invoiced = await this.getInvoicedItemsForDelivery(id);
        if (Array.isArray(invoiced) && invoiced.length > 0) {
          const msg = 'Cannot delete delivery note: one or more items have been invoiced';
          // Use a specific error message so route can translate to 400
          throw new Error(msg);
        }
      } catch (checkErr) {
        // If the check itself fails unexpectedly, surface a clear error
        if (checkErr instanceof Error && checkErr.message.startsWith('Cannot delete delivery note')) {
          throw checkErr;
        }
        // Fall through to deletion; invoiced check is best-effort
      }

      // Delete dependent picking data first to satisfy FK constraints
      // 1) Find picking sessions for this delivery
      const sessions = await db
        .select()
        .from(deliveryPickingSessions)
        .where(eq(deliveryPickingSessions.deliveryId, id));

      if (sessions.length > 0) {
        const sessionIds = sessions.map((s: any) => s.id);
        // 2) Delete picked items belonging to those sessions
        await db
          .delete(deliveryPickedItems)
          .where(sql`${deliveryPickedItems.pickingSessionId} = ANY(${sql.array(sessionIds, 'uuid')})`);
        // 3) Delete the picking sessions themselves
        await db
          .delete(deliveryPickingSessions)
          .where(sql`${deliveryPickingSessions.id} = ANY(${sql.array(sessionIds, 'uuid')})`);
      }

      // First delete all related delivery items
      await db
        .delete(deliveryItems)
        .where(eq(deliveryItems.deliveryId, id));
      
      // Then delete the delivery
      await db
        .delete(deliveries)
        .where(eq(deliveries.id, id));
    } catch (error) {
      console.error('Error deleting delivery:', error);
      // Preserve specific validation errors; otherwise map to generic
      if (error instanceof Error && error.message.startsWith('Cannot delete delivery note')) {
        throw error;
      }
      throw new Error('Failed to delete delivery');
    }
  }

  async startDeliveryPicking(deliveryId: string, userId: string): Promise<Delivery> {
    try {
      const result = await db
        .update(deliveries)
        .set({
          pickingStartedBy: userId,
          pickingStartedAt: new Date(),
          status: 'Partial',
          updatedAt: new Date()
        })
        .where(eq(deliveries.id, deliveryId))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error starting delivery picking:', error);
      throw new Error('Failed to start delivery picking');
    }
  }

  async completeDeliveryPicking(deliveryId: string, userId: string, notes?: string): Promise<Delivery> {
    try {
      const result = await db
        .update(deliveries)
        .set({
          pickingCompletedBy: userId,
          pickingCompletedAt: new Date(),
          status: 'Complete',
          pickingNotes: notes,
          updatedAt: new Date()
        })
        .where(eq(deliveries.id, deliveryId))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error completing delivery picking:', error);
      throw new Error('Failed to complete delivery picking');
    }
  }

  async confirmDelivery(deliveryId: string, confirmedBy: string, signature?: string): Promise<Delivery> {
    try {
      const result = await db
        .update(deliveries)
        .set({
          deliveryConfirmedBy: confirmedBy,
          deliveryConfirmedAt: new Date(),
          deliverySignature: signature,
          status: 'Complete',
          updatedAt: new Date()
        })
        .where(eq(deliveries.id, deliveryId))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error confirming delivery:', error);
      throw new Error('Failed to confirm delivery');
    }
  }

  // Delivery Item operations
  async getDeliveryItems(deliveryId: string): Promise<DeliveryItem[]> {
    try {
      console.log('Storage: Fetching delivery items for delivery ID:', deliveryId);
      // Join to items, sales order items, and LPO items to enrich description/supplier code/barcode from master data
      const rows = await db
        .select({
          di: deliveryItems,
          master: items,
          soItem: salesOrderItems,
          lpoItem: supplierLpoItems,
        })
        .from(deliveryItems)
        .leftJoin(salesOrderItems, eq(deliveryItems.salesOrderItemId, salesOrderItems.id))
        .leftJoin(items, eq(deliveryItems.itemId, items.id))
        .leftJoin(supplierLpoItems, eq(deliveryItems.itemId, supplierLpoItems.itemId))
        .where(eq(deliveryItems.deliveryId, deliveryId));

      console.log('Storage: Raw rows from database:', rows);
      console.log('Storage: Number of raw rows:', rows.length);

      const enriched = rows.map((r: any) => {
        const di = r.di as any;
        const master = r.master as any;
        const soItem = r.soItem as any;
        const lpoItem = r.lpoItem as any;
        
        // Prefer existing delivery description; otherwise fallback to item master description
        const description = di.description || master?.description || '';
        const supplierCode = di.supplierCode || master?.supplierCode || '';
        const barcode = di.barcode || master?.barcode || '';

        const toNum = (v: any): number => {
          if (v === null || v === undefined) return 0;
          if (typeof v === 'number') return v;
          const n = parseFloat(String(v));
          return Number.isFinite(n) ? n : 0;
        };

        // Fallback pricing: if delivery unitPrice is missing/zero, use SO item unitPrice
        const diUnit = toNum(di.unitPrice);
        const soiUnit = toNum(soItem?.unitPrice);
        const chosenUnit = diUnit > 0 ? diUnit : soiUnit;

        // Derive total if missing/zero using deliveredQuantity (fallback to picked/ordered)
        const deliveredQty = toNum(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || 0);
        const diTotal = toNum(di.totalPrice);
        const derivedTotal = chosenUnit * deliveredQty;
        const chosenTotal = diTotal > 0 ? diTotal : (derivedTotal > 0 ? derivedTotal : 0);

        const unitPrice = chosenUnit.toFixed(2);
        const totalPrice = chosenTotal.toFixed(2);

        // Add LPO discount and VAT data
        const lpoDiscountPercent = lpoItem?.discountPercent || lpoItem?.discountPercentage || 0;
        const lpoVatPercent = lpoItem?.vatPercent || lpoItem?.vatPercentage || 0;

        return this.normalizeDeliveryItemRecord({
          ...di,
          description,
          supplierCode,
          barcode,
          unitPrice,
          totalPrice,
          // Add LPO data for invoice generation
          lpoDiscountPercent,
          lpoVatPercent,
        });
      });

      console.log('Storage: Enriched items:', enriched);
      console.log('Storage: Number of enriched items:', enriched.length);
      return enriched as DeliveryItem[];
    } catch (error) {
      console.error('Error fetching delivery items:', error);
      throw new Error('Failed to fetch delivery items');
    }
  }

  async getDeliveryItem(id: string): Promise<DeliveryItem | undefined> {
    try {
      const result = await db
        .select()
        .from(deliveryItems)
        .where(eq(deliveryItems.id, id))
        .limit(1);
      if (!result[0]) return undefined;
      return this.normalizeDeliveryItemRecord(result[0]);
    } catch (error) {
      console.error('Error fetching delivery item:', error);
      throw new Error('Failed to fetch delivery item');
    }
  }

  async createDeliveryItem(item: InsertDeliveryItem): Promise<DeliveryItem> {
    try {
      // If minimal payload (deliveryId + salesOrderItemId + quantity) provided, enrich from sales order item + item master
      const enriched: any = { ...item };
      if (!enriched.barcode || !enriched.description || !enriched.unitPrice || !enriched.totalPrice) {
        if (enriched.salesOrderItemId) {
          const soItemRows = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, enriched.salesOrderItemId)).limit(1);
          const soItem = soItemRows[0];
          if (soItem) {
            const itemRows = await db.select().from(items).where(eq(items.id, soItem.itemId)).limit(1);
            const masterItem = itemRows[0] as any;
            enriched.itemId = enriched.itemId || soItem.itemId;
            enriched.lineNumber = enriched.lineNumber || soItem.lineNumber || 1;
            enriched.orderedQuantity = enriched.orderedQuantity || soItem.quantity;
            // Attempt to map pricing
            const qty = enriched.pickedQuantity || enriched.deliveredQuantity || enriched.orderedQuantity || soItem.quantity || 0;
            const unitPrice = soItem.unitPrice as any;
            enriched.unitPrice = enriched.unitPrice || unitPrice || '0.00';
            enriched.totalPrice = enriched.totalPrice || (Number(unitPrice || 0) * Number(qty || 0));
            // Map descriptive fields
            enriched.description = enriched.description || (masterItem?.description || 'Delivery Item');
            enriched.barcode = enriched.barcode || (masterItem?.barcode || `AUTO-${Date.now()}`);
            enriched.supplierCode = enriched.supplierCode || (masterItem?.supplierCode || 'AUTO-SUP');
            // Quantities default
            enriched.pickedQuantity = enriched.pickedQuantity || qty;
            enriched.deliveredQuantity = enriched.deliveredQuantity || qty;
          }
        }
        // Fallback defaults to satisfy NOT NULL constraints
        enriched.barcode = enriched.barcode || `AUTO-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
        enriched.supplierCode = enriched.supplierCode || 'AUTO-SUP';
        enriched.description = enriched.description || 'Delivery Item';
        enriched.orderedQuantity = enriched.orderedQuantity || enriched.pickedQuantity || enriched.deliveredQuantity || 0;
        enriched.pickedQuantity = enriched.pickedQuantity || enriched.orderedQuantity || 0;
        enriched.deliveredQuantity = enriched.deliveredQuantity || enriched.pickedQuantity || 0;
        enriched.unitPrice = enriched.unitPrice || '0.00';
        enriched.totalPrice = enriched.totalPrice || '0.00';
      }

      // Fix unitPrice/totalPrice: must be string, not null
      enriched.unitPrice = enriched.unitPrice ?? '0.00';
      enriched.totalPrice = enriched.totalPrice ?? '0.00';
      const result = await db.insert(deliveryItems).values(enriched).returning();
      if (!result[0] || !result[0].id) {
        throw new Error('Failed to create delivery item: missing id');
      }
      // Convert all nulls to undefined for fields expected as string | undefined
      const normalizedInput = Object.fromEntries(
        Object.entries(result[0]).map(([k, v]) =>
          v === null ? [k, undefined] : [k, v]
        )
      );
      return this.normalizeDeliveryItemRecord(normalizedInput) as DeliveryItem;
    } catch (error) {
      console.error('Error creating delivery item:', error);
      throw new Error('Failed to create delivery item');
    }
  }

  async updateDeliveryItem(id: string, item: Partial<InsertDeliveryItem>): Promise<DeliveryItem> {
    try {
      // Fix unitPrice/totalPrice defaults: must be string, not null
      if (item.unitPrice == null) item.unitPrice = '0.00';
      if (item.totalPrice == null) item.totalPrice = '0.00';

      // When deliveredQuantity is being changed, recompute remainingQuantity at the SO-item level
      let computedRemaining: number | undefined = undefined;
      if (item.deliveredQuantity !== undefined) {
        // Load current delivery item to get salesOrderItemId and ordered quantity
        const currentRows = await db
          .select()
          .from(deliveryItems)
          .where(eq(deliveryItems.id, id))
          .limit(1);
        const current = currentRows[0] as any;
        if (!current) throw new Error('Delivery item not found');

        const soItemId = current.salesOrderItemId as string;
        // Sum all delivered across the same SO item
        const sumRows = await db
          .select({ sum: sql<number>`coalesce(sum(${deliveryItems.deliveredQuantity}), 0)` })
          .from(deliveryItems)
          .where(eq(deliveryItems.salesOrderItemId, soItemId));
        const totalDeliveredExisting = Number((sumRows[0] as any)?.sum || 0);

        // total delivered will be existing total minus current old value plus new value
        const oldDelivered = Number(current.deliveredQuantity || 0);
        const newDelivered = Number(item.deliveredQuantity || 0);
        const totalDeliveredAdjusted = Math.max(0, totalDeliveredExisting - oldDelivered + newDelivered);

        // Use the ordered quantity from the SO item if present on the row, else fallback to current.orderedQuantity
        const orderedQty = Number(current.orderedQuantity || 0);
        computedRemaining = Math.max(0, orderedQty - totalDeliveredAdjusted);

        // Also recalc totalPrice if unitPrice is present
        const unit = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(current.unitPrice || 0);
        if (!isNaN(unit)) {
          item.totalPrice = (unit * newDelivered).toFixed(2) as any;
        }
      }

      const updatePayload: any = { ...item };
      if (computedRemaining !== undefined) {
        updatePayload.remainingQuantity = computedRemaining;
      }

      const result = await db.update(deliveryItems).set(updatePayload).where(eq(deliveryItems.id, id)).returning();
      if (!result[0]) throw new Error('Delivery item not found');
      return this.normalizeDeliveryItemRecord(result[0]);
    } catch (error) {
      console.error('Error updating delivery item:', error);
      throw new Error('Failed to update delivery item');
    }
  }

  async deleteDeliveryItem(id: string): Promise<void> {
    try {
      await db
        .delete(deliveryItems)
        .where(eq(deliveryItems.id, id));
    } catch (error) {
      console.error('Error deleting delivery item:', error);
      throw new Error('Failed to delete delivery item');
    }
  }

  async bulkCreateDeliveryItems(items: InsertDeliveryItem[]): Promise<DeliveryItem[]> {
    try {
      if (!Array.isArray(items) || items.length === 0) return [];

      // Group by deliveryId to compute line numbers per delivery
      const byDelivery: Record<string, InsertDeliveryItem[]> = {} as any;
      for (const it of items) {
        const did = (it as any).deliveryId as string;
        byDelivery[did] = byDelivery[did] || [];
        byDelivery[did].push(it);
      }

      // Helper to sum already delivered for a SO item
      const getAlreadyDelivered = async (salesOrderItemId: string): Promise<number> => {
        const rows = await db
          .select({ sum: sql<number>`coalesce(sum(${deliveryItems.deliveredQuantity}), 0)` })
          .from(deliveryItems)
          .where(eq(deliveryItems.salesOrderItemId, salesOrderItemId));
        const n = Number((rows[0] as any)?.sum || 0);
        return Number.isFinite(n) ? n : 0;
      };

      const enrichedAll: any[] = [];

      for (const [deliveryId, group] of Object.entries(byDelivery)) {
        // Determine starting line number
        const maxLineRows = await db
          .select({ max: sql<number>`coalesce(max(${deliveryItems.lineNumber}), 0)` })
          .from(deliveryItems)
          .where(eq(deliveryItems.deliveryId, deliveryId));
        let nextLine = Number((maxLineRows[0] as any)?.max || 0) + 1;

        for (const it of group) {
          const soItemId = (it as any).salesOrderItemId as string;
          // Fetch SO item and master item for enrichment
          const soiRows = await db
            .select()
            .from(salesOrderItems)
            .where(eq(salesOrderItems.id, soItemId))
            .limit(1);
          const soItem = soiRows[0] as any;
          const masterRows = soItem?.itemId
            ? await db.select().from(items).where(eq(items.id, soItem.itemId)).limit(1)
            : [];
          const master = masterRows[0] as any;

          const orderedFromSo = Number(soItem?.quantity || (it as any).orderedQuantity || 0);
          const alreadyDelivered = await getAlreadyDelivered(soItemId);
          const remaining = Math.max(0, orderedFromSo - alreadyDelivered);

          // Clamp request to remaining
          const requested = Number((it as any).deliveredQuantity || 0);
          const clamped = Math.min(Math.max(0, requested), remaining);

          const picked = Number((it as any).pickedQuantity || clamped);
          const unit = String(soItem?.unitPrice ?? '0.00');
          const total = (Number(unit) * clamped).toFixed(2);

          const enriched = this.normalizeDeliveryItemRecord({
            deliveryId: deliveryId as any,
            salesOrderItemId: soItemId as any,
            itemId: (soItem?.itemId || (it as any).itemId) as any,
            lineNumber: nextLine++,
            barcode: master?.barcode || '',
            supplierCode: master?.supplierCode || '',
            description: soItem?.description || master?.description || '',
            orderedQuantity: orderedFromSo,
            pickedQuantity: picked,
            deliveredQuantity: clamped,
            remainingQuantity: Math.max(0, orderedFromSo - (alreadyDelivered + clamped)),
            unitPrice: unit,
            totalPrice: total,
            pickedBy: (it as any).pickedBy,
            pickedAt: (it as any).pickedAt,
            storageLocation: (it as any).storageLocation,
            pickingNotes: (it as any).pickingNotes,
            qualityChecked: (it as any).qualityChecked ?? false,
            qualityCheckedBy: (it as any).qualityCheckedBy,
            qualityCheckedAt: (it as any).qualityCheckedAt,
            qualityNotes: (it as any).qualityNotes
          });

          enrichedAll.push(enriched);
        }
      }

      const result = await db.insert(deliveryItems).values(enrichedAll as any).returning();
      return result.map(r => this.normalizeDeliveryItemRecord(r));
    } catch (error) {
      console.error('Error bulk creating delivery items:', error);
      throw new Error('Failed to bulk create delivery items');
    }
  }

  // Delivery Picking Session operations
  async getDeliveryPickingSessions(deliveryId: string): Promise<DeliveryPickingSession[]> {
    try {
      return await db
        .select()
        .from(deliveryPickingSessions)
        .where(eq(deliveryPickingSessions.deliveryId, deliveryId))
        .orderBy(desc(deliveryPickingSessions.startedAt));
    } catch (error) {
      console.error('Error fetching delivery picking sessions:', error);
      throw new Error('Failed to fetch delivery picking sessions');
    }
  }

  async getDeliveryPickingSession(id: string): Promise<DeliveryPickingSession | undefined> {
    try {
      const result = await db
        .select()
        .from(deliveryPickingSessions)
        .where(eq(deliveryPickingSessions.id, id))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error('Error fetching delivery picking session:', error);
      throw new Error('Failed to fetch delivery picking session');
    }
  }

  async createDeliveryPickingSession(session: InsertDeliveryPickingSession): Promise<DeliveryPickingSession> {
    try {
      const result = await db
        .insert(deliveryPickingSessions)
        .values(session)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating delivery picking session:', error);
      throw new Error('Failed to create delivery picking session');
    }
  }

  async updateDeliveryPickingSession(id: string, session: Partial<InsertDeliveryPickingSession>): Promise<DeliveryPickingSession> {
    try {
      const result = await db
        .update(deliveryPickingSessions)
        .set({ ...session })
        .where(eq(deliveryPickingSessions.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery picking session not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error updating delivery picking session:', error);
      throw new Error('Failed to update delivery picking session');
    }
  }

  async completePickingSession(sessionId: string): Promise<DeliveryPickingSession> {
    try {
      const result = await db
        .update(deliveryPickingSessions)
        .set({
          status: 'Completed',
          completedAt: new Date()
        })
        .where(eq(deliveryPickingSessions.id, sessionId))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery picking session not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error completing picking session:', error);
      throw new Error('Failed to complete picking session');
    }
  }

  // Delivery Picked Item operations
  async getDeliveryPickedItems(sessionId: string): Promise<DeliveryPickedItem[]> {
    try {
      return await db
        .select()
        .from(deliveryPickedItems)
        .where(eq(deliveryPickedItems.pickingSessionId, sessionId))
        .orderBy(desc(deliveryPickedItems.pickedAt));
    } catch (error) {
      console.error('Error fetching delivery picked items:', error);
      throw new Error('Failed to fetch delivery picked items');
    }
  }

  async deleteDeliveryPickingSession(id: string): Promise<void> {
    try {
      await db
        .delete(deliveryPickingSessions)
        .where(eq(deliveryPickingSessions.id, id));
    } catch (error) {
      console.error('Error deleting delivery picking session:', error);
      throw new Error('Failed to delete delivery picking session');
    }
  }

  async deleteDeliveryPickedItem(id: string): Promise<void> {
    try {
      await db
        .delete(deliveryPickedItems)
        .where(eq(deliveryPickedItems.id, id));
    } catch (error) {
      console.error('Error deleting delivery picked item:', error);
      throw new Error('Failed to delete delivery picked item');
    }
  }

  async bulkCreateDeliveryPickedItems(items: InsertDeliveryPickedItem[]): Promise<DeliveryPickedItem[]> {
    try {
      const result = await db
        .insert(deliveryPickedItems)
        .values(items)
        .returning();

      return result;
    } catch (error) {
      console.error('Error bulk creating delivery picked items:', error);
      throw new Error('Failed to bulk create delivery picked items');
    }
  }

  async getDeliveryPickedItem(id: string): Promise<DeliveryPickedItem | undefined> {
    try {
      const result = await db
        .select()
        .from(deliveryPickedItems)
        .where(eq(deliveryPickedItems.id, id))
        .limit(1);

      return result[0];
    } catch (error) {
      console.error('Error fetching delivery picked item:', error);
      throw new Error('Failed to fetch delivery picked item');
    }
  }

  async createDeliveryPickedItem(item: InsertDeliveryPickedItem): Promise<DeliveryPickedItem> {
    try {
      const result = await db
        .insert(deliveryPickedItems)
        .values(item)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating delivery picked item:', error);
      throw new Error('Failed to create delivery picked item');
    }
  }

  async updateDeliveryPickedItem(id: string, item: Partial<InsertDeliveryPickedItem>): Promise<DeliveryPickedItem> {
    try {
      const result = await db
        .update(deliveryPickedItems)
        .set({ ...item })
        .where(eq(deliveryPickedItems.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery picked item not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error updating delivery picked item:', error);
      throw new Error('Failed to update delivery picked item');
    }
  }

  async verifyPickedItem(itemId: string, userId: string): Promise<DeliveryPickedItem> {
    try {
      const result = await db
        .update(deliveryPickedItems)
        .set({
          verified: true,
          verifiedBy: userId,
          verifiedAt: new Date()
        })
        .where(eq(deliveryPickedItems.id, itemId))
        .returning();

      if (result.length === 0) {
        throw new Error('Delivery picked item not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error verifying picked item:', error);
      throw new Error('Failed to verify picked item');
    }
  }

  // Barcode scanning and verification
  async verifyItemBarcode(barcode: string, expectedItemId?: string): Promise<{ valid: boolean; item?: any; message: string }> {
    try {
      const result = await db
        .select()
        .from(items)
        .where(eq(items.barcode, barcode))
        .limit(1);

      if (result.length === 0) {
        return { valid: false, message: 'Barcode not found' };
      }

      const item = result[0];
      
      if (expectedItemId && item.id !== expectedItemId) {
        return { valid: false, item, message: 'Barcode does not match expected item' };
      }

      return { valid: true, item, message: 'Barcode verified successfully' };
    } catch (error) {
      console.error('Error verifying item barcode:', error);
      return { valid: false, message: 'Error verifying barcode' };
    }
  }

  async scanItemForPicking(barcode: string, sessionId: string, quantity: number, userId: string, storageLocation?: string): Promise<DeliveryPickedItem> {
    try {
      // First verify the barcode
      const verification = await this.verifyItemBarcode(barcode);
      if (!verification.valid) {
        throw new Error(verification.message);
      }

      // Get the delivery item for this barcode
      const deliveryItemsRows = await db
        .select()
        .from(deliveryItems)
        .where(eq(deliveryItems.barcode, barcode))
        .limit(1);

      if (deliveryItemsRows.length === 0) {
        throw new Error('Item not found in delivery');
      }

      // Create picked item record
      const pickedItem: InsertDeliveryPickedItem = {
        pickingSessionId: sessionId,
        deliveryItemId: deliveryItemsRows[0].id,
        barcode,
        quantityPicked: quantity,
        storageLocation,
        pickedBy: userId,
        verified: false
      };

      return await this.createDeliveryPickedItem(pickedItem);
    } catch (error) {
      console.error('Error scanning item for picking:', error);
      throw new Error('Failed to scan item for picking');
    }
  }

  async getAvailableItemsForPicking(deliveryId: string): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: deliveryItems.id,
          barcode: deliveryItems.barcode,
          supplierCode: deliveryItems.supplierCode,
          description: deliveryItems.description,
          orderedQuantity: deliveryItems.orderedQuantity,
          pickedQuantity: deliveryItems.pickedQuantity,
          deliveredQuantity: deliveryItems.deliveredQuantity,
          storageLocation: deliveryItems.storageLocation
        })
        .from(deliveryItems)
        .where(eq(deliveryItems.deliveryId, deliveryId));

      return result;
    } catch (error) {
      console.error('Error fetching available items for picking:', error);
      throw new Error('Failed to fetch available items for picking');
    }
  }

  // Get invoiced items for a delivery
  async getInvoicedItemsForDelivery(deliveryId: string): Promise<any[]> {
    try {
      // Query to find all delivery items that have been invoiced
      const invoicedItems = await db
        .select({
          deliveryItemId: deliveryItems.id,
          invoiceId: sql`invoice_items.invoice_id`,
          invoiceNumber: sql`invoices.invoice_number`,
          invoiceStatus: sql`invoices.status`,
          createdAt: sql`invoices.created_at`
        })
        .from(deliveryItems)
        .innerJoin(sql`invoice_items`, sql`invoice_items.delivery_item_id = ${deliveryItems.id}`)
        .innerJoin(sql`invoices`, sql`invoices.id = invoice_items.invoice_id`)
        .where(eq(deliveryItems.deliveryId, deliveryId));

      return invoicedItems;
    } catch (error) {
      console.error('Error fetching invoiced items for delivery:', error);
      throw new Error('Failed to fetch invoiced items for delivery');
    }
  }
}
