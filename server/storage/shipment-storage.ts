import { BaseStorage } from './base.js';
import { IShipmentStorage } from './interfaces.js';
import { db } from "../db";
import { 
  shipments,
  salesOrders,
  customers,
  suppliers,
  users
} from '@shared/schema';
import { eq, and, desc, sql, count, ilike, or } from 'drizzle-orm';

export class ShipmentStorage extends BaseStorage implements IShipmentStorage {
  // Shipment operations
  async getShipments(filters?: {
    status?: string;
    priority?: string;
    carrierId?: string;
    serviceType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      // Apply filters
      const conditions = [];

      if (filters?.status) {
        // Only allow valid enum values for status
        const allowedStatuses = [
          'Pending',
          'Delivered',
          'Cancelled',
          'Picked Up',
          'In Transit',
          'Out for Delivery',
          'Delayed',
          'Lost'
        ] as const;
        if (allowedStatuses.includes(filters.status as any)) {
          conditions.push(eq(shipments.status, filters.status as typeof allowedStatuses[number]));
        }
      }
      if (filters?.priority) {
        const allowedPriorities = ['Low', 'Medium', 'High', 'Urgent'] as const;
        if (allowedPriorities.includes(filters.priority as any)) {
          conditions.push(eq(shipments.priority, filters.priority as typeof allowedPriorities[number]));
        }
      }
      if (filters?.carrierId) {
        conditions.push(eq(shipments.carrierId, filters.carrierId));
      }
      if (filters?.serviceType) {
        const allowedServiceTypes = ['Standard', 'Express', 'Overnight', 'Economy'] as const;
        if (allowedServiceTypes.includes(filters.serviceType as any)) {
          conditions.push(eq(shipments.serviceType, filters.serviceType as typeof allowedServiceTypes[number]));
        }
      }
      if (filters?.search) {
        conditions.push(
          or(
            ilike(shipments.shipmentNumber, `%${filters.search}%`),
            ilike(shipments.trackingNumber, `%${filters.search}%`),
            ilike(salesOrders.orderNumber, `%${filters.search}%`),
            ilike(customers.name, `%${filters.search}%`)
          )
        );
      }
      if (filters?.dateFrom) {
        conditions.push(sql`${shipments.createdAt} >= ${filters.dateFrom}`);
      }
      if (filters?.dateTo) {
        conditions.push(sql`${shipments.createdAt} <= ${filters.dateTo}`);
      }

      let query = db
        .select({
          id: shipments.id,
          shipmentNumber: shipments.shipmentNumber,
          trackingNumber: shipments.trackingNumber,
          salesOrderId: shipments.salesOrderId,
          salesOrderNumber: salesOrders.orderNumber,
          supplierId: shipments.supplierId,
          supplierName: suppliers.name,
          carrierId: shipments.carrierId,
          carrierName: shipments.carrierName,
          serviceType: shipments.serviceType,
          status: shipments.status,
          priority: shipments.priority,
          origin: shipments.origin,
          destination: shipments.destination,
          estimatedDelivery: shipments.estimatedDelivery,
          actualDelivery: shipments.actualDelivery,
          weight: shipments.weight,
          dimensions: shipments.dimensions,
          declaredValue: shipments.declaredValue,
          currency: shipments.currency,
          shippingCost: shipments.shippingCost,
          customerReference: shipments.customerReference,
          customerName: shipments.customerName, // Added for customer name
          specialInstructions: shipments.specialInstructions,
          packageCount: shipments.packageCount,
          isInsured: shipments.isInsured,
          requiresSignature: shipments.requiresSignature,
          currentLocation: shipments.currentLocation,
          lastUpdate: shipments.lastUpdate,
          createdAt: shipments.createdAt,
          updatedAt: shipments.updatedAt,
          // Additional LPO-related fields
          lpoId: shipments.lpoId, // Added for LPO ID
          lpoNumber: shipments.lpoNumber, // Added for LPO number
          items: shipments.items, // Added for items JSON
          subtotal: shipments.subtotal, // Added for subtotal
          taxAmount: shipments.taxAmount, // Added for tax amount
          paymentTerms: shipments.paymentTerms, // Added for payment terms
          deliveryTerms: shipments.deliveryTerms, // Added for delivery terms
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email
          }
        })
        .from(shipments)
        .leftJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .leftJoin(suppliers, eq(shipments.supplierId, suppliers.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(shipments.createdAt));

      // Move limit/offset after all joins
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const results = await query;
      return results;
    } catch (error) {
      console.error('Error fetching shipments:', error);
      throw new Error('Failed to fetch shipments');
    }
  }

