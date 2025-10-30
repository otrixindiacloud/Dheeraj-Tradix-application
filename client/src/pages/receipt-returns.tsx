import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReturnWizard from "@/components/ReturnWizard";
import DocumentAutomation from "@/components/DocumentAutomation";
import { 
  RotateCcw,
  Plus, 
  Search, 
  Filter,
  Edit, 
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Building2,
  Package,
  Undo2,
  RefreshCw,
  AlertCircle,
  Trash2,
  Bot
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/tables/data-table";
import { formatDate, formatCurrency } from "@/lib/utils";

// Form schemas
const receiptReturnSchema = z.object({
  returnNumber: z.string().min(1, "Return number is required"),
  goodsReceiptId: z.string().min(1, "Goods receipt is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  returnReason: z.string().min(1, "Return reason is required"),
  returnDate: z.string().min(1, "Return date is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Returned", "Credited"]),
  notes: z.string().optional(),
});

type ReceiptReturnForm = z.infer<typeof receiptReturnSchema>;
type ReceiptReturnItemForm = {
  itemId: string;
  quantityReturned: number;
  unitCost?: number;
  totalCost?: number;
  returnReason: string;
  conditionNotes?: string;
};

// Status badge component (light background, border + icon, no saturated fills)
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { icon: React.ElementType; variant: string; label: string }> = {
    Draft: { icon: FileText, variant: "outline", label: "Draft" },
    "Pending Approval": { icon: Clock, variant: "secondary", label: "Pending" },
    Approved: { icon: CheckCircle, variant: "default", label: "Approved" },
    Returned: { icon: RotateCcw, variant: "warning", label: "Returned" },
    Credited: { icon: DollarSign, variant: "success", label: "Credited" },
  };
  const data = cfg[status] || cfg["Draft"];
  const Icon = data.icon;
  return (
    <Badge
      variant={data.variant as any}
      className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{data.label}</span>
    </Badge>
  );
};

