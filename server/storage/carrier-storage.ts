import { 
  carriers, 
  shipments,
  type Carrier, 
  type InsertCarrier 
} from "@shared/schema";
import { db } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { BaseStorage } from './base.js';

export interface ICarrierStorage {
  getCarriers(): Promise<Carrier[]>;
  getCarrier(id: string): Promise<Carrier | undefined>;
  createCarrier(carrier: InsertCarrier): Promise<Carrier>;
  updateCarrier(id: string, carrier: Partial<InsertCarrier>): Promise<Carrier>;
  deleteCarrier(id: string): Promise<void>;
  getCarrierDetails(id: string): Promise<{
    carrier: Carrier;
    stats: {
      totalShipments: number;
      pendingShipments: number;
      deliveredShipments: number;
      inTransitShipments: number;
      onTimeDeliveryRate: number;
      averageDeliveryDays: number;
    };
    recentActivities: Array<{
      id: string;
      type: string;
      description: string;
      date: string;
      status?: string;
      amount?: string;
    }>;
  } | null>;
  getCarrierShipments(carrierId: string, page?: number, limit?: number): Promise<{
    shipments: Array<{
      id: string;
      shipmentNumber: string;
      trackingNumber: string;
      status: string;
      serviceType: string;
      priority: string;
      origin: string;
      destination: string;
      estimatedDelivery: string | null;
      actualDelivery: string | null;
      shippingCost: string | null;
    }>;
    total: number;
  }>;
  getCarrierPerformanceMetrics(carrierId: string): Promise<{
    deliveryPerformance: {
      onTimeDeliveries: number;
      totalDeliveries: number;
      onTimeRate: number;
      averageDelayDays: number;
    };
    serviceMetrics: {
      totalShipments: number;
      completedShipments: number;
      inProgressShipments: number;
      completionRate: number;
    };
    financialMetrics: {
      totalShippingCost: string;
      averageShippingCost: string;
      revenue: string;
    };
  }>;
}

export class CarrierStorage extends BaseStorage implements ICarrierStorage {
  async getCarriers(): Promise<Carrier[]> {
    return db
      .select()
      .from(carriers)
      .where(eq(carriers.isActive, true))
      .orderBy(desc(carriers.createdAt));
  }

  async getCarrier(id: string): Promise<Carrier | undefined> {
    const [carrier] = await db.select().from(carriers).where(eq(carriers.id, id));
    return carrier;
  }

  async createCarrier(carrierData: InsertCarrier): Promise<Carrier> {
    const [carrier] = await db.insert(carriers).values(carrierData).returning();
    return carrier;
  }

  async updateCarrier(id: string, carrierData: Partial<InsertCarrier>): Promise<Carrier> {
    const oldCarrier = await this.getCarrier(id);
    const [carrier] = await db.update(carriers).set({
      ...carrierData,
      updatedAt: new Date()
    }).where(eq(carriers.id, id)).returning();
    
    if (!carrier) {
      throw new Error("Carrier not found");
    }
    
    return carrier;
  }

  async deleteCarrier(id: string): Promise<void> {
    await db.update(carriers).set({
      isActive: false,
      updatedAt: new Date()
    }).where(eq(carriers.id, id));
  }

