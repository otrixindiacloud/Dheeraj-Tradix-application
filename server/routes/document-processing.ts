import { Router } from 'express';
import multer from 'multer';
import { documentProcessingService } from '../services/document-processing';

const router = Router();

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
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// GET /api/document-processing/test
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Document processing service is running',
    timestamp: new Date().toISOString()
  });
});

// POST /api/document-processing/extract-receipt
router.post('/extract-receipt', upload.single('document'), async (req, res) => {
  try {
    console.log('=== RECEIPT PROCESSING REQUEST START ===');
    console.log('Request headers:', req.headers);
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ 
        success: false, 
        message: 'No document uploaded' 
      });
    }

    console.log(`Processing receipt: ${req.file.originalname}, size: ${req.file.size} bytes`);
    console.log('File buffer length:', req.file.buffer.length);
    
    const extractedData = await documentProcessingService.processReceiptDocument(
      req.file.buffer,
      req.file.originalname
    );

    console.log('Successfully processed receipt:', {
      filename: req.file.originalname,
      receiptNumber: extractedData.receiptNumber,
      invoiceNumber: extractedData.invoiceNumber,
      itemsCount: extractedData.items?.length || 0
    });

    res.json({
      success: true,
      data: extractedData
    });
    console.log('=== RECEIPT PROCESSING REQUEST END ===');
  } catch (error) {
    console.error('=== RECEIPT PROCESSING ERROR ===');
    console.error('Error processing receipt document:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      cause: error instanceof Error ? error.cause : undefined
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to process document',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
    console.log('=== RECEIPT PROCESSING ERROR END ===');
  }
});

// POST /api/document-processing/extract-return
router.post('/extract-return', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }

    const extractedData = await documentProcessingService.processReceiptDocument(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      data: extractedData
    });
  } catch (error) {
    console.error('Error processing return document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/document-processing/extract-delivery
router.post('/extract-delivery', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }

    const extractedData = await documentProcessingService.processDeliveryDocument(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      data: extractedData
    });
  } catch (error) {
    console.error('Error processing delivery document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/document-processing/extract-purchase-invoice
router.post('/extract-purchase-invoice', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }

    console.log(`Processing purchase invoice: ${req.file.originalname}, size: ${req.file.size} bytes`);
    
    const extractedData = await documentProcessingService.processReceiptDocument(
      req.file.buffer,
      req.file.originalname
    );

    console.log('Successfully processed purchase invoice:', {
      filename: req.file.originalname,
      invoiceNumber: extractedData.invoiceNumber,
      itemsCount: extractedData.items?.length || 0
    });

    res.json({
      success: true,
      data: extractedData
    });
  } catch (error) {
    console.error('Error processing purchase invoice document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process document',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router;
