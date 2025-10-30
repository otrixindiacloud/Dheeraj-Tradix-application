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
  deliveryNumber: z.string().optional(),
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

interface StockIssueItemForm {
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

interface StockIssueWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: any[];
  items: any[];
  editData?: any; // Optional edit data for updating existing issue
}

export default function StockIssueWizard({ 
  open, 
  onOpenChange, 
  suppliers, 
  items,
  editData
}: StockIssueWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [stockIssueItems, setStockIssueItems] = useState<StockIssueItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      issueNumber: editData?.issueNumber || editData?.issue_number || "",
      issueDate: editData?.issueDate || editData?.issue_date || new Date().toISOString().split('T')[0],
      deliveryNumber: editData?.deliveryNumber || editData?.delivery_number || "",
      supplierId: editData?.supplierId || editData?.supplier_id || "",
      issueReason: editData?.issueReason || editData?.issue_reason || "",
      status: editData?.status || "Draft",
      notes: editData?.notes || "",
    },
  });

  // Form for items
  const itemsForm = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: {
      items: editData?.items || [],
    },
  });

  // Create/Update stock issue mutation
  const createStockIssueMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm) => {
      const issueData = {
        issueNumber: data.issueNumber,
        issueDate: data.issueDate,
        deliveryNumber: data.deliveryNumber,
        supplierId: data.supplierId,
        issueReason: data.issueReason,
        status: data.status,
        notes: data.notes,
        items: stockIssueItems,
      };

      if (editData?.id) {
        // Update existing issue
        const response = await apiRequest("PUT", `/api/stock-issues/${editData.id}`, issueData);
        return response.json();
      } else {
        // Create new issue
        const response = await apiRequest("POST", "/api/stock-issues", issueData);
        return response.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
      toast({
        title: "Success",
        description: editData?.id ? "Stock issue updated successfully" : "Stock issue created successfully",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editData?.id ? 'update' : 'create'} stock issue`,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setStockIssueItems([]);
    headerForm.reset();
    itemsForm.reset();
    setWizardKey(prev => prev + 1);
    onOpenChange(false);
  };

  const handleAddItem = () => {
    const newItem: StockIssueItemForm = {
      id: `item-${Date.now()}`,
      serialNo: stockIssueItems.length + 1,
      itemId: '',
      itemDescription: '',
      quantityIssued: 0,
      unitCost: 0,
      totalCost: 0,
      issueReason: '',
      conditionNotes: '',
    };
    setStockIssueItems([...stockIssueItems, newItem]);
  };

  const handleItemChange = (itemId: string, field: keyof StockIssueItemForm, value: any) => {
    setStockIssueItems(stockIssueItems.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setStockIssueItems(stockIssueItems.filter(item => item.id !== itemId));
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
    console.log('Creating/Updating stock issue with data:', data);
    console.log('Items to save:', stockIssueItems);
    createStockIssueMutation.mutate(data);
  };

  const steps = [
    { number: 1, title: "Issue Info", description: "Basic issue information" },
    { number: 2, title: "Items", description: "Add issue items" },
    { number: 3, title: "Review", description: "Review and create" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-responsive flex flex-col h-[90vh] max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {editData?.id ? 'Edit Stock Issue' : 'Create Stock Issue'}
          </DialogTitle>
          <DialogDescription>
            {editData?.id ? 'Update the stock issue details' : 'Create a new stock issue for material distribution'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= step.number
                  ? 'bg-blue-600 text-white'
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
                  currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <Progress value={(currentStep / steps.length) * 100} className="mb-6 flex-shrink-0" />

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 pr-2">
          {/* Step 1: Issue Information */}
          {currentStep === 1 && (
            <Card className="flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Edit3 className="h-4 w-4" />
                  Issue Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter the basic issue information
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
                              <Input {...field} placeholder="e.g. STK-001" className="h-8 text-xs" />
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
                            <FormLabel className="text-xs font-medium">Issue Date</FormLabel>
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
                        name="deliveryNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Delivery Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. DEL-001" className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="issueReason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Issue Reason</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Production">Production</SelectItem>
                                <SelectItem value="Maintenance">Maintenance</SelectItem>
                                <SelectItem value="Repair">Repair</SelectItem>
                                <SelectItem value="Replacement">Replacement</SelectItem>
                                <SelectItem value="Emergency">Emergency</SelectItem>
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
                      name="supplierId"
                      render={({ field }) => {
                        const [search, setSearch] = React.useState("");
                        const filteredSuppliers = suppliers.filter((supplier: any) =>
                          supplier.name.toLowerCase().includes(search.toLowerCase()) ||
                          supplier.email?.toLowerCase().includes(search.toLowerCase()) ||
                          supplier.contactPerson?.toLowerCase().includes(search.toLowerCase())
                        );
                        
                        return (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Supplier</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Search or select a supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-60 overflow-auto">
                                <div className="px-2 py-2">
                                  <input
                                    type="text"
                                    className="border rounded px-2 py-1 w-full mb-2 text-xs"
                                    placeholder="Search supplier..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                                {filteredSuppliers.length > 0 ? (
                                  filteredSuppliers.map((supplier: any) => (
                                    <SelectItem key={supplier.id} value={supplier.id} className="px-2 py-1 cursor-pointer hover:bg-gray-100">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-xs">{supplier.name}</span>
                                        <span className="text-xs text-gray-500">
                                          {supplier.contactPerson || supplier.email || 'No contact info'}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-4 py-2 text-gray-500 text-xs">
                                    {suppliers.length === 0
                                      ? "Loading suppliers..."
                                      : "No suppliers found. Please add a supplier first."}
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        );
                      }}
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
                  Issue Items
                </CardTitle>
                <CardDescription className="text-xs">
                  Add items to be issued
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-600">
                    {stockIssueItems.length} item{stockIssueItems.length !== 1 ? 's' : ''} added
                  </span>
                  <Button onClick={handleAddItem} size="sm" className="h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {stockIssueItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No items added yet</p>
                      <p className="text-xs">Click "Add Item" to get started</p>
                    </div>
                  ) : (
                    stockIssueItems.map((item, index) => (
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
                            <Label className="text-xs font-medium">Quantity Issued</Label>
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
                            <Label className="text-xs font-medium">Issue Reason</Label>
                            <Select onValueChange={(value) => handleItemChange(item.id, 'issueReason', value)} value={item.issueReason}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Production">Production</SelectItem>
                                <SelectItem value="Maintenance">Maintenance</SelectItem>
                                <SelectItem value="Repair">Repair</SelectItem>
                                <SelectItem value="Replacement">Replacement</SelectItem>
                                <SelectItem value="Emergency">Emergency</SelectItem>
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
                  Review Issue
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the issue information before creating
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
                      <Label className="text-xs font-medium text-gray-500">Issue Date</Label>
                      <p className="text-sm font-medium">{headerForm.watch('issueDate')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Delivery Number</Label>
                      <p className="text-sm font-medium">{headerForm.watch('deliveryNumber') || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Issue Reason</Label>
                      <p className="text-sm font-medium">{headerForm.watch('issueReason')}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Supplier</Label>
                      <p className="text-sm font-medium">
                        {suppliers.find(s => s.id === headerForm.watch('supplierId'))?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {headerForm.watch('status')}
                      </Badge>
                    </div>
                  </div>
                  
                  {stockIssueItems.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500 mb-2 block">Items ({stockIssueItems.length})</Label>
                      <div className="space-y-2">
                        {stockIssueItems.map((item, index) => (
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
                disabled={createStockIssueMutation.isPending || stockIssueItems.length === 0}
                size="sm"
                className="h-8 text-xs"
              >
                {createStockIssueMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {editData?.id ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {editData?.id ? 'Update Issue' : 'Create Issue'}
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