import { inventoryItems, suppliers, stockMovements, inventoryLevels, type InventoryItem, type Supplier, type InsertInventoryItem, type InventoryVariant, type InsertInventoryVariant, type InventoryLevel, type InsertInventoryLevel, type StockMovement, type InsertStockMovement } from "@shared/schema";

type InventoryLevelInsert = typeof inventoryLevels.$inferInsert;
import { db } from "../db";
import { eq, desc, and, or, like, gte, lte } from "drizzle-orm";
import { BaseStorage } from './base.js';
import { IInventoryStorage } from './interfaces.js';
import { nanoid } from 'nanoid';

export interface InventoryItemWithSupplier extends InventoryItem {
  supplier?: Supplier;
  supplierName?: string;
  storageLocation: string | null;
}

export class InventoryStorage extends BaseStorage implements IInventoryStorage {
  db: any;
  constructor() {
    super();
    this.db = db;
  }
  async getInventoryItems(filters?: {
    search?: string;
    supplierId?: string;
    category?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<InventoryItemWithSupplier[]> {
    const conditions = [];
    if (filters?.search) {
      conditions.push(
        or(
          like(inventoryItems.supplierCode, `%${filters.search}%`),
          like(inventoryItems.description, `%${filters.search}%`),
          like(inventoryItems.barcode, `%${filters.search}%`),
          like(suppliers.name, `%${filters.search}%`)
        )
      );
    }
    if (filters?.supplierId) {
      conditions.push(eq(inventoryItems.supplierId, filters.supplierId));
    }
    if (filters?.category) {
      conditions.push(eq(inventoryItems.category, filters.category));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(inventoryItems.isActive, filters.isActive));
    }

    let query = db
      .select({
        id: inventoryItems.id,
        supplierCode: inventoryItems.supplierCode,
        barcode: inventoryItems.barcode,
        description: inventoryItems.description,
        category: inventoryItems.category,
        unitOfMeasure: inventoryItems.unitOfMeasure,
        weight: inventoryItems.weight,
        dimensions: inventoryItems.dimensions,
        isActive: inventoryItems.isActive,
        supplierId: inventoryItems.supplierId,
        quantity: inventoryItems.quantity,
        reservedQuantity: inventoryItems.reservedQuantity,
        availableQuantity: inventoryItems.availableQuantity,
        totalStock: inventoryItems.totalStock,
        storageLocation: inventoryItems.storageLocation,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        supplierName: suppliers.name,
        supplier: suppliers
      })
      .from(inventoryItems)
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    query = query.orderBy(inventoryItems.description);

    const results = await query;
    // Transform results to include supplier information and actual inventory data
    return results.map(row => ({
      ...row,
      supplierName: typeof row.supplierName === 'string' ? row.supplierName : undefined,
      supplier: row.supplier && typeof row.supplier.id === 'string' ? row.supplier : undefined,
      reservedQuantity: Number(row.reservedQuantity ?? 0),
      availableQuantity: Number(row.availableQuantity ?? 0),
      totalStock: Number(row.totalStock ?? 0),
      storageLocation: row.storageLocation || null,
      weight: row.weight,
      dimensions: row.dimensions
    }));
  }

  async getInventoryItem(id: string): Promise<InventoryItemWithSupplier | undefined> {
    const [result] = await db
      .select({
        id: inventoryItems.id,
        supplierCode: inventoryItems.supplierCode,
        barcode: inventoryItems.barcode,
        description: inventoryItems.description,
        category: inventoryItems.category,
        unitOfMeasure: inventoryItems.unitOfMeasure,
        weight: inventoryItems.weight,
        dimensions: inventoryItems.dimensions,
        isActive: inventoryItems.isActive,
        supplierId: inventoryItems.supplierId,
        quantity: inventoryItems.quantity,
        reservedQuantity: inventoryItems.reservedQuantity,
        availableQuantity: inventoryItems.availableQuantity,
        totalStock: inventoryItems.totalStock,
        storageLocation: inventoryItems.storageLocation,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        supplierName: suppliers.name,
        supplier: suppliers
      })
      .from(inventoryItems)
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
      .where(eq(inventoryItems.id, id));
    if (!result) return undefined;
    return {
      ...result,
      supplierName: typeof result.supplierName === 'string' ? result.supplierName : undefined,
      supplier: result.supplier && typeof result.supplier.id === 'string' ? result.supplier : undefined,
      reservedQuantity: Number(result.reservedQuantity ?? 0),
      availableQuantity: Number(result.availableQuantity ?? 0),
      totalStock: Number(result.totalStock ?? 0),
      storageLocation: result.storageLocation || null
    };
  }

  async getInventoryItemBySupplierCode(supplierCode: string): Promise<InventoryItemWithSupplier | undefined> {
    const [result] = await db
      .select({
        id: inventoryItems.id,
        supplierCode: inventoryItems.supplierCode,
        barcode: inventoryItems.barcode,
        description: inventoryItems.description,
        category: inventoryItems.category,
        unitOfMeasure: inventoryItems.unitOfMeasure,
        weight: inventoryItems.weight,
        dimensions: inventoryItems.dimensions,
        isActive: inventoryItems.isActive,
        supplierId: inventoryItems.supplierId,
        quantity: inventoryItems.quantity,
        reservedQuantity: inventoryItems.reservedQuantity,
        availableQuantity: inventoryItems.availableQuantity,
        totalStock: inventoryItems.totalStock,
        storageLocation: inventoryItems.storageLocation,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        supplierName: suppliers.name,
        supplier: suppliers
      })
      .from(inventoryItems)
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
      .where(eq(inventoryItems.supplierCode, supplierCode));
    if (!result) return undefined;
    return {
      ...result,
      supplierName: typeof result.supplierName === 'string' ? result.supplierName : undefined,
      supplier: result.supplier && typeof result.supplier.id === 'string' ? result.supplier : undefined,
      reservedQuantity: Number(result.reservedQuantity ?? 0),
      availableQuantity: Number(result.availableQuantity ?? 0),
      totalStock: Number(result.totalStock ?? 0),
      storageLocation: result.storageLocation || null
    };
  }

  async getInventoryItemByBarcode(barcode: string): Promise<InventoryItemWithSupplier | undefined> {
    const [result] = await db
      .select({
        id: inventoryItems.id,
        supplierCode: inventoryItems.supplierCode,
        barcode: inventoryItems.barcode,
        description: inventoryItems.description,
        category: inventoryItems.category,
        unitOfMeasure: inventoryItems.unitOfMeasure,
        weight: inventoryItems.weight,
        dimensions: inventoryItems.dimensions,
        isActive: inventoryItems.isActive,
        supplierId: inventoryItems.supplierId,
        quantity: inventoryItems.quantity,
        reservedQuantity: inventoryItems.reservedQuantity,
        availableQuantity: inventoryItems.availableQuantity,
        totalStock: inventoryItems.totalStock,
        storageLocation: inventoryItems.storageLocation,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        supplierName: suppliers.name,
        supplier: suppliers
      })
      .from(inventoryItems)
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
      .where(eq(inventoryItems.barcode, barcode));
    if (!result) return undefined;
    return {
      ...result,
      supplierName: typeof result.supplierName === 'string' ? result.supplierName : undefined,
      supplier: result.supplier && typeof result.supplier.id === 'string' ? result.supplier : undefined,
      reservedQuantity: Number(result.reservedQuantity ?? 0),
      availableQuantity: Number(result.availableQuantity ?? 0),
      totalStock: Number(result.totalStock ?? 0),
      storageLocation: result.storageLocation || null
    };
  }

  async createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem> {
  const [item] = await db.insert(inventoryItems).values(itemData).returning();
  await this.logAuditEvent("inventory_item", item.id, "created", undefined, undefined, item);
  return item;
  }

  async updateInventoryItem(id: string, itemData: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const oldItem = await this.getInventoryItem(id);
    const [item] = await db
      .update(inventoryItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    
  await this.logAuditEvent("inventory_item", item.id, "updated", undefined, oldItem, item);
    return item;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const oldItem = await this.getInventoryItem(id);
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  await this.logAuditEvent("inventory_item", id, "deleted", undefined, oldItem, undefined);
  }

  async bulkCreateInventoryItems(items: InsertInventoryItem[]): Promise<InventoryItem[]> {
    const createdItems = await db.insert(inventoryItems).values(items).returning();
    for (const item of createdItems) {
      await this.logAuditEvent("inventory_item", item.id, "created", undefined, undefined, item);
    }
    return createdItems;
  }

  // Stub implementations for the remaining interface methods
  async getItemVariants(itemId: string): Promise<InventoryVariant[]> {
    // TODO: Implement when needed
    return [];
  }

  async getItemVariant(id: string): Promise<InventoryVariant | undefined> {
    // TODO: Implement when needed
    return undefined;
  }

  async createItemVariant(variant: InsertInventoryVariant): Promise<InventoryVariant> {
    // TODO: Implement when needed
    throw new Error("Method not implemented");
  }

  async updateItemVariant(id: string, variant: Partial<InsertInventoryVariant>): Promise<InventoryVariant> {
    // TODO: Implement when needed
    throw new Error("Method not implemented");
  }

  async deleteItemVariant(id: string): Promise<void> {
    // TODO: Implement when needed
  }

  async getInventoryLevels(filters?: {
    itemId?: string;
    location?: string;
    lowStock?: boolean;
  }): Promise<any[]> {
    try {
      const conditions = [] as any[];
      if (filters?.itemId) {
        conditions.push(eq(inventoryLevels.inventoryItemId, filters.itemId));
      }
      if (filters?.location) {
        conditions.push(eq(inventoryLevels.storageLocation, filters.location));
      }
      if (filters?.lowStock) {
        conditions.push(lte(inventoryLevels.quantityAvailable, inventoryLevels.reorderLevel));
      }

      let query = this.db
        .select({
          id: inventoryLevels.id,
          inventoryItemId: inventoryLevels.inventoryItemId,
          storageLocation: inventoryLevels.storageLocation,
          quantityAvailable: inventoryLevels.quantityAvailable,
          quantityReserved: inventoryLevels.quantityReserved,
          reorderLevel: inventoryLevels.reorderLevel,
          maxStockLevel: inventoryLevels.maxStockLevel,
          lastUpdated: inventoryLevels.lastUpdated,
          createdAt: inventoryLevels.createdAt,
          itemDescription: inventoryItems.description,
          itemCode: inventoryItems.supplierCode,
          barcode: inventoryItems.barcode,
          supplierName: suppliers.name,
        })
        .from(inventoryLevels)
        .leftJoin(inventoryItems, eq(inventoryLevels.inventoryItemId, inventoryItems.id))
        .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
        .orderBy(desc(inventoryLevels.lastUpdated), desc(inventoryLevels.createdAt));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const rows = await query;

      return rows.map(row => {
        const quantityAvailable = Number(row.quantityAvailable ?? 0);
        const reorderLevel = Number(row.reorderLevel ?? 0);
        return {
          id: row.id,
          inventoryItemId: row.inventoryItemId,
          itemId: row.inventoryItemId,
          itemName: row.itemDescription,
          itemCode: row.itemCode,
          barcode: row.barcode,
          quantityAvailable,
          quantityReserved: Number(row.quantityReserved ?? 0),
          currentQuantity: quantityAvailable,
          storageLocation: row.storageLocation,
          location: row.storageLocation,
          reorderLevel,
          maxStockLevel: Number(row.maxStockLevel ?? 0),
          isLowStock: reorderLevel > 0 ? quantityAvailable <= reorderLevel : quantityAvailable <= 10,
          lastUpdated: row.lastUpdated ?? row.createdAt,
          createdAt: row.createdAt,
          supplierName: row.supplierName,
        };
      });
    } catch (error) {
      if (this.isMissingTableError(error, 'inventory_levels')) {
        return this.computeInventoryLevelsFromMovements(filters);
      }
      console.error('Error fetching inventory levels:', error);
      throw error;
    }
  }

  async getInventoryLevel(id: string): Promise<InventoryLevel | undefined> {
    try {
      const [level] = await this.db
        .select()
        .from(inventoryLevels)
        .where(eq(inventoryLevels.id, id))
        .limit(1);

      return level ?? undefined;
    } catch (error) {
      if (this.isMissingTableError(error, 'inventory_levels')) {
        const synthetic = this.parseSyntheticLevelId(id);
        if (!synthetic) {
          return undefined;
        }
        return this.computeInventoryLevelFromMovements(synthetic.itemId, synthetic.location);
      }
      throw error;
    }
  }

  async getInventoryLevelByItem(itemId: string, location: string = 'MAIN'): Promise<InventoryLevel | undefined> {
    try {
      const conditions = [eq(inventoryLevels.inventoryItemId, itemId)];
      if (location) {
        conditions.push(eq(inventoryLevels.storageLocation, location));
      }

      let query = this.db
        .select()
        .from(inventoryLevels)
        .orderBy(desc(inventoryLevels.lastUpdated), desc(inventoryLevels.createdAt))
        .limit(1);

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const [level] = await query;
      if (level) {
        return level;
      }

      if (location) {
        const [fallback] = await this.db
          .select()
          .from(inventoryLevels)
          .where(eq(inventoryLevels.inventoryItemId, itemId))
          .orderBy(desc(inventoryLevels.lastUpdated), desc(inventoryLevels.createdAt))
          .limit(1);
        return fallback ?? undefined;
      }

      return undefined;
    } catch (error) {
      if (this.isMissingTableError(error, 'inventory_levels')) {
        return this.computeInventoryLevelFromMovements(itemId, location);
      }
      throw error;
    }
  }

  async createInventoryLevel(inventory: InsertInventoryLevel): Promise<InventoryLevel> {
    if (!inventory.inventoryItemId) {
      throw new Error('inventoryItemId is required to create an inventory level');
    }

    try {
      const now = new Date();
      const values: InventoryLevelInsert = {
        inventoryItemId: inventory.inventoryItemId,
        storageLocation: inventory.storageLocation ?? 'MAIN',
        quantityAvailable: Number(inventory.quantityAvailable ?? 0),
        quantityReserved: Number(inventory.quantityReserved ?? 0),
        reorderLevel: inventory.reorderLevel ?? 0,
        maxStockLevel: inventory.maxStockLevel ?? 0,
        createdAt: now,
        lastUpdated: now,
      };

      const [level] = await this.db
        .insert(inventoryLevels)
        .values(values)
        .onConflictDoUpdate({
          target: [inventoryLevels.inventoryItemId, inventoryLevels.storageLocation],
          set: {
            quantityAvailable: values.quantityAvailable,
            quantityReserved: values.quantityReserved,
            reorderLevel: values.reorderLevel,
            maxStockLevel: values.maxStockLevel,
            lastUpdated: now,
          },
        })
        .returning();

      return level;
    } catch (error) {
      if (this.isMissingTableError(error, 'inventory_levels')) {
        return this.createSyntheticLevel(
          inventory.inventoryItemId,
          inventory.storageLocation ?? 'MAIN',
          Number(inventory.quantityAvailable ?? 0),
          inventory
        );
      }
      throw error;
    }
  }

  async updateInventoryLevel(id: string, inventory: Partial<InsertInventoryLevel>): Promise<InventoryLevel> {
    try {
      const now = new Date();
      const updatePayload: Partial<InventoryLevelInsert> = {
        lastUpdated: now,
      };

      if (inventory.inventoryItemId !== undefined) {
        updatePayload.inventoryItemId = inventory.inventoryItemId;
      }
      if (inventory.storageLocation !== undefined) {
        updatePayload.storageLocation = inventory.storageLocation;
      }
      if (inventory.quantityAvailable !== undefined) {
        updatePayload.quantityAvailable = Number(inventory.quantityAvailable);
      }
      if (inventory.quantityReserved !== undefined) {
        updatePayload.quantityReserved = Number(inventory.quantityReserved);
      }
      if (inventory.reorderLevel !== undefined) {
        updatePayload.reorderLevel = inventory.reorderLevel;
      }
      if (inventory.maxStockLevel !== undefined) {
        updatePayload.maxStockLevel = inventory.maxStockLevel;
      }

      const [level] = await this.db
        .update(inventoryLevels)
        .set(updatePayload)
        .where(eq(inventoryLevels.id, id))
        .returning();

      if (!level) {
        throw new Error(`Inventory level ${id} not found`);
      }

      return level;
    } catch (error) {
      if (this.isMissingTableError(error, 'inventory_levels')) {
        const synthetic = this.parseSyntheticLevelId(id);
        const itemId = synthetic?.itemId ?? inventory.inventoryItemId;
        const location = synthetic?.location ?? inventory.storageLocation ?? 'MAIN';

        if (!itemId) {
          throw error;
        }

        const base = await this.computeInventoryLevelFromMovements(itemId, location);
        const quantityAvailable =
          inventory.quantityAvailable !== undefined
            ? Number(inventory.quantityAvailable)
            : Number(base.quantityAvailable ?? 0);

        return this.createSyntheticLevel(itemId, location, quantityAvailable, {
          quantityReserved:
            inventory.quantityReserved !== undefined
              ? Number(inventory.quantityReserved)
              : Number(base.quantityReserved ?? 0),
          reorderLevel: inventory.reorderLevel ?? base.reorderLevel ?? 10,
          maxStockLevel: inventory.maxStockLevel ?? base.maxStockLevel ?? 0,
        });
      }
      throw error;
    }
  }

  async deleteInventoryLevel(id: string): Promise<void> {
    try {
      await this.db.delete(inventoryLevels).where(eq(inventoryLevels.id, id));
    } catch (error) {
      if (this.isMissingTableError(error, 'inventory_levels')) {
        return;
      }
      throw error;
    }
  }

  async adjustInventoryQuantity(itemId: string, quantityChange: number, location: string = 'MAIN', reason?: string): Promise<InventoryLevel> {
    const currentLevel = await this.getInventoryLevelByItem(itemId, location);
    const currentQuantity = Number(currentLevel?.quantityAvailable ?? 0);
    const newQuantity = currentQuantity + quantityChange;

    if (newQuantity < 0) {
      throw new Error(`Resulting stock would be negative (item=${itemId}, before=${currentQuantity}, change=${quantityChange})`);
    }

    if (!currentLevel) {
      return this.createInventoryLevel({
        inventoryItemId: itemId,
        storageLocation: location,
        quantityAvailable: newQuantity,
        quantityReserved: 0,
        reorderLevel: 0,
        maxStockLevel: 0,
      });
    }

    return this.updateInventoryLevel(currentLevel.id, {
      quantityAvailable: newQuantity,
    });
  }

  private buildSyntheticLevelId(itemId: string, location: string): string {
    return `synthetic:${itemId}:${location}`;
  }

  private parseSyntheticLevelId(id: string): { itemId: string; location: string } | null {
    if (!id?.startsWith('synthetic:')) {
      return null;
    }
    const [, itemId, ...locationParts] = id.split(':');
    if (!itemId) {
      return null;
    }
    const location = locationParts.length > 0 ? locationParts.join(':') : 'MAIN';
    return { itemId, location };
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    const err = error as { code?: string; message?: string };
    if (!err) return false;
    if (err.code === '42P01') return true;
    return typeof err.message === 'string' && err.message.includes(tableName);
  }

  private createSyntheticLevel(itemId: string, location: string, quantityAvailable: number, overrides?: Partial<InsertInventoryLevel>): InventoryLevel {
    const now = new Date();
    return {
      id: this.buildSyntheticLevelId(itemId, location),
      inventoryItemId: itemId,
      storageLocation: location,
      quantityAvailable,
      quantityReserved: Number(overrides?.quantityReserved ?? 0),
      reorderLevel: overrides?.reorderLevel ?? 10,
      maxStockLevel: overrides?.maxStockLevel ?? 0,
      lastUpdated: now,
      createdAt: now,
    } as InventoryLevel;
  }

  private async computeInventoryLevelsFromMovements(filters?: {
    itemId?: string;
    location?: string;
    lowStock?: boolean;
  }): Promise<any[]> {
    const items = await this.getInventoryItems({ limit: 1000 });
    const results = [];

    for (const item of items as InventoryItemWithSupplier[]) {
      if (filters?.itemId && item.id !== filters.itemId) continue;

      const level = await this.computeInventoryLevelFromMovements(item.id, filters?.location);

      if (filters?.lowStock && (level?.quantityAvailable ?? 0) > 10) {
        continue;
      }

      results.push({
        id: level.id,
        inventoryItemId: item.id,
        itemId: item.id,
        itemName: item.description,
        itemCode: item.supplierCode,
        barcode: item.barcode,
        quantityAvailable: Number(level.quantityAvailable ?? 0),
        quantityReserved: Number(level.quantityReserved ?? 0),
        currentQuantity: Number(level.quantityAvailable ?? 0),
        storageLocation: level.storageLocation,
        location: level.storageLocation,
        reorderLevel: level.reorderLevel ?? 10,
        maxStockLevel: level.maxStockLevel ?? 0,
        isLowStock: Number(level.quantityAvailable ?? 0) <= 10,
        lastUpdated: level.lastUpdated ?? new Date(),
        createdAt: level.createdAt ?? new Date(),
        supplierName: item.supplierName,
      });
    }

    return results;
  }

  private async computeInventoryLevelFromMovements(itemId: string, location?: string): Promise<InventoryLevel> {
    const rows = await this.db
      .select({
        movementType: stockMovements.movementType,
        quantityMoved: stockMovements.quantityMoved,
        storageLocation: stockMovements.storageLocation,
        fromLocation: stockMovements.fromLocation,
        toLocation: stockMovements.toLocation,
      })
      .from(stockMovements)
      .where(eq(stockMovements.itemId, itemId));

    let quantity = 0;
    for (const movement of rows) {
      quantity += this.getSignedQuantityForLocation(movement, location);
    }

    return this.createSyntheticLevel(itemId, location ?? 'MAIN', quantity);
  }

  private getSignedQuantityForLocation(
    movement: {
      movementType: string | null;
      quantityMoved: number | null;
      storageLocation: string | null;
      fromLocation?: string | null;
      toLocation?: string | null;
    },
    location?: string
  ): number {
    const qty = Number(movement.quantityMoved ?? 0);
    const type = (movement.movementType ?? '').toUpperCase();
    const targetLocation = location ?? movement.storageLocation ?? 'MAIN';

    switch (type) {
      case 'OUT':
      case 'ISSUE':
        return -qty;
      case 'TRANSFER':
        if (movement.toLocation === targetLocation) {
          return qty;
        }
        if (movement.fromLocation === targetLocation) {
          return -qty;
        }
        return 0;
      case 'ADJUSTMENT':
      case 'RETURN':
      case 'RECEIPT':
      case 'IN':
      default:
        return qty;
    }
  }

  async getStockMovements(filters?: {
    itemId?: string;
    movementType?: string;
    referenceType?: string;
    referenceId?: string;
    location?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      console.log('getStockMovements called with filters:', filters);
      
      let query = this.db
        .select({
          id: stockMovements.id,
          itemId: stockMovements.itemId,
          variantId: stockMovements.variantId,
          movementType: stockMovements.movementType,
          referenceType: stockMovements.referenceType,
          referenceId: stockMovements.referenceId,
          transferNumber: stockMovements.transferNumber,
          storageLocation: stockMovements.storageLocation,
          fromLocation: stockMovements.fromLocation,
          toLocation: stockMovements.toLocation,
          transferDate: stockMovements.transferDate,
          requestedBy: stockMovements.requestedBy,
          reason: stockMovements.reason,
          quantityBefore: stockMovements.quantityBefore,
          quantityMoved: stockMovements.quantityMoved,
          quantityAfter: stockMovements.quantityAfter,
          unitCost: stockMovements.unitCost,
          totalValue: stockMovements.totalValue,
          status: stockMovements.status,
          notes: stockMovements.notes,
          createdBy: stockMovements.createdBy,
          createdAt: stockMovements.createdAt,
          // Join with inventory items to get item details
          itemName: inventoryItems.description,
          description: inventoryItems.description,
          barcode: inventoryItems.barcode,

        })
        .from(stockMovements)
        .leftJoin(inventoryItems, eq(stockMovements.itemId, inventoryItems.id))
        .orderBy(desc(stockMovements.createdAt));

      // Apply filters
      const conditions = [];
      if (filters?.itemId) {
        conditions.push(eq(stockMovements.itemId, filters.itemId));
      }
      if (filters?.movementType) {
        conditions.push(eq(stockMovements.movementType, filters.movementType));
      }
      if (filters?.referenceType) {
        conditions.push(eq(stockMovements.referenceType, filters.referenceType));
      }
      if (filters?.referenceId) {
        conditions.push(eq(stockMovements.referenceId, filters.referenceId));
      }
      if (filters?.location) {
        conditions.push(eq(stockMovements.storageLocation, filters.location));
      }
      if (filters?.dateFrom) {
        conditions.push(gte(stockMovements.createdAt, new Date(filters.dateFrom)));
      }
      if (filters?.dateTo) {
        conditions.push(lte(stockMovements.createdAt, new Date(filters.dateTo)));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      console.log('Executing query...');
      const movements = await query;
      console.log('Query executed, found movements:', movements?.length || 0);
      
      // Format the data for better frontend consumption
      if (!movements || !Array.isArray(movements)) {
        console.log('No movements found or invalid data structure');
        return [];
      }
      
      return movements.map((movement: any) => ({
        ...movement,
        referenceNumber: movement.referenceId || `SM-${movement.id.slice(-8).toUpperCase()}`,
        transferDate: movement.createdAt,
        requestedBy: movement.createdBy,
        reason: movement.notes || 'Stock Transfer',
        status: movement.status ?? this.mapMovementTypeToTransferStatus(movement.movementType),
        quantity: movement.quantityMoved,
        fromLocation: movement.fromLocation || (movement.movementType === 'Transfer' ? (movement.storageLocation || 'Unknown') : 'N/A'),
        toLocation: movement.toLocation || (movement.movementType === 'Transfer' ? 'Target Location' : movement.storageLocation),
      }));
    } catch (error) {
      console.error('Error fetching stock movements:', error);
      throw error;
    }
  }

  async getStockMovement(id: string): Promise<any> {
    try {
      const movement = await this.db
        .select({
          id: stockMovements.id,
          itemId: stockMovements.itemId,
          variantId: stockMovements.variantId,
          movementType: stockMovements.movementType,
          referenceType: stockMovements.referenceType,
          referenceId: stockMovements.referenceId,
          storageLocation: stockMovements.storageLocation,
          quantityBefore: stockMovements.quantityBefore,
          quantityMoved: stockMovements.quantityMoved,
          quantityAfter: stockMovements.quantityAfter,
          unitCost: stockMovements.unitCost,
          totalValue: stockMovements.totalValue,
          status: stockMovements.status,
          notes: stockMovements.notes,
          createdBy: stockMovements.createdBy,
          createdAt: stockMovements.createdAt,
          // Join with inventory items to get item details
          itemName: inventoryItems.description,
          itemCode: inventoryItems.barcode,
          description: inventoryItems.description,
        })
        .from(stockMovements)
        .leftJoin(inventoryItems, eq(stockMovements.itemId, inventoryItems.id))
        .where(eq(stockMovements.id, id))
        .limit(1);

      return movement[0] || null;
    } catch (error) {
      console.error('Error fetching stock movement:', error);
      throw error;
    }
  }

  async createStockMovement(movement: {
    movementType: string;
    quantityBefore: number;
    quantityMoved: number;
    quantityAfter: number;
    itemId?: string;
    variantId?: string;
    storageLocation?: string;
    notes?: string;
    referenceType?: string;
    referenceId?: string;
    unitCost?: string;
    totalValue?: string;
    createdBy?: string;
    transferNumber?: string;
    fromLocation?: string;
    toLocation?: string;
    transferDate?: string;
    requestedBy?: string;
    reason?: string;
    status?: string;
  }): Promise<any> {
    try {
      const movementId = nanoid();
      
      // Handle transfer-specific data mapping
      const mappedMovement = {
  id: movementId,
  itemId: movement.itemId || null,
  variantId: movement.variantId || null,
  movementType: movement.movementType || 'Transfer',
  referenceType: movement.referenceType || 'Transfer',
  referenceId: movement.referenceId || movement.transferNumber || `TRF-${movementId.slice(-8)}`,
  transferNumber: movement.transferNumber || `TRF-${movementId.slice(-8)}`,
  storageLocation: movement.storageLocation || movement.fromLocation || 'Unknown',
  fromLocation: movement.fromLocation || movement.storageLocation || null,
  toLocation: movement.toLocation || null,
  transferDate: movement.transferDate ? new Date(movement.transferDate) : null,
  requestedBy: movement.requestedBy || null,
  reason: movement.reason || null,
  quantityBefore: movement.quantityBefore || 0,
  quantityMoved: movement.quantityMoved,
  quantityAfter: movement.quantityAfter || (movement.quantityBefore || 0) + movement.quantityMoved,
  unitCost: movement.unitCost,
  totalValue: movement.totalValue,
  notes: movement.notes || 'Stock transfer',
  createdBy: movement.createdBy || movement.requestedBy || 'system',
  status: movement.status || 'Draft',
  createdAt: new Date(),
      };

      const result = await this.db
        .insert(stockMovements)
        .values(mappedMovement)
        .returning();

      return result[0];
    } catch (error) {
      const err = error as any;
      console.error('Error creating stock movement:', err?.stack || err);
      throw err;
    }
  }

  async updateStockMovement(
    id: string,
    movement: Partial<InsertStockMovement> & {
      transferNumber?: string;
      transferDate?: string;
      requestedBy?: string | null;
      reason?: string | null;
    }
  ): Promise<StockMovement | null> {
    try {
      const existing = await this.getStockMovement(id);
      if (!existing) {
        return null;
      }

      const quantityBefore = typeof movement.quantityBefore === 'number'
        ? movement.quantityBefore
        : Number(existing.quantityBefore ?? 0);
      const quantityMoved = typeof movement.quantityMoved === 'number'
        ? movement.quantityMoved
        : Number(movement.quantityMoved ?? existing.quantityMoved ?? 0);
      const inferredQuantityMoved = isNaN(quantityMoved)
        ? Number(existing.quantityMoved ?? 0)
        : quantityMoved;

      const quantityAfter = typeof movement.quantityAfter === 'number'
        ? movement.quantityAfter
        : quantityBefore + inferredQuantityMoved;

      const updateValues: any = {
        itemId: movement.itemId ?? existing.itemId ?? null,
        variantId: movement.variantId ?? existing.variantId ?? null,
        movementType: movement.movementType ?? existing.movementType ?? 'Transfer',
        referenceType: movement.referenceType ?? existing.referenceType ?? 'Transfer',
        referenceId: movement.referenceId ?? movement.transferNumber ?? existing.referenceId ?? null,
        storageLocation: movement.storageLocation ?? movement.fromLocation ?? existing.storageLocation ?? null,
        fromLocation: movement.fromLocation ?? existing.fromLocation ?? null,
        toLocation: movement.toLocation ?? existing.toLocation ?? null,
        quantityBefore,
        quantityMoved: inferredQuantityMoved,
        quantityAfter,
        unitCost: movement.unitCost ?? existing.unitCost ?? null,
        totalValue: movement.totalValue ?? existing.totalValue ?? null,
        status: movement.status ?? existing.status ?? 'Draft',
        notes: movement.notes ?? movement.reason ?? existing.notes ?? null,
        createdBy: movement.createdBy ?? movement.requestedBy ?? existing.createdBy ?? 'system',
      };

      if (movement.transferDate) {
        updateValues.createdAt = new Date(movement.transferDate);
      }

      const result = await this.db
        .update(stockMovements)
        .set(updateValues)
        .where(eq(stockMovements.id, id))
        .returning();

      return result[0] || null;
    } catch (error) {
      const err = error as any;
      console.error('Error updating stock movement:', err?.stack || err);
      throw err;
    }
  }

  private mapMovementTypeToTransferStatus(movementType: string): string {
    switch (movementType) {
      case 'Transfer':
        return 'In Transit';
      case 'Receipt':
        return 'Completed';
      case 'Issue':
        return 'Completed';
      case 'Adjustment':
        return 'Completed';
      default:
        return 'Draft';
    }
  }

  async getItemStockHistory(itemId: string, limit?: number): Promise<any[]> {
    try {
      let query = this.db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.itemId, itemId))
        .orderBy(desc(stockMovements.createdAt));

      if (limit) {
        query = query.limit(limit);
      }

      return await query;
    } catch (error) {
      console.error('Error fetching item stock history:', error);
      throw error;
    }
  }
}