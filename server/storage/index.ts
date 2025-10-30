export * from './interfaces.ts';
export * from './base.ts';
export * from './user-storage.ts';
export * from './customer-storage.ts';
export * from './supplier-storage.ts';
export * from './item-storage.ts';
export * from './inventory-storage.ts';
export * from './enquiry-storage.ts';
export * from './requisition-storage.ts';
export * from './audit-storage.ts';
export * from './quotation-storage.ts';
export * from './sales-order-storage.ts';
export * from './delivery-storage.ts';
export * from './shipment-storage.ts';
export * from './physical-stock-storage.ts';
export * from './invoice-storage.ts';
export * from './modular-storage-clean.ts';
export * from './supplier-quote-storage.ts';

// Provide a unified storage instance (modular) for all route imports.
// This ensures patched module implementations (e.g., GoodsReceiptStorage) are actually used.
import { ModularStorage } from './modular-storage-clean.ts';
export const storage = new ModularStorage() as any;
