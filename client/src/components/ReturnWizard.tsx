import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  Trash2,
  RotateCcw,
  AlertTriangle
} from "lucide-react";

// Form schemas for each step
const headerDetailsSchema = z.object({
  returnNumber: z.string().min(1, "Return number is required"),
  goodsReceiptId: z.string().optional(),
  supplierId: z.string().optional(),
  returnDate: z.string().min(1, "Return date is required"),
  returnReason: z.string().min(1, "Return reason is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Returned", "Credited"]),
  notes: z.string().optional(),
  // Additional optional header fields
  receiptNumber: z.string().optional(),
  receiptDate: z.string().optional(),
  receivedBy: z.string().optional(),
  expectedDate: z.string().optional(),
  actualDate: z.string().optional(),
  itemsExpected: z.number().optional(),
  itemsReceived: z.number().optional(),
  discrepancy: z.string().optional(),
  supplierName: z.string().optional(),
  supplierAddress: z.string().optional(),
  supplierContactPerson: z.string().optional(),
  supplierLpoNumber: z.string().optional(),
  customerLpoNumber: z.string().optional(),
  totalValue: z.number().optional(),
  supplierIdDisplay: z.string().optional(),
});

const returnItemSchema = z.object({
  id: z.string(),
  serialNo: z.number(),
  itemId: z.string().optional(),
  itemDescription: z.string().min(1, "Item description is required"),
  quantityReturned: z.number().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0),
  totalCost: z.number().min(0),
  returnReason: z.string().min(1, "Return reason is required"),
  conditionNotes: z.string().optional(),
});

