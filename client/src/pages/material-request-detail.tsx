import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft,
  Edit,
  Package2,
  User,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Plus,
  Trash2
} from "lucide-react";
import { StatusChangeDropdown, getStatusBadge } from "@/components/ui/status-change-dropdown";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Requisition } from "@shared/schema";

interface RequisitionItem {
  id: string;
  requisitionId: string;
  itemDescription: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedCost: number;
  specification?: string;
  preferredSupplier?: string;
  urgency?: string;
}

interface MaterialRequestDetail extends Requisition {
  items?: RequisitionItem[];
}

// Form schemas
const materialRequestSchema = z.object({
  requestedBy: z.string().min(1, "Requested by is required"),
  department: z.string().min(1, "Department is required"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Rejected", "Processing", "Completed", "Cancelled"]).optional(),
  requiredDate: z.string().min(1, "Required date is required"),
  totalEstimatedCost: z.number().min(0, "Total estimated cost must be positive"),
  justification: z.string().min(1, "Justification is required"),
  notes: z.string().optional(),
});

const materialRequestItemSchema = z.object({
  itemDescription: z.string().min(1, "Item description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitOfMeasure: z.string().min(1, "Unit of measure is required"),
  estimatedCost: z.number().min(0, "Estimated cost must be positive"),
  specification: z.string().optional(),
  preferredSupplier: z.string().optional(),
  urgency: z.enum(["Standard", "Urgent"]).default("Standard"),
});

type MaterialRequestForm = z.infer<typeof materialRequestSchema>;
type MaterialRequestItemForm = z.infer<typeof materialRequestItemSchema>;

interface RequestItem extends MaterialRequestItemForm {
  id: string;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "Low":
      return "bg-transparent text-blue-700 border-blue-300";
    case "Medium":
      return "bg-transparent text-amber-700 border-amber-300";
    case "High":
      return "bg-transparent text-orange-600 border-orange-300";
    case "Urgent":
      return "bg-transparent text-red-600 border-red-300";
    default:
      return "bg-transparent text-slate-600 border-slate-300";
  }
};

export default function MaterialRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [editItem, setEditItem] = useState<RequestItem | null>(null);

  const { data: request, isLoading } = useQuery<MaterialRequestDetail>({
    queryKey: ["/api/material-requests", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/material-requests/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch material request");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest("PUT", `/api/material-requests/${id}`, { status: newStatus });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/material-requests", id] });
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  // Fetch customers for dropdown
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch('/api/customers?limit=1000');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load customers');
      }
      const json = await res.json();
      if (Array.isArray(json)) {
        return json;
      } else if (json.customers && Array.isArray(json.customers)) {
        return json.customers;
      } else {
        return [];
      }
    }
  });

  const customers = customersData || [];

  // Fetch suppliers for dropdown
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load suppliers');
      }
      return res.json();
    }
  });

  // Unit of measure options
  const unitOptions = [
    "pcs", "kg", "g", "L", "mL", "m", "cm", "ft", "in", "box", "carton", 
    "pallet", "bag", "roll", "pack", "ton", "piece", "set", "lot"
  ];

  // Department management state
  const [departments] = useState([
    "IT", "HR", "Finance", "Operations", "Marketing", "Sales", "Engineering", "Support"
  ]);

  const editForm = useForm<MaterialRequestForm>({
    resolver: zodResolver(materialRequestSchema),
    defaultValues: {
      requestedBy: "",
      department: "",
      priority: "Medium",
      requiredDate: "",
      totalEstimatedCost: 0,
      justification: "",
      notes: "",
    },
  });

  const itemForm = useForm<MaterialRequestItemForm>({
    resolver: zodResolver(materialRequestItemSchema),
    defaultValues: {
      itemDescription: "",
      quantity: 1,
      unitOfMeasure: "",
      estimatedCost: 0,
      specification: "",
      preferredSupplier: "",
      urgency: "Standard",
    },
  });

  const editItemForm = useForm<MaterialRequestItemForm>({
    resolver: zodResolver(materialRequestItemSchema),
    defaultValues: {
      itemDescription: "",
      quantity: 1,
      unitOfMeasure: "",
      estimatedCost: 0,
      specification: "",
      preferredSupplier: "",
      urgency: "Standard",
    },
  });

  // Initialize form when request data is loaded
  useEffect(() => {
    if (request && showEditDialog) {
      editForm.reset({
        requestedBy: request.requestedBy || "",
        department: request.department || "",
        priority: (request.priority as "Low" | "Medium" | "High" | "Urgent") || "Medium",
        status: (request.status as any) || "Draft",
        requiredDate: request.requiredDate
          ? typeof request.requiredDate === "string"
            ? request.requiredDate.split('T')[0]
            : new Date(request.requiredDate).toISOString().slice(0, 10)
          : "",
        totalEstimatedCost: typeof request.totalEstimatedCost === "number"
          ? request.totalEstimatedCost
          : Number(request.totalEstimatedCost) || 0,
        justification: request.justification || "",
        notes: request.notes || "",
      });
      
      // Load items
      if (request.items && Array.isArray(request.items)) {
        setRequestItems(request.items.map((item: any) => ({
          id: item.id || Math.random().toString(36).substr(2, 9),
          itemDescription: item.itemDescription || "",
          quantity: item.quantity || 1,
          unitOfMeasure: item.unitOfMeasure || "",
          estimatedCost: typeof item.estimatedCost === "number" ? item.estimatedCost : Number(item.estimatedCost) || 0,
          specification: item.specification || "",
          preferredSupplier: item.preferredSupplier || "",
          urgency: (item.urgency as "Standard" | "Urgent") || "Standard",
        })));
      }
    }
  }, [request, showEditDialog]);

  useEffect(() => {
    if (editItem) {
      editItemForm.reset(editItem);
    }
  }, [editItem]);

  const editRequestMutation = useMutation({
    mutationFn: async (data: MaterialRequestForm) => {
      const requestData = {
        ...data,
        itemCount: requestItems.length,
        items: requestItems,
      };
      return await apiRequest("PUT", `/api/material-requests/${id}`, requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-requests", id] });
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      setShowEditDialog(false);
      toast({
        title: "Success",
        description: "Material request updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update material request",
        variant: "destructive",
      });
    },
  });

  const onEditSubmit = (data: MaterialRequestForm) => {
    const calculatedTotal = requestItems.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
    editRequestMutation.mutate({
      ...data,
      totalEstimatedCost: calculatedTotal,
    });
  };

  const onAddItem = (data: MaterialRequestItemForm) => {
    const newItem: RequestItem = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
    };
    setRequestItems(prev => [...prev, newItem]);
    setShowAddItemDialog(false);
    itemForm.reset();
    
    const newTotal = [...requestItems, newItem].reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
    editForm.setValue("totalEstimatedCost", newTotal);
  };

  const onEditItemSubmit = (data: MaterialRequestItemForm) => {
    if (!editItem) return;
    setRequestItems(prev => prev.map(item => item.id === editItem.id ? { ...item, ...data } : item));
    setShowEditItemDialog(false);
    setEditItem(null);
    const newTotal = requestItems.map(item => item.id === editItem.id ? { ...item, ...data } : item).reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
    editForm.setValue("totalEstimatedCost", newTotal);
  };

  const removeItem = (itemId: string) => {
    setRequestItems(prev => {
      const updated = prev.filter(item => item.id !== itemId);
      const newTotal = updated.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
      editForm.setValue("totalEstimatedCost", newTotal);
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading material request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Material Request Not Found</h2>
          <p className="text-gray-600 mb-4">The material request you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/material-requests")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Material Requests
          </Button>
        </div>
      </div>
    );
  }

  const items = request.items || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/material-requests")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Material Request #{request.requisitionNumber}
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(request.createdAt || request.requestDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(request.status || "Draft")}
          <Button
            variant="outline"
            onClick={() => setShowEditDialog(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Request
          </Button>
        </div>
      </div>

      {/* Status and Priority Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChangeDropdown
              currentStatus={request.status || "Draft"}
              onStatusChange={(newStatus) => updateStatusMutation.mutate(newStatus)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={`shadow-none ${getPriorityColor(request.priority || "Medium")} px-2 py-0.5 text-xs font-medium`}>
              {request.priority}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Number(request.totalEstimatedCost || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Items Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {items.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package2 className="h-4 w-4 mr-2" />
            Items ({items.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      Requested By
                    </label>
                    <p className="text-base font-medium text-gray-900">{request.requestedBy}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4" />
                      Department
                    </label>
                    <p className="text-base font-medium text-gray-900">{request.department}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4" />
                      Request Date
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(request.requestDate || request.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      Required Date
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(request.requiredDate)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">Justification</label>
                <p className="text-base text-gray-700 bg-gray-50 p-4 rounded-md whitespace-pre-wrap">
                  {request.justification}
                </p>
              </div>

              {request.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Additional Notes</label>
                    <p className="text-base text-gray-700 bg-gray-50 p-4 rounded-md whitespace-pre-wrap">
                      {request.notes}
                    </p>
                  </div>
                </>
              )}

              {request.approvedBy && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Approved By</label>
                      <p className="text-base font-medium text-gray-900">{request.approvedBy}</p>
                    </div>
                    {request.approvedDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Approved Date</label>
                        <p className="text-base font-medium text-gray-900">
                          {formatDate(request.approvedDate)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Items</CardTitle>
              <CardDescription>
                {items.length} {items.length === 1 ? "item" : "items"} in this request
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No items found in this request</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-center">Unit</TableHead>
                        <TableHead className="text-center">Unit Cost</TableHead>
                        <TableHead className="text-center">Total Cost</TableHead>
                        <TableHead>Specifications</TableHead>
                        {items.some(item => item.preferredSupplier || item.urgency) && (
                          <>
                            <TableHead>Preferred Supplier</TableHead>
                            <TableHead>Urgency</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.itemDescription}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.unitOfMeasure}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(item.estimatedCost || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {Number((item.quantity || 0) * (item.estimatedCost || 0)).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {item.specification ? (
                              <p className="text-sm text-gray-600 max-w-xs truncate" title={item.specification}>
                                {item.specification}
                              </p>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          {items.some(i => i.preferredSupplier || i.urgency) && (
                            <>
                              <TableCell>
                                {item.preferredSupplier ? (
                                  <span className="text-sm">{item.preferredSupplier}</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.urgency ? (
                                  <Badge variant={item.urgency === "Urgent" ? "destructive" : "outline"}>
                                    {item.urgency}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Request Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Material Request</DialogTitle>
            <DialogDescription>Update the details of this material request.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="requestedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested By</FormLabel>
                      <Select onValueChange={(value) => {
                        if (value !== "__loading__" && value !== "__no_customers__") {
                          field.onChange(value);
                        }
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customersLoading ? (
                            <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                          ) : customers.length > 0 ? (
                            customers.map((customer: any) => (
                              <SelectItem key={customer.id} value={customer.name}>
                                {customer.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_customers__" disabled>No customers found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="requiredDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="justification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Justification</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Explain the business need for this request..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional information..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={editForm.control}
                  name="totalEstimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Estimated Cost</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value || 0}
                          readOnly
                          className="bg-gray-50"
                        />
                      </FormControl>
                      <p className="text-xs text-gray-600">Auto-calculated from items</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Request Items Section */}
              <div className="space-y-4">
                <div className="flex flex-row items-center justify-between mb-2 gap-2">
                  <Label className="text-base font-semibold">Request Items <span className="ml-1 text-xs font-normal text-gray-500">({requestItems.length})</span></Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => setShowAddItemDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Item</span>
                  </Button>
                </div>
                {requestItems.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <div className="min-w-[700px] grid grid-cols-12 gap-0 p-3 bg-gray-50 text-sm font-semibold border-b">
                      <div className="col-span-3 pl-2">Description</div>
                      <div className="col-span-2 text-center">Quantity</div>
                      <div className="col-span-2 text-center">Unit</div>
                      <div className="col-span-2 text-center">Cost</div>
                      <div className="col-span-2 text-center">Total</div>
                      <div className="col-span-1 text-center">Actions</div>
                    </div>
                    {requestItems.map((item) => (
                      <div key={item.id} className="min-w-[700px] grid grid-cols-12 gap-0 p-3 border-b last:border-b-0 items-center">
                        <div className="col-span-3 pl-2">
                          <p className="font-medium leading-tight">{item.itemDescription}</p>
                          {item.specification && (
                            <p className="text-xs text-gray-600 mt-1">{item.specification}</p>
                          )}
                        </div>
                        <div className="col-span-2 text-center">{item.quantity}</div>
                        <div className="col-span-2 text-center">{item.unitOfMeasure}</div>
                        <div className="col-span-2 text-center">{Number(item.estimatedCost).toLocaleString()}</div>
                        <div className="col-span-2 text-center font-medium">
                          {Number(item.quantity * item.estimatedCost).toLocaleString()}
                        </div>
                        <div className="col-span-1 text-center flex gap-1 justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditItem(item);
                              setShowEditItemDialog(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                    <Package2 className="mx-auto h-12 w-12 mb-2 text-gray-400" />
                    <p className="font-medium">No items added yet</p>
                    <p className="text-sm">Click "Add Item" to include materials in this request</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editRequestMutation.isPending}>
                  {editRequestMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-3xl w-[80vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Request Item</DialogTitle>
            <DialogDescription>Add a material item to this request</DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onAddItem)} className="space-y-3">
              <FormField
                control={itemForm.control}
                name="itemDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter item description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={itemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="unitOfMeasure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="estimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="preferredSupplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Supplier (Optional)</FormLabel>
                      <FormControl>
                        <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {suppliers.map((supplier: any) => (
                              <SelectItem key={supplier.id} value={supplier.name}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select urgency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={itemForm.control}
                name="specification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specification (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter detailed specifications..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddItemDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Add Item
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent className="max-w-3xl w-[80vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Request Item</DialogTitle>
            <DialogDescription>Edit the details of this material item.</DialogDescription>
          </DialogHeader>
          <Form {...editItemForm}>
            <form onSubmit={editItemForm.handleSubmit(onEditItemSubmit)} className="space-y-3">
              <FormField control={editItemForm.control} name="itemDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Description</FormLabel>
                  <FormControl><Input placeholder="Enter item description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editItemForm.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editItemForm.control} name="unitOfMeasure" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unitOptions.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editItemForm.control} name="estimatedCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editItemForm.control} name="preferredSupplier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Supplier (Optional)</FormLabel>
                    <FormControl>
                      <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {suppliers.map((supplier: any) => (
                            <SelectItem key={supplier.id} value={supplier.name}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editItemForm.control} name="urgency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urgency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select urgency" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editItemForm.control} name="specification" render={({ field }) => (
                <FormItem>
                  <FormLabel>Specification (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Enter detailed specifications..." rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowEditItemDialog(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

