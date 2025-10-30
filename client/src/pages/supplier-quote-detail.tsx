import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useParams, Link } from "wouter";
import { formatDate } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Edit, 
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Star,
  TrendingUp,
  Eye,
  
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import SupplierQuoteItemsManager from "@/components/supplier-quote/supplier-quote-items-manager";

interface SupplierQuote {
  id: string;
  quoteNumber: string;
  supplierId: string;
  supplierName: string;
  customerName?: string;
  requisitionId?: string;
  requisitionNumber?: string;
  enquiryId?: string;
  enquiryNumber?: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Pending" | "Draft" | "Sent" | "Received" | "Under Review" | "Approved" | "Rejected" | "Accepted" | "Expired";
  requestDate: string;
  responseDate?: string;
  validUntil: string;
  totalAmount: string;
  currency: string;
  paymentTerms: string;
  deliveryTerms: string;
  notes?: string;
  attachments?: string[];
  score?: number;
  rank?: number;
  itemCount: number;
  supplierQuotationDocument?: string; // File path or URL to supplier's quotation document
  createdAt: string;
  updatedAt: string;
}

interface SupplierQuoteItem {
  id: string;
  quotationId: string;
  description: string; // Changed from itemDescription to description
  quantity: number;
  unitPrice: string;
  lineTotal: string; // Changed from totalPrice to lineTotal
  unitOfMeasure?: string;
  specifications?: string;
  leadTime?: string;
  warranty?: string;
  notes?: string;
}

