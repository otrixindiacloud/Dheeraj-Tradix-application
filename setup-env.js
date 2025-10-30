#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupEnvironment() {
  console.log('🔧 TRADIX ERP Environment Setup');
  console.log('================================\n');

  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. This will update it.\n');
  }

  console.log('Please provide the following configuration details:\n');

  // Database Configuration
  console.log('📊 DATABASE CONFIGURATION');
  console.log('========================');
  const databaseUrl = await question('Enter your PostgreSQL Database URL: ');
  if (!databaseUrl) {
    console.log('❌ Database URL is required');
    process.exit(1);
  }

  // OpenAI API Key
  console.log('\n🤖 OPENAI API CONFIGURATION');
  console.log('============================');
  const openaiKey = await question('Enter your OpenAI API Key (sk-...): ');
  if (!openaiKey || !openaiKey.startsWith('sk-')) {
    console.log('❌ Invalid OpenAI API Key format. Please ensure it starts with "sk-"');
    process.exit(1);
  }

  // Email Configuration
  console.log('\n📧 EMAIL CONFIGURATION');
  console.log('======================');
  const smtpHost = await question('SMTP Host (default: smtp.gmail.com): ') || 'smtp.gmail.com';
  const smtpPort = await question('SMTP Port (default: 587): ') || '587';
  const smtpUser = await question('SMTP Username (your email): ');
  const smtpPass = await question('SMTP Password (app password): ');
  const fromEmail = await question('From Email (default: noreply@yourcompany.com): ') || 'noreply@yourcompany.com';
  const fromName = await question('From Name (default: Your Company Name): ') || 'Your Company Name';
  const replyToEmail = await question('Reply To Email (default: support@yourcompany.com): ') || 'support@yourcompany.com';

  // Company Information
  console.log('\n🏢 COMPANY INFORMATION');
  console.log('======================');
  const companyName = await question('Company Name (default: Your Company Name): ') || 'Your Company Name';
  const companyAddress = await question('Company Address: ');
  const companyPhone = await question('Company Phone (default: +1-XXX-XXX-XXXX): ') || '+1-XXX-XXX-XXXX';
  const companyEmail = await question('Company Email (default: info@yourcompany.com): ') || 'info@yourcompany.com';
  const companyWebsite = await question('Company Website (default: https://yourcompany.com): ') || 'https://yourcompany.com';

  // Application Configuration
  console.log('\n⚙️  APPLICATION CONFIGURATION');
  console.log('============================');
  const nodeEnv = await question('Environment (development/production) [development]: ') || 'development';
  const port = await question('Port (default: 5000): ') || '5000';
  const sessionSecret = await question('Session Secret (press Enter for auto-generated): ') || uuidv4();
  const adminPassword = await question('Admin Password (default: admin123): ') || 'admin123';

  // Tally Integration (Optional)
  console.log('\n🔗 TALLY INTEGRATION (Optional)');
  console.log('===============================');
  const tallyEnabled = await question('Enable Tally Integration? (y/N): ').then(answer => answer.toLowerCase() === 'y' ? 'true' : 'false');
  let tallyServerUrl = '';
  let tallyUsername = '';
  let tallyPassword = '';
  
  if (tallyEnabled === 'true') {
    tallyServerUrl = await question('Tally Server URL: ');
    tallyUsername = await question('Tally Username: ');
    tallyPassword = await question('Tally Password: ');
  }

  // API Configuration
  console.log('\n🔌 API CONFIGURATION');
  console.log('====================');
  const apiEnabled = await question('Enable API Access? (Y/n): ').then(answer => answer.toLowerCase() === 'n' ? 'false' : 'true');
  const apiRateLimit = await question('API Rate Limit per minute (default: 100): ') || '100';
  const apiToken = await question('API Token (press Enter for auto-generated): ') || uuidv4();

  // Generate system user ID
  const systemUserId = uuidv4();

  // Create .env content
  const envContent = `# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_URL="${databaseUrl}"

# ===========================================
# OPENAI API CONFIGURATION
# ===========================================
OPENAI_API_KEY="${openaiKey}"

# ===========================================
# EMAIL CONFIGURATION
# ===========================================
# SMTP Settings
SMTP_HOST="${smtpHost}"
SMTP_PORT="${smtpPort}"
SMTP_SECURE="false"
SMTP_USER="${smtpUser}"
SMTP_PASS="${smtpPass}"

# Email Settings
FROM_EMAIL="${fromEmail}"
FROM_NAME="${fromName}"
REPLY_TO_EMAIL="${replyToEmail}"

# ===========================================
# COMPANY INFORMATION
# ===========================================
COMPANY_NAME="${companyName}"
COMPANY_ADDRESS="${companyAddress}"
COMPANY_PHONE="${companyPhone}"
COMPANY_EMAIL="${companyEmail}"
COMPANY_WEBSITE="${companyWebsite}"
COMPANY_LOGO="https://yourcompany.com/logo.png"

# ===========================================
# APPLICATION CONFIGURATION
# ===========================================
NODE_ENV="${nodeEnv}"
PORT="${port}"
SESSION_SECRET="${sessionSecret}"

# ===========================================
# ADMIN USER CONFIGURATION
# ===========================================
INIT_ADMIN_PASSWORD="${adminPassword}"

# ===========================================
# TALLY INTEGRATION
# ===========================================
TALLY_ENABLED="${tallyEnabled}"
TALLY_SERVER_URL="${tallyServerUrl}"
TALLY_USERNAME="${tallyUsername}"
TALLY_PASSWORD="${tallyPassword}"

# ===========================================
# API CONFIGURATION
# ===========================================
API_ENABLED="${apiEnabled}"
API_RATE_LIMIT="${apiRateLimit}"
API_TOKEN="${apiToken}"

# ===========================================
# SYSTEM USER CONFIGURATION
# ===========================================
SYSTEM_USER_ID="${systemUserId}"
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Environment configuration saved to .env file');
    console.log('\n🚀 You can now run the application with: npm run dev');
    console.log('\n📝 Note: Make sure to keep your .env file secure and never commit it to version control.');
    console.log('\n🔧 Configuration Summary:');
    console.log(`   - Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'Configured'}`);
    console.log(`   - OpenAI: ${openaiKey.substring(0, 8)}...`);
    console.log(`   - Email: ${fromEmail}`);
    console.log(`   - Company: ${companyName}`);
    console.log(`   - Port: ${port}`);
    console.log(`   - Tally: ${tallyEnabled === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`   - API: ${apiEnabled === 'true' ? 'Enabled' : 'Disabled'}`);
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    process.exit(1);
  }

  rl.close();
}

setupEnvironment().catch(console.error);
