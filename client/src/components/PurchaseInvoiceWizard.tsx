import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateLineItemTotals, calculateDocumentTotals, validateCurrencyAmount } from "@/lib/currency-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  X,
  Loader2,
  Package,
  Building2,
  Calendar,
  DollarSign,
  FileDown,
  RefreshCw
} from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";

// Form schemas
const headerDetailsSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  supplierInvoiceNumber: z.string().min(1, "Supplier invoice number is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  status: z.string().default("Draft"),
  notes: z.string().optional(),
  totalAmount: z.number().min(0),
  taxAmount: z.number().min(0),
  subtotal: z.number().min(0),
});

const itemSchema = z.object({
  id: z.string(),
  itemDescription: z.string().min(1, "Item description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be greater than 0"),
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  taxPercent: z.number().min(0).max(100).default(0),
  taxAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
});

const itemsSchema = z.object({
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ItemForm = z.infer<typeof itemSchema>;
type ItemsForm = z.infer<typeof itemsSchema>;

interface PurchaseInvoiceWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: any[];
  goodsReceipts?: any[];
}

export default function PurchaseInvoiceWizard({ 
  open, 
  onOpenChange, 
  suppliers,
  goodsReceipts = []
}: PurchaseInvoiceWizardProps) {
  
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'BHD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Fetch supplier invoice numbers for suggestions
  const { data: supplierInvoiceNumbers = [], isLoading: supplierInvoiceNumbersLoading } = useQuery<string[]>({
    queryKey: ["/api/purchase-invoices/supplier-invoice-numbers"],
    queryFn: async () => {
      const resp = await fetch("/api/purchase-invoices/supplier-invoice-numbers");
      if (!resp.ok) throw new Error("Failed to load supplier invoice numbers");
      return resp.json();
    }
  });

  // Common payment terms for quick selection
  const commonPaymentTerms = [
    "Net 15",
    "Net 30", 
    "Net 45",
    "Net 60",
    "Due on Receipt",
    "Cash on Delivery",
    "2/10 Net 30",
    "1/15 Net 30"
  ];

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      invoiceNumber: "",
      supplierInvoiceNumber: "",
      supplierId: "",
      invoiceDate: "",
      dueDate: "",
      paymentTerms: "Net 30",
      status: "Draft",
      notes: "",
      totalAmount: 0,
      taxAmount: 0,
      subtotal: 0,
    },
  });

  // Auto-calculate due date when invoice date or payment terms change
  const calculateDueDate = (invoiceDate: string, paymentTerms: string) => {
    if (!invoiceDate) return "";
    
    const date = new Date(invoiceDate);
    if (isNaN(date.getTime())) return "";
    
    // Extract days from payment terms (e.g., "Net 30" -> 30, "Net 15" -> 15)
    const daysMatch = paymentTerms.match(/(\d+)/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 30;
    
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  // Watch for changes in invoice date and payment terms
  const watchedInvoiceDate = headerForm.watch("invoiceDate");
  const watchedPaymentTerms = headerForm.watch("paymentTerms");
  
  // Update due date when invoice date or payment terms change
  useEffect(() => {
    if (watchedInvoiceDate && watchedPaymentTerms) {
      const calculatedDueDate = calculateDueDate(watchedInvoiceDate, watchedPaymentTerms);
      if (calculatedDueDate && calculatedDueDate !== headerForm.getValues("dueDate")) {
        headerForm.setValue("dueDate", calculatedDueDate);
      }
    }
  }, [watchedInvoiceDate, watchedPaymentTerms, headerForm]);

  // Form for items
  const itemsForm = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Create purchase invoice mutation
  const createPurchaseInvoiceMutation = useMutation({
    mutationFn: async (data: { invoice: HeaderDetailsForm; items: ItemForm[] }) => {
      const response = await apiRequest("POST", "/api/purchase-invoices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      toast({
        title: "Success",
        description: "Purchase invoice created successfully",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase invoice",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setUploadedFile(null);
    setExtractedData(null);
    setIsProcessing(false);
    setItems([]);
    setWizardKey(prev => prev + 1);
    headerForm.reset({
      invoiceNumber: "",
      supplierInvoiceNumber: "",
      supplierId: "",
      invoiceDate: "",
      dueDate: "",
      paymentTerms: "",
      status: "Draft",
      notes: "",
      totalAmount: 0,
      taxAmount: 0,
      subtotal: 0,
    });
    itemsForm.reset({ items: [] });
    onOpenChange(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);
      
      // Reset state to ensure fresh data
      setExtractedData(null);
      setItems([]);
      headerForm.reset();
      itemsForm.reset();
      setWizardKey(prev => prev + 1);
      
      try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('document', file);
        
        // Call the document processing API
        const response = await fetch('/api/document-processing/extract-purchase-invoice?t=' + Date.now(), {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`Failed to process document: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Document processing result:', result);
        
        if (result.success && result.data) {
          setExtractedData(result.data);
          
          // Populate header form with extracted data
          const formData = {
            invoiceNumber: result.data.invoiceNumber || result.data.receiptNumber || "",
            supplierInvoiceNumber: result.data.supplierInvoiceNumber || "",
            supplierId: result.data.supplierId || "",
            invoiceDate: result.data.invoiceDate || result.data.receiptDate || "",
            dueDate: result.data.dueDate || "",
            paymentTerms: result.data.paymentTerms || "",
            status: result.data.status || "Draft",
            notes: result.data.notes || "",
            totalAmount: result.data.totalAmount || 0,
            taxAmount: result.data.taxAmount || 0,
            subtotal: result.data.subtotal || 0,
          };
          
          headerForm.reset(formData);
          
          // Convert extracted items to form format
          const convertedItems: ItemForm[] = result.data.items?.map((item: any, index: number) => {
            const quantity = parseFloat(item.quantity || item.receivedQuantity || 0);
            const unitPrice = parseFloat(item.unitPrice || item.unitCost || 0);
            const discountPercent = parseFloat(item.discountPercent || 0);
            const taxPercent = parseFloat(item.taxPercent || item.vatPercent || 0);
            
            const grossAmount = quantity * unitPrice;
            const discountAmount = (grossAmount * discountPercent) / 100;
            const netAmount = grossAmount - discountAmount;
            const taxAmount = (netAmount * taxPercent) / 100;
            const totalAmount = netAmount + taxAmount;
            
            return {
              id: item.id || `item-${index}`,
              itemDescription: item.itemDescription || item.description || item.itemName || "",
              quantity: quantity,
              unitPrice: unitPrice,
              discountPercent: discountPercent,
              discountAmount: discountAmount,
              taxPercent: taxPercent,
              taxAmount: taxAmount,
              totalAmount: totalAmount,
            };
          }) || [];
          
          setItems(convertedItems);
          itemsForm.setValue("items", convertedItems);
          recalculateTotals(convertedItems);
          
          console.log('Form updated with extracted data:', formData);
          
          // Show success message
          toast({
            title: "Document Processed Successfully",
            description: `Extracted ${convertedItems.length} items from the uploaded document. Please review and confirm the details.`,
          });
        } else {
          throw new Error(result.message || 'Failed to extract data from document');
        }
      } catch (error) {
        console.error('Error processing document:', error);
        toast({
          title: "Document Processing Failed",
          description: error instanceof Error ? error.message : "Failed to process document. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const recalculateTotals = (items: ItemForm[]) => {
    const totals = calculateDocumentTotals(items.map(item => ({
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      discountPercent: item.discountPercent || 0,
      taxPercent: item.taxPercent || 0,
      explicitDiscountAmount: item.discountAmount || 0
    })));
    
    headerForm.setValue("subtotal", totals.subtotal);
    headerForm.setValue("taxAmount", totals.totalTax);
    headerForm.setValue("totalAmount", totals.totalAmount);
  };

  const addItem = () => {
    const newItem: ItemForm = {
      id: `item-${Date.now()}`,
      itemDescription: "",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
      totalAmount: 0,
    };
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
    recalculateTotals(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
    recalculateTotals(updatedItems);
  };

  const updateItem = (index: number, field: keyof ItemForm, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate totals for the specific item using currency utilities
    const item = updatedItems[index];
    const calculation = calculateLineItemTotals(
      item.quantity || 0,
      item.unitPrice || 0,
      item.discountPercent || 0,
      item.taxPercent || 0,
      item.discountAmount || 0
    );
    
    updatedItems[index] = {
      ...item,
      discountAmount: calculation.discountAmount,
      taxAmount: calculation.taxAmount,
      totalAmount: calculation.totalAmount
    };
    
    setItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
    recalculateTotals(updatedItems);
  };

  const nextStep = () => {
    if (currentStep === 1) {
      headerForm.handleSubmit(() => setCurrentStep(2))();
    } else if (currentStep === 2) {
      itemsForm.handleSubmit(() => setCurrentStep(3))();
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    const headerData = headerForm.getValues();
    const itemsData = itemsForm.getValues();
    
    createPurchaseInvoiceMutation.mutate({
      invoice: headerData,
      items: itemsData.items,
    });
  };

  const steps = [
    { number: 1, title: "Upload Document", description: "Upload purchase invoice PDF" },
    { number: 2, title: "Review Details", description: "Verify extracted information" },
    { number: 3, title: "Confirm Items", description: "Review and edit items" },
    { number: 4, title: "Create Invoice", description: "Final confirmation" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            Purchase Invoice Wizard
          </DialogTitle>
          <DialogDescription>
            Create a new purchase invoice by uploading a document or entering details manually
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.number 
                  ? 'bg-blue-600 border-blue-600 text-white' 
                  : 'border-gray-300 text-gray-500'
              }`}>
                {currentStep > step.number ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{step.number}</span>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  currentStep >= step.number ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload Document */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Purchase Invoice Document
                </CardTitle>
                <CardDescription>
                  Upload a PDF document to automatically extract invoice details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  {uploadedFile ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle className="h-8 w-8" />
                        <span className="text-lg font-medium">{uploadedFile.name}</span>
                      </div>
                      {isProcessing ? (
                        <div className="space-y-2">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          <p className="text-sm text-gray-600">Processing document...</p>
                          <Progress value={75} className="w-full max-w-xs mx-auto" />
                        </div>
                      ) : extractedData ? (
                        <div className="space-y-2">
                          <p className="text-sm text-green-600">Document processed successfully!</p>
                          <p className="text-xs text-gray-500">
                            Found {extractedData.items?.length || 0} items
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Upload Different File
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-lg font-medium text-gray-900">Upload Purchase Invoice</p>
                        <p className="text-sm text-gray-500">PDF files only, up to 10MB</p>
                      </div>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                    </div>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={nextStep}
                disabled={!extractedData && !uploadedFile}
              >
                Next: Review Details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Form {...headerForm}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Invoice Details
                  </CardTitle>
                  <CardDescription>
                    Review and edit the extracted invoice information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={headerForm.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="INV-001" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={headerForm.control}
                      name="supplierInvoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Invoice Number *</FormLabel>
                          <FormControl>
                            <Autocomplete
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              placeholder="Supplier's invoice reference"
                              suggestions={supplierInvoiceNumbers}
                              disabled={supplierInvoiceNumbersLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={headerForm.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliers.map(supplier => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={headerForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Draft">Draft</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={headerForm.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={headerForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={headerForm.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms *</FormLabel>
                        <FormControl>
                          <Autocomplete
                            value={field.value}
                            onValueChange={field.onChange}
                            suggestions={commonPaymentTerms}
                            placeholder="e.g., Net 30"
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={headerForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Additional notes..." rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </Form>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button onClick={nextStep}>
                Next: Review Items
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm Items */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Invoice Items
                    </CardTitle>
                    <CardDescription>
                      Review and edit the extracted items
                    </CardDescription>
                  </div>
                  <Button onClick={addItem} size="sm">
                    <Package className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Item Description</Label>
                          <Input
                            value={item.itemDescription}
                            onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                            placeholder="Item description"
                          />
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                updateItem(index, 'quantity', value);
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                updateItem(index, 'unitPrice', value);
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Discount %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountPercent}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 100) {
                                updateItem(index, 'discountPercent', value);
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Tax %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.taxPercent}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 100) {
                                updateItem(index, 'taxPercent', value);
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Discount Amount</Label>
                          <Input
                            type="number"
                            value={item.discountAmount.toFixed(2)}
                            readOnly
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <Label>Tax Amount</Label>
                          <Input
                            type="number"
                            value={item.taxAmount.toFixed(2)}
                            readOnly
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <Label>Total Amount</Label>
                          <Input
                            type="number"
                            value={item.totalAmount.toFixed(2)}
                            readOnly
                            className="bg-gray-50 font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button onClick={nextStep}>
                Next: Create Invoice
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Create Invoice */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Final Confirmation
                </CardTitle>
                <CardDescription>
                  Review all details before creating the purchase invoice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Invoice Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Invoice Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Invoice Number:</span>
                      <span className="ml-2 font-medium">{headerForm.getValues('invoiceNumber')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Supplier:</span>
                      <span className="ml-2 font-medium">
                        {suppliers.find(s => s.id === headerForm.getValues('supplierId'))?.name || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Invoice Date:</span>
                      <span className="ml-2 font-medium">{headerForm.getValues('invoiceDate')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Due Date:</span>
                      <span className="ml-2 font-medium">{headerForm.getValues('dueDate')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <Badge variant="secondary" className="ml-2">
                        {headerForm.getValues('status')}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Items:</span>
                      <span className="ml-2 font-medium">{items.length}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Financial Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(headerForm.getValues('subtotal') || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax Amount:</span>
                      <span className="font-medium">{formatCurrency(headerForm.getValues('taxAmount') || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600 font-medium">Total Amount:</span>
                      <span className="font-bold text-lg">{formatCurrency(headerForm.getValues('totalAmount') || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Items Summary */}
                <div>
                  <h4 className="font-medium mb-3">Items Summary</h4>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={item.id} className="flex justify-between text-sm border-b pb-1">
                        <span>{item.itemDescription}</span>
                        <span className="font-medium">{formatCurrency(item.totalAmount || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createPurchaseInvoiceMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createPurchaseInvoiceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Purchase Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
