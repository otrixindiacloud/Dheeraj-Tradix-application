import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface ExtractedDocumentData {
  // Header information
  documentNumber?: string;
  documentDate?: string;
  supplierName?: string;
  supplierId?: string;
  customerName?: string;
  customerId?: string;
  status?: string;
  notes?: string;
  
  // Items information
  items: ExtractedItemData[];
  
  // Document type specific fields
  documentType: 'receipt' | 'return' | 'issue' | 'issue-return';
  totalAmount?: number;
  vatAmount?: number;
  netAmount?: number;
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
  totalAmount: number;
  // Legacy fields for compatibility
  itemName?: string;
  description?: string;
  unitPrice?: number;
  totalPrice?: number;
  receivedQuantity?: number;
}

export class AIDocumentProcessingService {
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

  async processDocument(file: Buffer, filename: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): Promise<ExtractedDocumentData> {
    let filePath: string | null = null;
    
    try {
      console.log(`Processing ${documentType} document: ${filename}, size: ${file.length} bytes`);
      
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
      
      // Use OpenAI to parse the extracted text
      console.log('Starting AI-powered text parsing...');
      const extractedData = await this.parseDocumentWithAI(extractedText, documentType, filename);
      console.log('AI parsed data:', JSON.stringify(extractedData, null, 2));
      
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
      
      // Use pdf-parse for reliable PDF text extraction in Node.js
      console.log('Starting PDF parsing with pdf-parse...');
      
      try {
        // Import pdf-parse correctly (default export is the parser function)
        const pdfParse = (await import('pdf-parse')).default as (data: Buffer) => Promise<{ text: string }>;
        console.log('pdf-parse imported successfully');

        // Parse the PDF buffer directly
        const result = await pdfParse(pdfBuffer);
        const extractedText = (result && result.text) ? result.text : '';

        console.log(`Total extracted text length: ${extractedText.length} characters`);

        // Log first 2000 characters for debugging
        if (extractedText.length > 0) {
          console.log('First 2000 characters of extracted text:');
          console.log(extractedText.substring(0, 2000));
        }

        // Check if we got meaningful text
        if (extractedText.length < 10) {
          console.warn('PDF appears to be empty or contains very little text. Trying fallback extraction...');
          const fallbackText = this.extractTextFromPDFBuffer(pdfBuffer);

          if (fallbackText && fallbackText.length > 10) {
            console.log(`Fallback extraction successful: ${fallbackText.length} characters`);
            return fallbackText;
          }

          throw new Error('PDF appears to be empty or contains very little text. The PDF might be image-based or corrupted.');
        }

        return extractedText;

      } catch (pdfError) {
        console.error('Error with pdf-parse:', pdfError);
        
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
        if (error.message.includes('pdf-parse')) {
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

  private async parseDocumentWithAI(text: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return', filename?: string): Promise<ExtractedDocumentData> {
    try {
      console.log(`Parsing ${documentType} document with AI...`);
      
      // Check if OpenAI API key is available and valid
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.startsWith('your-') || apiKey.trim().length < 10) {
        console.log('OpenAI API key not configured or invalid, using enhanced fallback parsing');
        return this.parseDocumentFallback(text, documentType, filename);
      }
      
      // Additional validation for API key format
      if (!apiKey.startsWith('sk-')) {
        console.log('OpenAI API key format appears invalid, using enhanced fallback parsing');
        return this.parseDocumentFallback(text, documentType, filename);
      }

      const systemPrompt = this.getEnhancedSystemPrompt(documentType);
      const userPrompt = this.getEnhancedUserPrompt(text, documentType, filename);

      console.log('Sending request to OpenAI with enhanced prompts...');
      const { text: aiResponse } = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.05, // Very low temperature for maximum consistency
        maxTokens: 6000, // Increased token limit for more detailed extraction
      });

      console.log('OpenAI response received, length:', aiResponse.length);
      console.log('AI Response:', aiResponse);

      // Parse the AI response with enhanced validation
      const parsedData = this.parseAIResponse(aiResponse, documentType);
      console.log('Parsed AI response:', parsedData);

      // Post-process and validate the extracted data
      const validatedData = this.validateAndEnhanceExtractedData(parsedData, documentType);
      console.log('Validated and enhanced data:', validatedData);

      return validatedData;
    } catch (error: any) {
      console.error('Error parsing document with AI:', error);
      
      // Check if it's an API key error or authentication error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData = error?.data || error?.error || {};
      
      // Check various indicators of API key errors
      if (errorMessage?.includes('API key') || 
          errorMessage?.includes('authentication') || 
          errorMessage?.includes('invalid_api_key') ||
          errorMessage?.includes('Incorrect API key') ||
          error?.statusCode === 401 ||
          errorData?.code === 'invalid_api_key') {
        console.log('API key error detected, using enhanced fallback parsing');
        return this.parseDocumentFallback(text, documentType, filename);
      }
      
      // For other errors, return enhanced fallback
      console.log('AI parsing failed, using enhanced fallback parsing');
      return this.parseDocumentFallback(text, documentType, filename);
    }
  }

  private getEnhancedSystemPrompt(documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): string {
    const basePrompt = `You are an expert document parser for an ERP system with advanced AI capabilities. Your task is to extract structured data from business documents with maximum accuracy and intelligence.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any explanatory text, markdown formatting, or code blocks. The response must be parseable JSON.

The JSON structure should be:
{
  "documentNumber": "string",
  "documentDate": "YYYY-MM-DD",
  "supplierName": "string",
  "supplierId": "string",
  "customerName": "string", 
  "customerId": "string",
  "status": "string",
  "notes": "string",
  "items": [
    {
      "id": "uuid",
      "serialNo": number,
      "itemDescription": "string",
      "quantity": number,
      "unitCost": number,
      "discountPercent": number,
      "discountAmount": number,
      "netTotal": number,
      "vatPercent": number,
      "vatAmount": number,
      "totalAmount": number
    }
  ],
  "documentType": "${documentType}",
  "totalAmount": number,
  "vatAmount": number,
  "netAmount": number
}

ENHANCED GUIDELINES:
- Use advanced pattern recognition to identify document structures
- Extract all visible data with high precision
- For dates, convert to YYYY-MM-DD format (handle various date formats)
- For numbers, remove currency symbols and convert to decimal
- Generate UUIDs for item IDs using proper format
- If a field is not found, use null or appropriate default
- Use intelligent estimation only when data is clearly visible
- For item descriptions, use the full product name/description
- Calculate totals accurately based on quantity, unit cost, discounts, and VAT
- Handle multi-page documents and complex layouts
- Recognize table structures and extract data accordingly
- Identify and extract line items with proper categorization
- Handle different document formats and layouts intelligently`;

    switch (documentType) {
      case 'receipt':
        return basePrompt + `

This is a MATERIAL RECEIPT document. Look for:
- Receipt number, GR number, or reference number (check headers, footers, and body)
- Receipt date or delivery date (multiple date formats)
- Supplier name and details (company name, address, contact info)
- Received by information (person, department, location)
- Item details with quantities received (description, part numbers, specifications)
- Unit costs, discounts, VAT amounts (check for different currency formats)
- Total amounts (subtotal, tax, grand total)
- Special notes, terms, and conditions
- Batch numbers, serial numbers, and tracking information`;

      case 'return':
        return basePrompt + `

This is a RECEIPT RETURN document. Look for:
- Return number or reference (RMA, return authorization)
- Return date (when the return was initiated)
- Original receipt reference (link to original document)
- Supplier name and return address
- Return reason (defective, wrong item, overstock, etc.)
- Items being returned with quantities and conditions
- Unit costs, discounts, VAT amounts from original receipt
- Total return amounts (refund amounts)
- Return authorization details
- Condition of returned items`;

      case 'issue':
        return basePrompt + `

This is a MATERIAL ISSUE document. Look for:
- Issue number or reference (work order, project reference)
- Issue date (when materials were issued)
- Customer name or department (who received the materials)
- Issued by information (person, department, location)
- Item details with quantities issued (description, specifications)
- Unit costs, discounts, VAT amounts
- Total issue amounts (cost allocation)
- Project or work order references
- Location details (warehouse, site, etc.)
- Authorization and approval details`;

      case 'issue-return':
        return basePrompt + `

This is an ISSUE RETURN document. Look for:
- Return number or reference (return authorization)
- Return date (when the return was initiated)
- Original issue reference (link to original issue document)
- Customer name and return location
- Return reason (unused, excess, defective, etc.)
- Items being returned with quantities and conditions
- Unit costs, discounts, VAT amounts from original issue
- Total return amounts (cost recovery)
- Return authorization details
- Condition of returned items`;

      default:
        return basePrompt;
    }
  }

  private getSystemPrompt(documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): string {
    const basePrompt = `You are an expert document parser for an ERP system. Your task is to extract structured data from business documents with high accuracy.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any explanatory text, markdown formatting, or code blocks. The response must be parseable JSON.

The JSON structure should be:
{
  "documentNumber": "string",
  "documentDate": "YYYY-MM-DD",
  "supplierName": "string",
  "supplierId": "string",
  "customerName": "string", 
  "customerId": "string",
  "status": "string",
  "notes": "string",
  "items": [
    {
      "id": "uuid",
      "serialNo": number,
      "itemDescription": "string",
      "quantity": number,
      "unitCost": number,
      "discountPercent": number,
      "discountAmount": number,
      "netTotal": number,
      "vatPercent": number,
      "vatAmount": number,
      "totalAmount": number
    }
  ],
  "documentType": "${documentType}",
  "totalAmount": number,
  "vatAmount": number,
  "netAmount": number
}

Guidelines:
- Extract all visible data accurately
- For dates, convert to YYYY-MM-DD format
- For numbers, remove currency symbols and convert to decimal
- Generate UUIDs for item IDs
- If a field is not found, use null or appropriate default
- Be conservative with estimates - only extract clearly visible data
- For item descriptions, use the full product name/description
- Calculate totals accurately based on quantity, unit cost, discounts, and VAT`;

    switch (documentType) {
      case 'receipt':
        return basePrompt + `

This is a MATERIAL RECEIPT document. Look for:
- Receipt number, GR number, or reference number
- Receipt date or delivery date
- Supplier name and details
- Received by information
- Item details with quantities received
- Unit costs, discounts, VAT amounts
- Total amounts`;

      case 'return':
        return basePrompt + `

This is a RECEIPT RETURN document. Look for:
- Return number or reference
- Return date
- Original receipt reference
- Supplier name
- Return reason
- Items being returned with quantities
- Unit costs, discounts, VAT amounts
- Total return amounts`;

      case 'issue':
        return basePrompt + `

This is a MATERIAL ISSUE document. Look for:
- Issue number or reference
- Issue date
- Customer name or department
- Issued by information
- Item details with quantities issued
- Unit costs, discounts, VAT amounts
- Total issue amounts`;

      case 'issue-return':
        return basePrompt + `

This is an ISSUE RETURN document. Look for:
- Return number or reference
- Return date
- Original issue reference
- Customer name
- Return reason
- Items being returned with quantities
- Unit costs, discounts, VAT amounts
- Total return amounts`;

      default:
        return basePrompt;
    }
  }

  private getEnhancedUserPrompt(text: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return', filename?: string): string {
    return `Please parse the following ${documentType.toUpperCase()} document text with advanced AI analysis and extract all relevant information with maximum accuracy:

Document Type: ${documentType}
Filename: ${filename || 'Unknown'}
Document Length: ${text.length} characters

ANALYSIS INSTRUCTIONS:
1. Scan the entire document for document structure and layout patterns
2. Identify headers, footers, and main content areas
3. Look for table structures and extract data systematically
4. Recognize different date formats and convert to YYYY-MM-DD
5. Identify currency symbols and convert amounts to decimal numbers
6. Extract line items with proper categorization
7. Calculate totals and verify mathematical accuracy
8. Look for special notes, terms, and additional information

Document Text:
${text.substring(0, 12000)} // Increased text limit for better analysis

Extract all visible information with high precision and return as JSON. Pay special attention to:
- Document numbers and references
- Dates in various formats
- Supplier/customer information
- Item details and quantities
- Financial calculations
- Special notes and conditions`;
  }

  private getUserPrompt(text: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return', filename?: string): string {
    return `Please parse the following ${documentType.toUpperCase()} document text and extract all relevant information:

Document Type: ${documentType}
Filename: ${filename || 'Unknown'}

Document Text:
${text.substring(0, 8000)} // Limit text length for API

Extract all visible information and return as JSON.`;
  }

  private parseAIResponse(aiResponse: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): ExtractedDocumentData {
    try {
      // Clean the response to extract JSON
      let jsonString = aiResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Find JSON object boundaries
      const jsonStart = jsonString.indexOf('{');
      const jsonEnd = jsonString.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('Cleaned JSON string:', jsonString);
      
      const parsed = JSON.parse(jsonString);
      
      // Ensure required fields
      const result: ExtractedDocumentData = {
        documentNumber: parsed.documentNumber || null,
        documentDate: parsed.documentDate || null,
        supplierName: parsed.supplierName || null,
        supplierId: parsed.supplierId || null,
        customerName: parsed.customerName || null,
        customerId: parsed.customerId || null,
        status: parsed.status || 'Draft',
        notes: parsed.notes || null,
        items: Array.isArray(parsed.items) ? parsed.items.map((item: any) => ({
          id: item.id || randomUUID(),
          serialNo: item.serialNo || 1,
          itemDescription: item.itemDescription || '',
          quantity: parseFloat(item.quantity) || 0,
          unitCost: parseFloat(item.unitCost) || 0,
          discountPercent: parseFloat(item.discountPercent) || 0,
          discountAmount: parseFloat(item.discountAmount) || 0,
          netTotal: parseFloat(item.netTotal) || 0,
          vatPercent: parseFloat(item.vatPercent) || 0,
          vatAmount: parseFloat(item.vatAmount) || 0,
          totalAmount: parseFloat(item.totalAmount) || 0,
          // Legacy fields
          itemName: item.itemDescription || '',
          description: item.itemDescription || '',
          unitPrice: parseFloat(item.unitCost) || 0,
          totalPrice: parseFloat(item.totalAmount) || 0,
          receivedQuantity: parseFloat(item.quantity) || 0,
        })) : [],
        documentType,
        totalAmount: parseFloat(parsed.totalAmount) || 0,
        vatAmount: parseFloat(parsed.vatAmount) || 0,
        netAmount: parseFloat(parsed.netAmount) || 0,
      };
      
      return result;
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('AI Response that failed to parse:', aiResponse);
      
      // Return fallback data
      return this.parseDocumentFallback('', documentType, '');
    }
  }

  private parseDocumentFallback(text: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return', filename?: string): ExtractedDocumentData {
    console.log('Using fallback parsing for document type:', documentType);
    
    // Basic fallback parsing logic
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const result: ExtractedDocumentData = {
      documentNumber: this.extractDocumentNumber(text, documentType) || filename?.replace('.pdf', '') || null,
      documentDate: this.extractDate(text) || new Date().toISOString().split('T')[0],
      supplierName: this.extractSupplierName(text) || null,
      supplierId: null,
      customerName: this.extractCustomerName(text) || null,
      customerId: null,
      status: 'Draft',
      notes: null,
      items: this.extractItemsFallback(text),
      documentType,
      totalAmount: 0,
      vatAmount: 0,
      netAmount: 0,
    };
    
    return result;
  }

  private extractDocumentNumber(text: string, documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): string | null {
    const patterns = {
      receipt: [/(?:receipt|gr|grn)[\s\-]*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-]+)/i, /(GR|REC|GRN)[\s\-]?(\d{4,}[\-]?[A-Z0-9]+)/i],
      return: [/(?:return|rtn)[\s\-]*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-]+)/i, /(RTN|RET)[\s\-]?(\d{4,}[\-]?[A-Z0-9]+)/i],
      issue: [/(?:issue|iss)[\s\-]*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-]+)/i, /(ISS|ISU)[\s\-]?(\d{4,}[\-]?[A-Z0-9]+)/i],
      'issue-return': [/(?:return|rtn)[\s\-]*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-]+)/i, /(RTN|RET)[\s\-]?(\d{4,}[\-]?[A-Z0-9]+)/i]
    };
    
    for (const pattern of patterns[documentType]) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }

  private extractDate(text: string): string | null {
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /(?:date|issued?|received?)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    return null;
  }

  private extractSupplierName(text: string): string | null {
    const patterns = [
      /(?:supplier|vendor|from)[\s:]*([^\n\r]+)/i,
      /(?:company|organization)[\s:]*([^\n\r]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private extractCustomerName(text: string): string | null {
    const patterns = [
      /(?:customer|client|to)[\s:]*([^\n\r]+)/i,
      /(?:delivered\s+to|issued\s+to)[\s:]*([^\n\r]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private validateAndEnhanceExtractedData(data: ExtractedDocumentData, documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): ExtractedDocumentData {
    console.log('Validating and enhancing extracted data...');
    
    // Validate and enhance document number
    if (!data.documentNumber || data.documentNumber.trim() === '') {
      data.documentNumber = this.generateDocumentNumber(documentType);
    }
    
    // Validate and enhance document date
    if (!data.documentDate || data.documentDate.trim() === '') {
      data.documentDate = new Date().toISOString().split('T')[0];
    } else {
      // Ensure date is in correct format
      data.documentDate = this.normalizeDate(data.documentDate);
    }
    
    // Validate and enhance items
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map((item, index) => {
        // Ensure required fields are present
        const enhancedItem: ExtractedItemData = {
          id: item.id || randomUUID(),
          serialNo: item.serialNo || (index + 1),
          itemDescription: item.itemDescription || item.description || item.itemName || '',
          quantity: Math.max(0, parseFloat(item.quantity?.toString()) || 0),
          unitCost: Math.max(0, parseFloat(item.unitCost?.toString()) || 0),
          discountPercent: Math.max(0, Math.min(100, parseFloat(item.discountPercent?.toString()) || 0)),
          discountAmount: Math.max(0, parseFloat(item.discountAmount?.toString()) || 0),
          netTotal: Math.max(0, parseFloat(item.netTotal?.toString()) || 0),
          vatPercent: Math.max(0, Math.min(100, parseFloat(item.vatPercent?.toString()) || 0)),
          vatAmount: Math.max(0, parseFloat(item.vatAmount?.toString()) || 0),
          totalAmount: Math.max(0, parseFloat(item.totalAmount?.toString()) || 0),
          // Legacy fields
          itemName: item.itemDescription || item.description || item.itemName || '',
          description: item.itemDescription || item.description || item.itemName || '',
          unitPrice: parseFloat(item.unitCost?.toString()) || 0,
          totalPrice: parseFloat(item.totalAmount?.toString()) || 0,
          receivedQuantity: parseFloat(item.quantity?.toString()) || 0,
        };
        
        // Recalculate totals if they seem incorrect
        const calculatedNetTotal = enhancedItem.quantity * enhancedItem.unitCost;
        const calculatedDiscountAmount = (calculatedNetTotal * enhancedItem.discountPercent) / 100;
        const calculatedVatAmount = ((calculatedNetTotal - calculatedDiscountAmount) * enhancedItem.vatPercent) / 100;
        const calculatedTotalAmount = calculatedNetTotal - calculatedDiscountAmount + calculatedVatAmount;
        
        // Use calculated values if original values seem wrong
        if (Math.abs(enhancedItem.netTotal - calculatedNetTotal) > 0.01) {
          enhancedItem.netTotal = calculatedNetTotal;
        }
        if (Math.abs(enhancedItem.discountAmount - calculatedDiscountAmount) > 0.01) {
          enhancedItem.discountAmount = calculatedDiscountAmount;
        }
        if (Math.abs(enhancedItem.vatAmount - calculatedVatAmount) > 0.01) {
          enhancedItem.vatAmount = calculatedVatAmount;
        }
        if (Math.abs(enhancedItem.totalAmount - calculatedTotalAmount) > 0.01) {
          enhancedItem.totalAmount = calculatedTotalAmount;
        }
        
        return enhancedItem;
      });
    } else {
      data.items = [];
    }
    
    // Calculate document totals
    const totalAmount = data.items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const vatAmount = data.items.reduce((sum, item) => sum + (item.vatAmount || 0), 0);
    const netAmount = data.items.reduce((sum, item) => sum + (item.netTotal || 0), 0);
    
    data.totalAmount = totalAmount;
    data.vatAmount = vatAmount;
    data.netAmount = netAmount;
    
    // Set default status if not provided
    if (!data.status || data.status.trim() === '') {
      data.status = 'Draft';
    }
    
    console.log('Data validation and enhancement completed');
    return data;
  }

  private generateDocumentNumber(documentType: 'receipt' | 'return' | 'issue' | 'issue-return'): string {
    const prefix = {
      receipt: 'GR',
      return: 'RTN',
      issue: 'ISS',
      'issue-return': 'IRT'
    }[documentType];
    
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    return `${prefix}-${timestamp}`;
  }

  private normalizeDate(dateString: string): string {
    try {
      // Handle various date formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      return new Date().toISOString().split('T')[0];
    }
  }

  private extractItemsFallback(text: string): ExtractedItemData[] {
    const items: ExtractedItemData[] = [];
    
    // Look for table-like structures
    const lines = text.split('\n');
    let inTable = false;
    let itemCount = 0;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('item') && line.toLowerCase().includes('description')) {
        inTable = true;
        continue;
      }
      
      if (inTable && line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          itemCount++;
          items.push({
            id: randomUUID(),
            serialNo: itemCount,
            itemDescription: parts[1] || '',
            quantity: parseFloat(parts[2]) || 0,
            unitCost: parseFloat(parts[3]) || 0,
            discountPercent: 0,
            discountAmount: 0,
            netTotal: (parseFloat(parts[2]) || 0) * (parseFloat(parts[3]) || 0),
            vatPercent: 0,
            vatAmount: 0,
            totalAmount: (parseFloat(parts[2]) || 0) * (parseFloat(parts[3]) || 0),
            // Legacy fields
            itemName: parts[1] || '',
            description: parts[1] || '',
            unitPrice: parseFloat(parts[3]) || 0,
            totalPrice: (parseFloat(parts[2]) || 0) * (parseFloat(parts[3]) || 0),
            receivedQuantity: parseFloat(parts[2]) || 0,
          });
        }
      }
    }
    
    return items;
  }
}

export const aiDocumentProcessingService = new AIDocumentProcessingService();