  async getShipment(id: string): Promise<any> {
    try {
      const result = await db
        .select({
          id: shipments.id,
          shipmentNumber: shipments.shipmentNumber,
          trackingNumber: shipments.trackingNumber,
          salesOrderId: shipments.salesOrderId,
          salesOrderNumber: salesOrders.orderNumber,
          supplierId: shipments.supplierId,
          supplierName: suppliers.name,
          carrierId: shipments.carrierId,
          carrierName: shipments.carrierName,
          serviceType: shipments.serviceType,
          status: shipments.status,
          priority: shipments.priority,
          origin: shipments.origin,
          destination: shipments.destination,
          estimatedDelivery: shipments.estimatedDelivery,
          actualDelivery: shipments.actualDelivery,
          weight: shipments.weight,
          dimensions: shipments.dimensions,
          declaredValue: shipments.declaredValue,
          currency: shipments.currency,
          shippingCost: shipments.shippingCost,
          customerReference: shipments.customerReference,
          customerName: shipments.customerName, // Added for customer name
          specialInstructions: shipments.specialInstructions,
          packageCount: shipments.packageCount,
          isInsured: shipments.isInsured,
          requiresSignature: shipments.requiresSignature,
          currentLocation: shipments.currentLocation,
          lastUpdate: shipments.lastUpdate,
          createdAt: shipments.createdAt,
          updatedAt: shipments.updatedAt,
          // Additional LPO-related fields
          lpoId: shipments.lpoId, // Added for LPO ID
          lpoNumber: shipments.lpoNumber, // Added for LPO number
          items: shipments.items, // Added for items JSON
          subtotal: shipments.subtotal, // Added for subtotal
          taxAmount: shipments.taxAmount, // Added for tax amount
          paymentTerms: shipments.paymentTerms, // Added for payment terms
          deliveryTerms: shipments.deliveryTerms, // Added for delivery terms
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email
          }
        })
        .from(shipments)
        .leftJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .leftJoin(suppliers, eq(shipments.supplierId, suppliers.id))
        .where(eq(shipments.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching shipment:', error);
      throw new Error('Failed to fetch shipment');
    }
  }

  async getShipmentByNumber(shipmentNumber: string): Promise<any> {
    try {
      const result = await db
        .select()
        .from(shipments)
        .where(eq(shipments.shipmentNumber, shipmentNumber))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching shipment by number:', error);
      throw new Error('Failed to fetch shipment by number');
    }
  }

  async getShipmentByTrackingNumber(trackingNumber: string): Promise<any> {
    try {
      const result = await db
        .select({
          id: shipments.id,
          shipmentNumber: shipments.shipmentNumber,
          trackingNumber: shipments.trackingNumber,
          salesOrderId: shipments.salesOrderId,
          salesOrderNumber: salesOrders.orderNumber,
          supplierId: shipments.supplierId,
          supplierName: suppliers.name,
          carrierId: shipments.carrierId,
          carrierName: shipments.carrierName,
          serviceType: shipments.serviceType,
          status: shipments.status,
          priority: shipments.priority,
          origin: shipments.origin,
          destination: shipments.destination,
          estimatedDelivery: shipments.estimatedDelivery,
          actualDelivery: shipments.actualDelivery,
          weight: shipments.weight,
          dimensions: shipments.dimensions,
          declaredValue: shipments.declaredValue,
          currency: shipments.currency,
          shippingCost: shipments.shippingCost,
          customerReference: shipments.customerReference,
          specialInstructions: shipments.specialInstructions,
          packageCount: shipments.packageCount,
          isInsured: shipments.isInsured,
          requiresSignature: shipments.requiresSignature,
          currentLocation: shipments.currentLocation,
          lastUpdate: shipments.lastUpdate,
          createdAt: shipments.createdAt,
          updatedAt: shipments.updatedAt,
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email
          }
        })
        .from(shipments)
        .leftJoin(salesOrders, eq(shipments.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .leftJoin(suppliers, eq(shipments.supplierId, suppliers.id))
        .where(eq(shipments.trackingNumber, trackingNumber))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching shipment by tracking number:', error);
      throw new Error('Failed to fetch shipment by tracking number');
    }
  }

  async createShipment(shipmentData: any): Promise<any> {
    try {
      // Generate shipment number if not provided
      if (!shipmentData.shipmentNumber) {
        shipmentData.shipmentNumber = this.generateNumber('SHP');
      }

      // Generate tracking number if not provided
      if (!shipmentData.trackingNumber) {
        shipmentData.trackingNumber = `TRK${Math.random().toString().substr(2, 9)}`;
      }

      const result = await db
        .insert(shipments)
        .values({
          ...shipmentData,
          lastUpdate: new Date(),
        })
        .returning();

      // Create initial tracking event - DISABLED to prevent errors
      // await this.createTrackingEvent({
      //   shipmentId: result[0].id,
      //   timestamp: new Date(),
      //   location: shipmentData.origin || 'Origin',
      //   status: 'Shipment Created',
      //   description: 'Shipment has been created and is pending pickup',
      //   scanType: 'Pickup'
      // });

      // Log audit event
      await this.logAuditEvent(
        'shipment',
        result[0].id,
        'created',
        shipmentData.createdBy,
        null,
        result[0]
      );

      return await this.getShipment(result[0].id);
    } catch (error) {
      console.error('Error creating shipment:', error);
      if (error instanceof Error && error.message) {
        throw new Error(error.message);
      }
      throw error;
    }
  }

  async updateShipment(id: string, shipmentData: any): Promise<any> {
    try {
      // Process the data to handle date fields properly
      const processedData: any = {};
      
      // Handle date fields that need to be converted to Date objects
      const dateFields = ['estimatedDelivery', 'actualDelivery', 'createdAt', 'updatedAt', 'lastUpdate'];
      
      Object.keys(shipmentData).forEach(key => {
        const value = shipmentData[key];
        
        if (dateFields.includes(key) && value) {
          // Convert string dates to Date objects
          if (typeof value === 'string') {
            processedData[key] = new Date(value);
          } else if (value instanceof Date) {
            processedData[key] = value;
          } else {
            processedData[key] = value;
          }
        } else {
          processedData[key] = value;
        }
      });
      
      // Always set updatedAt and lastUpdate to current date
      processedData.updatedAt = new Date();
      processedData.lastUpdate = new Date();

      const result = await db
        .update(shipments)
        .set(processedData)
        .where(eq(shipments.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error('Shipment not found');
      }

      await this.logAuditEvent(
        'shipment',
        id,
        'updated',
        shipmentData.updatedBy,
        null,
        result[0]
      );

      return await this.getShipment(id);
    } catch (error) {
      console.error('Error updating shipment:', error);
      throw new Error('Failed to update shipment');
    }
  }

  async deleteShipment(id: string): Promise<void> {
    try {
      // Delete shipment directly (tracking events table doesn't exist)
      const result = await db.delete(shipments).where(eq(shipments.id, id)).returning();

      if (result.length === 0) {
        throw new Error('Shipment not found');
      }
      
      await this.logAuditEvent(
        'shipment',
        id,
        'deleted',
        undefined,
        null,
        null
      );
    } catch (error) {
      console.error('Error deleting shipment:', error);
      throw new Error('Failed to delete shipment');
    }
  }

  async updateShipmentStatus(id: string, status: string, location?: string): Promise<any> {
    try {
      const updateData: any = {
        status,
        lastUpdate: new Date(),
        updatedAt: new Date(),
      };

      if (location) {
        updateData.currentLocation = location;
      }

      // If status is Delivered, set actual delivery date
      if (status === 'Delivered') {
        updateData.actualDelivery = new Date();
      }

      const result = await db
        .update(shipments)
        .set(updateData)
        .where(eq(shipments.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error('Shipment not found');
      }

      // Create tracking event for status change - DISABLED to prevent errors
      // await this.createTrackingEvent({
      //   shipmentId: id,
      //   timestamp: new Date(),
      //   location: location || result[0].currentLocation || 'Unknown',
      //   status: status,
      //   description: `Shipment status updated to ${status}`,
      //   scanType: this.getEventTypeFromStatus(status)
      // });

      return await this.getShipment(id);
    } catch (error) {
      console.error('Error updating shipment status:', error);
      throw new Error('Failed to update shipment status');
    }
  }

  // Shipment tracking operations - DISABLED (table doesn't exist)
  async getShipmentTrackingEvents(shipmentId: string): Promise<any[]> {
    try {
      // Return empty array since tracking events table doesn't exist
      console.log('Tracking events table not available, returning empty array');
      return [];
    } catch (error) {
      console.error('Error fetching tracking events:', error);
      return [];
    }
  }

  async createTrackingEvent(eventData: any): Promise<any> {
    try {
      // Return mock data since tracking events table doesn't exist
      console.log('Tracking events table not available, returning mock data');
      return {
        id: `mock-${Date.now()}`,
        ...eventData,
        timestamp: eventData.timestamp || new Date(),
      };
    } catch (error) {
      console.error('Error creating tracking event:', error);
      return null;
    }
  }

  async getLatestTrackingEvent(shipmentId: string): Promise<any> {
    try {
      // Return null since tracking events table doesn't exist
      console.log('Tracking events table not available, returning null');
      return null;
    } catch (error) {
      console.error('Error fetching latest tracking event:', error);
      return null;
    }
  }

  // Analytics and reporting
  async getShipmentAnalytics(): Promise<{
    totalShipments: number;
    pendingShipments: number;
    inTransitShipments: number;
    deliveredShipments: number;
    outForDeliveryShipments: number;
  }> {
    try {
      const results = await db
        .select({
          status: shipments.status,
          count: count()
        })
        .from(shipments)
        .groupBy(shipments.status);

      const analytics = {
        totalShipments: 0,
        pendingShipments: 0,
        inTransitShipments: 0,
        deliveredShipments: 0,
        outForDeliveryShipments: 0,
      };

      results.forEach(row => {
        analytics.totalShipments += row.count;
        
        switch (row.status) {
          case 'Pending':
            analytics.pendingShipments = row.count;
            break;
          case 'In Transit':
            analytics.inTransitShipments = row.count;
            break;
          case 'Delivered':
            analytics.deliveredShipments = row.count;
            break;
          case 'Out for Delivery':
            analytics.outForDeliveryShipments = row.count;
            break;
        }
      });

      return analytics;
    } catch (error) {
      console.error('Error fetching shipment analytics:', error);
      throw new Error('Failed to fetch shipment analytics');
    }
  }

  // Helper method to map status to event type
  private getEventTypeFromStatus(status: string): string {
    switch (status) {
      case 'Picked Up':
        return 'Pickup';
      case 'In Transit':
        return 'In Transit';
      case 'Out for Delivery':
        return 'Out for Delivery';
      case 'Delivered':
        return 'Delivered';
      case 'Delayed':
      case 'Lost':
      case 'Cancelled':
        return 'Exception';
      default:
        return 'In Transit';
    }
  }
}