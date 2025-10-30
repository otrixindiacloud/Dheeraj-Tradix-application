import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { resolveUserId } from './middleware/user-resolution.js';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users } from "../shared/schemas/users-customers";
import { eq } from "drizzle-orm";
import bcrypt from 'bcryptjs';


const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use((req, res, next) => {
  console.log(`[DEBUG][REQ] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Attach resolved user id early
app.use(resolveUserId);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Wait for storage to be ready before starting
  const { storageReady } = await import('./storage');
  await storageReady;
  
  const server = await registerRoutes(app);

  // Ensure required admin users exist (idempotent upsert-like behavior)
  try {
    const adminPass = process.env.INIT_ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 10);
    const requiredAdmins = [
      { username: 'admin', email: 'admin@example.com' },
      { username: 'testadmin', email: 'testadmin@example.com' }
    ];
    for (const adm of requiredAdmins) {
      const existing = await db.select().from(users).where(eq(users.username, adm.username)).limit(1);
      if (!existing.length) {
        await db.insert(users).values({ 
          username: adm.username, 
          role: 'admin', 
          passwordHash: hash, 
          email: adm.email,
          firstName: adm.username === 'admin' ? 'Admin' : 'Test Admin',
          lastName: 'User',
          name: adm.username === 'admin' ? 'Admin User' : 'Test Admin User'
        });
        log(`Seeded missing admin user '${adm.username}'.`);
      }
    }

    // Ensure system user exists (required for quotation creation)
    const { SYSTEM_USER_ID } = await import('@shared/utils/uuid');
    const systemUserExists = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID)).limit(1);
    if (!systemUserExists.length) {
      await db.insert(users).values({ 
        id: SYSTEM_USER_ID,
        username: 'system', 
        role: 'system', 
        email: 'system@tradix.com',
        firstName: 'System',
        lastName: 'User',
        name: 'System User', // Add the required name field
        isActive: true
      });
      log(`Seeded system user with ID: ${SYSTEM_USER_ID}`);
    }
  } catch (e) {
    console.error('Admin seed error', e);
  }

  // Ensure system user exists (required for quotation creation)
  try {
    const { SYSTEM_USER_ID } = await import('@shared/utils/uuid');
    const systemUserExists = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID)).limit(1);
    if (!systemUserExists.length) {
      await db.insert(users).values({ 
        id: SYSTEM_USER_ID,
        username: 'system', 
        role: 'system', 
        email: 'system@tradix.com',
        firstName: 'System',
        lastName: 'User',
        name: 'System User',
        passwordHash: await bcrypt.hash('system', 10),
        isActive: true
      });
      log(`Seeded system user with ID: ${SYSTEM_USER_ID}`);
    }
  } catch (e) {
    console.error('System user seed error', e);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "localhost", () => {
    // Lazy import dynamic storage (may still be initializing); log constructor when available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const storageModule = require('./storage');
      const activeStorage = storageModule.storage;
      const ctorName = activeStorage ? activeStorage.constructor?.name : 'undefined';
      log(`serving on port ${port} (storage=${ctorName})`);
    } catch (e) {
      log(`serving on port ${port} (storage=load-error)`);
    }
  });
})();