export default function SupplierQuoteDetailPage() {

  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<SupplierQuote | null>(null);
  const quoteId = params.id;

  // Fetch quote details from API
  const [quote, setQuote] = useState<SupplierQuote | null>(null);
  const [items, setItems] = useState<SupplierQuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Purchase Invoice (PI) PDF table preview state
  const [showPiPreview, setShowPiPreview] = useState(false);
  const [piPreviewLoading, setPiPreviewLoading] = useState(false);
  const [piTable, setPiTable] = useState<{
    tableHeaders: string[];
    tableData: Array<{
      serialNumber: number;
      itemDescription: string;
      quantity: string;
      unit: string;
      cost: string;
      discountPercent: string;
      discountAmount: string;
      vatPercent: string;
      vatAmount: string;
      totalAmount: string;
    }>;
    totals?: any;
    currency?: string;
  } | null>(null);

  // Fetch quote and items on mount or quoteId change
  React.useEffect(() => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/supplier-quotes/${quoteId}`).then(async r => {
        if (!r.ok) throw new Error("Failed to fetch quote");
        return r.json();
      }),
      fetch(`/api/supplier-quotes/${quoteId}/items`).then(async r => {
        if (!r.ok) throw new Error("Failed to fetch items");
        return r.json();
      })
    ]).then(([quoteData, itemsData]) => {
      setQuote(quoteData);
      setItems(itemsData);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [quoteId]);

  const openPiPreview = async () => {
    if (!quoteId) return;
    setShowPiPreview(true);
    setPiPreviewLoading(true);
    try {
      const res = await fetch(`/api/supplier-quotes/${quoteId}/pdf-table-data`);
      if (!res.ok) throw new Error("Failed to fetch PI table data");
      const data = await res.json();
      setPiTable({
        tableHeaders: data.tableHeaders || [],
        tableData: data.tableData || [],
        totals: data.totals,
        currency: data.currency
      });
    } catch (e: any) {
      setError(e.message || "Failed to load preview");
    } finally {
      setPiPreviewLoading(false);
    }
  };

  // Removed purchase invoices section and related logic

  const handleDelete = () => {
    toast({
      title: "Success",
      description: "Supplier quote deleted successfully (mock)",
    });
    navigate("/supplier-quotes");
    setShowDeleteDialog(false);
  };

  const handleApprove = () => {
    if (!quoteId) return;
    fetch(`/api/supplier-quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Approved" })
    })
      .then(async r => {
        if (!r.ok) throw new Error("Failed to approve supplier quote");
        return r.json();
      })
      .then(() => {
        toast({
          title: "Success",
          description: "Supplier quote approved and updated in backend.",
        });
        // Update local state
        setQuote(q => q ? { ...q, status: "Approved" } : q);
        // Invalidate and refetch supplier quotes cache to update the table
        queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", "ready-for-lpo"] });
      })
      .catch(e => {
        toast({
          title: "Error",
          description: e.message || "Failed to approve supplier quote.",
          variant: "destructive"
        });
      });
  };

  const handleReject = () => {
    if (!quoteId) return;
    fetch(`/api/supplier-quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Rejected" })
    })
      .then(async r => {
        if (!r.ok) throw new Error("Failed to reject supplier quote");
        return r.json();
      })
      .then(() => {
        toast({
          title: "Success",
          description: "Supplier quote rejected and updated in backend.",
        });
        // Update the local state to reflect the change
        setQuote(q => q ? { ...q, status: "Rejected" } : q);
        // Invalidate and refetch supplier quotes cache to update the table
        queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", "ready-for-lpo"] });
      })
      .catch(e => {
        toast({
          title: "Error",
          description: e.message || "Failed to reject supplier quote.",
          variant: "destructive"
        });
      });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent": return "bg-red-500 text-white border-red-600";
      case "High": return "bg-orange-500 text-white border-orange-600";
      case "Medium": return "bg-yellow-500 text-white border-yellow-600";
      case "Low": return "bg-green-500 text-white border-green-600";
      default: return "bg-gray-500 text-white border-gray-600";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return "text-green-600";
    if (score >= 7) return "text-yellow-600";
    return "text-red-600";
  };

  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900">Loading Supplier Quote...</h2>
          <p className="text-gray-600 mt-2">Please wait while we fetch the quote details.</p>
        </div>
      </div>
    );
  }

  // Show error state if there was an error fetching data
  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Error Loading Quote</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <button 
            onClick={() => navigate("/supplier-quotes")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200 mt-4"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            <div className="text-sm font-bold">Back to Supplier Quotes</div>
          </button>
        </div>
      </div>
    );
  }

  // Show not found state only if we're not loading and there's no error but no quote data
  if (!quote && !loading && !error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Supplier Quote Not Found</h2>
          <p className="text-gray-600 mt-2">The supplier quote you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate("/supplier-quotes")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200 mt-4"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            <div className="text-sm font-bold">Back to Supplier Quotes</div>
          </button>
        </div>
      </div>
    );
  }

  // Add missing handleEditClick function
  const handleEditClick = () => {
    if (quote) {
      // Ensure all required fields have default values
      const formData = {
        ...quote,
        supplierName: quote.supplierName || "",
        totalAmount: quote.totalAmount || "",
        currency: quote.currency || "BHD",
        paymentTerms: quote.paymentTerms || "",
        deliveryTerms: quote.deliveryTerms || "",
        notes: quote.notes || ""
      };
      setEditForm(formData);
      setShowEditDialog(true);
    }
  };

  // Add missing handleEditChange function
  const handleEditChange = <K extends keyof SupplierQuote>(key: K, value: SupplierQuote[K]) => {
    setEditForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  // Enhanced handleEditSave function with proper validation
  const handleEditSave = () => {
    if (!quoteId || !editForm) return;
    
    // Debug logging to help identify validation issues
    console.log("Edit form data:", editForm);
    
    // Validate required fields - check for empty strings and null/undefined
    const supplierName = editForm.supplierName?.trim();
    const totalAmount = editForm.totalAmount?.toString().trim();
    const currency = editForm.currency?.trim();
    
    console.log("Validation values:", { supplierName, totalAmount, currency });
    
    if (!supplierName || !totalAmount || !currency) {
      console.log("Validation failed - missing required fields");
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Supplier Name, Total Amount, Currency).",
        variant: "destructive"
      });
      return;
    }
    
    // Validate total amount is a positive number
    const numericAmount = parseFloat(totalAmount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      toast({
        title: "Validation Error",
        description: "Total Amount must be a valid positive number.",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare the update data
    const updateData = {
      supplierName: supplierName,
      priority: editForm.priority,
      status: editForm.status,
      totalAmount: totalAmount,
      currency: currency,
      paymentTerms: editForm.paymentTerms || "",
      deliveryTerms: editForm.deliveryTerms || "",
      notes: editForm.notes || ""
    };
    
    fetch(`/api/supplier-quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    })
      .then(async r => {
        if (!r.ok) {
          const errorData = await r.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to update supplier quote");
        }
        return r.json();
      })
      .then(() => {
        toast({
          title: "Success",
          description: "Supplier quote updated successfully.",
        });
        setShowEditDialog(false);
        // Update local state
        setQuote(editForm);
        // Invalidate and refetch supplier quotes cache to update the table
        queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", "ready-for-lpo"] });
      })
      .catch(e => {
        toast({
          title: "Error",
          description: e.message || "Failed to update supplier quote.",
          variant: "destructive"
        });
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate("/supplier-quotes")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            <div className="text-sm font-bold">Back to Supplier Quotes</div>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {quote?.quoteNumber || 'Loading...'}
            </h1>
            <p className="text-gray-600">
              From {quote?.supplierName || 'Loading...'}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {/* <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button> */}
          {quote?.status === "Under Review" && (
            <>
              <Button 
                variant="outline"
                onClick={handleApprove}
                className="border-green-500 text-green-600 hover:bg-green-50"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button 
                variant="outline"
                onClick={handleReject}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          <Button 
            variant="outline"
            onClick={handleEditClick}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button 
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Status</p>
                <StatusPill status={quote?.status || ''} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Priority</p>
                <Badge className={getPriorityColor(quote?.priority || '')}>
                  {quote?.priority}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Total Amount</p>
                <p className="font-semibold">{quote?.currency} {quote?.totalAmount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Score</p>
                <p className={`font-semibold ${getScoreColor(quote?.score || 0)}`}>
                  {quote?.score}/10
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Rank</p>
                <p className="font-semibold">#{ quote?.rank}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote Information */}
        <Card>
          <CardHeader>
            <CardTitle>Quote Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Supplier</label>
                <p className="mt-1">{quote?.supplierName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Customer</label>
                <p className="mt-1">{quote?.customerName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Enquiry</label>
                <p className="mt-1">
                  {quote?.enquiryNumber ? (
                    <span className="text-blue-600 font-medium">
                      {quote.enquiryNumber}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">No Enquiry</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Requisition</label>
                <p className="mt-1">
                  {quote?.requisitionNumber ? (
                    <span className="text-green-600 font-medium">
                      {quote.requisitionNumber}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">No Requisition</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Request Date</label>
                <p className="mt-1">
                  {quote?.requestDate && quote.requestDate !== null && !isNaN(Date.parse(quote.requestDate))
                    ? formatDate(new Date(quote.requestDate), 'MMM dd, yyyy')
                    : quote?.createdAt && !isNaN(Date.parse(quote.createdAt))
                    ? formatDate(new Date(quote.createdAt), 'MMM dd, yyyy')
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Response Date</label>
                <p className="mt-1">
                  {quote?.responseDate && !isNaN(Date.parse(quote?.responseDate))
                    ? formatDate(new Date(quote.responseDate), 'MMM dd, yyyy')
                    : 'Pending'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Valid Until</label>
                <p className="mt-1">{
                  quote?.validUntil && !isNaN(Date.parse(quote?.validUntil))
                    ? formatDate(new Date(quote.validUntil), 'MMM dd, yyyy')
                    : 'N/A'
                }</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Currency</label>
                <p className="mt-1">{quote?.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Payment Terms</label>
              <p className="mt-1 text-gray-900">{quote?.paymentTerms}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Delivery Terms</label>
              <p className="mt-1 text-gray-900">{quote?.deliveryTerms}</p>
            </div>
            {quote?.notes && (
              <div>
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <p className="mt-1 text-gray-900">{quote?.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier Quotation Document Section */}
      {quote?.supplierQuotationDocument && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Supplier Quotation Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">Quotation Document</p>
                  <p className="text-sm text-gray-500">
                    {quote?.supplierQuotationDocument.includes('http') ? 'External Link' : 'Uploaded File'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(quote.supplierQuotationDocument, '_blank')}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = quote.supplierQuotationDocument!;
                    link.download = `quotation-${quote.quoteNumber}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Section */}
      <SupplierQuoteItemsManager 
        supplierQuoteId={quoteId || ''} 
        editable={true}
      />

      {/* Purchase Invoices Section removed as requested */}

      {/* Delete Confirmation Dialog */}
      {/* Edit Supplier Quote Modal Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Supplier Quote</DialogTitle>
            {editForm && (
              <p className="text-sm text-muted-foreground">
                Quote Number: {editForm.quoteNumber}
              </p>
            )}
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-supplierName">Supplier Name</Label>
                <Input
                  id="edit-supplierName"
                  value={editForm.supplierName}
                  onChange={e => handleEditChange("supplierName", e.target.value)}
                  placeholder="Enter supplier name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select
                    value={editForm.priority}
                    onValueChange={(value: "Low" | "Medium" | "High" | "Urgent") => 
                      handleEditChange("priority", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value: "Draft" | "Sent" | "Received" | "Under Review" | "Approved" | "Rejected" | "Accepted" | "Expired") => 
                      handleEditChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Received">Received</SelectItem>
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Accepted">Accepted</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-totalAmount">Total Amount</Label>
                  <Input
                    id="edit-totalAmount"
                    type="number"
                    step="0.01"
                    value={editForm.totalAmount}
                    onChange={e => handleEditChange("totalAmount", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-currency">Currency</Label>
                  <Select
                    value={editForm.currency}
                    onValueChange={(value: "BHD" | "AED" | "SAR" | "QAR" | "KWD") => 
                      handleEditChange("currency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BHD">BHD</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="SAR">SAR</SelectItem>
                      <SelectItem value="QAR">QAR</SelectItem>
                      <SelectItem value="KWD">KWD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-paymentTerms">Payment Terms</Label>
                  <Input
                    id="edit-paymentTerms"
                    value={editForm.paymentTerms || ""}
                    onChange={e => handleEditChange("paymentTerms", e.target.value)}
                    placeholder="e.g., Net 30"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-deliveryTerms">Delivery Terms</Label>
                  <Input
                    id="edit-deliveryTerms"
                    value={editForm.deliveryTerms || ""}
                    onChange={e => handleEditChange("deliveryTerms", e.target.value)}
                    placeholder="e.g., FOB Destination"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editForm.notes || ""}
                  onChange={e => handleEditChange("notes", e.target.value)}
                  placeholder="Additional requirements or specifications"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleEditSave}
                  disabled={!editForm?.supplierName?.trim() || !editForm?.totalAmount?.toString().trim() || !editForm?.currency?.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier quote? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="border-red-500 text-red-600 hover:bg-red-50 bg-transparent"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PI PDF Table Preview Dialog */}
      <Dialog open={showPiPreview} onOpenChange={setShowPiPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Purchase Invoice PDF Table Preview</DialogTitle>
          </DialogHeader>
          {piPreviewLoading ? (
            <div className="py-8 text-center text-gray-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              {piTable && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">Currency: {piTable.currency || 'BHD'}</div>
                  <table className="min-w-full text-sm border">
                    <thead>
                      <tr>
                        {(piTable.tableHeaders || []).map((h, i) => (
                          <th key={i} className="border px-2 py-1 text-left bg-gray-50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(piTable.tableData || []).map((row, i) => (
                        <tr key={i}>
                          <td className="border px-2 py-1">{row.serialNumber}</td>
                          <td className="border px-2 py-1">{row.itemDescription}</td>
                          <td className="border px-2 py-1">{row.quantity}</td>
                          <td className="border px-2 py-1">{row.unit}</td>
                          <td className="border px-2 py-1">{row.cost}</td>
                          <td className="border px-2 py-1">{row.discountPercent}</td>
                          <td className="border px-2 py-1">{row.discountAmount}</td>
                          <td className="border px-2 py-1">{row.vatPercent}</td>
                          <td className="border px-2 py-1">{row.vatAmount}</td>
                          <td className="border px-2 py-1">{row.totalAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {piTable.totals && (
                    <div className="text-right text-sm text-gray-700 space-y-1">
                      <div>Subtotal: {piTable.totals.totalGrossAmount}</div>
                      <div>Discount: {piTable.totals.totalDiscountAmount}</div>
                      <div>VAT: {piTable.totals.totalVatAmount}</div>
                      <div className="font-semibold">Total: {piTable.totals.totalAmount}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}