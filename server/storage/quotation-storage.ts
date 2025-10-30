import { eq, and, gte, lte, desc, asc, isNull, isNotNull, like, or } from "drizzle-orm";
import { db } from "../db";
import {
  quotations,
  quotationItems,
  quotationApprovals,
  quotationItemAcceptances,
  enquiries,
  enquiryItems,
  customers,
  purchaseOrders,
  users,
  type Quotation,
  type QuotationItem,
  type QuotationApproval,
  type InsertQuotation,
  type InsertQuotationItem,
  type InsertQuotationApproval,
} from "@shared/schema";
import { BaseStorage } from './base.js';
import { validateUserIdOrDefault, SYSTEM_USER_ID } from "@shared/utils/uuid";

export class QuotationStorage extends BaseStorage {
  
  // Helper method to get enquiry with customer details
  async getEnquiryWithCustomer(enquiryId: string) {
    const result = await db
      .select({
        id: enquiries.id,
        enquiryNumber: enquiries.enquiryNumber,
        notes: enquiries.notes,
        customerId: enquiries.customerId,
        customer: {
          id: customers.id,
          name: customers.name,
          customerType: customers.customerType,
          email: customers.email,
          phone: customers.phone,
        }
      })
      .from(enquiries)
      .innerJoin(customers, eq(enquiries.customerId, customers.id))
      .where(eq(enquiries.id, enquiryId));
    
    return result[0];
  }
  // Quotation operations
  async getQuotations(limit = 50, offset = 0, filters?: {
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }) {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(quotations.status, filters.status as any));
    }
    
    if (filters?.customerId) {
      conditions.push(eq(quotations.customerId, filters.customerId));
    }
    
    if (filters?.dateFrom) {
      conditions.push(gte(quotations.createdAt, new Date(filters.dateFrom)));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(quotations.createdAt, new Date(filters.dateTo)));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          like(quotations.quoteNumber, `%${filters.search}%`),
          like(quotations.notes, `%${filters.search}%`)
        )
      );
    }

    // Join with purchase orders to get PO document information and users for username
    return await db
      .select({
        // All quotation fields
        id: quotations.id,
        quoteNumber: quotations.quoteNumber,
        revision: quotations.revision,
        parentQuotationId: quotations.parentQuotationId,
        revisionReason: quotations.revisionReason,
        supersededAt: quotations.supersededAt,
        supersededBy: quotations.supersededBy,
        isSuperseded: quotations.isSuperseded,
        enquiryId: quotations.enquiryId,
        customerId: quotations.customerId,
        customerType: quotations.customerType,
        status: quotations.status,
        quoteDate: quotations.quoteDate,
        validUntil: quotations.validUntil,
        subtotal: quotations.subtotal,
        discountPercentage: quotations.discountPercentage,
        discountAmount: quotations.discountAmount,
        taxAmount: quotations.taxAmount,
        totalAmount: quotations.totalAmount,
        terms: quotations.terms,
        notes: quotations.notes,
        approvalStatus: quotations.approvalStatus,
        requiredApprovalLevel: quotations.requiredApprovalLevel,
        approvedBy: quotations.approvedBy,
        approvedAt: quotations.approvedAt,
        rejectionReason: quotations.rejectionReason,
        createdBy: quotations.createdBy,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        // User information
        createdByUsername: users.username,
        // PO document fields
        customerPoNumber: purchaseOrders.poNumber,
        customerPoDocument: purchaseOrders.documentPath,
        customerPoDocumentName: purchaseOrders.documentName,
      })
      .from(quotations)
      .leftJoin(purchaseOrders, eq(quotations.id, purchaseOrders.quotationId))
      .leftJoin(users, eq(quotations.createdBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quotations.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getQuotation(id: string) {
    const result = await db
      .select({
        // All quotation fields
        id: quotations.id,
        quoteNumber: quotations.quoteNumber,
        revision: quotations.revision,
        parentQuotationId: quotations.parentQuotationId,
        revisionReason: quotations.revisionReason,
        supersededAt: quotations.supersededAt,
        supersededBy: quotations.supersededBy,
        isSuperseded: quotations.isSuperseded,
        enquiryId: quotations.enquiryId,
        customerId: quotations.customerId,
        customerType: quotations.customerType,
        status: quotations.status,
        quoteDate: quotations.quoteDate,
        validUntil: quotations.validUntil,
        subtotal: quotations.subtotal,
        discountPercentage: quotations.discountPercentage,
        discountAmount: quotations.discountAmount,
        taxAmount: quotations.taxAmount,
        totalAmount: quotations.totalAmount,
        terms: quotations.terms,
        notes: quotations.notes,
        approvalStatus: quotations.approvalStatus,
        requiredApprovalLevel: quotations.requiredApprovalLevel,
        approvedBy: quotations.approvedBy,
        approvedAt: quotations.approvedAt,
        rejectionReason: quotations.rejectionReason,
        createdBy: quotations.createdBy,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        // User information
        createdByUsername: users.username,
        // PO document fields
        customerPoNumber: purchaseOrders.poNumber,
        customerPoDocument: purchaseOrders.documentPath,
        customerPoDocumentName: purchaseOrders.documentName,
      })
      .from(quotations)
      .leftJoin(purchaseOrders, eq(quotations.id, purchaseOrders.quotationId))
      .leftJoin(users, eq(quotations.createdBy, users.id))
      .where(eq(quotations.id, id))
      .limit(1);
    
    return result[0];
  }

  async createQuotation(quotation: InsertQuotation, userId?: string) {
    // Generate unique quotation number
    let quoteNumber: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      quoteNumber = this.generateNumber("QT");
      
      // Check if this number already exists
      const existing = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.quoteNumber, quoteNumber)).limit(1);
      if (existing.length === 0) break;
      
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique quotation number");
    }
    
    const now = this.getCurrentTimestamp();

    // Ensure validUntil is a Date object if provided
    const processedQuotation = {
      ...quotation,
      validUntil: quotation.validUntil ? new Date(quotation.validUntil as unknown as string | Date) : undefined,
    };

    const newQuotation = {
      ...processedQuotation,
      quoteNumber,  // Use the correct field name from schema
      createdBy: validateUserIdOrDefault(userId || processedQuotation.createdBy),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(quotations).values(newQuotation).returning();
    const inserted = (result as Quotation[])[0];

    await this.logAuditEvent(
      "quotation",
      inserted.id,
      "created",
      (userId || quotation.createdBy || "system") as string,
      null,
      inserted
    );

    return inserted as Quotation;
  }

  async updateQuotation(id: string, quotation: Partial<InsertQuotation>) {
    const existing = await this.getQuotation(id);
    if (!existing) {
      throw new Error("Quotation not found");
    }

    const updatedQuotation = {
      ...quotation,
      updatedAt: this.getCurrentTimestamp(),
    };

    await db
      .update(quotations)
      .set(updatedQuotation)
      .where(eq(quotations.id, id));

    await this.logAuditEvent(
      "quotation",
      id,
      "updated",
      (quotation.createdBy || "system") as string,
      existing,
      { ...existing, ...updatedQuotation }
    );

    return { ...existing, ...updatedQuotation } as Quotation;
  }

  async deleteQuotation(id: string) {
    const existing = await this.getQuotation(id);
    if (!existing) {
      throw new Error("Quotation not found");
    }

    try {
      // Use transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Delete related items first (these have CASCADE delete)
        await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
        
        // Delete quotation approvals if any
        await tx.delete(quotationApprovals).where(eq(quotationApprovals.quotationId, id));
        
        // Delete the quotation
        const result = await tx.delete(quotations).where(eq(quotations.id, id));
        
        if (result.rowCount === 0) {
          throw new Error("Failed to delete quotation");
        }
      });

      await this.logAuditEvent(
        "quotation",
        id,
        "deleted",
        undefined,
        existing,
        null
      );
    } catch (error) {
      console.error("Error deleting quotation:", error);
      
      // Check if it's a foreign key constraint violation
      if (error instanceof Error && error.message.includes('foreign key constraint')) {
        throw new Error("Cannot delete quotation. It is referenced by sales orders, customer acceptances, or purchase orders. Please delete the related records first.");
      }
      
      // Check for specific PostgreSQL error codes
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === '23503') { // Foreign key violation
          throw new Error("Cannot delete quotation. It is referenced by other records. Please delete the related records first.");
        }
      }
      
      throw error;
    }
  }

  async generateQuotationFromEnquiry(enquiryId: string, userId = "system") {
    try {
      console.log("generateQuotationFromEnquiry called with:", { enquiryId, userId });

      // Get the enquiry with customer details
      const enquiry = await this.getEnquiryWithCustomer(enquiryId);
      if (!enquiry) {
        throw new Error("Enquiry not found");
      }

      console.log("Retrieved enquiry and customer:", {
        enquiry: { id: enquiry.id, notes: enquiry.notes },
        customer: { id: enquiry.customer.id, name: enquiry.customer.name, customerType: enquiry.customer.customerType }
      });

      // Get enquiry items to copy to quotation (rename variable to avoid shadowing table identifier)
      const enquiryItemsList = await db
        .select()
        .from(enquiryItems)
        .where(eq(enquiryItems.enquiryId, enquiryId));

      console.log("Retrieved enquiry items:", enquiryItemsList.length, "items");

      // Import enhanced pricing engine
      const { enhancedPricingStorage } = await import('./pricing-storage.js');

      // Create quotation data
      const quotationData = {
        customerId: enquiry.customerId,
        customerType: enquiry.customer.customerType,
        enquiryId: enquiry.id,
        status: "Draft" as const,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        subtotal: "0",
        discountPercentage: "0",
        discountAmount: "0",
        taxAmount: "0",
        totalAmount: "0", // Will be calculated from items
        notes: `Generated from enquiry ${enquiry.enquiryNumber}`,
        createdBy: validateUserIdOrDefault(userId),
      };

      console.log("Creating quotation with data:", quotationData);

      // Create the quotation with userId parameter
      const quotation = await this.createQuotation(quotationData as unknown as InsertQuotation, userId);

      console.log("Successfully created quotation:", quotation);

      // Copy enquiry items to quotation items with enhanced pricing
      if (enquiryItemsList.length > 0) {
        let totalAmount = 0;
        const createdItems: QuotationItem[] = [];

        for (const enquiryItem of enquiryItemsList) {
          try {
            // Use enhanced pricing engine for each item
            // First, create a mock item if itemId is not available
            let itemId = enquiryItem.itemId;
            
            if (!itemId) {
              // For enquiry items without itemId, use fallback calculation
              const basePrice = parseFloat(enquiryItem.unitPrice || "0");
              const markup = enquiry.customer.customerType === "Retail" ? 0.7 : 0.4;
              const quotedPrice = basePrice * (1 + markup);
              const totalPrice = quotedPrice * enquiryItem.quantity;
              totalAmount += totalPrice;

              const quotationItemData: InsertQuotationItem = {
                quotationId: quotation.id,
                description: enquiryItem.description,
                quantity: enquiryItem.quantity,
                costPrice: basePrice,
                markup: markup * 100,
                unitPrice: quotedPrice,
                discountPercentage: enquiryItem.discountPercent ? Number(enquiryItem.discountPercent) : undefined,
                discountAmount: enquiryItem.discountAmount ? Number(enquiryItem.discountAmount) : undefined,
                vatPercent: enquiryItem.vatPercent ? Number(enquiryItem.vatPercent) : undefined,
                vatAmount: enquiryItem.vatAmount ? Number(enquiryItem.vatAmount) : undefined,
                lineTotal: totalPrice,
                notes: enquiryItem.notes || "",
              };

              console.log("Creating quotation item (fallback pricing):", quotationItemData);
              const created = await this.createQuotationItem(quotationItemData);
              createdItems.push(created);
            } else {
              // Use enhanced pricing engine
              const pricingResult = await enhancedPricingStorage.calculateItemPrice(
                itemId,
                enquiry.customerId,
                enquiryItem.quantity
              );

              const quotationItemData: InsertQuotationItem = {
                quotationId: quotation.id,
                description: enquiryItem.description,
                quantity: enquiryItem.quantity,
                costPrice: pricingResult.costPrice,
                markup: pricingResult.markupPercentage,
                unitPrice: pricingResult.finalPrice,
                discountPercentage: enquiryItem.discountPercent ? Number(enquiryItem.discountPercent) : undefined,
                discountAmount: enquiryItem.discountAmount ? Number(enquiryItem.discountAmount) : undefined,
                vatPercent: enquiryItem.vatPercent ? Number(enquiryItem.vatPercent) : undefined,
                vatAmount: enquiryItem.vatAmount ? Number(enquiryItem.vatAmount) : undefined,
                lineTotal: pricingResult.finalPrice * enquiryItem.quantity,
                notes: `${enquiryItem.notes || ""} | Pricing method: ${pricingResult.method} | Factors: ${pricingResult.factors.join(', ')}`,
              };

              totalAmount += pricingResult.finalPrice * enquiryItem.quantity;

              console.log("Creating quotation item (enhanced pricing):", quotationItemData);
              const created = await this.createQuotationItem(quotationItemData);
              createdItems.push(created);
            }
          } catch (pricingError) {
            console.error("Error calculating enhanced pricing for item:", pricingError);
            
            // Fallback to original pricing logic
            const basePrice = parseFloat(enquiryItem.unitPrice || "0");
            const markup = enquiry.customer.customerType === "Retail" ? 0.7 : 0.4;
            const quotedPrice = basePrice * (1 + markup);
            const totalPrice = quotedPrice * enquiryItem.quantity;
            totalAmount += totalPrice;

            const quotationItemData: InsertQuotationItem = {
              quotationId: quotation.id,
              description: enquiryItem.description,
              quantity: enquiryItem.quantity,
              costPrice: basePrice,
              markup: markup * 100,
              unitPrice: quotedPrice,
              discountPercentage: enquiryItem.discountPercent ? Number(enquiryItem.discountPercent) : undefined,
              discountAmount: enquiryItem.discountAmount ? Number(enquiryItem.discountAmount) : undefined,
              vatPercent: enquiryItem.vatPercent ? Number(enquiryItem.vatPercent) : undefined,
              vatAmount: enquiryItem.vatAmount ? Number(enquiryItem.vatAmount) : undefined,
              lineTotal: totalPrice,
              notes: enquiryItem.notes || "",
            };

            console.log("Creating quotation item (fallback after error):", quotationItemData);
            const created = await this.createQuotationItem(quotationItemData);
            createdItems.push(created);
          }
        }

        // Calculate VAT based on enquiry items data
        let calculatedVAT = 0;
        let calculatedSubtotal = 0;
        
        for (const enquiryItem of enquiryItemsList) {
          const qty = Number(enquiryItem.quantity) || 0;
          const unit = Number(enquiryItem.unitPrice) || 0;
          const gross = qty * unit;
          
          // Calculate discount
          const discountPercent = Number(enquiryItem.discountPercent) || 0;
          const discountAmount = Number(enquiryItem.discountAmount) || 0;
          const appliedDiscount = discountAmount > 0 ? discountAmount : (gross * discountPercent / 100);
          const netAmount = Math.max(gross - appliedDiscount, 0);
          
          // Calculate VAT
          const vatPercent = Number(enquiryItem.vatPercent) || 0;
          const vatAmount = Number(enquiryItem.vatAmount) || 0;
          const calculatedVatAmount = vatAmount > 0 ? vatAmount : (netAmount * vatPercent / 100);
          
          calculatedSubtotal += gross;
          calculatedVAT += calculatedVatAmount;
        }
        
        const totalWithTax = calculatedSubtotal + calculatedVAT;
        
        const updatedQuotation = {
          subtotal: calculatedSubtotal.toFixed(2),
          taxAmount: calculatedVAT.toFixed(2),
          totalAmount: totalWithTax.toFixed(2),
        };
        console.log("Updating quotation totals:", updatedQuotation);
        await this.updateQuotation(quotation.id, updatedQuotation);
      }

      // Return fresh quotation with updated totals (re-query)
      const refreshed = await this.getQuotation(quotation.id);
      
      // Update enquiry status to "Quoted"
      console.log("=== ATTEMPTING TO UPDATE ENQUIRY STATUS ===");
      console.log("Enquiry ID:", enquiryId);
      try {
        const { EnquiryStorage } = await import('./enquiry-storage.js');
        console.log("EnquiryStorage imported successfully");
        const enquiryStorage = new EnquiryStorage();
        console.log("EnquiryStorage instance created");
        
        const updateResult = await enquiryStorage.updateEnquiry(enquiryId, { status: "Quoted" });
        console.log("✅ Successfully updated enquiry status to 'Quoted'", updateResult);
      } catch (statusError) {
        console.error("❌ Error updating enquiry status:", statusError);
        console.error("Error details:", JSON.stringify(statusError, Object.getOwnPropertyNames(statusError), 2));
        // Don't throw - quotation was created successfully
      }
      
      console.log("Successfully generated quotation with items from enquiry");
      return refreshed || quotation;
    } catch (error) {
      console.error("Error generating quotation from enquiry:", error);
      throw error;
    }
  }

  // Quotation revision operations
  async createQuotationRevision(originalId: string, revisionData: any, userId: string) {
    const original = await this.getQuotation(originalId);
    if (!original) {
      throw new Error("Original quotation not found");
    }

    // Create new quotation as revision
    const revisionQuotation: InsertQuotation = {
      ...original,
      parentQuotationId: originalId,
      revision: (original.revision || 0) + 1,
      status: "Draft",
      createdBy: validateUserIdOrDefault(userId),
      ...revisionData,
    };

    delete (revisionQuotation as any).id;
    delete (revisionQuotation as any).createdAt;
    delete (revisionQuotation as any).updatedAt;
    // Persist new quotation header
    const newQuotation = await this.createQuotation(revisionQuotation, userId);

    try {
      // Fetch original items
      const originalItems = await this.getQuotationItems(originalId);
      if (originalItems.length) {
        let subtotal = 0;
        const duplicated: InsertQuotationItem[] = originalItems.map(it => {
          const qty = Number(it.quantity) || 0;
            const unit = parseFloat(it.unitPrice as any || '0');
          const lineTotal = parseFloat(it.lineTotal as any || (qty * unit).toFixed(2));
          subtotal += lineTotal;
          return {
            quotationId: newQuotation.id,
            description: it.description,
            quantity: qty,
            costPrice: typeof it.costPrice === 'string' ? parseFloat(it.costPrice) : it.costPrice,
            markup: typeof it.markup === 'string' ? parseFloat(it.markup) : it.markup,
            unitPrice: typeof it.unitPrice === 'string' ? parseFloat(it.unitPrice) : it.unitPrice,
            lineTotal: typeof lineTotal === 'string' ? parseFloat(lineTotal) : lineTotal,
            isAccepted: true, // fresh revision assumes active items
            notes: it.notes as any || undefined,
          } as InsertQuotationItem;
        });
        // Insert sequentially (small counts) or could batch
        for (const dup of duplicated) {
          await this.createQuotationItem(dup);
        }
        // Calculate tax (5% as per quotation form logic)
        const taxAmount = subtotal * 0.05;
        const totalWithTax = subtotal + taxAmount;
        
        // Update totals on new quotation
        await this.updateQuotation(newQuotation.id, {
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalWithTax.toFixed(2),
        });
      }
    } catch (dupErr) {
      console.error("Failed duplicating quotation items for revision", dupErr);
    }

    // Return refreshed quotation (with updated totals if any)
    return await this.getQuotation(newQuotation.id) || newQuotation;
  }

  async getQuotationRevisions(originalId: string) {
    return await db
      .select()
      .from(quotations)
      .where(eq(quotations.parentQuotationId, originalId))
      .orderBy(asc(quotations.revision));
  }

  async getQuotationHistory(quotationId: string) {
    // This would typically query an audit log table
    // For now, return empty array
    return [];
  }

  // Quotation Item operations
  async getQuotationItems(quotationId: string) {
    return await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quotationId))
      .orderBy(asc(quotationItems.createdAt));
  }

  async createQuotationItem(item: InsertQuotationItem) {
    // Do NOT generate custom id; let DB default gen_random_uuid() handle it
    try {
      const baseItem = {
        ...item,
        // createdAt left to DB default
      } as any;

      const inserted = await db.insert(quotationItems).values(baseItem).returning();
      const row = (inserted as any)[0];
      return row as QuotationItem;
    } catch (error) {
      console.error("createQuotationItem failed:", error);
      throw error;
    }
  }

  async updateQuotationItem(id: string, item: Partial<InsertQuotationItem>) {
    const existing = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.id, id))
      .limit(1);

    if (!existing[0]) {
      throw new Error("Quotation item not found");
    }

    const updatedItem = {
      ...item,
      unitPrice: item.unitPrice !== undefined ? String(item.unitPrice) : undefined,
      costPrice: item.costPrice !== undefined ? String(item.costPrice) : undefined,
      markup: item.markup !== undefined ? String(item.markup) : undefined,
      lineTotal: item.lineTotal !== undefined ? String(item.lineTotal) : undefined,
    };

    await db
      .update(quotationItems)
      .set(updatedItem)
      .where(eq(quotationItems.id, id));

    await this.logAuditEvent(
      "quotation_item",
      id,
      "updated",
      "system", // Use system as fallback since modifiedBy doesn't exist in InsertQuotationItem
      existing[0],
      { ...existing[0], ...updatedItem }
    );

    return { ...existing[0], ...updatedItem } as QuotationItem;
  }

  async deleteQuotationItem(id: string) {
    const existing = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.id, id))
      .limit(1);

    if (!existing[0]) {
      throw new Error("Quotation item not found");
    }

    await db.delete(quotationItems).where(eq(quotationItems.id, id));

    await this.logAuditEvent(
      "quotation_item",
      id,
      "deleted",
      undefined,
      existing[0],
      null
    );
  }

  // Quotation Approval operations
  async getQuotationApprovals(quotationId: string) {
    return await db
      .select()
      .from(quotationApprovals)
      .where(eq(quotationApprovals.quotationId, quotationId))
      .orderBy(asc(quotationApprovals.createdAt));
  }

  async createQuotationApproval(approval: InsertQuotationApproval) {
    // Ensure approverId is a valid uuid or null
    const approverId = approval.approverId && typeof approval.approverId === 'string' && approval.approverId.length === 36
      ? approval.approverId
      : null;
    // Generate a proper UUID for the approval record
    const id = crypto.randomUUID();
    const now = this.getCurrentTimestamp();

    // Only allow valid status values
    const allowedApprovalStatuses = ["Pending", "Approved", "Rejected"];
    const status = allowedApprovalStatuses.includes(approval.status) ? approval.status : "Pending";

    const newApproval = {
      ...approval,
      id,
      approverId,
      status,
      createdAt: now,
    };

    await db.insert(quotationApprovals).values(newApproval);

    await this.logAuditEvent(
      "quotation_approval",
      id,
      "created",
      approverId || "system",
      null,
      newApproval
    );

    return { ...newApproval } as QuotationApproval;
  }
}