  async getCarrierDetails(id: string): Promise<{
    carrier: Carrier;
    stats: {
      totalShipments: number;
      pendingShipments: number;
      deliveredShipments: number;
      inTransitShipments: number;
      onTimeDeliveryRate: number;
      averageDeliveryDays: number;
    };
    recentActivities: Array<{
      id: string;
      type: string;
      description: string;
      date: string;
      status?: string;
      amount?: string;
    }>;
  } | null> {
    try {
      const carrier = await this.getCarrier(id);
      if (!carrier) {
        return null;
      }

      // Get shipment statistics
      const shipmentStats = await db
        .select({
          totalShipments: count(),
          pendingShipments: sql<number>`COUNT(CASE WHEN status IN ('Pending', 'Picked Up') THEN 1 END)`,
          deliveredShipments: sql<number>`COUNT(CASE WHEN status = 'Delivered' THEN 1 END)`,
          inTransitShipments: sql<number>`COUNT(CASE WHEN status IN ('In Transit', 'Out for Delivery') THEN 1 END)`,
        })
        .from(shipments)
        .where(eq(shipments.carrierId, id));

      // Calculate on-time delivery rate
      const deliveredShipmentsData = await db
        .select({
          estimatedDelivery: shipments.estimatedDelivery,
          actualDelivery: shipments.actualDelivery,
        })
        .from(shipments)
        .where(and(
          eq(shipments.carrierId, id),
          eq(shipments.status, 'Delivered'),
          sql`${shipments.estimatedDelivery} IS NOT NULL`,
          sql`${shipments.actualDelivery} IS NOT NULL`
        ));

      const onTimeDeliveries = deliveredShipmentsData.filter(s => {
        if (!s.estimatedDelivery || !s.actualDelivery) return false;
        return new Date(s.actualDelivery) <= new Date(s.estimatedDelivery);
      }).length;

      const onTimeDeliveryRate = deliveredShipmentsData.length > 0
        ? (onTimeDeliveries / deliveredShipmentsData.length) * 100
        : 0;

      // Calculate average delivery days
      const deliveryDays = deliveredShipmentsData.map(s => {
        if (!s.estimatedDelivery || !s.actualDelivery) return 0;
        const estimated = new Date(s.estimatedDelivery).getTime();
        const actual = new Date(s.actualDelivery).getTime();
        return Math.floor((actual - estimated) / (1000 * 60 * 60 * 24));
      });
      const averageDeliveryDays = deliveryDays.length > 0
        ? deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length
        : 0;

      // Get recent activities
      const recentShipments = await db
        .select({
          id: shipments.id,
          shipmentNumber: shipments.shipmentNumber,
          status: shipments.status,
          shippingCost: shipments.shippingCost,
          createdAt: shipments.createdAt,
        })
        .from(shipments)
        .where(eq(shipments.carrierId, id))
        .orderBy(desc(shipments.createdAt))
        .limit(10);

      const activities = recentShipments.map(shipment => ({
        id: shipment.id,
        type: 'Shipment',
        description: `Shipment ${shipment.shipmentNumber} created`,
        date: shipment.createdAt ? new Date(shipment.createdAt).toISOString() : '',
        status: shipment.status || undefined,
        amount: shipment.shippingCost?.toString(),
      }));

      return {
        carrier,
        stats: {
          totalShipments: shipmentStats[0]?.totalShipments || 0,
          pendingShipments: shipmentStats[0]?.pendingShipments || 0,
          deliveredShipments: shipmentStats[0]?.deliveredShipments || 0,
          inTransitShipments: shipmentStats[0]?.inTransitShipments || 0,
          onTimeDeliveryRate,
          averageDeliveryDays,
        },
        recentActivities: activities,
      };
    } catch (error) {
      console.error('Error in getCarrierDetails:', error);
      return null;
    }
  }

  async getCarrierShipments(carrierId: string, page = 1, limit = 20): Promise<{
    shipments: Array<{
      id: string;
      shipmentNumber: string;
      trackingNumber: string;
      status: string;
      serviceType: string;
      priority: string;
      origin: string;
      destination: string;
      estimatedDelivery: string | null;
      actualDelivery: string | null;
      shippingCost: string | null;
    }>;
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const carrierShipments = await db
      .select({
        id: shipments.id,
        shipmentNumber: shipments.shipmentNumber,
        trackingNumber: shipments.trackingNumber,
        status: shipments.status,
        serviceType: shipments.serviceType,
        priority: shipments.priority,
        origin: shipments.origin,
        destination: shipments.destination,
        estimatedDelivery: shipments.estimatedDelivery,
        actualDelivery: shipments.actualDelivery,
        shippingCost: shipments.shippingCost,
      })
      .from(shipments)
      .where(eq(shipments.carrierId, carrierId))
      .orderBy(desc(shipments.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: count() })
      .from(shipments)
      .where(eq(shipments.carrierId, carrierId));

    return {
      shipments: carrierShipments.map(shipment => ({
        ...shipment,
        estimatedDelivery: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString() : null,
        actualDelivery: shipment.actualDelivery ? new Date(shipment.actualDelivery).toISOString() : null,
        shippingCost: shipment.shippingCost?.toString() || null,
        status: shipment.status || '',
        serviceType: shipment.serviceType || '',
        priority: shipment.priority || '',
      })),
      total: totalResult[0]?.count || 0,
    };
  }

