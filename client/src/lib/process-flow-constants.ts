// Process Flow Constants - 12 Step End-to-End Automation
// From Customer Enquiry to Invoicing

export interface ProcessFlowStep {
  id: number;
  name: string;
  path: string;
  icon: string;
  color: string;
  description: string;
  estimatedDuration: number; // days
  requiredFields: string[];
  dependencies: number[];
  validationRules: Record<string, any>;
  successCriteria: string;
  nextActions: string[];
  module: 'Sales' | 'Purchase' | 'Inventory';
  subModule?: string;
  isOptional?: boolean;
  requiresApproval?: boolean;
  approvalLevel?: 'Manager' | 'Director' | 'Finance';
}

export const PROCESS_FLOW_STEPS: ProcessFlowStep[] = [
  {
    id: 1,
    name: "Customer Management",
    path: "/customers",
    icon: "fas fa-users",
    color: "text-blue-700",
    description: "Create and manage customer information, profiles, and relationships",
    estimatedDuration: 1,
    requiredFields: ["customerName", "contactInfo", "customerType", "classification", "creditLimit", "paymentTerms"],
    dependencies: [],
    validationRules: {
      customerName: { required: true, minLength: 2 },
      contactInfo: { required: true, type: "email" },
      customerType: { required: true, enum: ["Retail", "Wholesale"] },
      classification: { required: true, enum: ["Internal", "Corporate", "Individual", "Family", "Ministry"] },
      creditLimit: { required: true, type: "number", min: 0 },
      paymentTerms: { required: true, enum: ["Net 30", "Net 15", "COD", "Prepaid"] }
    },
    successCriteria: "Customer profile created with complete information and credit approval",
    nextActions: ["Create enquiry for customer"],
    module: "Sales",
    subModule: "Customer Management"
  },
  {
    id: 2,
    name: "Enquiry Management",
    path: "/enquiries",
    icon: "fas fa-question-circle",
    color: "text-amber-500",
    description: "Process customer enquiry, requirements, and initial qualification",
    estimatedDuration: 2,
    requiredFields: ["enquiryDetails", "productRequirements", "quantity", "urgency", "source", "expectedDelivery"],
    dependencies: [1],
    validationRules: {
      enquiryDetails: { required: true, minLength: 10 },
      productRequirements: { required: true, minLength: 5 },
      quantity: { required: true, type: "number", min: 1 },
      urgency: { required: true, enum: ["Low", "Medium", "High", "Urgent"] },
      source: { required: true, enum: ["Email", "Phone", "Web Form", "Walk-in", "Referral"] },
      expectedDelivery: { required: true, type: "date" }
    },
    successCriteria: "Enquiry details captured, qualified, and status set to 'In Progress'",
    nextActions: ["Generate quotation"],
    module: "Sales",
    subModule: "Enquiry Management"
  },
  {
    id: 3,
    name: "Quotation Management",
    path: "/quotations",
    icon: "fas fa-file-alt",
    color: "text-blue-500",
    description: "Generate, manage, and track quotations with pricing and terms",
    estimatedDuration: 1,
    requiredFields: ["quotationNumber", "lineItems", "pricing", "validityPeriod", "termsAndConditions", "discounts"],
    dependencies: [2],
    validationRules: {
      quotationNumber: { required: true, pattern: "^QT-\\d{4}-\\d{3}$" },
      lineItems: { required: true, minItems: 1 },
      pricing: { required: true, type: "object" },
      validityPeriod: { required: true, type: "number", min: 1 },
      termsAndConditions: { required: true, minLength: 20 },
      discounts: { required: false, type: "object" }
    },
    successCriteria: "Quotation generated, approved, and sent to customer",
    nextActions: ["Wait for customer acceptance"],
    module: "Sales",
    subModule: "Quotation Management",
    requiresApproval: true,
    approvalLevel: "Manager"
  },
  {
    id: 4,
    name: "Customer PO Upload",
    path: "/customer-po-upload",
    icon: "fas fa-upload",
    color: "text-purple-500",
    description: "Upload, validate, and process customer purchase orders",
    estimatedDuration: 1,
    requiredFields: ["poDocument", "poNumber", "poDate", "poAmount", "poTerms", "poValidation"],
    dependencies: [3],
    validationRules: {
      poDocument: { required: true, type: "file" },
      poNumber: { required: true, minLength: 3 },
      poDate: { required: true, type: "date" },
      poAmount: { required: true, type: "number", min: 0 },
      poTerms: { required: true, minLength: 5 },
      poValidation: { required: true, type: "boolean" }
    },
    successCriteria: "Customer PO uploaded, validated, and approved",
    nextActions: ["Generate sales order"],
    module: "Sales",
    subModule: "Customer PO Management"
  },
  {
    id: 5,
    name: "Sales Order Management",
    path: "/sales-orders",
    icon: "fas fa-shopping-cart",
    color: "text-green-600",
    description: "Create, manage, and track sales orders from customer POs",
    estimatedDuration: 1,
    requiredFields: ["salesOrderNumber", "orderItems", "totalAmount", "deliveryDate", "paymentTerms", "orderStatus"],
    dependencies: [4],
    validationRules: {
      salesOrderNumber: { required: true, pattern: "^SO-\\d{4}-\\d{3}$" },
      orderItems: { required: true, minItems: 1 },
      totalAmount: { required: true, type: "number", min: 0 },
      deliveryDate: { required: true, type: "date" },
      paymentTerms: { required: true, enum: ["Net 30", "Net 15", "COD", "Prepaid"] },
      orderStatus: { required: true, enum: ["Draft", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"] }
    },
    successCriteria: "Sales order created, confirmed, and ready for fulfillment",
    nextActions: ["Generate delivery note"],
    module: "Sales",
    subModule: "Sales Order Management"
  },
  {
    id: 6,
    name: "Delivery Note Management",
    path: "/delivery-note",
    icon: "fas fa-truck-moving",
    color: "text-blue-600",
    description: "Create delivery notes, manage shipments, and track deliveries",
    estimatedDuration: 1,
    requiredFields: ["deliveryNoteNumber", "deliveryAddress", "deliveryDate", "carrierDetails", "trackingNumber", "deliveryStatus"],
    dependencies: [5],
    validationRules: {
      deliveryNoteNumber: { required: true, pattern: "^DN-\\d{4}-\\d{3}$" },
      deliveryAddress: { required: true, minLength: 10 },
      deliveryDate: { required: true, type: "date" },
      carrierDetails: { required: true, type: "object" },
      trackingNumber: { required: true, minLength: 5 },
      deliveryStatus: { required: true, enum: ["Prepared", "Dispatched", "In Transit", "Delivered", "Returned"] }
    },
    successCriteria: "Delivery note created and goods dispatched to customer",
    nextActions: ["Generate invoice"],
    module: "Sales",
    subModule: "Delivery Management"
  },
  {
    id: 7,
    name: "Invoicing Management",
    path: "/invoicing",
    icon: "fas fa-file-invoice",
    color: "text-green-600",
    description: "Generate, send, and track invoices and payments",
    estimatedDuration: 1,
    requiredFields: ["invoiceNumber", "invoiceDate", "lineItems", "totalAmount", "paymentInstructions", "invoiceStatus"],
    dependencies: [6],
    validationRules: {
      invoiceNumber: { required: true, pattern: "^INV-\\d{4}-\\d{3}$" },
      invoiceDate: { required: true, type: "date" },
      lineItems: { required: true, minItems: 1 },
      totalAmount: { required: true, type: "number", min: 0 },
      paymentInstructions: { required: true, minLength: 10 },
      invoiceStatus: { required: true, enum: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"] }
    },
    successCriteria: "Invoice generated, sent to customer, and payment tracked",
    nextActions: ["Track payment and close order"],
    module: "Sales",
    subModule: "Invoicing Management"
  },
  {
    id: 8,
    name: "Supplier Management",
    path: "/suppliers",
    icon: "fas fa-truck",
    color: "text-indigo-600",
    description: "Manage supplier information, contracts, and performance",
    estimatedDuration: 1,
    requiredFields: ["supplierName", "contactInfo", "supplierType", "contractDetails", "performanceRating", "paymentTerms"],
    dependencies: [],
    validationRules: {
      supplierName: { required: true, minLength: 2 },
      contactInfo: { required: true, type: "email" },
      supplierType: { required: true, enum: ["Manufacturer", "Distributor", "Service Provider", "Local Supplier"] },
      contractDetails: { required: true, type: "object" },
      performanceRating: { required: true, type: "number", min: 1, max: 5 },
      paymentTerms: { required: true, enum: ["Net 30", "Net 15", "COD", "Prepaid"] }
    },
    successCriteria: "Supplier profile created with complete information and contract established",
    nextActions: ["Create requisition"],
    module: "Purchase",
    subModule: "Supplier Management"
  },
  {
    id: 9,
    name: "Requisition Management",
    path: "/requisitions",
    icon: "fas fa-clipboard-list",
    color: "text-orange-500",
    description: "Create and manage internal requisitions for goods and services",
    estimatedDuration: 1,
    requiredFields: ["requisitionNumber", "requestedItems", "quantity", "urgency", "requestedBy", "department", "budgetCode"],
    dependencies: [8],
    validationRules: {
      requisitionNumber: { required: true, pattern: "^REQ-\\d{4}-\\d{3}$" },
      requestedItems: { required: true, minItems: 1 },
      quantity: { required: true, type: "number", min: 1 },
      urgency: { required: true, enum: ["Low", "Medium", "High", "Urgent"] },
      requestedBy: { required: true, minLength: 2 },
      department: { required: true, enum: ["Sales", "Operations", "IT", "Finance", "HR"] },
      budgetCode: { required: true, minLength: 3 }
    },
    successCriteria: "Requisition created, approved, and ready for quotation",
    nextActions: ["Request supplier quotes"],
    module: "Purchase",
    subModule: "Requisition Management",
    requiresApproval: true,
    approvalLevel: "Manager"
  },
  {
    id: 10,
    name: "Supplier Quotes Management",
    path: "/supplier-quotes",
    icon: "fas fa-file-contract",
    color: "text-amber-600",
    description: "Request, receive, and evaluate supplier quotations",
    estimatedDuration: 3,
    requiredFields: ["quoteNumber", "supplierDetails", "quoteItems", "pricing", "validityPeriod", "evaluationScore"],
    dependencies: [9],
    validationRules: {
      quoteNumber: { required: true, pattern: "^SQ-\\d{4}-\\d{3}$" },
      supplierDetails: { required: true, type: "object" },
      quoteItems: { required: true, minItems: 1 },
      pricing: { required: true, type: "object" },
      validityPeriod: { required: true, type: "number", min: 1 },
      evaluationScore: { required: true, type: "number", min: 1, max: 10 }
    },
    successCriteria: "Supplier quotes received, evaluated, and best quote selected",
    nextActions: ["Generate supplier LPO"],
    module: "Purchase",
    subModule: "Supplier Quotes Management"
  },
  {
    id: 11,
    name: "Supplier LPO Management",
    path: "/supplier-lpo",
    icon: "fas fa-handshake",
    color: "text-indigo-500",
    description: "Create, send, and track Local Purchase Orders to suppliers",
    estimatedDuration: 1,
    requiredFields: ["lpoNumber", "supplierDetails", "orderItems", "deliveryInstructions", "paymentTerms", "lpoStatus"],
    dependencies: [10],
    validationRules: {
      lpoNumber: { required: true, pattern: "^LPO-\\d{4}-\\d{3}$" },
      supplierDetails: { required: true, type: "object" },
      orderItems: { required: true, minItems: 1 },
      deliveryInstructions: { required: true, minLength: 10 },
      paymentTerms: { required: true, enum: ["Net 30", "Net 15", "COD", "Prepaid"] },
      lpoStatus: { required: true, enum: ["Draft", "Sent", "Acknowledged", "Confirmed", "Cancelled"] }
    },
    successCriteria: "LPO sent to supplier and acknowledged",
    nextActions: ["Track shipment"],
    module: "Purchase",
    subModule: "Supplier LPO Management"
  },
  {
    id: 12,
    name: "Shipment Tracking",
    path: "/shipment-tracking",
    icon: "fas fa-shipping-fast",
    color: "text-cyan-500",
    description: "Track shipments, monitor delivery status, and manage logistics",
    estimatedDuration: 5,
    requiredFields: ["trackingNumber", "carrierDetails", "shipmentDate", "expectedDelivery", "currentStatus", "locationUpdates"],
    dependencies: [11],
    validationRules: {
      trackingNumber: { required: true, minLength: 5 },
      carrierDetails: { required: true, type: "object" },
      shipmentDate: { required: true, type: "date" },
      expectedDelivery: { required: true, type: "date" },
      currentStatus: { required: true, enum: ["Dispatched", "In Transit", "Out for Delivery", "Delivered", "Delayed"] },
      locationUpdates: { required: true, type: "array" }
    },
    successCriteria: "Shipment tracked and delivered successfully",
    nextActions: ["Complete order cycle"],
    module: "Purchase",
    subModule: "Shipment Tracking"
  }
];

// Helper functions
export const getStepById = (stepId: number): ProcessFlowStep | undefined => {
  return PROCESS_FLOW_STEPS.find(step => step.id === stepId);
};

export const getNextSteps = (currentStepId: number): ProcessFlowStep[] => {
  const currentStep = getStepById(currentStepId);
  if (!currentStep) return [];
  
  return PROCESS_FLOW_STEPS.filter(step => 
    step.dependencies.includes(currentStepId) || 
    (step.dependencies.length === 0 && step.id > currentStepId)
  );
};

export const calculateProgress = (completedSteps: number[], totalSteps: number): number => {
  return Math.round((completedSteps.length / totalSteps) * 100);
};

export const getStepStatus = (stepId: number, completedSteps: number[], currentStep: number): 'completed' | 'current' | 'pending' => {
  if (completedSteps.includes(stepId)) return 'completed';
  if (stepId === currentStep) return 'current';
  return 'pending';
};
