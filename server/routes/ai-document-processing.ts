import { Express } from 'express';
import { aiDocumentProcessingService, ExtractedDocumentData } from '../services/ai-document-processing';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

export function registerAIDocumentProcessingRoutes(app: Express) {
  // Process Material Receipt document
  app.post('/api/ai-document-processing/extract-receipt', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('Processing Material Receipt document:', req.file.originalname);
      
      const extractedData = await aiDocumentProcessingService.processDocument(
        req.file.buffer,
        req.file.originalname,
        'receipt'
      );

      res.json({
        success: true,
        data: extractedData,
        message: 'Document processed successfully'
      });
    } catch (error) {
      console.error('Error processing receipt document:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process document'
      });
    }
  });

  // Process Receipt Return document
  app.post('/api/ai-document-processing/extract-receipt-return', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('Processing Receipt Return document:', req.file.originalname);
      
      const extractedData = await aiDocumentProcessingService.processDocument(
        req.file.buffer,
        req.file.originalname,
        'return'
      );

      res.json({
        success: true,
        data: extractedData,
        message: 'Document processed successfully'
      });
    } catch (error) {
      console.error('Error processing receipt return document:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process document'
      });
    }
  });

  // Process Material Issue document
  app.post('/api/ai-document-processing/extract-material-issue', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('Processing Material Issue document:', req.file.originalname);
      
      const extractedData = await aiDocumentProcessingService.processDocument(
        req.file.buffer,
        req.file.originalname,
        'issue'
      );

      res.json({
        success: true,
        data: extractedData,
        message: 'Document processed successfully'
      });
    } catch (error) {
      console.error('Error processing material issue document:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process document'
      });
    }
  });

  // Process Issue Return document
  app.post('/api/ai-document-processing/extract-issue-return', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('Processing Issue Return document:', req.file.originalname);
      
      const extractedData = await aiDocumentProcessingService.processDocument(
        req.file.buffer,
        req.file.originalname,
        'issue-return'
      );

      res.json({
        success: true,
        data: extractedData,
        message: 'Document processed successfully'
      });
    } catch (error) {
      console.error('Error processing issue return document:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process document'
      });
    }
  });

  // Generic document processing endpoint
  app.post('/api/ai-document-processing/extract/:documentType', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { documentType } = req.params;
      
      if (!['receipt', 'return', 'issue', 'issue-return'].includes(documentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document type. Must be one of: receipt, return, issue, issue-return'
        });
      }

      console.log(`Processing ${documentType} document:`, req.file.originalname);
      
      const extractedData = await aiDocumentProcessingService.processDocument(
        req.file.buffer,
        req.file.originalname,
        documentType as 'receipt' | 'return' | 'issue' | 'issue-return'
      );

      res.json({
        success: true,
        data: extractedData,
        message: 'Document processed successfully'
      });
    } catch (error) {
      console.error(`Error processing ${req.params.documentType} document:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process document'
      });
    }
  });

  // Health check endpoint
  app.get('/api/ai-document-processing/health', (req, res) => {
    res.json({
      success: true,
      message: 'AI Document Processing service is running',
      timestamp: new Date().toISOString()
    });
  });
}
