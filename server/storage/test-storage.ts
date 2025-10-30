/**
 * Test Storage Implementation
 * 
 * A simple in-memory storage implementation for development and testing
 * when database connections fail.
 */

import type { IStorage } from './interfaces.js';

export class TestStorage implements IStorage {
  private data: {
    users: any[];
    customers: any[];
    suppliers: any[];
    items: any[];
    enquiries: any[];
    quotations: any[];
    salesOrders: any[];
    invoices: any[];
    // Add other data stores as needed
  } = {
    users: [],
    customers: [],
    suppliers: [],
    items: [],
    enquiries: [],
    quotations: [],
    salesOrders: [],
    invoices: [],
  };

  constructor() {
    console.log('[TEST-STORAGE] Initialized with empty data');
    this.initializeTestData();
  }

  private initializeTestData() {
    // Add some basic test data
    this.data.users = [
      {
        id: 'test-user-1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        passwordHash: '$2a$10$test.hash.for.admin',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.data.customers = [
      {
        id: 'test-customer-1',
        name: 'Test Customer',
        email: 'customer@example.com',
        phone: '123-456-7890',
        address: '123 Test St',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.data.suppliers = [
      {
        id: 'test-supplier-1',
        name: 'Test Supplier',
        email: 'supplier@example.com',
        phone: '098-765-4321',
        address: '456 Supplier Ave',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  // User operations
  async createUser(userData: any): Promise<any> {
    const user = { id: `user-${Date.now()}`, ...userData, createdAt: new Date(), updatedAt: new Date() };
    this.data.users.push(user);
    return user;
  }

  async getUserById(id: string): Promise<any> {
    return this.data.users.find(u => u.id === id) || null;
  }

  async getUserByUsername(username: string): Promise<any> {
    return this.data.users.find(u => u.username === username) || null;
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    this.data.users[index] = { ...this.data.users[index], ...updates, updatedAt: new Date() };
    return this.data.users[index];
  }

  async deleteUser(id: string): Promise<boolean> {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.data.users.splice(index, 1);
    return true;
  }

  async listUsers(): Promise<any[]> {
    return [...this.data.users];
  }

  // Customer operations
  async createCustomer(customerData: any): Promise<any> {
    const customer = { id: `customer-${Date.now()}`, ...customerData, createdAt: new Date(), updatedAt: new Date() };
    this.data.customers.push(customer);
    return customer;
  }

  async getCustomerById(id: string): Promise<any> {
    return this.data.customers.find(c => c.id === id) || null;
  }

  async updateCustomer(id: string, updates: any): Promise<any> {
    const index = this.data.customers.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.data.customers[index] = { ...this.data.customers[index], ...updates, updatedAt: new Date() };
    return this.data.customers[index];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const index = this.data.customers.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.data.customers.splice(index, 1);
    return true;
  }

  async listCustomers(): Promise<any[]> {
    return [...this.data.customers];
  }

  // Supplier operations
  async createSupplier(supplierData: any): Promise<any> {
    const supplier = { id: `supplier-${Date.now()}`, ...supplierData, createdAt: new Date(), updatedAt: new Date() };
    this.data.suppliers.push(supplier);
    return supplier;
  }

  async getSupplierById(id: string): Promise<any> {
    return this.data.suppliers.find(s => s.id === id) || null;
  }

  async updateSupplier(id: string, updates: any): Promise<any> {
    const index = this.data.suppliers.findIndex(s => s.id === id);
    if (index === -1) return null;
    this.data.suppliers[index] = { ...this.data.suppliers[index], ...updates, updatedAt: new Date() };
    return this.data.suppliers[index];
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const index = this.data.suppliers.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.data.suppliers.splice(index, 1);
    return true;
  }

  async listSuppliers(): Promise<any[]> {
    return [...this.data.suppliers];
  }

  // Item operations
  async createItem(itemData: any): Promise<any> {
    const item = { id: `item-${Date.now()}`, ...itemData, createdAt: new Date(), updatedAt: new Date() };
    this.data.items.push(item);
    return item;
  }

  async getItemById(id: string): Promise<any> {
    return this.data.items.find(i => i.id === id) || null;
  }

  async updateItem(id: string, updates: any): Promise<any> {
    const index = this.data.items.findIndex(i => i.id === id);
    if (index === -1) return null;
    this.data.items[index] = { ...this.data.items[index], ...updates, updatedAt: new Date() };
    return this.data.items[index];
  }

  async deleteItem(id: string): Promise<boolean> {
    const index = this.data.items.findIndex(i => i.id === id);
    if (index === -1) return false;
    this.data.items.splice(index, 1);
    return true;
  }

  async listItems(): Promise<any[]> {
    return [...this.data.items];
  }

  // Enquiry operations
  async createEnquiry(enquiryData: any): Promise<any> {
    const enquiry = { id: `enquiry-${Date.now()}`, ...enquiryData, createdAt: new Date(), updatedAt: new Date() };
    this.data.enquiries.push(enquiry);
    return enquiry;
  }

  async getEnquiryById(id: string): Promise<any> {
    return this.data.enquiries.find(e => e.id === id) || null;
  }

  async updateEnquiry(id: string, updates: any): Promise<any> {
    const index = this.data.enquiries.findIndex(e => e.id === id);
    if (index === -1) return null;
    this.data.enquiries[index] = { ...this.data.enquiries[index], ...updates, updatedAt: new Date() };
    return this.data.enquiries[index];
  }

  async deleteEnquiry(id: string): Promise<boolean> {
    const index = this.data.enquiries.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.data.enquiries.splice(index, 1);
    return true;
  }

  async listEnquiries(): Promise<any[]> {
    return [...this.data.enquiries];
  }

  // Quotation operations
  async createQuotation(quotationData: any): Promise<any> {
    const quotation = { id: `quotation-${Date.now()}`, ...quotationData, createdAt: new Date(), updatedAt: new Date() };
    this.data.quotations.push(quotation);
    return quotation;
  }

  async getQuotationById(id: string): Promise<any> {
    return this.data.quotations.find(q => q.id === id) || null;
  }

  async updateQuotation(id: string, updates: any): Promise<any> {
    const index = this.data.quotations.findIndex(q => q.id === id);
    if (index === -1) return null;
    this.data.quotations[index] = { ...this.data.quotations[index], ...updates, updatedAt: new Date() };
    return this.data.quotations[index];
  }

  async deleteQuotation(id: string): Promise<boolean> {
    const index = this.data.quotations.findIndex(q => q.id === id);
    if (index === -1) return false;
    this.data.quotations.splice(index, 1);
    return true;
  }

  async listQuotations(): Promise<any[]> {
    return [...this.data.quotations];
  }

  // Sales Order operations
  async createSalesOrder(salesOrderData: any): Promise<any> {
    const salesOrder = { id: `sales-order-${Date.now()}`, ...salesOrderData, createdAt: new Date(), updatedAt: new Date() };
    this.data.salesOrders.push(salesOrder);
    return salesOrder;
  }

  async getSalesOrderById(id: string): Promise<any> {
    return this.data.salesOrders.find(so => so.id === id) || null;
  }

  async updateSalesOrder(id: string, updates: any): Promise<any> {
    const index = this.data.salesOrders.findIndex(so => so.id === id);
    if (index === -1) return null;
    this.data.salesOrders[index] = { ...this.data.salesOrders[index], ...updates, updatedAt: new Date() };
    return this.data.salesOrders[index];
  }

  async deleteSalesOrder(id: string): Promise<boolean> {
    const index = this.data.salesOrders.findIndex(so => so.id === id);
    if (index === -1) return false;
    this.data.salesOrders.splice(index, 1);
    return true;
  }

  async listSalesOrders(): Promise<any[]> {
    return [...this.data.salesOrders];
  }

  // Invoice operations
  async createInvoice(invoiceData: any): Promise<any> {
    const invoice = { id: `invoice-${Date.now()}`, ...invoiceData, createdAt: new Date(), updatedAt: new Date() };
    this.data.invoices.push(invoice);
    return invoice;
  }

  async getInvoiceById(id: string): Promise<any> {
    return this.data.invoices.find(i => i.id === id) || null;
  }

  async updateInvoice(id: string, updates: any): Promise<any> {
    const index = this.data.invoices.findIndex(i => i.id === id);
    if (index === -1) return null;
    this.data.invoices[index] = { ...this.data.invoices[index], ...updates, updatedAt: new Date() };
    return this.data.invoices[index];
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const index = this.data.invoices.findIndex(i => i.id === id);
    if (index === -1) return false;
    this.data.invoices.splice(index, 1);
    return true;
  }

  async listInvoices(): Promise<any[]> {
    return [...this.data.invoices];
  }

  // Stub implementations for other required methods
  // These can be expanded as needed for specific functionality

  async createEnquiryItem(itemData: any): Promise<any> {
    return { id: `enquiry-item-${Date.now()}`, ...itemData, createdAt: new Date(), updatedAt: new Date() };
  }

  async getEnquiryItemById(id: string): Promise<any> {
    return null;
  }

  async updateEnquiryItem(id: string, updates: any): Promise<any> {
    return null;
  }

  async deleteEnquiryItem(id: string): Promise<boolean> {
    return false;
  }

  async listEnquiryItems(): Promise<any[]> {
    return [];
  }

  async createQuotationItem(itemData: any): Promise<any> {
    return { id: `quotation-item-${Date.now()}`, ...itemData, createdAt: new Date(), updatedAt: new Date() };
  }

  async getQuotationItemById(id: string): Promise<any> {
    return null;
  }

  async updateQuotationItem(id: string, updates: any): Promise<any> {
    return null;
  }

  async deleteQuotationItem(id: string): Promise<boolean> {
    return false;
  }

  async listQuotationItems(): Promise<any[]> {
    return [];
  }

  // Add more stub methods as needed for the IStorage interface
  // For now, we'll implement the most commonly used methods

  // Generic search method
  async search(query: string, type?: string): Promise<any[]> {
    const results: any[] = [];
    
    if (!type || type === 'customers') {
      results.push(...this.data.customers.filter(c => 
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.email?.toLowerCase().includes(query.toLowerCase())
      ));
    }
    
    if (!type || type === 'suppliers') {
      results.push(...this.data.suppliers.filter(s => 
        s.name?.toLowerCase().includes(query.toLowerCase()) ||
        s.email?.toLowerCase().includes(query.toLowerCase())
      ));
    }
    
    if (!type || type === 'items') {
      results.push(...this.data.items.filter(i => 
        i.name?.toLowerCase().includes(query.toLowerCase()) ||
        i.description?.toLowerCase().includes(query.toLowerCase())
      ));
    }
    
    return results;
  }

  // Audit logging
  async logAudit(action: string, details: any): Promise<void> {
    console.log(`[AUDIT] ${action}:`, details);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; message: string }> {
    return {
      status: 'healthy',
      message: 'Test storage is running with in-memory data'
    };
  }
}
