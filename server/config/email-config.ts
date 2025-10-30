// Email Configuration
export const EMAIL_CONFIG = {
  // SMTP Configuration - All values from environment variables
  SMTP: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  },
  
  // Email settings
  FROM_EMAIL: process.env.FROM_EMAIL || '',
  FROM_NAME: process.env.FROM_NAME || '',
  REPLY_TO: process.env.REPLY_TO_EMAIL || '',
  
  // Company information
  COMPANY: {
    name: process.env.COMPANY_NAME || '',
    address: process.env.COMPANY_ADDRESS || '',
    phone: process.env.COMPANY_PHONE || '',
    email: process.env.COMPANY_EMAIL || '',
    website: process.env.COMPANY_WEBSITE || '',
    logo: process.env.COMPANY_LOGO || ''
  }
};

// Email templates for different document types
export const EMAIL_TEMPLATES = {
  INVOICE: {
    subject: 'Invoice #{documentNumber} - {companyName}',
    template: 'invoice-template'
  },
  PROFORMA_INVOICE: {
    subject: 'Proforma Invoice #{documentNumber} - {companyName}',
    template: 'proforma-invoice-template'
  },
  QUOTATION: {
    subject: 'Quotation #{documentNumber} - {companyName}',
    template: 'quotation-template'
  },
  GOODS_RECEIPT: {
    subject: 'Goods Receipt #{documentNumber} - {companyName}',
    template: 'goods-receipt-template'
  },
  SALES_ORDER: {
    subject: 'Sales Order #{documentNumber} - {companyName}',
    template: 'sales-order-template'
  },
  PURCHASE_INVOICE: {
    subject: 'Purchase Invoice #{documentNumber} - {companyName}',
    template: 'purchase-invoice-template'
  }
};
