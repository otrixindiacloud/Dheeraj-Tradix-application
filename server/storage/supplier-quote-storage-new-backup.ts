import { db } from "../db";
import { eq, and, gte, lte, sql, desc, ilike, or } from "drizzle-orm";
import { supplierQuotes, supplierQuoteItems, suppliers, enquiries, customers, quotations } from "@shared/schema";

export class SupplierQuoteStorage {
  static async list(params: any) {
    try {
      console.log('SupplierQuoteStorage.list called with params:', params);
      
      // Build WHERE clause based on filters
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Add enquiryId filter if provided
      if (params.enquiryId) {
        whereConditions.push(`sq.enquiry_id = $${paramIndex}`);
        queryParams.push(params.enquiryId);
        paramIndex++;
      }

      // Add other filters if needed
      if (params.status) {
        whereConditions.push(`sq.status = $${paramIndex}`);
        queryParams.push(params.status);
        paramIndex++;
      }

      if (params.priority) {
        whereConditions.push(`sq.priority = $${paramIndex}`);
        queryParams.push(params.priority);
        paramIndex++;
      }

      if (params.supplier) {
        whereConditions.push(`sq.supplier_id = $${paramIndex}`);
        queryParams.push(params.supplier);
        paramIndex++;
      }

      if (params.search) {
        whereConditions.push(`(sq.quote_number ILIKE $${paramIndex} OR sq.rfq_number ILIKE $${paramIndex} OR sq.notes ILIKE $${paramIndex})`);
        queryParams.push(`%${params.search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          sq.id,
          sq.quote_number as "quoteNumber",
          sq.quotation_number as "quotationNumber",
          sq.supplier_id as "supplierId",
          sq.status,
          sq.priority,
          sq.quote_date as "quoteDate",
          sq.valid_until as "validUntil",
          sq.request_date as "requestDate",
          sq.response_date as "responseDate",
          sq.subtotal,
          sq.discount_percentage as "discountPercentage",
          sq.discount_amount as "discountAmount",
          sq.tax_amount as "taxAmount",
          sq.total_amount as "totalAmount",
          sq.currency,
          sq.terms,
          sq.notes,
          sq.requisition_id as "requisitionId",
          sq.payment_terms as "paymentTerms",
          sq.delivery_terms as "deliveryTerms",
          sq.rfq_number as "rfqNumber",
          sq.evaluation_score as "evaluationScore",
          sq.competitive_rank as "competitiveRank",
          sq.is_preferred_supplier as "isPreferredSupplier",
          sq.created_by as "createdBy",
          sq.created_at as "createdAt",
          sq.updated_at as "updatedAt",
          s.id as "supplierId",
          s.name as "supplierName",
          s.email as "supplierEmail",
          s.phone as "supplierPhone",
          s.address as "supplierAddress",
          s.contact_person as "supplierContactPerson"
        FROM supplier_quotes sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        ${whereClause}
        ORDER BY sq.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(params.limit, (params.page - 1) * params.limit);
      
      // Execute the query using the pool directly
      console.log('Executing query:', query);
      console.log('Query params:', queryParams);
      const result = await pool.query(query, queryParams);
      console.log('Query result rows:', result.rows.length);
      
      // Process results to match expected format
      const processedResults = result.rows.map((row: any) => {
        const supplier = row.supplierId ? {
          id: row.supplierId,
          name: row.supplierName,
          email: row.supplierEmail,
          phone: row.supplierPhone,
          address: row.supplierAddress,
          contactPerson: row.supplierContactPerson,
        } : null;

        return {
          id: row.id,
          quoteNumber: row.quoteNumber,
          quotationNumber: row.quotationNumber,
          supplierId: row.supplierId,
          status: row.status,
          priority: row.priority,
          quoteDate: row.quoteDate,
          requestDate: row.requestDate,
          validUntil: row.validUntil,
          responseDate: row.responseDate,
          subtotal: row.subtotal,
          discountPercentage: row.discountPercentage,
          discountAmount: row.discountAmount,
          taxAmount: row.taxAmount,
          totalAmount: row.totalAmount,
          currency: row.currency,
          terms: row.terms,
          notes: row.notes,
          requisitionId: row.requisitionId,
          paymentTerms: row.paymentTerms,
          deliveryTerms: row.deliveryTerms,
          rfqNumber: row.rfqNumber,
          evaluationScore: row.evaluationScore,
          competitiveRank: row.competitiveRank,
          isPreferredSupplier: row.isPreferredSupplier,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          supplier,
          supplierName: supplier?.name || "No Supplier"
        };
      });

      return processedResults;
    } catch (error) {
      console.error('Error in SupplierQuoteStorage.list:', error);
      throw error;
    }
  }

  static async getById(id: string) {
    try {
      const query = `
        SELECT 
          sq.id,
          sq.quote_number as "quoteNumber",
          sq.quotation_number as "quotationNumber",
          sq.supplier_id as "supplierId",
          sq.status,
          sq.priority,
          sq.quote_date as "quoteDate",
          sq.valid_until as "validUntil",
          sq.request_date as "requestDate",
          sq.response_date as "responseDate",
          sq.subtotal,
          sq.discount_percentage as "discountPercentage",
          sq.discount_amount as "discountAmount",
          sq.tax_amount as "taxAmount",
          sq.total_amount as "totalAmount",
          sq.currency,
          sq.terms,
          sq.notes,
          sq.requisition_id as "requisitionId",
          sq.payment_terms as "paymentTerms",
          sq.delivery_terms as "deliveryTerms",
          sq.rfq_number as "rfqNumber",
          sq.evaluation_score as "evaluationScore",
          sq.competitive_rank as "competitiveRank",
          sq.is_preferred_supplier as "isPreferredSupplier",
          sq.created_by as "createdBy",
          sq.created_at as "createdAt",
          sq.updated_at as "updatedAt",
          s.id as "supplierId",
          s.name as "supplierName",
          s.email as "supplierEmail",
          s.phone as "supplierPhone",
          s.address as "supplierAddress",
          s.contact_person as "supplierContactPerson"
        FROM supplier_quotes sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        WHERE sq.id = $1
        LIMIT 1
      `;

      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const supplier = row.supplierId ? {
        id: row.supplierId,
        name: row.supplierName,
        email: row.supplierEmail,
        phone: row.supplierPhone,
        address: row.supplierAddress,
        contactPerson: row.supplierContactPerson,
      } : null;

      return {
        id: row.id,
        quoteNumber: row.quoteNumber,
        quotationNumber: row.quotationNumber,
        supplierId: row.supplierId,
        status: row.status,
        priority: row.priority,
        quoteDate: row.quoteDate,
        requestDate: row.requestDate,
        validUntil: row.validUntil,
        responseDate: row.responseDate,
        subtotal: row.subtotal,
        discountPercentage: row.discountPercentage,
        discountAmount: row.discountAmount,
        taxAmount: row.taxAmount,
        totalAmount: row.totalAmount,
        currency: row.currency,
        terms: row.terms,
        notes: row.notes,
        requisitionId: row.requisitionId,
        paymentTerms: row.paymentTerms,
        deliveryTerms: row.deliveryTerms,
        rfqNumber: row.rfqNumber,
        evaluationScore: row.evaluationScore,
        competitiveRank: row.competitiveRank,
        isPreferredSupplier: row.isPreferredSupplier,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        supplier,
        supplierName: supplier?.name || "Unknown Supplier",
      };
    } catch (error) {
      console.error('Error in SupplierQuoteStorage.getById:', error);
      throw error;
    }
  }

  static async getItems(quoteId: string) {
    try {
      console.log('🔍 Fetching items for quote ID:', quoteId);
      
      // First check if the quote exists
      const quoteExists = await db
        .select({ id: supplierQuotes.id })
        .from(supplierQuotes)
        .where(eq(supplierQuotes.id, quoteId))
        .limit(1);
      
      console.log('📋 Quote exists check:', quoteExists.length > 0);
      
      if (quoteExists.length === 0) {
        console.log('❌ Quote not found:', quoteId);
        return [];
      }
      
      // Use Drizzle ORM to query the supplier_quote_items table
      const items = await db
        .select()
        .from(supplierQuoteItems)
        .where(eq(supplierQuoteItems.supplierQuoteId, quoteId))
        .orderBy(supplierQuoteItems.createdAt);
      
      console.log('📦 Raw items from database:', items);
      console.log('📊 Items count:', items.length);
      
      // Map database field names to frontend expected field names
      const mappedItems = items.map(item => ({
        id: item.id,
        quotationId: item.supplierQuoteId,
        description: item.itemDescription,
        quantity: item.quantity, // Already an integer
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal, // Changed from totalPrice to lineTotal
        unitOfMeasure: item.unitOfMeasure,
        specifications: item.specification,
        leadTime: item.leadTime,
        warranty: item.warranty,
        notes: item.brand || item.model ? `${item.brand || ''} ${item.model || ''}`.trim() : undefined
      }));
      
      console.log('🔄 Mapped items:', mappedItems);
      return mappedItems;
      
    } catch (error) {
      console.error('Error in SupplierQuoteStorage.getItems:', error);
      
      // If the table doesn't exist, try to create it
      if (error.message && error.message.includes('relation "supplier_quote_items" does not exist')) {
        console.log('Table supplier_quote_items does not exist, attempting to create it...');
        try {
          // Run the migration to create the table
          const migrationSQL = `
            CREATE TABLE IF NOT EXISTS supplier_quote_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                supplier_quote_id UUID REFERENCES supplier_quotes(id) ON DELETE CASCADE NOT NULL,
                line_number INTEGER NOT NULL,
                item_description TEXT NOT NULL,
                quantity DECIMAL(10, 2) NOT NULL,
                unit_of_measure VARCHAR(50),
                unit_price DECIMAL(10, 2) NOT NULL,
                total_price DECIMAL(12, 2) NOT NULL,
                specification TEXT,
                brand VARCHAR(100),
                model VARCHAR(100),
                warranty VARCHAR(100),
                lead_time VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_supplier_quote_items_quote_id ON supplier_quote_items(supplier_quote_id);
            CREATE INDEX IF NOT EXISTS idx_supplier_quote_items_line_number ON supplier_quote_items(supplier_quote_id, line_number);
          `;
          
          await pool.query(migrationSQL);
          console.log('Table supplier_quote_items created successfully');
          
          // Now try to fetch items again
          const items = await db
            .select()
            .from(supplierQuoteItems)
            .where(eq(supplierQuoteItems.supplierQuoteId, quoteId))
            .orderBy(supplierQuoteItems.lineNumber);
          
          console.log('Items fetched after table creation:', items.length, 'items');
          
          // Map database field names to frontend expected field names
          const mappedItems = items.map(item => ({
            id: item.id,
            quotationId: item.supplierQuoteId,
            description: item.itemDescription,
            quantity: parseFloat(item.quantity),
            unitPrice: item.unitPrice,
            lineTotal: item.totalPrice,
            unitOfMeasure: item.unitOfMeasure,
            specifications: item.specification,
            leadTime: item.leadTime,
            warranty: item.warranty,
            notes: item.brand || item.model ? `${item.brand || ''} ${item.model || ''}`.trim() : undefined
          }));
          
          return mappedItems;
          
        } catch (createError) {
          console.error('Error creating supplier_quote_items table:', createError);
          return [];
        }
      }
      
      // Return empty array for other errors to prevent UI crashes
      return [];
    }
  }

  static async create(data: any) {
    try {
      // Generate quote number if not provided
      if (!data.quoteNumber) {
        data.quoteNumber = `SQ-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      }

      // Map frontend field names to database column names
      const fieldMapping: { [key: string]: string } = {
        supplierId: 'supplier_id',
        customerId: 'customer_id',
        status: 'status',
        priority: 'priority',
        validUntil: 'valid_until',
        paymentTerms: 'payment_terms',
        deliveryTerms: 'delivery_terms',
        notes: 'notes',
        rfqNumber: 'rfq_number',
        quotationNumber: 'quotation_number',
        totalAmount: 'total_amount',
        currency: 'currency',
        enquiryId: 'enquiry_id',
        quoteNumber: 'quote_number'
      };

      // Build INSERT query
      const insertFields = [];
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      // Add required fields
      insertFields.push('id', 'quote_number', 'supplier_id', 'status', 'priority', 'created_at', 'updated_at');
      placeholders.push(`gen_random_uuid()`, `$${paramIndex}`, `$${paramIndex + 1}`, `$${paramIndex + 2}`, `$${paramIndex + 3}`, `NOW()`, `NOW()`);
      values.push(data.quoteNumber, data.supplierId, data.status || 'Draft', data.priority || 'Medium');
      paramIndex += 4;

      // Add optional fields
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null && fieldMapping[key] && !insertFields.includes(fieldMapping[key])) {
          insertFields.push(fieldMapping[key]);
          placeholders.push(`$${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      const query = `
        INSERT INTO supplier_quotes (${insertFields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING id
      `;

      console.log('Create query:', query);
      console.log('Create values:', values);

      const result = await pool.query(query, values);
      const quoteId = result.rows[0].id;
      
      // Insert items if present
      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          // Calculate total price
          const totalPrice = parseFloat(item.quantity) * parseFloat(item.unitPrice);
          
          const itemQuery = `
            INSERT INTO supplier_quote_items (
              id, supplier_quote_id, line_number, item_description, 
              quantity, unit_of_measure, unit_price, total_price, specification, 
              brand, model, warranty, lead_time
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
          `;
          await pool.query(itemQuery, [
            quoteId,
            i + 1,
            item.itemDescription,
            item.quantity,
            item.unitOfMeasure,
            item.unitPrice,
            totalPrice,
            item.specification || null,
            item.brand || null,
            item.model || null,
            item.warranty || null,
            item.leadTime || null
          ]);
        }
      }
      
      return await this.getById(quoteId);
    } catch (error) {
      console.error('Error in SupplierQuoteStorage.create:', error);
      throw error;
    }
  }

  static async update(id: string, updates: any) {
    try {
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      // Map frontend field names to database column names
      const fieldMapping: { [key: string]: string } = {
        supplierId: 'supplier_id',
        customerId: 'customer_id',
        status: 'status',
        priority: 'priority',
        validUntil: 'valid_until',
        paymentTerms: 'payment_terms',
        deliveryTerms: 'delivery_terms',
        notes: 'notes',
        rfqNumber: 'rfq_number',
        totalAmount: 'total_amount',
        currency: 'currency',
        responseDate: 'response_date'
      };

      // Build SET clause
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null && fieldMapping[key]) {
          updateFields.push(`${fieldMapping[key]} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      // Add updatedAt timestamp
      updateFields.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Add ID parameter
      values.push(id);

      const query = `
        UPDATE supplier_quotes 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `;

      console.log('Update query:', query);
      console.log('Update values:', values);

      const result = await pool.query(query, values);
      
      if (result.rowCount === 0) {
        throw new Error('Supplier quote not found');
      }

      return await this.getById(id);
    } catch (error) {
      console.error("Database error in SupplierQuoteStorage.update:", error);
      throw new Error(`Failed to update supplier quote: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  static async hasReferences(id: string) {
    // Check if the supplier quote is referenced by other entities
    // This would need to be implemented based on your business logic
    return false;
  }

  static async delete(id: string) {
    try {
      // Use raw SQL for deletion to avoid Drizzle ORM issues
      await pool.query('BEGIN');
      
      // Delete supplier quote items first (due to foreign key constraint)
      await pool.query('DELETE FROM supplier_quote_items WHERE supplier_quote_id = $1', [id]);
      
      // Then delete the supplier quote
      const result = await pool.query('DELETE FROM supplier_quotes WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        await pool.query('ROLLBACK');
        throw new Error('Supplier quote not found');
      }
      
      await pool.query('COMMIT');
      return { message: "Supplier quote deleted successfully" };
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error in SupplierQuoteStorage.delete:', error);
      throw error;
    }
  }

  static async getCount(filters?: any) {
    try {
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Apply same filters as list method
      if (filters?.enquiryId) {
        whereConditions.push(`enquiry_id = $${paramIndex}`);
        queryParams.push(filters.enquiryId);
        paramIndex++;
      }
      if (filters?.supplier && filters.supplier !== "" && filters.supplier !== "all") {
        whereConditions.push(`supplier_id = $${paramIndex}`);
        queryParams.push(filters.supplier);
        paramIndex++;
      }
      if (filters?.status && filters.status !== "" && filters.status !== "all") {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(filters.status);
        paramIndex++;
      }
      if (filters?.priority && filters.priority !== "" && filters.priority !== "all") {
        whereConditions.push(`priority = $${paramIndex}`);
        queryParams.push(filters.priority);
        paramIndex++;
      }
      if (filters?.currency && filters.currency !== "" && filters.currency !== "all") {
        whereConditions.push(`currency = $${paramIndex}`);
        queryParams.push(filters.currency);
        paramIndex++;
      }
      if (filters?.dateFrom) {
        whereConditions.push(`valid_until >= $${paramIndex}`);
        queryParams.push(filters.dateFrom);
        paramIndex++;
      }
      if (filters?.dateTo) {
        whereConditions.push(`valid_until <= $${paramIndex}`);
        queryParams.push(filters.dateTo);
        paramIndex++;
      }
      if (filters?.search && filters.search.trim() !== "") {
        whereConditions.push(`(quote_number ILIKE $${paramIndex} OR rfq_number ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`);
        queryParams.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `SELECT COUNT(*) FROM supplier_quotes ${whereClause}`;
      
      const result = await pool.query(query, queryParams);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error('Error in SupplierQuoteStorage.getCount:', error);
      throw error;
    }
  }
}
