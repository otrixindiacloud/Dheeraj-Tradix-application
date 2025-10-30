// Email Configuration from Environment Variables
// This replaces the hardcoded email_config.json approach

export const EMAIL_CONFIG_ENV = {
  // SMTP Configuration
  email: {
    smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtp_port: parseInt(process.env.SMTP_PORT || '587'),
    from_email: process.env.FROM_EMAIL || '',
    app_password: process.env.SMTP_PASS || '',
    from_name: process.env.FROM_NAME || ''
  },
  
  // API Configuration
  api: {
    base_url: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || '5000'}`,
    api_token: process.env.API_TOKEN || ''
  },
  
  // Company Information
  company: {
    name: process.env.COMPANY_NAME || '',
    address: process.env.COMPANY_ADDRESS || '',
    phone: process.env.COMPANY_PHONE || '',
    email: process.env.COMPANY_EMAIL || '',
    website: process.env.COMPANY_WEBSITE || ''
  },
  
  // Document Types Configuration
  document_types: {
    quotation: {
      enabled: true,
      template: 'quotation',
      subject_template: 'Quotation #{documentNumber} - {companyName}'
    },
    invoice: {
      enabled: true,
      template: 'invoice',
      subject_template: 'Invoice #{documentNumber} - {companyName}'
    },
    'sales-order': {
      enabled: true,
      template: 'sales-order',
      subject_template: 'Sales Order #{documentNumber} - {companyName}'
    },
    'supplier-lpo': {
      enabled: true,
      template: 'lpo',
      subject_template: 'Purchase Order #{documentNumber} - {companyName}'
    },
    'goods-receipt': {
      enabled: true,
      template: 'goods-receipt',
      subject_template: 'Goods Receipt #{documentNumber} - {companyName}'
    },
    'delivery-note': {
      enabled: true,
      template: 'delivery-note',
      subject_template: 'Delivery Note #{documentNumber} - {companyName}'
    }
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    log_file: 'email_automation.log',
    log_sent_emails: true,
    log_file_path: 'sent_emails.csv'
  }
};

// Helper function to get email configuration
export function getEmailConfig() {
  return EMAIL_CONFIG_ENV;
}

// Helper function to validate email configuration
export function validateEmailConfig() {
  const config = EMAIL_CONFIG_ENV;
  const errors: string[] = [];
  
  if (!config.email.from_email) {
    errors.push('FROM_EMAIL is required');
  }
  
  if (!config.email.app_password) {
    errors.push('SMTP_PASS is required');
  }
  
  if (!config.company.name) {
    errors.push('COMPANY_NAME is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
