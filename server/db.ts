import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

console.log("DATABASE_URL from env:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);

// Require DATABASE_URL to be set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. Please set your PostgreSQL connection string.');
}

let pool: Pool | null = null;
let db: any = null;

try {
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 10, // Reduced for serverless compatibility
    min: 0, // Don't keep connections alive (Neon is serverless)
    idleTimeoutMillis: 30000, // 30 seconds - shorter for serverless
    connectionTimeoutMillis: 10000, // 10 seconds connection timeout
    statement_timeout: 60000, // 1 minute for queries
    query_timeout: 60000, // 1 minute query timeout
    keepAlive: true,
    keepAliveInitialDelayMillis: 0, // No initial delay for serverless
    allowExitOnIdle: true, // Allow pool to close on idle for serverless
    ssl: {
      rejectUnauthorized: false // Required for Neon and other cloud providers
    }
  });

  // Add error handling for the pool with better error management
  pool.on('error', (err: any) => {
    // Don't log expected serverless connection terminations
    if (err.code !== '57P01') {
      console.error('Database pool error:', err.code || err.message);
    }
    // For 57P01 errors, Neon is just closing idle connections - this is normal
  });

  // Only log important connection events
  if (process.env.LOG_DB_CONNECTIONS === 'true') {
    pool.on('connect', () => {
      console.log('Database connection established');
    });

    pool.on('acquire', () => {
      console.log('Database connection acquired from pool');
    });

    pool.on('remove', () => {
      console.log('Database connection removed from pool');
    });
  }

  // Add connection health check with retry logic
  const checkConnectionHealth = async () => {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
          client.release();
          return true;
        } catch (error) {
          client.release();
          throw error;
        }
      } catch (error: any) {
        // Ignore expected serverless connection terminations
        if (error.code === '57P01') {
          // Wait and retry on next iteration
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        if (attempt === maxRetries) {
          console.error('Database health check failed after all retries:', error?.message || error);
          return false;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return false;
  };

  // Export health check function
  (global as any).checkDatabaseHealth = checkConnectionHealth;

  // Helper function to execute queries with automatic retry on transient errors
  const withRetry = async <T>(
    queryFn: () => Promise<T>, 
    maxRetries: number = 3, 
    retryDelay: number = 1000
  ): Promise<T> => {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn();
      } catch (error: any) {
        lastError = error;
        // Retry on transient connection errors
        if (error?.code === '57P01' || error?.code === '08P01' || error?.code === '08S01') {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
        }
        // Don't retry on other errors
        throw error;
      }
    }
    throw lastError;
  };

  // Export the retry wrapper
  (global as any).dbWithRetry = withRetry;

  db = drizzle({ client: pool, schema });
  console.log('[DB] Using PostgreSQL database');
} catch (error) {
  console.error('[DB] PostgreSQL connection failed:', error);
  console.error('[DB] This might be due to network issues or database unavailability.');
  console.error('[DB] Please check your internet connection and database URL.');
  throw new Error('Failed to connect to PostgreSQL database. Please check your DATABASE_URL and network connection.');
}

export { db as drizzleDb };
export { db };

// Export pool for backward compatibility
export { pool };

// Export pool for session store
export const sessionPool = pool;