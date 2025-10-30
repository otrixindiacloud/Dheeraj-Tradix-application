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
  Truck,
  Loader2,
  Plus,
  Trash2
} from "lucide-react";

// Form schemas
const headerDetailsSchema = z.object({
  issueNumber: z.string().min(1, "Issue number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  customerId: z.string().min(1, "Customer is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  issueReason: z.string().min(1, "Issue reason is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Processed", "Cancelled"]),
  notes: z.string().optional(),
});

const itemsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    serialNo: z.number(),
    itemId: z.string(),
    itemDescription: z.string(),
    quantityIssued: z.number().min(0),
    unitCost: z.number().min(0),
    totalCost: z.number().min(0),
    issueReason: z.string(),
    conditionNotes: z.string().optional(),
  })).min(1, "At least one item is required"),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ItemsForm = z.infer<typeof itemsSchema>;

interface IssueItemForm {
  id: string;
  serialNo: number;
  itemId: string;
  itemDescription: string;
  quantityIssued: number;
  unitCost: number;
  totalCost: number;
  issueReason: string;
  conditionNotes: string;
}

interface IssueReturnWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockIssues: any[];
  customers: any[];
  suppliers: any[];
  items: any[];
  customersLoading?: boolean;
  customersError?: any;
}

export default function IssueReturnWizard({ 
  open, 
  onOpenChange, 
  stockIssues, 
  customers, 
  suppliers, 
  items,
  customersLoading = false,
  customersError = null
}: IssueReturnWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [issueItems, setIssueItems] = useState<IssueItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      issueNumber: "",
      issueDate: new Date().toISOString().split('T')[0],
      customerId: "",
      supplierId: "",
      issueReason: "",
      status: "Draft",
      notes: "",
    },
  });

  // Form for items
  const itemsForm = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Create issue return mutation
  const createIssueReturnMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm) => {
      const returnData = {
        issueNumber: data.issueNumber,
        issueDate: data.issueDate,
        customerId: data.customerId,
        supplierId: data.supplierId,
        issueReason: data.issueReason,
        status: data.status,
        notes: data.notes,
        items: issueItems,
      };

      const response = await apiRequest("POST", "/api/issue-returns", returnData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["issue-returns"] });
      toast({
        title: "Success",
        description: "Issue return created successfully",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create issue return",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setIssueItems([]);
    headerForm.reset();
    itemsForm.reset();
    setWizardKey(prev => prev + 1);
    onOpenChange(false);
  };

  const handleAddItem = () => {
    const newItem: IssueItemForm = {
      id: `item-${Date.now()}`,
      serialNo: issueItems.length + 1,
      itemId: '',
      itemDescription: '',
      quantityIssued: 0,
      unitCost: 0,
      totalCost: 0,
      issueReason: '',
      conditionNotes: '',
    };
    setIssueItems([...issueItems, newItem]);
  };

  const handleItemChange = (itemId: string, field: keyof IssueItemForm, value: any) => {
    setIssueItems(issueItems.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setIssueItems(issueItems.filter(item => item.id !== itemId));
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
    console.log('Creating issue return with data:', data);
    console.log('Items to save:', issueItems);
    createIssueReturnMutation.mutate(data);
  };

  const steps = [
    { number: 1, title: "Return Info", description: "Basic return information" },
    { number: 2, title: "Items", description: "Add return items" },
    { number: 3, title: "Review", description: "Review and create" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-responsive flex flex-col h-[90vh] max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Issue Return
          </DialogTitle>
          <DialogDescription>
            Create a new issue return for returned stock items
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= step.number
                  ? 'bg-red-600 text-white'
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
                  currentStep > step.number ? 'bg-red-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <Progress value={(currentStep / steps.length) * 100} className="mb-6 flex-shrink-0" />

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
                        name="issueNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Issue Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. RET-001" className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="issueDate"
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
                        name="customerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Customer</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {customersLoading ? (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading customers...
                                  </div>
                                ) : customersError ? (
                                  <div className="px-2 py-1.5 text-sm text-red-500">
                                    Error loading customers. Please try again.
                                  </div>
                                ) : customers && customers.length > 0 ? (
                                  customers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      {customer.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No customers found
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="supplierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Supplier</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {suppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={headerForm.control}
                      name="issueReason"
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
                              <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                              <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                              <SelectItem value="Damaged Item">Damaged Item</SelectItem>
                              <SelectItem value="Over Issued">Over Issued</SelectItem>
                              <SelectItem value="Customer Request">Customer Request</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
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
                              <SelectItem value="Draft">Draft</SelectItem>
                              <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Processed">Processed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-600">
                    {issueItems.length} item{issueItems.length !== 1 ? 's' : ''} added
                  </span>
                  <Button onClick={handleAddItem} size="sm" className="h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {issueItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No items added yet</p>
                      <p className="text-xs">Click "Add Item" to get started</p>
                    </div>
                  ) : (
                    issueItems.map((item, index) => (
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
                              value={item.quantityIssued}
                              onChange={(e) => handleItemChange(item.id, 'quantityIssued', parseFloat(e.target.value) || 0)}
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
                              value={item.quantityIssued * item.unitCost}
                              readOnly
                              className="h-8 text-xs bg-gray-50"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Return Reason</Label>
                            <Select onValueChange={(value) => handleItemChange(item.id, 'issueReason', value)} value={item.issueReason}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                                <SelectItem value="Damaged Item">Damaged Item</SelectItem>
                                <SelectItem value="Over Issued">Over Issued</SelectItem>
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
                    ))
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
                      <Label className="text-xs font-medium text-gray-500">Issue Number</Label>
                      <p className="text-sm font-medium">{headerForm.watch('issueNumber')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Return Date</Label>
                      <p className="text-sm font-medium">{headerForm.watch('issueDate')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Customer</Label>
                      <p className="text-sm font-medium">
                        {customers.find(c => c.id === headerForm.watch('customerId'))?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Supplier</Label>
                      <p className="text-sm font-medium">
                        {suppliers.find(s => s.id === headerForm.watch('supplierId'))?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Return Reason</Label>
                      <p className="text-sm font-medium">{headerForm.watch('issueReason')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {headerForm.watch('status')}
                      </Badge>
                    </div>
                  </div>
                  
                  {issueItems.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500 mb-2 block">Items ({issueItems.length})</Label>
                      <div className="space-y-2">
                        {issueItems.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">#{item.serialNo} {item.itemDescription}</span>
                            <span className="text-gray-600">
                              {item.quantityIssued} × {item.unitCost.toFixed(2)} = {(item.quantityIssued * item.unitCost).toFixed(2)}
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
                disabled={createIssueReturnMutation.isPending || issueItems.length === 0}
                size="sm"
                className="h-8 text-xs"
              >
                {createIssueReturnMutation.isPending ? (
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