  async getCarrierPerformanceMetrics(carrierId: string): Promise<{
    deliveryPerformance: {
      onTimeDeliveries: number;
      totalDeliveries: number;
      onTimeRate: number;
      averageDelayDays: number;
    };
    serviceMetrics: {
      totalShipments: number;
      completedShipments: number;
      inProgressShipments: number;
      completionRate: number;
    };
    financialMetrics: {
      totalShippingCost: string;
      averageShippingCost: string;
      revenue: string;
    };
  }> {
    try {
      // Delivery Performance
      const deliveredShipments = await db
        .select({
          estimatedDelivery: shipments.estimatedDelivery,
          actualDelivery: shipments.actualDelivery,
        })
        .from(shipments)
        .where(and(
          eq(shipments.carrierId, carrierId),
          eq(shipments.status, 'Delivered'),
          sql`${shipments.estimatedDelivery} IS NOT NULL`,
          sql`${shipments.actualDelivery} IS NOT NULL`
        ));

      const onTimeDeliveries = deliveredShipments.filter(s => {
        if (!s.estimatedDelivery || !s.actualDelivery) return false;
        return new Date(s.actualDelivery) <= new Date(s.estimatedDelivery);
      }).length;

      const deliveryDays = deliveredShipments.map(s => {
        if (!s.estimatedDelivery || !s.actualDelivery) return 0;
        const estimated = new Date(s.estimatedDelivery).getTime();
        const actual = new Date(s.actualDelivery).getTime();
        return Math.floor((actual - estimated) / (1000 * 60 * 60 * 24));
      });
      const averageDelayDays = deliveryDays.length > 0
        ? deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length
        : 0;

      // Service Metrics
      const serviceStats = await db
        .select({
          totalShipments: count(),
          completedShipments: sql<number>`COUNT(CASE WHEN status = 'Delivered' THEN 1 END)`,
          inProgressShipments: sql<number>`COUNT(CASE WHEN status IN ('In Transit', 'Out for Delivery', 'Picked Up') THEN 1 END)`,
        })
        .from(shipments)
        .where(eq(shipments.carrierId, carrierId));

      // Financial Metrics
      const financialStats = await db
        .select({
          totalShippingCost: sum(shipments.shippingCost),
          avgShippingCost: sql<number>`AVG(${shipments.shippingCost})`,
        })
        .from(shipments)
        .where(eq(shipments.carrierId, carrierId));

      const service = serviceStats[0] || { totalShipments: 0, completedShipments: 0, inProgressShipments: 0 };
      const financial = financialStats[0] || { totalShippingCost: null, avgShippingCost: 0 };

      return {
        deliveryPerformance: {
          onTimeDeliveries,
          totalDeliveries: deliveredShipments.length,
          onTimeRate: deliveredShipments.length > 0 ? (onTimeDeliveries / deliveredShipments.length) * 100 : 0,
          averageDelayDays,
        },
        serviceMetrics: {
          totalShipments: service.totalShipments,
          completedShipments: service.completedShipments,
          inProgressShipments: service.inProgressShipments,
          completionRate: service.totalShipments > 0 ? (service.completedShipments / service.totalShipments) * 100 : 0,
        },
        financialMetrics: {
          totalShippingCost: financial.totalShippingCost?.toString() || '0',
          averageShippingCost: financial.avgShippingCost?.toString() || '0',
          revenue: financial.totalShippingCost?.toString() || '0',
        },
      };
    } catch (error) {
      console.error('Error in getCarrierPerformanceMetrics:', error);
      return {
        deliveryPerformance: {
          onTimeDeliveries: 0,
          totalDeliveries: 0,
          onTimeRate: 0,
          averageDelayDays: 0,
        },
        serviceMetrics: {
          totalShipments: 0,
          completedShipments: 0,
          inProgressShipments: 0,
          completionRate: 0,
        },
        financialMetrics: {
          totalShippingCost: '0',
          averageShippingCost: '0',
          revenue: '0',
        },
      };
    }
  }
}

