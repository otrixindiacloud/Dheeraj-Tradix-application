import { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

// In-memory storage for export jobs (in production, use Redis or database)
const exportJobs = new Map<string, {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  error?: string;
}>();

// Export job schema
const exportJobSchema = z.object({
  types: z.array(z.string()),
  format: z.enum(['csv', 'excel', 'json', 'xml']),
  dateRange: z.union([
    z.string(),
    z.object({
      from: z.string(),
      to: z.string()
    })
  ]),
  includeArchived: z.boolean().optional()
});

// Helper function to convert data to CSV
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

// Helper function to convert data to JSON
function convertToJSON(data: any[]): string {
  return JSON.stringify(data, null, 2);
}

// Helper function to get date filter
function getDateFilter(dateRange: any) {
  if (typeof dateRange === 'string') {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      case '30d':
        return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      case '90d':
        return { from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      default:
        return {};
    }
  } else if (dateRange && typeof dateRange === 'object') {
    return {
      from: dateRange.from ? new Date(dateRange.from) : undefined,
      to: dateRange.to ? new Date(dateRange.to) : undefined
    };
  }
  return {};
}

// Export data function with proper timeout handling and retry logic
async function exportData(type: string, format: string, dateFilter: any, includeArchived: boolean = false): Promise<any[]> {
  const timeout = 300000; // 5 minutes timeout for export operations
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let data: any[] = [];
      
      // Set up timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timeout')), timeout);
      });
      
      // Set up data fetching promise with connection validation
      const dataPromise = (async () => {
        // First, validate database connection with retry
        let connectionValid = false;
        let connectionAttempts = 0;
        const maxConnectionAttempts = 3;
        
        while (!connectionValid && connectionAttempts < maxConnectionAttempts) {
          try {
            await db.execute('SELECT 1 as test');
            connectionValid = true;
          } catch (connError) {
            connectionAttempts++;
            if (connectionAttempts >= maxConnectionAttempts) {
              throw new Error(`Database connection failed after ${maxConnectionAttempts} attempts: ${connError instanceof Error ? connError.message : 'Unknown connection error'}`);
            }
            // Wait before retrying connection
            await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
          }
        }

        // Add pagination to prevent memory issues with large datasets
        const limit = 1000;
        let offset = 0;
        let allData: any[] = [];
        let hasMoreData = true;

        while (hasMoreData) {
          let batchData: any[] = [];
          
          switch (type) {
            case 'enquiries':
              batchData = await storage.getEnquiries(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'quotations':
              batchData = await storage.getQuotations(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'sales_orders':
              batchData = await storage.getSalesOrders(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'invoices':
              batchData = await storage.getInvoices(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'customers':
              batchData = await storage.getCustomers(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'suppliers':
              batchData = await storage.getSuppliers(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'inventory':
              batchData = await storage.getItems(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'audit_logs':
              batchData = await storage.getAuditLogs(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'users':
              batchData = await storage.getUsers(limit, offset, { 
                ...dateFilter,
                includeArchived 
              });
              break;
            case 'all':
              // Export all data types with pagination
              const allBatchData = await Promise.all([
                storage.getEnquiries(limit, offset, { ...dateFilter, includeArchived }),
                storage.getQuotations(limit, offset, { ...dateFilter, includeArchived }),
                storage.getSalesOrders(limit, offset, { ...dateFilter, includeArchived }),
                storage.getInvoices(limit, offset, { ...dateFilter, includeArchived }),
                storage.getCustomers(limit, offset, { ...dateFilter, includeArchived }),
                storage.getSuppliers(limit, offset, { ...dateFilter, includeArchived }),
                storage.getItems(limit, offset, { ...dateFilter, includeArchived }),
                storage.getUsers(limit, offset, { ...dateFilter, includeArchived })
              ]);
              
              batchData = allBatchData.flat();
              break;
            default:
              throw new Error(`Unknown export type: ${type}`);
          }
          
          allData.push(...batchData);
          
          // Check if we got less data than requested, meaning we've reached the end
          hasMoreData = batchData.length === limit;
          offset += limit;
          
          // Add a small delay between batches to prevent overwhelming the database
          if (hasMoreData) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        return allData;
      })();
    
      // Race between timeout and data fetching
      data = await Promise.race([dataPromise, timeoutPromise]) as any[];
      
      const duration = Date.now() - startTime;
      console.log(`Export completed for ${type} in ${duration}ms, ${data.length} records`);
      
      return data;
    } catch (error) {
      console.error(`Export attempt ${attempt} failed for ${type}:`, error);
      
      if (attempt === maxRetries) {
        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            throw new Error(`Database connection timeout: The export operation took too long to complete. Please try again or contact support if the issue persists.`);
          } else if (error.message.includes('connection')) {
            throw new Error(`Database connection failed: Unable to connect to the database. Please check your network connection and try again.`);
          } else {
            throw new Error(`Export failed: ${error.message}`);
          }
        }
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`Retrying export for ${type} (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms delay`);
    }
  }
  
  throw new Error(`Export failed for ${type} after ${maxRetries} attempts`);
}

export function registerExportRoutes(app: Express) {
  console.log("[EXPORT ROUTES] Registering export routes...");

  // Database health check endpoint
  app.get("/api/export/health", async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      
      // Test database connection with a simple query
      const result = await db.execute('SELECT 1 as test');
      const responseTime = Date.now() - startTime;
      
      res.json({
        status: 'healthy',
        database: 'connected',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database health check failed:", error);
      res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Start export job
  app.post("/api/export/start", async (req: Request, res: Response) => {
    try {
      const exportJobData = exportJobSchema.parse(req.body);
      const jobId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create job record
      const job = {
        id: jobId,
        type: exportJobData.types.join(','),
        status: 'pending' as const,
        progress: 0,
        createdAt: new Date().toISOString()
      };
      
      exportJobs.set(jobId, job);
      
      // Process export asynchronously
      setImmediate(async () => {
        try {
          exportJobs.set(jobId, { ...job, status: 'processing', progress: 10 });
          
          const dateFilter = getDateFilter(exportJobData.dateRange);
          const results: any[] = [];
          
          for (let i = 0; i < exportJobData.types.length; i++) {
            const type = exportJobData.types[i];
            const progress = 10 + (i / exportJobData.types.length) * 80;
            
            try {
              const data = await exportData(type, exportJobData.format, dateFilter, exportJobData.includeArchived);
              results.push(...data);
              
              exportJobs.set(jobId, { 
                ...exportJobs.get(jobId)!, 
                progress: Math.round(progress) 
              });
            } catch (error) {
              console.error(`Failed to export ${type}:`, error);
              // Continue with other types
            }
          }
          
          // Generate file
          const timestamp = new Date().toISOString().split('T')[0];
          const filename = `export_${timestamp}_${jobId}.${exportJobData.format}`;
          const filepath = path.join(process.cwd(), 'uploads', filename);
          
          // Ensure uploads directory exists
          const uploadsDir = path.dirname(filepath);
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          let fileContent: string;
          switch (exportJobData.format) {
            case 'csv':
              fileContent = convertToCSV(results);
              break;
            case 'json':
              fileContent = convertToJSON(results);
              break;
            case 'excel':
            case 'xml':
              // For now, fallback to CSV
              fileContent = convertToCSV(results);
              break;
            default:
              fileContent = convertToCSV(results);
          }
          
          fs.writeFileSync(filepath, fileContent);
          
          // Update job as completed
          exportJobs.set(jobId, {
            ...exportJobs.get(jobId)!,
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
            downloadUrl: `/api/export/download/${filename}`
          });
          
        } catch (error) {
          console.error(`Export job ${jobId} failed:`, error);
          
          // Provide more detailed error information
          let errorMessage = 'Unknown error';
          if (error instanceof Error) {
            if (error.message.includes('timeout')) {
              errorMessage = 'Database connection timeout: The export operation took too long to complete. Please try again or contact support if the issue persists.';
            } else if (error.message.includes('connection')) {
              errorMessage = 'Database connection failed: Unable to connect to the database. Please check your network connection and try again.';
            } else if (error.message.includes('permission')) {
              errorMessage = 'Permission denied: You do not have sufficient permissions to export this data.';
            } else {
              errorMessage = `Export failed: ${error.message}`;
            }
          }
          
          exportJobs.set(jobId, {
            ...exportJobs.get(jobId)!,
            status: 'failed',
            error: errorMessage,
            completedAt: new Date().toISOString()
          });
        }
      });
      
      res.json({
        success: true,
        jobId,
        message: 'Export job started successfully'
      });
      
    } catch (error) {
      console.error("Error starting export job:", error);
      res.status(500).json({ 
        message: "Failed to start export job",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get export jobs
  app.get("/api/export/jobs", async (req: Request, res: Response) => {
    try {
      const jobs = Array.from(exportJobs.values()).map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        downloadUrl: job.downloadUrl,
        error: job.error
      }));
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching export jobs:", error);
      res.status(500).json({ 
        message: "Failed to fetch export jobs",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Download export file
  app.get("/api/export/download/:filename", async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: "Export file not found" });
      }
      
      res.download(filepath, filename, (err) => {
        if (err) {
          console.error("Error downloading file:", err);
          res.status(500).json({ message: "Failed to download file" });
        }
      });
      
    } catch (error) {
      console.error("Error downloading export file:", error);
      res.status(500).json({ 
        message: "Failed to download export file",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get export job status
  app.get("/api/export/jobs/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      const job = exportJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      
      res.json({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        downloadUrl: job.downloadUrl,
        error: job.error
      });
      
    } catch (error) {
      console.error("Error fetching export job:", error);
      res.status(500).json({ 
        message: "Failed to fetch export job",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Cancel export job
  app.delete("/api/export/jobs/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      const job = exportJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      
      if (job.status === 'completed' || job.status === 'failed') {
        return res.status(400).json({ message: "Cannot cancel completed or failed job" });
      }
      
      exportJobs.set(jobId, { ...job, status: 'failed', error: 'Cancelled by user' });
      
      res.json({ message: "Export job cancelled successfully" });
      
    } catch (error) {
      console.error("Error cancelling export job:", error);
      res.status(500).json({ 
        message: "Failed to cancel export job",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