export default function ReceiptReturnsPage() {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showReturnWizard, setShowReturnWizard] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  // Local search state for goods receipt selection (previously incorrectly inside render callback)
  const [receiptSearchTerm, setReceiptSearchTerm] = useState("");
  // Local state for item and quantity selection in dialogs
  // (Removed local selectedItemId/quantity state; using form values directly)
  const [showAutomation, setShowAutomation] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Handle row click to navigate to return detail page
  const handleRowClick = (returnItem: any) => {
    setLocation(`/receipt-returns/${returnItem.id}`);
  };

  // Handle automation data extraction
  const handleAutomationData = (data: any) => {
    console.log('Automation data received:', data);
    
    // Pre-fill the form with extracted data
    if (data.documentNumber) {
      // You can pre-fill return number
    }
    if (data.documentDate) {
      // You can pre-fill return date
    }
    if (data.supplierName) {
      // You can try to find matching supplier
    }
    if (data.notes) {
      // You can pre-fill notes
    }
    
    // Show the wizard with pre-filled data
    setShowReturnWizard(true);
    setShowAutomation(false);
    
    toast({
      title: 'Data extracted successfully',
      description: `Found ${data.items?.length || 0} items. Please review and complete the form.`,
    });
  };

  // Fetch receipt returns
  const { data: receiptReturns = [], isLoading, error, refetch } = useQuery({
    queryKey: ["receipt-returns"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/receipt-returns");
        const json = await response.json();
        // API returns { success: true, data: [...] }
        if (json && json.success && Array.isArray(json.data)) {
          return json.data;
        }
        // Fallback if data is already an array (direct response)
        return Array.isArray(json) ? json : [];
      } catch (error) {
        console.error("Failed to fetch receipt returns:", error);
        return [];
      }
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch goods receipts for dropdown (from /api/receipts)
  const { data: goodsReceipts = [] } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/receipts");
        const data = await response.json();
        // Ensure each receipt has a receiptNumber property
        return Array.isArray(data)
          ? data.map((receipt: any) => ({
              ...receipt,
              receiptNumber: receipt.receiptNumber || receipt.number || receipt.id,
            }))
          : [];
      } catch (error) {
        console.error("Failed to fetch receipts:", error);
        return [];
      }
    },
  });

  // Fetch items for dropdown
  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/inventory-items");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch inventory items:", error);
        return [];
      }
    },
  });

  // Fetch suppliers for name resolution
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/suppliers");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Failed to fetch suppliers", e);
        return [];
      }
    }
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["receipt-returns-stats"],
    queryFn: async () => {
      const returnsArray = Array.isArray(receiptReturns) ? receiptReturns : [];
      const total = returnsArray.length;
      const draft = returnsArray.filter(r => r.status === "Draft").length;
      const pending = returnsArray.filter(r => r.status === "Pending Approval").length;
      const approved = returnsArray.filter(r => r.status === "Approved").length;
      const returned = returnsArray.filter(r => r.status === "Returned").length;
      const credited = returnsArray.filter(r => r.status === "Credited").length;
      
      // Calculate total return value
      const totalValue = returnsArray.reduce((sum, ret) => {
        return sum + (parseFloat(ret.returnQuantity || "0") * parseFloat(ret.unitPrice || "0"));
      }, 0);
      
      return { total, draft, pending, approved, returned, credited, totalValue };
    },
    enabled: Array.isArray(receiptReturns) && receiptReturns.length > 0,
  });


  // Update receipt return mutation
  const updateReturnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReceiptReturnForm> }) => {
      // Convert camelCase to snake_case for backend
      const dbData: any = {};
      if (data.returnNumber) dbData.return_number = data.returnNumber;
      if (data.goodsReceiptId) dbData.goods_receipt_id = data.goodsReceiptId;
      if (data.supplierId) dbData.supplier_id = data.supplierId;
      if (data.returnReason) dbData.return_reason = data.returnReason;
      if (data.returnDate) dbData.return_date = data.returnDate;
      if (data.status) dbData.status = data.status;
      if (data.notes !== undefined) dbData.notes = data.notes;
      
      console.log('Updating return with ID:', id);
      console.log('Sending data:', dbData);
      
      const response = await apiRequest("PUT", `/api/receipt-returns/${id}`, dbData);
      const json = await response.json();
      
      console.log('Update response:', json);
      
      if (!json.success) {
        throw new Error(json.message || 'Failed to update return');
      }
      return json.data;
    },
    onSuccess: (updated: any) => {
      console.log('Update successful:', updated);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["receipt-returns"] });
      queryClient.invalidateQueries({ queryKey: ["receipt-returns-stats"] });
      setShowEditDialog(false);
      setEditForm(null);
      form.reset();
      toast({
        title: "Success",
        description: "Receipt return updated successfully",
      });
      refetch(); // Force refetch to ensure we see updated data
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update receipt return",
        variant: "destructive",
      });
    },
  });

  // Delete receipt return mutation
  const deleteReturnMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/receipt-returns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-returns"] });
      toast({
        title: "Success",
        description: "Receipt return deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete receipt return",
        variant: "destructive",
      });
    },
  });

  // Form for edit dialog
  const form = useForm<ReceiptReturnForm>({
    resolver: zodResolver(receiptReturnSchema),
    defaultValues: {
      returnNumber: "",
      goodsReceiptId: "",
      supplierId: "",
      returnReason: "",
      returnDate: "",
      status: "Draft",
      notes: "",
    },
  });

  // Filter receipt returns
  const filteredReturns = (Array.isArray(receiptReturns) ? receiptReturns : []).filter((returnItem: any) => {
    const matchesSearch = 
      returnItem.returnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      returnItem.returnedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      returnItem.returnReason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      returnItem.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || returnItem.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Table columns
  const columns = [
    {
      key: "returnNumber",
      header: "Return Number",
      render: (value: string) => (
        <span className="font-mono text-sm font-medium">{value || "N/A"}</span>
      ),
    },
    {
      key: "goodsReceiptId",
      header: "Goods Receipt",
      render: (value: string) => {
        const receipt = goodsReceipts.find((r: any) => r.id === value);
        const display = receipt?.receiptNumber || receipt?.number || value;
        return (
          <span className="font-mono text-xs text-blue-700 font-medium">{display || "N/A"}</span>
        );
      },
    },
    {
      key: "supplierId",
      header: "Supplier",
      render: (value: string, row: any) => {
        // Prefer supplier list lookup; fallback to goods receipt supplier name if not found
        const supplier = suppliers.find((s: any) => s.id === value);
        let name = supplier?.name;
        if (!name) {
          const receipt = goodsReceipts.find((r: any) => r.id === row.goodsReceiptId);
            name = receipt?.supplierName || receipt?.supplier?.name;
        }
        return (
          <span className="text-sm font-medium text-gray-800">{name || value || "N/A"}</span>
        );
      },
    },
    {
      key: "returnReason",
      header: "Return Reason",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gray-500" />
          <span className="truncate max-w-[150px]" title={value}>{value || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "returnDate",
      header: "Return Date",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{value ? formatDate(value) : "N/A"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => <StatusBadge status={value || "Draft"} />,
    },
    {
      key: "notes",
      header: "Notes",
      render: (value: string) => (
        <span className="truncate max-w-[200px]">{value || ""}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, returnItem: any) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedReturn(returnItem);
              setShowDetailsDialog(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setEditForm(returnItem);
              setShowEditDialog(true);
              // Prefill form values
              form.setValue("returnNumber", returnItem.returnNumber || returnItem.return_number || "");
              form.setValue("goodsReceiptId", returnItem.goodsReceiptId || returnItem.goods_receipt_id || "");
              form.setValue("supplierId", returnItem.supplierId || returnItem.supplier_id || "");
              form.setValue("returnReason", returnItem.returnReason || returnItem.return_reason || "");
              form.setValue("returnDate", returnItem.returnDate || returnItem.return_date || "");
              form.setValue("status", returnItem.status || "Draft");
              form.setValue("notes", returnItem.notes || "");
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to delete return ${returnItem.returnNumber || returnItem.return_number}?`)) {
                deleteReturnMutation.mutate(returnItem.id);
              }
            }}
            className="hover:bg-red-50"
            title="Delete return"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 space-y-6 pr-2">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-orange-50 rounded-xl p-6 border border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200/50">
              <RotateCcw className="h-10 w-10 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1"> Receipt Returns</h1>
              <p className="text-slate-600 text-base">Manage returns of received goods and track return processing</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span>Return Processing</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>Last updated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <DocumentAutomation
              documentType="return"
              onDataExtracted={handleAutomationData}
              onClose={() => setShowAutomation(false)}
              trigger={
                <Button 
                  variant="outline"
                  className="px-6 py-2.5 font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Upload Return Document
                </Button>
              }
            />
            <Button 
              className="px-6 py-2.5 font-medium"
              onClick={() => setShowReturnWizard(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Process Return
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All returns</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <FileText className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <p className="text-xs text-muted-foreground">Being prepared</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Ready to return</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Returned</CardTitle>
              <RotateCcw className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.returned}</div>
              <p className="text-xs text-muted-foreground">Items returned</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credited</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.credited}</div>
              <p className="text-xs text-muted-foreground">Credit processed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search returns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
                <SelectItem value="Credited">Credited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receipt Returns  </CardTitle>
          <CardDescription>
            {filteredReturns.length} of {Array.isArray(receiptReturns) ? receiptReturns.length : 0} returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredReturns}
            columns={columns}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            emptyMessage="No receipt returns found. Process your first return to get started."
          />
        </CardContent>
      </Card>

      {/* Edit Return Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Receipt Return</DialogTitle>
            <DialogDescription>
              Update details for return #{form.getValues("returnNumber")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                if (!editForm?.id) return;
                // Derive supplierId from selected goods receipt (mirroring create logic)
                const selectedReceipt = goodsReceipts.find((r: any) => r.id === data.goodsReceiptId);
                const supplierId = selectedReceipt?.supplierId || selectedReceipt?.supplier_id || editForm.supplierId || editForm.supplier_id || "";
                const payload: Partial<ReceiptReturnForm> = {
                  returnNumber: data.returnNumber,
                  goodsReceiptId: data.goodsReceiptId,
                  supplierId,
                  returnReason: data.returnReason,
                  returnDate: data.returnDate,
                  status: data.status,
                  notes: data.notes,
                };
                updateReturnMutation.mutate({ id: editForm.id, data: payload });
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="returnNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="goodsReceiptId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goods Receipt</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select goods receipt" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {goodsReceipts.map((receipt: any) => (
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Removed itemId and returnQuantity fields from edit dialog, not in schema */}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Removed returnedBy field from edit dialog, not in schema */}
              </div>
              <FormField
                control={form.control}
                name="returnReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Reason</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select return reason" />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
                        <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Returned">Returned</SelectItem>
                        <SelectItem value="Credited">Credited</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateReturnMutation.isPending} className="min-w-[120px] flex items-center justify-center gap-2">
                  {updateReturnMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {updateReturnMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Returns Receipt Details</DialogTitle>
            <DialogDescription>
              Return #{selectedReturn?.returnNumber || "N/A"}
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Number</Label>
                    <p className="text-sm font-medium">{selectedReturn.returnNumber || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Item</Label>
                    <p className="text-sm font-medium">{selectedReturn.itemName || selectedReturn.itemCode || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Quantity</Label>
                    <p className="text-sm font-medium text-orange-600">{selectedReturn.returnQuantity || "0"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <StatusBadge status={selectedReturn.status || "Draft"} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Date</Label>
                    <p className="text-sm font-medium">
                      {selectedReturn.returnDate ? formatDate(selectedReturn.returnDate) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Returned By</Label>
                    <p className="text-sm font-medium">{selectedReturn.returnedBy || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Return Reason</Label>
                    <p className="text-sm font-medium">{selectedReturn.returnReason || "N/A"}</p>
                  </div>
                </div>
              </div>
              {selectedReturn.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {selectedReturn.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Wizard */}
      <ReturnWizard
        open={showReturnWizard}
        onOpenChange={setShowReturnWizard}
        goodsReceipts={goodsReceipts}
        suppliers={suppliers}
        items={items}
      />
    </div>
  );
}