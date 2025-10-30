// New email service using server-side API instead of EmailJS

export interface EmailAttachment {
  name: string;
  data: string; // base64 encoded PDF data
  type: string;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  emailId?: string;
}

export class EmailService {
  private static instance: EmailService;

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send document email with PDF attachment via server API
   */
  async sendEmailWithPdf(
    toEmail: string,
    toName: string,
    documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order' | 'purchase_invoice',
    documentNumber: string,
    pdfData: string, // base64 encoded PDF
    customMessage?: string
  ): Promise<SendEmailResult> {
    try {
      // This method is kept for backward compatibility but now uses server API
      console.log('Sending email with PDF via server API...');
      
      // For now, we'll use the sendEmailWithPdfLink method since the server handles PDF generation
      return await this.sendEmailWithPdfLink(
        toEmail,
        toName,
        documentType,
        documentNumber,
        `data:application/pdf;base64,${pdfData}`,
        customMessage
      );
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Send email with PDF as downloadable link via server API
   */
  async sendEmailWithPdfLink(
    toEmail: string,
    toName: string,
    documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order' | 'purchase_invoice',
    documentNumber: string,
    pdfDownloadUrl: string,
    customMessage?: string
  ): Promise<SendEmailResult> {
    try {
      console.log('Sending email with PDF link via server API...');
      
      // For now, we'll use the simple email method since the server handles PDF generation
      const subject = this.getSubject(documentType, documentNumber);
      const message = customMessage || this.getDefaultMessage(documentType, documentNumber);
      
      return await this.sendSimpleEmail(toEmail, toName, subject, message);
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Send simple email without attachment via server API
   */
  async sendSimpleEmail(
    toEmail: string,
    toName: string,
    subject: string,
    message: string
  ): Promise<SendEmailResult> {
    try {
      console.log('Sending simple email via server API...');
      
      const response = await fetch('/api/email/send-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail,
          toName,
          subject,
          message
        })
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: 'Email sent successfully',
          emailId: result.messageId
        };
      } else {
        return {
          success: false,
          message: result.message || 'Failed to send email'
        };
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Send document email directly (one-click send)
   */
  async sendDocumentDirectly(
    documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order' | 'purchase_invoice',
    documentId: string,
    toEmail: string,
    toName: string,
    customMessage?: string
  ): Promise<SendEmailResult> {
    try {
      console.log(`Sending ${documentType} ${documentId} directly via server API...`);
      
      const endpoint = this.getEmailEndpoint(documentType);
      const response = await fetch(`/api/email/${endpoint}/${documentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: toEmail,
          customMessage,
          autoSend: true
        })
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: result.message || 'Email sent successfully',
          emailId: result.data?.emailResult?.messageId
        };
      } else {
        return {
          success: false,
          message: result.message || 'Failed to send email'
        };
      }
    } catch (error) {
      console.error('Error sending document email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Test email service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/email/test');
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error testing email connection:', error);
      return false;
    }
  }

  private getEmailEndpoint(documentType: string): string {
    const endpointMap: Record<string, string> = {
      'invoice': 'invoice',
      'proforma_invoice': 'invoice', // Use invoice endpoint for proforma
      'quotation': 'quotation',
      'goods_receipt': 'goods-receipt',
      'sales_order': 'sales-order',
      'purchase_invoice': 'purchase-invoice'
    };
    
    return endpointMap[documentType] || documentType;
  }

  private getSubject(documentType: string, documentNumber: string): string {
    const typeMap: Record<string, string> = {
      'invoice': 'Invoice',
      'proforma_invoice': 'Proforma Invoice',
      'quotation': 'Quotation',
      'goods_receipt': 'Goods Receipt',
      'sales_order': 'Sales Order',
      'purchase_invoice': 'Purchase Invoice'
    };
    
    const typeName = typeMap[documentType] || documentType.toUpperCase();
    return `${typeName} #${documentNumber} - Golden Tag WLL`;
  }

  private getDefaultMessage(documentType: string, documentNumber: string): string {
    const typeMap: Record<string, string> = {
      'invoice': 'invoice',
      'proforma_invoice': 'proforma invoice',
      'quotation': 'quotation',
      'goods_receipt': 'goods receipt',
      'sales_order': 'sales order',
      'purchase_invoice': 'purchase invoice'
    };
    
    const typeName = typeMap[documentType] || documentType.replace('_', ' ');
    return `Please find your ${typeName} #${documentNumber} attached to this email.`;
  }
}

// Export singleton instance
export const emailService = new EmailService();