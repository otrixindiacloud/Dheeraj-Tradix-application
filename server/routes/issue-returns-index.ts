import type { Express } from "express";
import issueReturnsRoutes from "./issue-returns";

export function registerIssueReturnsRoutes(app: Express) {
  app.use("/api/issue-returns", issueReturnsRoutes);
}
