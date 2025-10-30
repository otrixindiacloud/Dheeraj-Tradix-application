import nodemailer from 'nodemailer';
import { EMAIL_CONFIG, EMAIL_TEMPLATES } from '../config/email-config';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport(EMAIL_CONFIG.SMTP);
  }

  /**
   * Send email with attachments
   */
  async sendEmail(options: EmailOptions): Promise<SendEmailResult> {
    try {
      const mailOptions = {
        from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        replyTo: options.replyTo || EMAIL_CONFIG.REPLY_TO
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send document email with PDF attachment
   */
  async sendDocumentEmail(
    toEmail: string,
    toName: string,
    documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order' | 'purchase_invoice',
    documentNumber: string,
    pdfBuffer: Buffer,
    customMessage?: string
  ): Promise<SendEmailResult> {
    try {
      const template = EMAIL_TEMPLATES[documentType.toUpperCase() as keyof typeof EMAIL_TEMPLATES];
      const subject = template.subject
        .replace('{documentNumber}', documentNumber)
        .replace('{companyName}', EMAIL_CONFIG.COMPANY.name);

      const html = this.generateDocumentEmailHTML(
        toName,
        documentType,
        documentNumber,
        customMessage
      );

      const text = this.generateDocumentEmailText(
        toName,
        documentType,
        documentNumber,
        customMessage
      );

      return await this.sendEmail({
        to: toEmail,
        subject,
        html,
        text,
        attachments: [{
          filename: `${documentType.replace('_', '-')}-${documentNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
    } catch (error) {
      console.error('Error sending document email:', error);
      return {
        success: false,
        message: 'Failed to send document email',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send simple notification email
   */
  async sendNotificationEmail(
    toEmail: string,
    toName: string,
    subject: string,
    message: string
  ): Promise<SendEmailResult> {
    const html = this.generateSimpleEmailHTML(toName, subject, message);
    const text = this.generateSimpleEmailText(toName, subject, message);

    return await this.sendEmail({
      to: toEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Generate HTML email template for documents
   */
  private generateDocumentEmailHTML(
    toName: string,
    documentType: string,
    documentNumber: string,
    customMessage?: string
  ): string {
    const documentTitle = documentType.replace('_', ' ').toUpperCase();
    const defaultMessage = customMessage || `Please find your ${documentTitle} #${documentNumber} attached to this email.`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentTitle} - ${EMAIL_CONFIG.COMPANY.name}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .company-info { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${EMAIL_CONFIG.COMPANY.name}</h1>
            <p>${documentTitle} #${documentNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${toName},</p>
            <p>${defaultMessage}</p>
            <p>The document is attached to this email as a PDF file.</p>
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            <p>Best regards,<br>
            <strong>${EMAIL_CONFIG.COMPANY.name}</strong></p>
          </div>
          <div class="footer">
            <div class="company-info">
              <p><strong>${EMAIL_CONFIG.COMPANY.name}</strong></p>
              <p>${EMAIL_CONFIG.COMPANY.address}</p>
              <p>Phone: ${EMAIL_CONFIG.COMPANY.phone}</p>
              <p>Website: ${EMAIL_CONFIG.COMPANY.website}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text email template for documents
   */
  private generateDocumentEmailText(
    toName: string,
    documentType: string,
    documentNumber: string,
    customMessage?: string
  ): string {
    const documentTitle = documentType.replace('_', ' ').toUpperCase();
    const defaultMessage = customMessage || `Please find your ${documentTitle} #${documentNumber} attached to this email.`;

    return `
${EMAIL_CONFIG.COMPANY.name}
${documentTitle} #${documentNumber}

Dear ${toName},

${defaultMessage}

The document is attached to this email as a PDF file.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
${EMAIL_CONFIG.COMPANY.name}

---
${EMAIL_CONFIG.COMPANY.name}
${EMAIL_CONFIG.COMPANY.address}
Phone: ${EMAIL_CONFIG.COMPANY.phone}
Website: ${EMAIL_CONFIG.COMPANY.website}
    `;
  }

  /**
   * Generate HTML email template for simple emails
   */
  private generateSimpleEmailHTML(toName: string, subject: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${EMAIL_CONFIG.COMPANY.name}</h1>
          </div>
          <div class="content">
            <p>Dear ${toName},</p>
            <p>${message}</p>
            <p>Best regards,<br>
            <strong>${EMAIL_CONFIG.COMPANY.name}</strong></p>
          </div>
          <div class="footer">
            <p><strong>${EMAIL_CONFIG.COMPANY.name}</strong></p>
            <p>${EMAIL_CONFIG.COMPANY.address}</p>
            <p>Phone: ${EMAIL_CONFIG.COMPANY.phone}</p>
            <p>Website: ${EMAIL_CONFIG.COMPANY.website}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text email template for simple emails
   */
  private generateSimpleEmailText(toName: string, subject: string, message: string): string {
    return `
${EMAIL_CONFIG.COMPANY.name}
${subject}

Dear ${toName},

${message}

Best regards,
${EMAIL_CONFIG.COMPANY.name}

---
${EMAIL_CONFIG.COMPANY.name}
${EMAIL_CONFIG.COMPANY.address}
Phone: ${EMAIL_CONFIG.COMPANY.phone}
Website: ${EMAIL_CONFIG.COMPANY.website}
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