const returnItemsSchema = z.object({
  items: z.array(returnItemSchema),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ReturnItemForm = z.infer<typeof returnItemSchema>;
type ReturnItemsForm = z.infer<typeof returnItemsSchema>;

interface ReturnWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goodsReceipts: any[];
  suppliers: any[];
  items: any[];
}

export default function ReturnWizard({ open, onOpenChange, goodsReceipts, suppliers, items }: ReturnWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [returnItems, setReturnItems] = useState<ReturnItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      returnNumber: "",
      goodsReceiptId: "",
      supplierId: "",
      returnDate: new Date().toISOString().split('T')[0],
      returnReason: "",
      status: "Draft",
      notes: "",
      receiptNumber: "",
      receiptDate: "",
      receivedBy: "",
      expectedDate: "",
      actualDate: "",
      itemsExpected: 0,
      itemsReceived: 0,
      discrepancy: "",
      supplierName: "",
      supplierAddress: "",
      supplierContactPerson: "",
      supplierLpoNumber: "",
      customerLpoNumber: "",
      totalValue: 0,
      supplierIdDisplay: "",
    },
  });

  // Form for items
  const itemsForm = useForm<ReturnItemsForm>({
    resolver: zodResolver(returnItemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Create return mutation
  const createReturnMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm) => {
      const returnData = {
        returnNumber: data.returnNumber,
        goodsReceiptId: data.goodsReceiptId,
        supplierId: data.supplierId,
        returnDate: data.returnDate,
        returnReason: data.returnReason,
        status: data.status,
        notes: data.notes,
        items: returnItems,
      };

      const response = await apiRequest("POST", "/api/receipt-returns", returnData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receipt-returns"] });
      toast({
        title: "Success",
        description: "Receipt return created successfully",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create receipt return",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setReturnItems([]);
    headerForm.reset();
    itemsForm.reset();
    setWizardKey(prev => prev + 1);
    onOpenChange(false);
  };

  const handleAddItem = () => {
    const newItem: ReturnItemForm = {
      id: `item-${Date.now()}`,
      serialNo: returnItems.length + 1,
      itemId: '',
      itemDescription: '',
      quantityReturned: 0,
      unitCost: 0,
      totalCost: 0,
      returnReason: '',
      conditionNotes: '',
    };
    setReturnItems([...returnItems, newItem]);
  };

  const handleItemChange = (itemId: string, field: keyof ReturnItemForm, value: any) => {
    setReturnItems(returnItems.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setReturnItems(returnItems.filter(item => item.id !== itemId));
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: HeaderDetailsForm) => {
    console.log('Creating return with data:', data);
    console.log('Items to save:', returnItems);
    createReturnMutation.mutate(data);
  };

  const steps = [
    { number: 1, title: "Return Info", description: "Basic return information" },
    { number: 2, title: "Items", description: "Add return items" },
    { number: 3, title: "Review", description: "Review and create" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-responsive flex flex-col h-[90vh] max-h-[90vh] w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Create Receipt Return
          </DialogTitle>
          <DialogDescription>
            Create a new receipt return for returned goods
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= step.number
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step.number}
              </div>
              <div className="ml-2">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  currentStep > step.number ? 'bg-orange-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <Progress value={(currentStep / steps.length) * 100} className="mb-4 flex-shrink-0" />

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 pr-2">
          {/* Step 1: Return Information */}
          {currentStep === 1 && (
            <Card className="flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Edit3 className="h-4 w-4" />
                  Return Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter the basic return information
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Form {...headerForm}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={headerForm.control}
                        name="returnNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Return Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. RET-001" className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="returnDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Return Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={headerForm.control}
                        name="goodsReceiptId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Goods Receipt</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Automatically populate supplier when goods receipt is selected
                                const selectedReceipt = goodsReceipts.find(r => r.id === value);
                                if (selectedReceipt) {
                                  const supplierId = selectedReceipt.supplierId || selectedReceipt.supplier_id;
                                  if (supplierId) {
                                    headerForm.setValue("supplierId", supplierId);
                                  }
                                }
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select goods receipt" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {goodsReceipts.map((receipt) => (
                                  <SelectItem key={receipt.id} value={receipt.id}>
                                    {receipt.receiptNumber && typeof receipt.receiptNumber === "string"
                                      ? receipt.receiptNumber
                                      : `GR-${receipt.id}`}
                                    {receipt.supplierName
                                      ? ` — ${receipt.supplierName}`
                                      : receipt.supplier?.name
                                        ? ` — ${receipt.supplier.name}`
                                        : ""}
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
                        name="returnReason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Return Reason</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Damaged">Damaged</SelectItem>
                                <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                                <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                <SelectItem value="Excess Quantity">Excess Quantity</SelectItem>
                                <SelectItem value="Expired">Expired</SelectItem>
                                <SelectItem value="Customer Request">Customer Request</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                    
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
                              <SelectItem value="Draft">Draft</SelectItem>
                              <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Returned">Returned</SelectItem>
                              <SelectItem value="Credited">Credited</SelectItem>
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
            <Card className="flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Return Items
                </CardTitle>
                <CardDescription className="text-xs">
                  Add items being returned
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-600">
                      {returnItems.length} item{returnItems.length !== 1 ? 's' : ''} added
                    </span>
                    {returnItems.length > 3 && (
                      <span className="text-xs text-gray-400">
                        Scroll to see all items
                      </span>
                    )}
                  </div>
                  <Button onClick={handleAddItem} size="sm" className="h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3 border border-gray-100 rounded-md relative">
                  {returnItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No items added yet</p>
                      <p className="text-xs">Click "Add Item" to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3 p-2">
                      {returnItems.map((item, index) => (
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
                        
                        <div className="grid grid-cols-2 gap-3">
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
                            <Label className="text-xs font-medium">Quantity Returned</Label>
                            <Input
                              type="number"
                              value={item.quantityReturned}
                              onChange={(e) => handleItemChange(item.id, 'quantityReturned', parseFloat(e.target.value) || 0)}
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
                              value={item.quantityReturned * item.unitCost}
                              readOnly
                              className="h-8 text-xs bg-gray-50"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Return Reason</Label>
                            <Select onValueChange={(value) => handleItemChange(item.id, 'returnReason', value)} value={item.returnReason}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Damaged">Damaged</SelectItem>
                                <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                                <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Condition Notes</Label>
                            <Input
                              value={item.conditionNotes}
                              onChange={(e) => handleItemChange(item.id, 'conditionNotes', e.target.value)}
                              placeholder="Condition notes"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <Card className="flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Review Return
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the return information before creating
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Return Number</Label>
                      <p className="text-sm font-medium">{headerForm.watch('returnNumber')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Return Date</Label>
                      <p className="text-sm font-medium">{headerForm.watch('returnDate')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Return Reason</Label>
                      <p className="text-sm font-medium">{headerForm.watch('returnReason')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {headerForm.watch('status')}
                      </Badge>
                    </div>
                  </div>
                  
                  {returnItems.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500 mb-2 block">Items ({returnItems.length})</Label>
                      <div className="space-y-2">
                        {returnItems.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">#{item.serialNo} {item.itemDescription}</span>
                            <span className="text-gray-600">
                              {item.quantityReturned} × {item.unitCost.toFixed(2)} = {(item.quantityReturned * item.unitCost).toFixed(2)}
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
        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0 bg-white">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            size="sm"
            className="h-8 text-xs"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} size="sm" className="h-8 text-xs">
              Cancel
            </Button>
            
            {currentStep < 3 ? (
              <Button
                onClick={nextStep}
                disabled={currentStep === 1 && !headerForm.formState.isValid}
                size="sm"
                className="h-8 text-xs"
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={headerForm.handleSubmit(onSubmit)}
                disabled={createReturnMutation.isPending || returnItems.length === 0}
                size="sm"
                className="h-8 text-xs"
              >
                {createReturnMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Create Return
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