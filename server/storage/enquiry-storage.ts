import { 
  enquiries, 
  enquiryItems, 
  auditLogs, 
  customers,
  quotations,
  supplierQuotes,
  type Enquiry, 
  type EnquiryItem,
  type InsertEnquiry, 
  type InsertEnquiryItem 
} from "@shared/schema";
import { db } from "../db";
import { eq, desc, and, or, like, count, sql } from "drizzle-orm";
import { BaseStorage } from './base.js';
import { IEnquiryStorage } from './interfaces.js';

export class EnquiryStorage extends BaseStorage implements IEnquiryStorage {
  async getEnquiries(limit = 50, offset = 0, filters?: {
    status?: string;
    source?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<any[]> {
    try {
      console.log("getEnquiries called with:", { limit, offset, filters });
      
      const conditions = [];
      
      if (filters?.status) {
        conditions.push(eq(enquiries.status, filters.status as any));
      }
      
      if (filters?.source) {
        conditions.push(eq(enquiries.source, filters.source as any));
      }
      
      if (filters?.customerId) {
        conditions.push(eq(enquiries.customerId, filters.customerId));
      }
      
      if (filters?.dateFrom) {
        conditions.push(sql`${enquiries.enquiryDate} >= ${filters.dateFrom}`);
      }
      
      if (filters?.dateTo) {
        conditions.push(sql`${enquiries.enquiryDate} <= ${filters.dateTo}`);
      }
      
      if (filters?.search) {
        conditions.push(
          or(
            like(enquiries.enquiryNumber, `%${filters.search}%`),
            like(enquiries.notes, `%${filters.search}%`)
          )
        );
      }
      
      let query = db
        .select({
          id: enquiries.id,
          enquiryNumber: enquiries.enquiryNumber,
          customerId: enquiries.customerId,
          enquiryDate: enquiries.enquiryDate,
          status: enquiries.status,
          source: enquiries.source,
          referralCustomerId: enquiries.referralCustomerId,
          referralName: enquiries.referralName,
          targetDeliveryDate: enquiries.targetDeliveryDate,
          notes: enquiries.notes,
          attachments: enquiries.attachments,
          createdBy: enquiries.createdBy,
          createdAt: enquiries.createdAt,
          updatedAt: enquiries.updatedAt,
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            customerType: customers.customerType,
            classification: customers.classification,
          }
        })
        .from(enquiries)
        .leftJoin(customers, eq(enquiries.customerId, customers.id));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      console.log("Executing query...");
      const result = await query
        .limit(limit)
        .offset(offset)
        .orderBy(desc(enquiries.createdAt));
      
      console.log("Query result:", result.length, "enquiries found");
      return result;
    } catch (error) {
      console.error("Error in getEnquiries:", error);
      throw error;
    }
  }

  async getEnquiry(id: string): Promise<Enquiry | undefined> {
    const [row] = await db.select().from(enquiries).where(eq(enquiries.id, id));
    return row as any;
  }

  async createEnquiry(enquiryData: InsertEnquiry): Promise<Enquiry> {
    try {
      console.log("Creating enquiry with data:", enquiryData);
      
      // Generate unique enquiry number
      let enquiryNumber: string;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        const enquiryCount = await db.select({ count: count() }).from(enquiries);
        const baseNumber = enquiryCount[0].count + 1 + attempts;
        enquiryNumber = `ENQ-2024-${String(baseNumber).padStart(3, '0')}`;
        
        // Check if this number already exists
        const existing = await db.select({ id: enquiries.id }).from(enquiries).where(eq(enquiries.enquiryNumber, enquiryNumber)).limit(1);
        if (existing.length === 0) break;
        
        attempts++;
      } while (attempts < maxAttempts);
      
      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique enquiry number");
      }
      
      console.log("Generated enquiry number:", enquiryNumber);
      
      // Convert date string to Date object if provided
      const processedData = {
        ...enquiryData,
        targetDeliveryDate: enquiryData.targetDeliveryDate ? new Date(enquiryData.targetDeliveryDate) : null,
        enquiryNumber
      };
      console.log("Processed data:", processedData);
      
      const [enquiry] = await db
        .insert(enquiries)
        .values(processedData)
        .returning();
      
      console.log("Created enquiry:", enquiry);
      
      // await this.logAuditEvent("enquiry", enquiry.id, "create", enquiryData.createdBy || undefined, undefined, enquiry);
      return enquiry;
    } catch (error) {
      console.error("Error in createEnquiry:", error);
      throw error;
    }
  }

  async updateEnquiry(id: string, enquiryData: Partial<InsertEnquiry>): Promise<Enquiry> {
    const oldEnquiry = await this.getEnquiry(id);
    
    // Convert date string to Date object if provided
    const processedData = {
      ...enquiryData,
      targetDeliveryDate: enquiryData.targetDeliveryDate ? new Date(enquiryData.targetDeliveryDate) : null,
      updatedAt: new Date()
    };
    
    const [enquiry] = await db
      .update(enquiries)
      .set(processedData)
      .where(eq(enquiries.id, id))
      .returning();
    
    await this.logAuditEvent("enquiry", id, "update", undefined, oldEnquiry, enquiry);
    return enquiry;
  }

  async deleteEnquiry(id: string): Promise<void> {
    const enquiry = await this.getEnquiry(id);
    
    // First delete all enquiry items
    await db.delete(enquiryItems).where(eq(enquiryItems.enquiryId, id));
    
    // Nullify references in dependent tables that optionally reference enquiries
    // Quotations.enquiry_id is nullable; set to NULL to avoid FK constraint errors
    await db.update(quotations).set({ enquiryId: null as any }).where(eq(quotations.enquiryId, id));
    
    // Supplier quotes may also reference the enquiry; set to NULL
    await db.update(supplierQuotes).set({ enquiryId: null as any }).where(eq(supplierQuotes.enquiryId, id));
    
    // Then delete the enquiry
    await db.delete(enquiries).where(eq(enquiries.id, id));
    
    await this.logAuditEvent("enquiry", id, "delete", undefined, enquiry, undefined);
  }

  // Enquiry Item operations
  async getEnquiryItems(enquiryId: string): Promise<EnquiryItem[]> {
    const rows = await db.select().from(enquiryItems).where(eq(enquiryItems.enquiryId, enquiryId));
    // Normalize numeric fields so UI consistently shows values
    return rows.map((r: any) => ({
      ...r,
      unitPrice: r.unitPrice ?? '0.00',
      discountPercent: r.discountPercent ?? '0',
      discountAmount: r.discountAmount ?? '0.00',
      vatPercent: r.vatPercent ?? '0',
      vatAmount: r.vatAmount ?? '0.00',
    })) as any;
  }

  async getEnquiryItem(id: string): Promise<EnquiryItem | undefined> {
    const [item] = await db.select().from(enquiryItems).where(eq(enquiryItems.id, id));
    return item;
  }

  async createEnquiryItem(enquiryItemData: InsertEnquiryItem): Promise<EnquiryItem> {
    // Convert unitPrice from number to string if present and compute discountAmount from percent if missing
    const qtyNum = (enquiryItemData as any).quantity ?? 0;
    const unitNum = (enquiryItemData as any).unitPrice ?? undefined;
    const pctNum = (enquiryItemData as any).discountPercent ?? undefined;
    const amtNum = (enquiryItemData as any).discountAmount ?? undefined;
    const vatPctNum = (enquiryItemData as any).vatPercent ?? undefined;
    const vatAmtNum = (enquiryItemData as any).vatAmount ?? undefined;

    const gross = unitNum !== undefined ? (Number(unitNum) * Number(qtyNum)) : undefined;
    const computedDiscountAmount = (amtNum === undefined || amtNum === null) && gross !== undefined && pctNum !== undefined
      ? ((gross * Number(pctNum)) / 100)
      : undefined;
    const computedDiscountPercent = (pctNum === undefined || pctNum === null) && gross !== undefined && amtNum !== undefined && Number(gross) > 0
      ? ((Number(amtNum) / Number(gross)) * 100)
      : undefined;

    // Calculate net amount after discount for VAT calculation
    const appliedDiscount = computedDiscountAmount !== undefined ? computedDiscountAmount : (amtNum !== undefined ? Number(amtNum) : 0);
    const netAmount = gross !== undefined ? Math.max(gross - appliedDiscount, 0) : undefined;
    
    // Calculate VAT amount from percentage if amount is not provided
    const computedVatAmount = (vatAmtNum === undefined || vatAmtNum === null) && netAmount !== undefined && vatPctNum !== undefined
      ? ((netAmount * Number(vatPctNum)) / 100)
      : undefined;

    const processedData = {
      ...enquiryItemData,
      unitPrice: enquiryItemData.unitPrice ? String(enquiryItemData.unitPrice) : undefined,
      discountPercent: (enquiryItemData as any).discountPercent !== undefined && (enquiryItemData as any).discountPercent !== null
        ? String((enquiryItemData as any).discountPercent)
        : (computedDiscountPercent !== undefined ? String(computedDiscountPercent) : undefined),
      discountAmount: (enquiryItemData as any).discountAmount !== undefined && (enquiryItemData as any).discountAmount !== null
        ? String((enquiryItemData as any).discountAmount)
        : (computedDiscountAmount !== undefined ? String(computedDiscountAmount) : undefined),
      vatPercent: (enquiryItemData as any).vatPercent !== undefined && (enquiryItemData as any).vatPercent !== null
        ? String((enquiryItemData as any).vatPercent)
        : undefined,
      vatAmount: (enquiryItemData as any).vatAmount !== undefined && (enquiryItemData as any).vatAmount !== null
        ? String((enquiryItemData as any).vatAmount)
        : (computedVatAmount !== undefined ? String(computedVatAmount) : undefined)
    };
    
    const [enquiryItem] = await db
      .insert(enquiryItems)
      .values(processedData)
      .returning();
    
    await this.logAuditEvent("enquiry_item", enquiryItem.id, "create", undefined, undefined, enquiryItem);
    return enquiryItem;
  }

  async updateEnquiryItem(id: string, enquiryItemData: Partial<InsertEnquiryItem>): Promise<EnquiryItem> {
    const oldItem = await this.getEnquiryItem(id);
    
    // Convert unitPrice from number to string if present and compute discountAmount from percent if missing
    const qtyNum = (enquiryItemData as any).quantity ?? oldItem?.quantity;
    const unitNum = (enquiryItemData as any).unitPrice ?? oldItem?.unitPrice;
    const pctNum = (enquiryItemData as any).discountPercent ?? undefined;
    const amtNum = (enquiryItemData as any).discountAmount ?? undefined;
    const vatPctNum = (enquiryItemData as any).vatPercent ?? undefined;
    const vatAmtNum = (enquiryItemData as any).vatAmount ?? undefined;

    const gross = unitNum !== undefined && qtyNum !== undefined ? (Number(unitNum) * Number(qtyNum)) : undefined;
    const computedDiscountAmount = (amtNum === undefined || amtNum === null) && gross !== undefined && pctNum !== undefined
      ? ((Number(gross) * Number(pctNum)) / 100)
      : undefined;
    const computedDiscountPercent = (pctNum === undefined || pctNum === null) && gross !== undefined && amtNum !== undefined && Number(gross) > 0
      ? ((Number(amtNum) / Number(gross)) * 100)
      : undefined;

    // Calculate net amount after discount for VAT calculation
    const appliedDiscount = computedDiscountAmount !== undefined ? computedDiscountAmount : (amtNum !== undefined ? Number(amtNum) : 0);
    const netAmount = gross !== undefined ? Math.max(gross - appliedDiscount, 0) : undefined;
    
    // Calculate VAT amount from percentage if amount is not provided
    const computedVatAmount = (vatAmtNum === undefined || vatAmtNum === null) && netAmount !== undefined && vatPctNum !== undefined
      ? ((netAmount * Number(vatPctNum)) / 100)
      : undefined;

    const processedData = {
      ...enquiryItemData,
      unitPrice: enquiryItemData.unitPrice ? String(enquiryItemData.unitPrice) : undefined,
      discountPercent: (enquiryItemData as any).discountPercent !== undefined && (enquiryItemData as any).discountPercent !== null
        ? String((enquiryItemData as any).discountPercent)
        : (computedDiscountPercent !== undefined ? String(computedDiscountPercent) : undefined),
      discountAmount: (enquiryItemData as any).discountAmount !== undefined && (enquiryItemData as any).discountAmount !== null
        ? String((enquiryItemData as any).discountAmount)
        : (computedDiscountAmount !== undefined ? String(computedDiscountAmount) : undefined),
      vatPercent: (enquiryItemData as any).vatPercent !== undefined && (enquiryItemData as any).vatPercent !== null
        ? String((enquiryItemData as any).vatPercent)
        : undefined,
      vatAmount: (enquiryItemData as any).vatAmount !== undefined && (enquiryItemData as any).vatAmount !== null
        ? String((enquiryItemData as any).vatAmount)
        : (computedVatAmount !== undefined ? String(computedVatAmount) : undefined)
    };
    
    const [enquiryItem] = await db
      .update(enquiryItems)
      .set(processedData)
      .where(eq(enquiryItems.id, id))
      .returning();
    
    await this.logAuditEvent("enquiry_item", id, "update", undefined, oldItem, enquiryItem);
    return enquiryItem;
  }

  async deleteEnquiryItem(id: string): Promise<void> {
    const item = await this.getEnquiryItem(id);
    await db.delete(enquiryItems).where(eq(enquiryItems.id, id));
    
    await this.logAuditEvent("enquiry_item", id, "delete", undefined, item, undefined);
  }

  async bulkCreateEnquiryItems(enquiryItemsData: InsertEnquiryItem[]): Promise<EnquiryItem[]> {
    if (enquiryItemsData.length === 0) return [];
    
    // Convert unitPrice from number to string for all items
    const processedData = enquiryItemsData.map(item => ({
      ...item,
      unitPrice: item.unitPrice ? String(item.unitPrice) : undefined
    }));
    
    const items = await db
      .insert(enquiryItems)
      .values(processedData)
      .returning();
    
    // Log audit events for bulk creation
    for (const item of items) {
      await this.logAuditEvent("enquiry_item", item.id, "create", undefined, undefined, item);
    }
    
    return items;
  }

  async logAuditEvent(
    entityType: string,
    entityId: string,
    action: string,
    userId?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    await db.insert(auditLogs).values({
      entityType,
      entityId,
      action,
      oldData,
      newData,
      userId,
      timestamp: new Date(),
    });
  }
}
