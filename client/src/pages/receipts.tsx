import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/tables/data-table";
import ReceiptWizard from "@/components/ReceiptWizard";
import DocumentAutomation from "@/components/DocumentAutomation";
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  Trash,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Building2,
  Truck,
  Scan,
  ClipboardCheck,
  RefreshCw,
  Loader2,
  Bot
} from "lucide-react";

// Utility function to format date strings as "YYYY-MM-DD"
function formatDate(dateStr?: string) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// Form schemas
const goodsReceiptSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  receiptDate: z.string().min(1, "Receipt date is required"),
  receivedBy: z.string().min(1, "Received by is required"),
  status: z.enum(["Pending", "Partial", "Completed", "Discrepancy"]),
  notes: z.string().optional(),
});

type GoodsReceiptForm = z.infer<typeof goodsReceiptSchema>;

// Status badge colors


const getStatusIcon = (status: string) => {
  switch (status) {
    case "Pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "Partial":
      return <Truck className="h-4 w-4 text-blue-600" />;
    case "Complete":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Discrepancy":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "Pending Approval":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case "Approved":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Paid":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Partially Paid":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "Overdue":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "Disputed":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "Cancelled":
      return <XCircle className="h-4 w-4 text-gray-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusBadge = (status: string) => {
  let colorClass = "text-gray-600 border-gray-300 bg-gray-50";
  let icon = getStatusIcon(status);
  switch (status) {
    case "Pending":
      colorClass = "text-yellow-600 border-yellow-300 bg-yellow-50";
      icon = <Clock className="h-4 w-4 text-yellow-600" />;
      break;
    case "Partial":
      colorClass = "text-blue-600 border-blue-300 bg-blue-50";
      icon = <Truck className="h-4 w-4 text-blue-600" />;
      break;
    case "Completed":
      colorClass = "text-green-600 border-green-300 bg-green-50";
      icon = <CheckCircle className="h-4 w-4 text-green-600" />;
      break;
    case "Discrepancy":
      colorClass = "text-red-600 border-red-300 bg-red-50";
      icon = <AlertTriangle className="h-4 w-4 text-red-600" />;
      break;
    default:
      colorClass = "text-gray-600 border-gray-300 bg-gray-50";
      icon = <Clock className="h-4 w-4 text-gray-600" />;
  }
  return (
    <Badge variant="outline" className={`${colorClass} flex items-center  gap-1 px-3 py-1 font-semibold`}>
      {icon}
      <span className="ml-0 ">{status}</span>
    </Badge>
  );
};

export default function ReceiptsPage() {
  const [, navigate] = useLocation();
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);
  const [receiptNumberSearch, setReceiptNumberSearch] = useState("");
  const [showReceiptNumberDialog, setShowReceiptNumberDialog] = useState(false);
  const [fetchedReceiptData, setFetchedReceiptData] = useState<any | null>(null);
  const [showAutomation, setShowAutomation] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for edit dialog
  const form = useForm<GoodsReceiptForm>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: {
      receiptNumber: "",
      supplierId: "",
      receiptDate: "",
      receivedBy: "",
      status: "Pending",
      notes: "",
    },
  });

  // Sync form values with editForm when opening the edit dialog
  React.useEffect(() => {
    if (showEditDialog && editForm) {
      form.setValue("receiptNumber", editForm.receiptNumber || "");
      form.setValue("supplierId", editForm.supplierId || "");
      form.setValue("receiptDate", editForm.receiptDate || "");
      form.setValue("receivedBy", editForm.receivedBy || "");
      form.setValue("status", editForm.status || "Pending");
      form.setValue("notes", editForm.notes || "");
    }
    // Reset form when dialog closes
    if (!showEditDialog) {
      form.reset();
    }
  }, [showEditDialog, editForm]);

  // Handle form submission with proper validation
  const onSubmit = (data: GoodsReceiptForm) => {
    if (editForm && editForm.id) {
      updateReceiptMutation.mutate({ ...data, id: editForm.id });
    } else {
      createReceiptMutation.mutate(data);
    }
  };

  // Handle automation data extraction
  const handleAutomationData = (data: any) => {
    console.log('Automation data received:', data);
    
    // Pre-fill the form with extracted data
    if (data.documentNumber) {
      form.setValue("receiptNumber", data.documentNumber);
    }
    if (data.documentDate) {
      form.setValue("receiptDate", data.documentDate);
    }
    if (data.supplierName) {
      // Try to find matching supplier ID
      const matchingSupplier = suppliers?.find(s => 
        s.name?.toLowerCase().includes(data.supplierName?.toLowerCase()) ||
        data.supplierName?.toLowerCase().includes(s.name?.toLowerCase())
      );
      if (matchingSupplier) {
        form.setValue("supplierId", matchingSupplier.id);
      }
    }
    if (data.notes) {
      form.setValue("notes", data.notes);
    }
    
    // Set status to Pending for review
    form.setValue("status", "Pending");
    
    // Show the wizard with pre-filled data
    setShowWizard(true);
    setShowAutomation(false);
    
    toast({
      title: 'Data extracted successfully',
      description: `Found ${data.items?.length || 0} items. Please review and complete the form.`,
    });
  };

  // Create goods receipt mutation
  const createReceiptMutation = useMutation({
    mutationFn: async (data: GoodsReceiptForm) => {
      return await apiRequest("POST", "/api/material-receipts", data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["material-receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["material-receipts-stats"] })
      ]);
      setShowForm(false);
      setEditForm(null);
      toast({
        title: "Success",
        description: "Receipt created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create receipt",
        variant: "destructive",
      });
    },
  });

  // Delete material receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/material-receipts/${id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["material-receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["material-receipts-stats"] })
      ]);
      setShowDeleteDialog(false);
      setSelectedReceipt(null);
      toast({
        title: "Deleted",
        description: "Receipt deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete receipt",
        variant: "destructive",
      });
    },
  });

  // Fetch goods receipts
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["material-receipts"],
    queryFn: async () => {
      console.log('Fetching material receipts from API...');
      const response = await apiRequest("GET", "/api/material-receipts");
      const data = await response.json();
      console.log('Material receipts data received:', data);
      console.log('Data is array?', Array.isArray(data));
      console.log('Data length:', Array.isArray(data) ? data.length : 0);
      return Array.isArray(data) ? data : [];
    },
  });

  console.log('Receipts state:', receipts);
  console.log('Is loading?', isLoading);

  // Fetch suppliers data
  const { data: suppliersData = [] } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const response = await fetch("/api/suppliers");
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const suppliers = suppliersData || [];

  // Fetch supplier LPOs for the edit dialog
  const { data: supplierLpos = [] } = useQuery({
    queryKey: ["supplier-lpos"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/supplier-lpos");
        const data = await response.json();
        return data.success ? data.data : [];
      } catch (error) {
        console.error("Failed to fetch supplier LPOs:", error);
        return [];
      }
    },
  });

  // Enrich receipts with supplier data
  const enrichedReceipts = receipts.map((receipt: any) => {
    const supplier = suppliers.find((s: any) => s.id === receipt.supplierId);
    const enrichedReceipt = {
      ...receipt,
      supplier: supplier ? {
        ...supplier,
        name: supplier.name || 'Unknown Supplier'
      } : receipt.supplier || { name: receipt.supplierName || 'N/A', contactPerson: '-' }
    };
    return enrichedReceipt;
  });
  
  console.log('Enriched receipts:', enrichedReceipts);
  console.log('Enriched receipts length:', enrichedReceipts.length);

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["material-receipts-stats"],
    queryFn: async () => {
      const receiptsArray = Array.isArray(enrichedReceipts) ? enrichedReceipts : [];
      const total = receiptsArray.length;
      const pending = receiptsArray.filter(r => r.status === "Pending").length;
      const partial = receiptsArray.filter(r => r.status === "Partial").length;
      const complete = receiptsArray.filter(r => r.status === "Completed").length;
      const discrepancy = receiptsArray.filter(r => r.status === "Discrepancy").length;
      
      return { total, pending, partial, complete, discrepancy };
    },
    enabled: Array.isArray(receipts) && receipts.length > 0,
  });


  // Update goods receipt mutation
  const updateReceiptMutation = useMutation({
    mutationFn: async (data: GoodsReceiptForm & { id: string }) => {
      const { id, ...updateData } = data;
      // Convert camelCase to snake_case for backend
      const dbData: any = {};
      if (updateData.receiptNumber) dbData.receipt_number = updateData.receiptNumber;
      if (updateData.supplierId) dbData.supplier_id = updateData.supplierId;
      if (updateData.receiptDate) dbData.receipt_date = updateData.receiptDate;
      if (updateData.receivedBy) dbData.received_by = updateData.receivedBy;
      if (updateData.status) dbData.status = updateData.status;
      if (updateData.notes !== undefined) dbData.notes = updateData.notes;
      
      return await apiRequest("PUT", `/api/material-receipts/${id}`, dbData);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["material-receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["material-receipts-stats"] })
      ]);
      setShowEditDialog(false);
      toast({
        title: "Success",
        description: "Material receipt updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update goods receipt",
        variant: "destructive",
      });
    },
  });

  // Fetch receipt data by receipt number
  const fetchReceiptByNumber = async (receiptNumber: string) => {
    if (!receiptNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a receipt number",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch material receipt by receipt number
      const response = await fetch(`/api/material-receipts`);
      if (!response.ok) {
        throw new Error('Failed to fetch material receipts');
      }
      const allReceipts = await response.json();
      
      // Find the receipt with matching receipt number
      const receipt = allReceipts.find((r: any) => 
        r.receiptNumber?.toLowerCase() === receiptNumber.toLowerCase()
      );
      
      if (!receipt) {
        throw new Error('Receipt not found');
      }
      
      // Fetch items for this receipt
      const itemsResponse = await fetch(`/api/material-receipts/${receipt.id}`);
      let receiptWithItems = receipt;
      
      if (itemsResponse.ok) {
        const detailData = await itemsResponse.json();
        receiptWithItems = {
          ...receipt,
          items: detailData.items || []
        };
      }
      
      setFetchedReceiptData(receiptWithItems);
      setSelectedReceipt(receiptWithItems);
      setShowReceiptNumberDialog(false);
      setShowDetailsDialog(true);
      toast({
        title: "Success",
        description: `Receipt ${receiptNumber} loaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Receipt not found",
        variant: "destructive",
      });
    }
  };

  // Sort receipts by createdAt descending (latest first)
  const sortedReceipts = (Array.isArray(enrichedReceipts) ? enrichedReceipts : []).slice().sort((a: any, b: any) => {
    const aDate = new Date(a.createdAt || a.receiptDate || 0).getTime();
    const bDate = new Date(b.createdAt || b.receiptDate || 0).getTime();
    return bDate - aDate;
  });

  // Filter receipts
  const filteredReceipts = sortedReceipts.filter((receipt: any) => {
    const matchesSearch = 
      receipt.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.receivedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
  
  console.log('Sorted receipts:', sortedReceipts.length);
  console.log('Filtered receipts:', filteredReceipts.length);
  console.log('Search query:', searchQuery);
  console.log('Status filter:', statusFilter);

  // Table columns
  const columns = [
    {
      key: "receiptNumber",
      header: "Receipt Number",
      render: (value: string) => (
        <span className="font-mono text-sm font-medium">{value}</span>
      ),
    },
    {
      key: "supplierColumn",
      header: "Supplier",
      render: (_: string, receipt: any) => {
        const supplier = receipt.supplier;
        const supplierName = supplier?.name || receipt.supplierName || "N/A";
        
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{supplierName}</span>
              {supplier?.contactPerson && (
                <span className="text-xs text-gray-500">{supplier.contactPerson}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "receivedBy",
      header: "Received By",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "receiptDate",
      header: "Receipt Date",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span>{formatDate(value)}</span>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (_: any, receipt: any) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <span className="text-sm">
            {receipt.items?.length || 0} items
          </span>
        </div>
      ),
    },
    {
      key: "totalItems",
      header: "Total Items",
      render: (value: number, receipt: any) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{receipt.totalItems ?? receipt.items?.length ?? 0}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, receipt: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedReceipt(receipt);
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
              setEditForm(receipt);
              setShowEditDialog(true);
              // Set form values for editing
              form.setValue("receiptNumber", receipt.receiptNumber || "");
              form.setValue("supplierId", receipt.supplierId || "");
              form.setValue("receiptDate", receipt.receiptDate || "");
              form.setValue("receivedBy", receipt.receivedBy || "");
              form.setValue("status", receipt.status || "Pending");
              form.setValue("notes", receipt.notes || "");
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedReceipt(receipt);
              setShowDeleteDialog(true);
            }}
            className="hover:bg-red-50"
          >
            <Trash className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Delete Receipt Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Receipt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete receipt #{selectedReceipt?.receiptNumber}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteReceiptMutation.isPending}
              onClick={() => {
                if (selectedReceipt?.id) {
                  deleteReceiptMutation.mutate(selectedReceipt.id);
                }
              }}
            >
              {deleteReceiptMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-green-50 rounded-xl p-6 border border-slate-200/50 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200/50">
              <Package className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Material Receipts</h1>
              <p className="text-slate-600 text-base">Record and manage incoming material receipts for material tracking</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>System Active</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>Last updated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              className="px-6 py-2.5 font-medium"
              onClick={() => setShowReceiptNumberDialog(true)}
            >
              <Search className="h-4 w-4 mr-2" />
              Search by Receipt #
            </Button>
            <DocumentAutomation
              documentType="receipt"
              onDataExtracted={handleAutomationData}
              onClose={() => setShowAutomation(false)}
              trigger={
                <Button 
                  variant="outline"
                  className="px-6 py-2.5 font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Upload Receipt Document
                </Button>
              }
            />
            <Button 
              className="px-6 py-2.5 font-medium"
              onClick={() => setShowWizard(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Receipt
            </Button>
          </div>

      {/* Edit Receipt Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[75vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit material Receipt</DialogTitle>
            <DialogDescription>
              Update details for receipt #{form.getValues("receiptNumber")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="receiptNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
                        {suppliers.map((supplier: any) => (
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="receiptDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receivedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received By</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                <Button type="submit" disabled={updateReceiptMutation.isPending ? true : false}>
                  {updateReceiptMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All receipts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting receipt</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partial</CardTitle>
              <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.partial}</div>
              <p className="text-xs text-muted-foreground">Partially received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Complete</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
              <p className="text-xs text-muted-foreground">Fully received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discrepancy</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.discrepancy}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
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
                placeholder="Search receipts, customers, received by..."
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
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
                <SelectItem value="Discrepancy">Discrepancy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Material Receipts</CardTitle>
              <CardDescription>
                {filteredReceipts.length} of {Array.isArray(enrichedReceipts) ? enrichedReceipts.length : 0} receipts
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["material-receipts"] });
                queryClient.refetchQueries({ queryKey: ["material-receipts"] });
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredReceipts}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No material receipts found. Create your first receipt to get started."
            onRowClick={(receipt) => navigate(`/material-receipt/${receipt.id}`)}
          />
        </CardContent>
      </Card>

      {/* Receipt Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Goods Receipt Details</DialogTitle>
            <DialogDescription>
              Receipt #{selectedReceipt?.receiptNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-6 pb-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Receipt Number</Label>
                    <p className="text-sm font-medium">{selectedReceipt.receiptNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Received By</Label>
                    <p className="text-sm font-medium">{selectedReceipt.receivedBy}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    {getStatusBadge(selectedReceipt.status || "Pending")}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Receipt Date</Label>
                    <p className="text-sm font-medium">
                      {selectedReceipt.receiptDate ? formatDate(selectedReceipt.receiptDate) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer</Label>
                    <p className="text-sm font-medium">
                      {selectedReceipt.customer?.name || "N/A"}
                      {selectedReceipt.customer?.customerType && (
                        <span className="text-xs text-gray-500 ml-2">({selectedReceipt.customer.customerType})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {selectedReceipt.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {selectedReceipt.notes}
                  </p>
                </div>
              )}
              
              {/* Display Items if available */}
              {selectedReceipt.items && selectedReceipt.items.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500 mb-2 block">Items ({selectedReceipt.items.length})</Label>
                  <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Qty</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Unit Cost</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedReceipt.items.map((item: any, index: number) => (
                          <tr key={item.id || index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{index + 1}</td>
                            <td className="px-3 py-2">{item.itemDescription || item.description || 'N/A'}</td>
                            <td className="px-3 py-2 text-right">{item.quantityReceived || item.quantity || 0}</td>
                            <td className="px-3 py-2 text-right">AED {typeof item.unitCost === 'number' ? item.unitCost.toFixed(2) : (parseFloat(item.unitCost) || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-medium">AED {typeof item.totalCost === 'number' ? item.totalCost.toFixed(2) : (parseFloat(item.totalCost) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Display Supplier info if available from fetched data */}
              {selectedReceipt.supplier && (
                <div>
                  <Label className="text-sm font-medium text-gray-500 mb-2 block">Supplier Information</Label>
                  <div className="bg-blue-50 p-3 rounded-md space-y-1">
                    <p className="text-sm"><strong>Name:</strong> {selectedReceipt.supplier.name || 'N/A'}</p>
                    {selectedReceipt.supplier.email && (
                      <p className="text-sm"><strong>Email:</strong> {selectedReceipt.supplier.email}</p>
                    )}
                    {selectedReceipt.supplier.phone && (
                      <p className="text-sm"><strong>Phone:</strong> {selectedReceipt.supplier.phone}</p>
                    )}
                    {selectedReceipt.supplier.address && (
                      <p className="text-sm"><strong>Address:</strong> {selectedReceipt.supplier.address}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search by Receipt Number Dialog */}
      <Dialog open={showReceiptNumberDialog} onOpenChange={setShowReceiptNumberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Search Receipt by Number</DialogTitle>
            <DialogDescription>
              Enter the receipt number to fetch complete receipt details including items and supplier information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                placeholder="e.g., REC-20251012-0001"
                value={receiptNumberSearch}
                onChange={(e) => setReceiptNumberSearch(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    fetchReceiptByNumber(receiptNumberSearch);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReceiptNumberDialog(false);
                setReceiptNumberSearch('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => fetchReceiptByNumber(receiptNumberSearch)}
              disabled={!receiptNumberSearch.trim()}
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Wizard */}
      <ReceiptWizard 
        open={showWizard} 
        onOpenChange={setShowWizard} 
        supplierLpos={suppliers.map(supplier => ({
          supplierId: supplier.id,
          supplier: supplier,
          supplierName: supplier.name
        }))}
      />
    </div>
  );
}