import type { Express } from "express";
import { registerReceiptRoutes } from "./receipts";

export function registerReceiptsRoutes(app: Express) {
  registerReceiptRoutes(app);
}
