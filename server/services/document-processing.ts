import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface ExtractedReceiptData {
  // Header information
  receiptNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  receiptDate?: string;
  supplierName?: string;
  supplierId?: string;
  supplierLpoId?: string;
  receivedBy?: string;
  status?: string;
  paymentTerms?: string;
  dueDate?: string;
  supplierAddress?: string;
  supplierContactPerson?: string;
  notes?: string;
  
  // Items information
  items: ExtractedItemData[];
}

export interface ExtractedItemData {
  id: string;
  serialNo: number;
  itemDescription: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
  vatPercent: number;
  vatAmount: number;
  // Legacy fields for compatibility
  itemName?: string;
  description?: string;
  unitPrice?: number;
  totalPrice?: number;
  receivedQuantity?: number;
}

export interface ExtractedDeliveryData {
  // Header information
  deliveryNumber?: string;
  deliveryDate?: string;
  customerName?: string;
  customerId?: string;
  supplierName?: string;
  supplierId?: string;
  status?: string;
  notes?: string;
  
  // Items information
  items: ExtractedItemData[];
}

export class DocumentProcessingService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }

  async processReceiptDocument(file: Buffer, filename: string): Promise<ExtractedReceiptData> {
    let filePath: string | null = null;
    
    try {
      console.log(`Processing document: ${filename}, size: ${file.length} bytes`);
      
      // Validate file
      if (!file || file.length === 0) {
        throw new Error('No file data received');
      }
      
      if (!filename || !filename.toLowerCase().endsWith('.pdf')) {
        throw new Error('Only PDF files are supported');
      }
      
      // Check if upload directory exists
      try {
        await fs.access(this.uploadDir);
      } catch (error) {
        console.log('Upload directory does not exist, creating it...');
        await fs.mkdir(this.uploadDir, { recursive: true });
        console.log('Upload directory created successfully');
      }
      
      // Save the uploaded file
      const fileId = randomUUID();
      const fileExtension = path.extname(filename);
      const savedFilename = `${fileId}${fileExtension}`;
      filePath = path.join(this.uploadDir, savedFilename);
      
      console.log(`Saving file to: ${filePath}`);
      await fs.writeFile(filePath, file);
      console.log(`File saved successfully`);
      
      // Extract text from PDF
      console.log('Starting PDF text extraction...');
      const extractedText = await this.extractTextFromPDF(filePath);
      console.log('Extracted text length:', extractedText.length);
      
      // Parse the extracted text to extract structured data
      console.log('Starting text parsing...');
      const extractedData = this.parseReceiptText(extractedText, filename);
      console.log('Parsed data:', JSON.stringify(extractedData, null, 2));
      
      return extractedData;
    } catch (error) {
      console.error('Error processing document:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        filename,
        fileSize: file.length,
        filePath
      });
      
      // Provide more user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('pdf-parse')) {
          throw new Error('PDF processing library not available. Please contact administrator.');
        } else if (error.message.includes('empty') || error.message.includes('corrupted')) {
          throw new Error('PDF file is empty or corrupted. Please try a different file.');
        } else if (error.message.includes('image-based')) {
          throw new Error('This PDF appears to be image-based and cannot be processed. Please use a text-based PDF.');
        } else if (error.message.includes('No file data')) {
          throw new Error('No file data received. Please try uploading again.');
        } else if (error.message.includes('Only PDF files')) {
          throw new Error('Only PDF files are supported. Please upload a .pdf file.');
        } else {
          throw new Error(`Failed to process PDF: ${error.message}`);
        }
      }
      
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clean up the temporary file
      if (filePath) {
        try {
          await fs.unlink(filePath);
          console.log('Temporary file cleaned up');
        } catch (error) {
          console.warn('Error cleaning up temporary file:', error);
        }
      }
    }
  }

  private async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      console.log(`Extracting text from PDF: ${filePath}`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`PDF file not found at path: ${filePath}`);
      }
      
      // Read the PDF file
      const pdfBuffer = await fs.readFile(filePath);
      console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);
      
      if (pdfBuffer.length === 0) {
        throw new Error('PDF file is empty');
      }
      
      // Use pdfjs-dist for reliable PDF text extraction
      console.log('Starting PDF parsing with pdfjs-dist...');
      
      try {
        // Import pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        console.log('pdfjs-dist imported successfully');
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBuffer,
          useSystemFonts: true,
          standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
        });
        
        const pdfDocument = await loadingTask.promise;
        console.log(`PDF loaded successfully. Pages: ${pdfDocument.numPages}`);
        
        let extractedText = '';
        
        // Extract text from each page
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
          console.log(`Processing page ${pageNum}...`);
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine all text items from the page
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText) {
            extractedText += pageText + '\n';
            console.log(`Page ${pageNum} text length: ${pageText.length} characters`);
          }
        }
        
        console.log(`Total extracted text length: ${extractedText.length} characters`);
        
        // Log first 2000 characters for debugging
        if (extractedText.length > 0) {
          console.log('First 2000 characters of extracted text:');
          console.log(extractedText.substring(0, 2000));
        }
        
        // Check if we got meaningful text
        if (extractedText.length < 10) {
          throw new Error('PDF appears to be empty or contains very little text. The PDF might be image-based or corrupted.');
        }
        
        return extractedText;
        
      } catch (pdfError) {
        console.error('Error with pdfjs-dist:', pdfError);
        
        // Fallback: Try simple text extraction from PDF buffer
        console.log('Trying fallback text extraction...');
        const fallbackText = this.extractTextFromPDFBuffer(pdfBuffer);
        
        if (fallbackText && fallbackText.length > 10) {
          console.log(`Fallback extraction successful: ${fallbackText.length} characters`);
          return fallbackText;
        }
        
        throw new Error(`PDF parsing failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
      }
      
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('pdfjs-dist')) {
          throw new Error('PDF parsing library not available. Please contact administrator.');
        } else if (error.message.includes('empty')) {
          throw new Error('PDF file is empty or corrupted. Please try a different file.');
        } else if (error.message.includes('not found')) {
          throw new Error('PDF file not found. Please try uploading again.');
        } else {
          throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
      }
      
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private extractTextFromPDFBuffer(buffer: Buffer): string {
    try {
      // Simple text extraction from PDF buffer
      // This is a basic approach that looks for text patterns
      const bufferString = buffer.toString('latin1');
      
      // Look for common text patterns in PDFs
      const textPatterns = [
        /\(([^)]+)\)/g,  // Text in parentheses
        /\[([^\]]+)\]/g,  // Text in brackets
        /<([^>]+)>/g,     // Text in angle brackets
      ];
      
      let extractedText = '';
      for (const pattern of textPatterns) {
        const matches = bufferString.match(pattern);
        if (matches) {
          extractedText += matches.join(' ');
        }
      }
      
      // Clean up the text
      extractedText = extractedText
        .replace(/[^\w\s\-.,:;!?@#$%&*()+=]/g, ' ') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      return extractedText;
    } catch (error) {
      console.error('Error in fallback text extraction:', error);
      return '';
    }
  }

  private parseReceiptText(text: string, filename?: string): ExtractedReceiptData {
    console.log('Parsing extracted text...');
    console.log('Text length:', text.length);
    console.log('First 1000 characters:', text.substring(0, 1000));
    
    // Clean and normalize the text for better parsing
    const cleanedText = text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Handle old Mac line endings
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
    
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const extractedData: ExtractedReceiptData = {
      items: []
    };

    // Extract receipt number from filename as fallback
    let filenameReceiptNumber = '';
    if (filename) {
      // Try to extract receipt number from filename patterns like "goods-receipt-GR-20251008-N1A5M.pdf"
      const filenameMatch = filename.match(/([A-Z]{2,}-\d{4,}-[A-Z0-9]+)/i);
      if (filenameMatch) {
        filenameReceiptNumber = filenameMatch[1];
        console.log('Found receipt number in filename:', filenameReceiptNumber);
      }
    }

    const parseNumber = (value: string): number => {
      const cleaned = value
        .replace(/[,\s]/g, '') // remove thousand separators and spaces
        .replace(/[A-Za-z%$€£₹]/g, '') // remove currency and percent symbols/letters
        .replace(/[^0-9.-]/g, ''); // remove any other non-numeric chars
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const parseDateFlexible = (value: string): string => {
      const v = value.trim();
      // Try common formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
      // If contains '-' and looks like YYYY-MM-DD, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      // If contains '/', attempt to normalize to YYYY-MM-DD assuming DD/MM/YYYY first
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) {
        const [a, b, c] = v.split('/');
        const dd = a.length === 1 ? `0${a}` : a;
        const mm = b.length === 1 ? `0${b}` : b;
        const yyyy = c.length === 2 ? `20${c}` : c;
        // Heuristic: if first part > 12, it's certainly DD/MM
        if (parseInt(a, 10) > 12) return `${yyyy}-${mm}-${dd}`;
        // Otherwise prefer DD/MM (common in invoices outside US)
        return `${yyyy}-${mm}-${dd}`;
      }
      // Fallback to Date parsing
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
      return v;
    };

    // Parse header information with more flexible patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Extract receipt number - comprehensive patterns for goods receipts
      if (
        /Receipt\s*(No\.|No|Number|#)\s*:/.test(line) ||
        line.startsWith('Receipt:') ||
        /^GR\s*[0-9]/.test(line) ||
        /^REC\s*[0-9]/.test(line) ||
        /^GR-\d/.test(line) ||
        /^REC-\d/.test(line) ||
        /Receipt\s*Number\s*:/.test(line) ||
        /Goods\s*Receipt\s*No\.?\s*:/.test(line) ||
        /GRN\s*No\.?\s*:/.test(line) ||
        /Reference\s*No\.?\s*:/.test(line) ||
        /Document\s*No\.?\s*:/.test(line) ||
        /Ref\s*No\.?\s*:/.test(line) ||
        /GRN\s*:/.test(line) ||
        /GR\s*:/.test(line)
      ) {
        const receiptNumber = this.extractValueAfterColon(line)
          .replace(/\s+/g, ' ')
          .trim() || line.trim();
        extractedData.receiptNumber = receiptNumber;
        extractedData.invoiceNumber = receiptNumber; // Keep for compatibility
        console.log('Found receipt number in document:', receiptNumber);
      }
      
      // Also try to find receipt numbers in any line that looks like a receipt number
      if (!extractedData.receiptNumber) {
        // More comprehensive patterns for receipt numbers
        const receiptPatterns = [
          /(GR|REC|RECEIPT|GRN)[\s\-]?(\d{4,}[\-]?[A-Z0-9]+)/i,
          /(GR|REC|RECEIPT|GRN)[\s\-]?(\d{2,4}[\-]?\d{2,4}[\-]?[A-Z0-9]+)/i,
          /(GR|REC|RECEIPT|GRN)[\s\-]?(\d{6,})/i,
          /(GR|REC|RECEIPT|GRN)[\s\-]?([A-Z0-9]{6,})/i
        ];
        
        for (const pattern of receiptPatterns) {
          const match = line.match(pattern);
          if (match) {
            const receiptNumber = match[0].replace(/\s+/g, '-').toUpperCase();
            extractedData.receiptNumber = receiptNumber;
            extractedData.invoiceNumber = receiptNumber; // Keep for compatibility
            console.log('Found receipt number pattern in line:', receiptNumber);
            break;
          }
        }
      }
      
      // Extract invoice date - comprehensive patterns for goods receipts
      if (
        /Invoice\s*Date\s*:/.test(line) || 
        /^Date\s*:/.test(line) ||
        /Receipt\s*Date\s*:/.test(line) ||
        /Delivery\s*Date\s*:/.test(line) ||
        /Received\s*Date\s*:/.test(line) ||
        /Date\s*of\s*Receipt\s*:/.test(line) ||
        /Goods\s*Received\s*Date\s*:/.test(line) ||
        /GR\s*Date\s*:/.test(line) ||
        /GRN\s*Date\s*:/.test(line) ||
        /Document\s*Date\s*:/.test(line) ||
        /Issue\s*Date\s*:/.test(line) ||
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line) ||
        /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(line)
      ) {
        const dateStr = this.extractValueAfterColon(line) || line.trim();
        const parsedDate = parseDateFlexible(dateStr);
        extractedData.invoiceDate = parsedDate;
        extractedData.receiptDate = parsedDate;
        console.log('Found invoice date:', parsedDate);
      }
      
      // Extract supplier name - comprehensive patterns for goods receipts
      if (
        line.includes('Supplier Name:') || 
        line.startsWith('Supplier:') ||
        line.includes('Vendor:') ||
        line.includes('From:') ||
        line.includes('Company:') ||
        line.includes('Organization:') ||
        line.includes('Received From:') ||
        line.includes('Delivered By:') ||
        /^[A-Z][a-z]+\s+[A-Z]/.test(line) || // Company name pattern
        /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z]/.test(line) // Multi-word company name
      ) {
        const supplierName = this.extractValueAfterColon(line) || line.trim();
        // Clean up the supplier name
        const cleanedName = supplierName
          .replace(/[^\w\s\-&.,]/g, '') // Remove special characters except common business ones
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        if (cleanedName.length > 2) {
          extractedData.supplierName = cleanedName;
          console.log('Found supplier name:', cleanedName);
        }
      }
      
      // Extract status
      if (line.includes('Status:')) {
        extractedData.status = this.extractValueAfterColon(line);
      }
      
      // Extract payment terms - more flexible patterns
      if (
        line.includes('Payment Terms:') || 
        line.startsWith('Terms:') ||
        line.includes('Payment:') ||
        /Net\s+\d+/.test(line) ||
        /Due\s+in\s+\d+/.test(line)
      ) {
        extractedData.paymentTerms = this.extractValueAfterColon(line) || line.trim();
        console.log('Found payment terms:', extractedData.paymentTerms);
      }
      
      // Extract due date - more flexible patterns
      if (
        line.includes('Due Date:') || 
        /Due\s*On\s*:/.test(line) ||
        /Due\s*Date\s*:/.test(line) ||
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line)
      ) {
        const due = this.extractValueAfterColon(line) || line.trim();
        extractedData.dueDate = parseDateFlexible(due);
        console.log('Found due date:', extractedData.dueDate);
      }
      
      // Extract supplier address
      if (line.includes('Supplier Name & Address:')) {
        let addressLines = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].includes('Supplier Contact Person:') && !lines[j].includes('ITEMS:')) {
          if (lines[j].trim()) {
            addressLines.push(lines[j].trim());
          }
          j++;
        }
        extractedData.supplierAddress = addressLines.join('\n');
        i = j - 1;
      }
      
      // Extract supplier contact person
      if (line.includes('Supplier Contact Person:')) {
        let contactLines = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].includes('ITEMS:') && !lines[j].includes('S.l.')) {
          if (lines[j].trim()) {
            contactLines.push(lines[j].trim());
          }
          j++;
        }
        extractedData.supplierContactPerson = contactLines.join('\n');
        i = j - 1;
      }
      
      // Extract items - more flexible table detection
      if (
        (line.includes('S.l.') || /S\.?No\.?/i.test(line) || /Item\s*No/i.test(line)) && 
        (line.toLowerCase().includes('item') || line.toLowerCase().includes('description') || line.toLowerCase().includes('product'))
      ) {
        console.log('Found items table header:', line);
        // Skip header row
        i++;
        let itemCount = 0;
        while (i < lines.length && !lines[i].toLowerCase().includes('total') && !lines[i].toLowerCase().includes('subtotal')) {
          const itemLine = lines[i];
          console.log('Processing item line:', itemLine);
          
          // Try different parsing methods
          let item = null;
          if (itemLine.includes('|')) {
            item = this.parseItemLine(itemLine);
          } else if (this.looksLikeItemLine(itemLine)) {
            item = this.parseItemLineFlexible(itemLine);
          }
          
          if (item) {
            extractedData.items.push(item);
            itemCount++;
            console.log('Parsed item:', item);
          }
          i++;
        }
        console.log(`Parsed ${itemCount} items from table`);
        break;
      }
    }

    // Set defaults and fallbacks
    extractedData.receivedBy = extractedData.receivedBy || 'System User';
    extractedData.status = extractedData.status || 'Pending';
    extractedData.notes = extractedData.notes || '';
    
    // Use filename receipt number as fallback if not found in document
    if (!extractedData.receiptNumber && filenameReceiptNumber) {
      extractedData.receiptNumber = filenameReceiptNumber;
      extractedData.invoiceNumber = filenameReceiptNumber; // Keep for compatibility
      console.log('Using receipt number from filename as fallback:', filenameReceiptNumber);
    }

    return extractedData;
  }

  private extractValueAfterColon(line: string): string {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      return line.substring(colonIndex + 1).trim();
    }
    return '';
  }

  private looksLikeItemLine(line: string): boolean {
    // Check if line looks like an item row (contains numbers and text)
    const hasNumbers = /\d/.test(line);
    const hasText = /[A-Za-z]/.test(line);
    const hasMultipleWords = line.split(/\s+/).length >= 3;
    return hasNumbers && hasText && hasMultipleWords;
  }

  private parseItemLineFlexible(line: string): ExtractedItemData | null {
    try {
      // Try to extract data from space-separated or tab-separated values
      const parts = line.split(/\s+/).filter(part => part.length > 0);
      
      if (parts.length < 3) {
        return null;
      }

      const cleanNum = (s: string) => {
        const cleaned = s
          .replace(/[,\s]/g, '')
          .replace(/[A-Za-z%$€£₹]/g, '')
          .replace(/[^0-9.-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      // Try to identify parts by position and content
      let serialNo = 1;
      let itemDescription = '';
      let quantity = 0;
      let unitCost = 0;
      let discountPercent = 0;
      let discountAmount = 0;
      let netTotal = 0;
      let vatPercent = 0;
      let vatAmount = 0;

      // First part is usually serial number
      if (/^\d+$/.test(parts[0])) {
        serialNo = parseInt(parts[0], 10);
        parts.shift();
      }

      // Find description (usually the longest text part)
      let descIndex = 0;
      let maxLength = 0;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].length > maxLength && /[A-Za-z]/.test(parts[i])) {
          maxLength = parts[i].length;
          descIndex = i;
        }
      }
      itemDescription = parts[descIndex] || '';

      // Extract numeric values from remaining parts
      const numericParts = parts.filter(part => /[\d.,]/.test(part)).map(cleanNum);
      
      if (numericParts.length >= 2) {
        quantity = numericParts[0] || 0;
        unitCost = numericParts[1] || 0;
        
        if (numericParts.length >= 3) {
          discountPercent = numericParts[2] || 0;
        }
        if (numericParts.length >= 4) {
          discountAmount = numericParts[3] || 0;
        }
        if (numericParts.length >= 5) {
          netTotal = numericParts[4] || 0;
        }
        if (numericParts.length >= 6) {
          vatPercent = numericParts[5] || 0;
        }
        if (numericParts.length >= 7) {
          vatAmount = numericParts[6] || 0;
        }
      }

      return {
        id: randomUUID(),
        serialNo,
        itemDescription,
        quantity,
        unitCost,
        discountPercent,
        discountAmount,
        netTotal,
        vatPercent,
        vatAmount,
        // Legacy fields
        itemName: itemDescription,
        description: itemDescription,
        unitPrice: unitCost,
        totalPrice: netTotal + vatAmount,
        receivedQuantity: quantity,
      };
    } catch (error) {
      console.error('Error parsing flexible item line:', error);
      return null;
    }
  }

  private parseItemLine(line: string): ExtractedItemData | null {
    try {
      const parts = line.split('|').map(part => part.trim());
      
      if (parts.length < 9) {
        return null;
      }

      const cleanNum = (s: string) => {
        const cleaned = s
          .replace(/[,\s]/g, '')
          .replace(/[A-Za-z%$€£₹]/g, '')
          .replace(/[^0-9.-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      const serialNo = parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || 1;
      const itemDescription = parts[1] || '';
      const quantity = cleanNum(parts[2]);
      const unitCost = cleanNum(parts[3]);
      const discountPercent = cleanNum(parts[4]);
      const discountAmount = cleanNum(parts[5]);
      const netTotal = cleanNum(parts[6]);
      const vatPercent = cleanNum(parts[7]);
      const vatAmount = cleanNum(parts[8]);

      return {
        id: randomUUID(),
        serialNo,
        itemDescription,
        quantity,
        unitCost,
        discountPercent,
        discountAmount,
        netTotal,
        vatPercent,
        vatAmount,
        // Legacy fields
        itemName: itemDescription,
        description: itemDescription,
        unitPrice: unitCost,
        totalPrice: netTotal + vatAmount,
        receivedQuantity: quantity,
      };
    } catch (error) {
      console.error('Error parsing item line:', error);
      return null;
    }
  }

  async processDeliveryDocument(buffer: Buffer, filename: string): Promise<ExtractedDeliveryData> {
    try {
      console.log(`Processing delivery document: ${filename}, size: ${buffer.length} bytes`);
      
      // Save file temporarily
      const tempId = randomUUID();
      const tempPath = path.join(this.uploadDir, `${tempId}.pdf`);
      await fs.writeFile(tempPath, buffer);
      
      try {
        // Extract text from PDF
        const extractedText = await this.extractTextFromPDF(tempPath);
        console.log(`Extracted text length: ${extractedText.length}`);
        
        // Parse the extracted text
        const parsedData = this.parseDeliveryText(extractedText);
        console.log('Parsed delivery data:', parsedData);
        
        return parsedData;
      } finally {
        // Clean up temporary file
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          console.warn('Failed to clean up temporary file:', error);
        }
      }
    } catch (error) {
      console.error('Error processing delivery document:', error);
      throw error;
    }
  }

  private parseDeliveryText(text: string): ExtractedDeliveryData {
    console.log('Parsing extracted text...');
    console.log(`Text length: ${text.length}`);
    console.log('First 1000 characters:', text.substring(0, 1000));
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const result: ExtractedDeliveryData = {
      items: []
    };
    
    // Extract delivery number
    const deliveryNumberMatch = text.match(/delivery\s*no[:\s]*([A-Z0-9-]+)/i) || 
                               text.match(/delivery\s*number[:\s]*([A-Z0-9-]+)/i) ||
                               text.match(/([A-Z]{2,}-\d{4,}-[A-Z0-9]+)/);
    if (deliveryNumberMatch) {
      result.deliveryNumber = deliveryNumberMatch[1];
      console.log('Found delivery number:', result.deliveryNumber);
    }
    
    // Extract delivery date
    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        result.deliveryDate = date.toISOString().split('T')[0];
        console.log('Found delivery date:', result.deliveryDate);
      }
    }
    
    // Extract customer name
    const customerMatch = text.match(/customer[:\s]*([^\n\r]+)/i) ||
                         text.match(/delivered\s*to[:\s]*([^\n\r]+)/i);
    if (customerMatch) {
      result.customerName = customerMatch[1].trim();
      console.log('Found customer name:', result.customerName);
    }
    
    // Extract supplier name
    const supplierMatch = text.match(/supplier[:\s]*([^\n\r]+)/i) ||
                         text.match(/from[:\s]*([^\n\r]+)/i);
    if (supplierMatch) {
      result.supplierName = supplierMatch[1].trim();
      console.log('Found supplier name:', result.supplierName);
    }
    
    // Extract items from table
    const itemsTableStart = lines.findIndex(line => 
      line.toLowerCase().includes('item') && 
      line.toLowerCase().includes('description') && 
      line.toLowerCase().includes('qty')
    );
    
    if (itemsTableStart !== -1) {
      console.log('Found items table header:', lines[itemsTableStart]);
      
      for (let i = itemsTableStart + 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip if line doesn't look like an item row
        if (!line.includes('|') && !line.match(/\d+\s+\w+/)) {
          continue;
        }
        
        const item = this.parseDeliveryItemLine(line);
        if (item) {
          result.items.push(item);
          console.log('Parsed item:', item);
        }
      }
    }
    
    console.log(`Parsed ${result.items.length} items from table`);
    return result;
  }

  private parseDeliveryItemLine(line: string): ExtractedItemData | null {
    try {
      // Handle pipe-separated format
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 4) return null;
        
        const serialNo = parseInt(parts[0]) || 0;
        const itemDescription = parts[1] || '';
        const quantity = this.cleanNum(parts[2]);
        const unitCost = this.cleanNum(parts[3]);
        
        return {
          id: randomUUID(),
          serialNo,
          itemDescription,
          quantity,
          unitCost,
          discountPercent: 0,
          discountAmount: 0,
          netTotal: quantity * unitCost,
          vatPercent: 0,
          vatAmount: 0,
          // Legacy fields
          itemName: itemDescription,
          description: itemDescription,
          unitPrice: unitCost,
          totalPrice: quantity * unitCost,
          receivedQuantity: quantity
        };
      }
      
      // Handle space-separated format
      const parts = line.split(/\s+/);
      if (parts.length < 3) return null;
      
      const serialNo = parseInt(parts[0]) || 0;
      const itemDescription = parts.slice(1, -2).join(' ');
      const quantity = this.cleanNum(parts[parts.length - 2]);
      const unitCost = this.cleanNum(parts[parts.length - 1]);
      
      return {
        id: randomUUID(),
        serialNo,
        itemDescription,
        quantity,
        unitCost,
        discountPercent: 0,
        discountAmount: 0,
        netTotal: quantity * unitCost,
        vatPercent: 0,
        vatAmount: 0,
        // Legacy fields
        itemName: itemDescription,
        description: itemDescription,
        unitPrice: unitCost,
        totalPrice: quantity * unitCost,
        receivedQuantity: quantity
      };
    } catch (error) {
      console.error('Error parsing delivery item line:', error);
      return null;
    }
  }
}

export const documentProcessingService = new DocumentProcessingService();
