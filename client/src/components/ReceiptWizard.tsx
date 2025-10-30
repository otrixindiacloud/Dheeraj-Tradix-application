import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Edit3, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  X, 
  AlertCircle,
  Package,
  Calendar,
  User,
  Building2,
  DollarSign,
  Loader2,
  Plus,
  Trash2
} from "lucide-react";

// Form schemas for each step
const headerDetailsSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  receiptDate: z.string().min(1, "Receipt date is required"),
  receivedBy: z.string().min(1, "Received by is required"),
  status: z.enum(["Pending", "Partial", "Completed", "Discrepancy"]),
  notes: z.string().optional(),
  // Additional optional header fields
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  supplierName: z.string().optional(),
  paymentTerms: z.string().optional(),
  dueDate: z.string().optional(),
  supplierAddress: z.string().optional(),
  supplierContactPerson: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string(),
  serialNo: z.number(),
  itemDescription: z.string(),
  quantity: z.number().min(0),
  unitCost: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  discountAmount: z.number().min(0),
  netTotal: z.number().min(0),
  vatPercent: z.number().min(0).max(100),
  vatAmount: z.number().min(0),
  itemName: z.string().optional(),
  description: z.string().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  receivedQuantity: z.number().optional(),
});

const itemsSchema = z.object({
  items: z.array(itemSchema),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ItemForm = z.infer<typeof itemSchema>;
type ItemsForm = z.infer<typeof itemsSchema>;

interface ReceiptWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierLpos?: any[];
}

export default function ReceiptWizard({ open, onOpenChange, supplierLpos = [] }: ReceiptWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      receiptNumber: "",
      supplierId: "",
      receiptDate: new Date().toISOString().split('T')[0],
      receivedBy: "",
      status: "Pending",
      notes: "",
      invoiceNumber: "",
      invoiceDate: "",
      supplierName: "",
      paymentTerms: "",
      dueDate: "",
      supplierAddress: "",
      supplierContactPerson: "",
    },
  });

  // Form for items
  const itemsForm = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Create receipt mutation
  const createReceiptMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm) => {
      // Helper function to convert empty strings to null
      const toNullableString = (value?: string) => {
        if (!value || value.trim() === '') return null;
        return value.trim();
      };

      const toNullableDate = (value?: string) => {
        if (!value || value.trim() === '') return null;
        const trimmed = value.trim();
        // Convert to ISO string if it's a valid date
        const date = new Date(trimmed);
        return isNaN(date.getTime()) ? trimmed : date.toISOString();
      };

      const additionalInfo = {
        invoiceNumber: toNullableString(data.invoiceNumber),
        invoiceDate: toNullableDate(data.invoiceDate),
        supplierName: toNullableString(data.supplierName),
        paymentTerms: toNullableString(data.paymentTerms),
        dueDate: toNullableDate(data.dueDate),
        supplierAddress: toNullableString(data.supplierAddress),
        supplierContactPerson: toNullableString(data.supplierContactPerson),
        items: items,
      };

      const receiptData = {
        receiptNumber: data.receiptNumber,
        supplierId: data.supplierId,
        receiptDate: data.receiptDate ? (typeof data.receiptDate === 'string' ? data.receiptDate : data.receiptDate.toISOString()) : new Date().toISOString(),
        receivedBy: data.receivedBy,
        status: data.status,
        notes: toNullableString(data.notes),
        ...additionalInfo,
      };

      const response = await apiRequest("POST", "/api/material-receipts", receiptData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["material-receipts"] });
      toast({
        title: "Success",
        description: "Material receipt created successfully",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create material receipt",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setItems([]);
    headerForm.reset();
    itemsForm.reset();
    setWizardKey(prev => prev + 1);
    onOpenChange(false);
  };

  const handleAddItem = () => {
    const newItem: ItemForm = {
      id: `item-${Date.now()}`,
      serialNo: items.length + 1,
      itemDescription: '',
      quantity: 0,
      unitCost: 0,
      discountPercent: 0,
      discountAmount: 0,
      netTotal: 0,
      vatPercent: 0,
      vatAmount: 0,
      itemName: '',
      description: '',
      unitPrice: 0,
      totalPrice: 0,
      receivedQuantity: 0,
    };
    setItems([...items, newItem]);
  };

  const handleItemChange = (itemId: string, field: keyof ItemForm, value: any) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const nextStep = () => {
    if (currentStep === 1) {
      // Validate step 1 before proceeding
      headerForm.trigger().then((isValid) => {
        if (isValid && headerForm.watch('supplierId')) {
          setCurrentStep(2);
        }
      });
    } else if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: HeaderDetailsForm) => {
    console.log('Creating receipt with data:', data);
    console.log('Items to save:', items);
    
    // Validate that we have required data
    if (!data.supplierId) {
      toast({
        title: "Validation Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.receiptNumber) {
      toast({
        title: "Validation Error", 
        description: "Please enter a receipt number",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.receivedBy) {
      toast({
        title: "Validation Error",
        description: "Please enter who received the materials",
        variant: "destructive",
      });
      return;
    }
    
    createReceiptMutation.mutate(data);
  };

  const steps = [
    { number: 1, title: "Receipt Info", description: "Basic receipt information" },
    { number: 2, title: "Items", description: "Add receipt items" },
    { number: 3, title: "Review", description: "Review and create" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-responsive flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Material Receipt
          </DialogTitle>
          <DialogDescription>
            Create a new material receipt with detailed information
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 overflow-x-auto">
          <div className="flex items-center min-w-0 flex-1">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center min-w-0">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 ${
                  currentStep >= step.number
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step.number}
                </div>
                <div className="ml-2 min-w-0">
                  <p className="text-sm font-medium truncate">{step.title}</p>
                  <p className="text-xs text-gray-500 truncate">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 flex-shrink-0 ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Progress value={(currentStep / steps.length) * 100} className="mb-6" />

        {/* Step Content */}
        <div className="py-2 flex-1 overflow-y-auto">
          {/* Step 1: Receipt Information */}
          {currentStep === 1 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Edit3 className="h-4 w-4" />
                  Receipt Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter the basic receipt information to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full flex flex-col">
                <Form {...headerForm}>
                  <form className="space-y-4 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField
                        control={headerForm.control}
                        name="receiptNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Receipt Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. REC-001" className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="receiptDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Receipt Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={headerForm.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Supplier *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {supplierLpos.map((lpo: any) => (
                                <SelectItem key={lpo.supplierId} value={lpo.supplierId}>
                                  {lpo.supplier?.name || lpo.supplierName || 'Unknown Supplier'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={headerForm.control}
                      name="receivedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Received By</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter name" className="h-8 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={headerForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Partial">Partial</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Discrepancy">Discrepancy</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={headerForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Additional notes..." className="h-16 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Items */}
          {currentStep === 2 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Receipt Items
                </CardTitle>
                <CardDescription className="text-xs">
                  Add items to this material receipt
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-600">
                    {items.length} item{items.length !== 1 ? 's' : ''} added
                  </span>
                  <Button onClick={handleAddItem} size="sm" className="h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No items added yet</p>
                      <p className="text-xs">Click "Add Item" to get started</p>
                    </div>
                  ) : (
                    items.map((item, index) => (
                      <Card key={item.id} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              #{item.serialNo}
                            </Badge>
                            <span className="text-sm font-medium">Item {index + 1}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-medium">Item Description</Label>
                            <Input
                              value={item.itemDescription}
                              onChange={(e) => handleItemChange(item.id, 'itemDescription', e.target.value)}
                              placeholder="Enter description"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Unit Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => handleItemChange(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Total Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity * item.unitCost}
                              readOnly
                              className="h-8 text-xs bg-gray-50"
                            />
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Review Receipt
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the receipt information before creating
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full flex flex-col">
                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Receipt Number</Label>
                      <p className="text-sm font-medium">{headerForm.watch('receiptNumber')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Receipt Date</Label>
                      <p className="text-sm font-medium">{headerForm.watch('receiptDate')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Received By</Label>
                      <p className="text-sm font-medium">{headerForm.watch('receivedBy')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {headerForm.watch('status')}
                      </Badge>
                    </div>
                  </div>
                  
                  {items.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500 mb-2 block">Items ({items.length})</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {items.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">#{item.serialNo} {item.itemDescription}</span>
                            <span className="text-gray-600">
                              {item.quantity} × {item.unitCost.toFixed(2)} = {(item.quantity * item.unitCost).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {headerForm.watch('notes') && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Notes</Label>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{headerForm.watch('notes')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t flex-wrap gap-2">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            size="sm"
            className="h-8 text-xs flex-shrink-0"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Previous
          </Button>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleClose} size="sm" className="h-8 text-xs flex-shrink-0">
              Cancel
            </Button>
            
            {currentStep < 3 ? (
              <Button
                onClick={nextStep}
                disabled={currentStep === 1 && (!headerForm.formState.isValid || !headerForm.watch('supplierId'))}
                size="sm"
                className="h-8 text-xs flex-shrink-0"
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={headerForm.handleSubmit(onSubmit)}
                disabled={createReceiptMutation.isPending || items.length === 0}
                size="sm"
                className="h-8 text-xs flex-shrink-0"
              >
                {createReceiptMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Create Receipt
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}