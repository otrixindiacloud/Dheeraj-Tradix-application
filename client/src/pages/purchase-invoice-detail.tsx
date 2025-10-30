import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Download, 
  FileText,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Receipt,
  Package,
  AlertTriangle,
  Edit,
  Printer,
  Share2,
  Save,
  X,
  CheckCircle,
  Mail,
  Copy,
  User,
  Truck,
  ClipboardCheck,
  FileCheck,
  CreditCard,
  FileSearch,
  Eye,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PurchaseInvoiceItem {
  id: string;
  purchaseInvoiceId?: string;
  invoiceId?: string; // Legacy field, may be used elsewhere
  itemId?: string;
  variantId?: string;
  goodsReceiptItemId?: string;
  lpoItemId?: string;
  itemDescription: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  unitOfMeasure?: string;
  taxRate: string;
  discountRate: string;
  taxAmount: string;
  discountAmount: string;
  supplierCode?: string;
  barcode?: string;
  storageLocation?: string;
  batchNumber?: string;
  expiryDate?: string;
  condition?: string;
  notes?: string;
  // Item details
  itemDescriptionFromItem?: string;
  itemCategory?: string;
  itemStorageLocation?: string;
  itemDimensions?: string;
  itemWeight?: string;
  itemSupplierCode?: string;
  itemBarcode?: string;
  // Variant details
  variant?: {
    id: string;
    variantName?: string;
    variantValue?: string;
    additionalCost?: string;
  };
  // Goods receipt item details
  goodsReceiptItem?: {
    id: string;
    quantityExpected?: number;
    quantityReceived?: number;
    quantityDamaged?: number;
    quantityShort?: number;
    unitCost?: string;
    totalCost?: string;
    discrepancyReason?: string;
  };
  // Item object for PDF generation (backward compatibility)
  item?: {
    itemName?: string;
    description?: string;
    category?: string;
    storageLocation?: string;
    dimensions?: string;
    weight?: string;
    itemCode?: string;
    barcode?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  goodsReceiptId?: string;
  goodsReceiptNumber?: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Paid" | "Partially Paid" | "Overdue" | "Discrepancy" | "Cancelled";
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overdue";
  invoiceDate: string;
  dueDate: string;
  receivedDate?: string;
  paymentDate?: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  currency: "BHD" | "AED" | "EUR" | "GBP";
  paymentTerms: string;
  paymentMethod?: "Bank Transfer" | "Cheque" | "Cash" | "Credit Card" | "Letter of Credit";
  bankReference?: string;
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
  attachments: string[];
  itemCount: number;
  items?: PurchaseInvoiceItem[];
  isRecurring: boolean;
  nextInvoiceDate?: string;
  createdAt: string;
  updatedAt: string;
}

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

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase();
  switch (statusLower) {
    case "draft":
      return <span className="text-gray-600 font-medium">Draft</span>;
    case "pending approval":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending Approval</Badge>;
    case "approved":
      return <span className="text-green-600 font-medium">Approved</span>;
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Paid</Badge>;
    case "partially paid":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Partially Paid</Badge>;
    case "overdue":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Overdue</Badge>;
    case "discrepancy":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Discrepancy</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Cancelled</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800 border-gray-300">{status}</Badge>;
  }
};

const getPaymentStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase();
  switch (statusLower) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Paid</Badge>;
    case "partially paid":
      return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Partially Paid</Badge>;
    case "unpaid":
      return <span className="text-red-600 font-medium">Unpaid</span>;
    case "overdue":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Overdue</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800 border-gray-300">{status}</Badge>;
  }
};

export default function PurchaseInvoiceDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<Partial<PurchaseInvoice>>({});
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Bank Transfer" | "Cheque" | "Cash" | "Credit Card" | "Letter of Credit">("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");

  // Fetch purchase invoice details
  const { data: invoiceData, isLoading, error, refetch } = useQuery({
    queryKey: ['purchase-invoice', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/purchase-invoices/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch purchase invoice');
      }
      const data = await response.json();
      
      // Log items count for debugging
      console.log('[PurchaseInvoiceDetail] Fetched invoice data:', {
        invoiceId: id,
        invoiceNumber: data.invoiceNumber,
        itemsCount: data.items?.length || 0,
        hasItems: !!(data.items && data.items.length > 0),
        items: data.items || []
      });
      
      // Ensure items array exists
      if (!data.items) {
        data.items = [];
      }
      
      return data as PurchaseInvoice;
    },
    enabled: !!id,
  });

  // Fallback: fetch items directly if the main invoice response has no items
  const { data: fallbackItems = [], isFetching: isFetchingItems } = useQuery({
    queryKey: ['purchase-invoice-items', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/purchase-invoices/${id}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch purchase invoice items');
      }
      const items = await response.json();
      return Array.isArray(items) ? items as PurchaseInvoiceItem[] : [];
    },
    enabled: !!id && !!invoiceData && ((invoiceData.items?.length || 0) === 0),
  });

  // Download PDF handler
  const handleDownloadPDF = async () => {
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while the PDF is being generated...",
      });

      const response = await apiRequest("GET", `/api/purchase-invoices/${id}/pdf?mode=enhanced`);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `purchase-invoice-${invoiceData?.invoiceNumber || 'unknown'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Purchase invoice PDF download started.",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate or download the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Process payment mutation
  const processPayment = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: string; method: string; reference: string }) => {
      const response = await apiRequest("POST", `/api/purchase-invoices/${data.invoiceId}/payment`, {
        amount: parseFloat(data.amount),
        method: data.method,
        reference: data.reference
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to record payment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Payment Recorded",
        description: "Payment has been recorded successfully.",
      });
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentReference("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update payment status mutation
  const updatePaymentStatus = useMutation({
    mutationFn: async (data: { invoiceId: string; paymentStatus: string }) => {
      const response = await apiRequest("PATCH", `/api/purchase-invoices/${data.invoiceId}/payment-status`, {
        paymentStatus: data.paymentStatus
      });
      
      if (!response.ok) {
        throw new Error('Failed to update payment status');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Payment Status Updated",
        description: "Payment status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update invoice status mutation
  const updateInvoiceStatus = useMutation({
    mutationFn: async (data: { invoiceId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/purchase-invoices/${data.invoiceId}/status`, {
        status: data.status
      });
      
      if (!response.ok) {
        throw new Error('Failed to update invoice status');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Invoice Status Updated",
        description: "Invoice status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePayment = () => {
    if (!invoiceData || !paymentAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter a payment amount.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(paymentAmount);
    const total = parseFloat(invoiceData.totalAmount);
    const paid = parseFloat(invoiceData.paidAmount || "0");

    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (amount > total - paid) {
      toast({
        title: "Amount Too High",
        description: `Payment amount cannot exceed remaining balance of ${invoiceData.currency} ${(total - paid).toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    processPayment.mutate({
      invoiceId: invoiceData.id,
      amount: paymentAmount,
      method: paymentMethod,
      reference: paymentReference
    });
  };

  const handleSendEmail = async () => {
    try {
      toast({
        title: "Sending Email",
        description: "Please wait while we prepare the email...",
      });

      // This would call the email API when available
      toast({
        title: "Not Implemented",
        description: "Email functionality will be available soon.",
      });
      setIsEmailDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard!",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading purchase invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Purchase Invoice Not Found</h2>
          <p className="text-gray-600 mb-6">The purchase invoice you're looking for doesn't exist or has been removed.</p>
          <Link href="/purchase-invoices">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Purchase Invoices
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const financials = {
    subtotal: parseFloat(invoiceData.subtotal || '0'),
    taxAmount: parseFloat(invoiceData.taxAmount || '0'),
    discountAmount: parseFloat(invoiceData.discountAmount || '0'),
    totalAmount: parseFloat(invoiceData.totalAmount || '0'),
    paidAmount: parseFloat(invoiceData.paidAmount || '0'),
    remainingAmount: parseFloat(invoiceData.remainingAmount || '0'),
  };

  const isOverdue = new Date(invoiceData.dueDate) < new Date() && invoiceData.paymentStatus !== "Paid";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/purchase-invoices">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Purchase Invoice</h1>
                    <p className="text-sm text-gray-500 font-mono">{invoiceData.invoiceNumber}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={invoiceData.status}
                onValueChange={(value) => {
                  if (value !== invoiceData.status) {
                    updateInvoiceStatus.mutate({
                      invoiceId: invoiceData.id,
                      status: value
                    });
                  }
                }}
                disabled={updateInvoiceStatus.isPending}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Discrepancy">Discrepancy</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEmailDialogOpen(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => printRef.current && window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{invoiceData.currency} {financials.totalAmount.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Paid Amount</p>
                  <p className="text-2xl font-bold text-green-600">{invoiceData.currency} {financials.paidAmount.toFixed(2)}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Remaining</p>
                  <p className="text-2xl font-bold text-orange-600">{invoiceData.currency} {financials.remainingAmount.toFixed(2)}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Payment Status</p>
                <Select
                  value={invoiceData.paymentStatus}
                  onValueChange={(value) => {
                    if (invoiceData && value !== invoiceData.paymentStatus) {
                      updatePaymentStatus.mutate({
                        invoiceId: invoiceData.id,
                        paymentStatus: value
                      });
                    }
                  }}
                  disabled={updatePaymentStatus.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier Information */}
            <Card ref={printRef}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Supplier Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Supplier Name</Label>
                    <p className="font-medium">{invoiceData.supplierName}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Supplier Invoice</Label>
                    <p className="font-medium">{invoiceData.supplierInvoiceNumber || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Invoice Items
                  </div>
                  <Badge variant="secondary">{(invoiceData.items?.length || fallbackItems.length || 0)} items</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!invoiceData.items || invoiceData.items.length === 0) && fallbackItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">{isFetchingItems ? 'Loading items…' : 'No items found for this purchase invoice.'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto flex justify-center">
                    <table className="w-[95%] max-w-[1400px] border-collapse mx-auto">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-center py-3 px-2 font-semibold text-gray-700 text-xs">S</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-700 text-xs">I</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs">Item Description & Specifications</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-700 text-xs">Qty</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-700 text-xs">Unit Cost</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-700 text-xs">Disc %</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-700 text-xs">Disc Amt</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-700 text-xs">VAT %</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-700 text-xs">VAT Amt</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700 text-xs">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items : fallbackItems).map((item, index) => {
                        const unitCost = parseFloat(item.unitPrice) || 0;
                        const quantity = item.quantity || 0;
                        const grossAmount = unitCost * quantity;
                        const discountRate = parseFloat(item.discountRate) || 0;
                        const discountAmount = parseFloat(item.discountAmount) || (grossAmount * discountRate / 100);
                        const netAmount = grossAmount - discountAmount;
                        const taxRate = parseFloat(item.taxRate) || 0;
                        const taxAmount = parseFloat(item.taxAmount) || (netAmount * taxRate / 100);
                        const totalAmount = netAmount + taxAmount;

                        return (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-2 text-center text-sm text-gray-600">{index + 1}</td>
                            <td className="py-3 px-2 text-center text-sm text-gray-600">
                              {item.supplierCode || item.barcode || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-sm">{item.itemDescription}</span>
                              {/* Supplier quote item specifications */}
                              {(item as any).supplierQuoteItem && (item as any).supplierQuoteItem.specification && (
                                <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                                  {(item as any).supplierQuoteItem.specification}
                                </p>
                              )}
                              {(item as any).supplierQuoteItem && ((item as any).supplierQuoteItem.brand || (item as any).supplierQuoteItem.model) && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {(item as any).supplierQuoteItem.brand && <span>Brand: {(item as any).supplierQuoteItem.brand}</span>}
                                  {(item as any).supplierQuoteItem.brand && (item as any).supplierQuoteItem.model && <span> • </span>}
                                  {(item as any).supplierQuoteItem.model && <span>Model: {(item as any).supplierQuoteItem.model}</span>}
                                </p>
                              )}
                              {item.variant && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {item.variant.variantName}: {item.variant.variantValue}
                                </p>
                              )}
                              {item.unitOfMeasure && (
                                <p className="text-xs text-gray-500 mt-1">Unit: {item.unitOfMeasure}</p>
                              )}
                              {item.storageLocation && (
                                <p className="text-xs text-gray-500 mt-1">Location: {item.storageLocation}</p>
                              )}
                              {item.batchNumber && (
                                <p className="text-xs text-gray-500 mt-1">Batch: {item.batchNumber}</p>
                              )}
                              {item.expiryDate && (
                                <p className="text-xs text-gray-500 mt-1">Expiry: {formatDate(item.expiryDate)}</p>
                              )}
                              {item.condition && item.condition !== "Good" && (
                                <p className="text-xs text-orange-600 mt-1">Condition: {item.condition}</p>
                              )}
                              {item.goodsReceiptItem && (item.goodsReceiptItem.quantityDamaged || item.goodsReceiptItem.quantityShort) && (
                                <p className="text-xs text-red-600 mt-1">
                                  {item.goodsReceiptItem.quantityDamaged ? `Damaged: ${item.goodsReceiptItem.quantityDamaged}` : ''}
                                  {item.goodsReceiptItem.quantityDamaged && item.goodsReceiptItem.quantityShort ? ' • ' : ''}
                                  {item.goodsReceiptItem.quantityShort ? `Short: ${item.goodsReceiptItem.quantityShort}` : ''}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-sm font-medium">
                              {quantity.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right text-sm">
                              {invoiceData.currency} {unitCost.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right text-sm">
                              {discountRate.toFixed(1)}%
                            </td>
                            <td className="py-3 px-3 text-right text-sm">
                              {invoiceData.currency} {discountAmount.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right text-sm">
                              {taxRate.toFixed(1)}%
                            </td>
                            <td className="py-3 px-3 text-right text-sm">
                              {invoiceData.currency} {taxAmount.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-semibold">
                                {invoiceData.currency} {totalAmount.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50">
                          <td colSpan={3} className="py-4 px-4 font-semibold text-gray-900">
                            Total
                          </td>
                          <td className="py-4 px-3 text-right font-semibold">
                            {(invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items : fallbackItems).reduce((sum, it) => sum + (it.quantity || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 px-3"></td>
                          <td className="py-4 px-3"></td>
                          <td className="py-4 px-3 text-right font-semibold text-red-600">
                            {invoiceData.currency} {financials.discountAmount.toFixed(2)}
                          </td>
                          <td className="py-4 px-3"></td>
                          <td className="py-4 px-3 text-right font-semibold">
                            {invoiceData.currency} {financials.taxAmount.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-lg font-bold">
                              {invoiceData.currency} {financials.totalAmount.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {invoiceData.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoiceData.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-medium">{invoiceData.currency} {financials.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tax (VAT)</span>
                  <span className="text-sm font-medium">{invoiceData.currency} {financials.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Discount</span>
                  <span className="text-sm font-medium text-red-600">-{invoiceData.currency} {financials.discountAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold text-blue-600">{invoiceData.currency} {financials.totalAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Paid</span>
                  <span className="text-sm font-medium text-green-600">{invoiceData.currency} {financials.paidAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-orange-600">Remaining</span>
                  <span className="text-sm font-bold text-orange-600">{invoiceData.currency} {financials.remainingAmount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-gray-600">Invoice Date</Label>
                  <p className="font-medium">{formatDate(invoiceData.invoiceDate)}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Due Date</Label>
                  <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                    {formatDate(invoiceData.dueDate)}
                    {isOverdue && <span className="ml-2 text-red-600">Overdue</span>}
                  </p>
                </div>
                {invoiceData.receivedDate && (
                  <div>
                    <Label className="text-gray-600">Received Date</Label>
                    <p className="font-medium">{formatDate(invoiceData.receivedDate)}</p>
                  </div>
                )}
                <div>
                  <Label className="text-gray-600">Payment Terms</Label>
                  <p className="font-medium">{invoiceData.paymentTerms}</p>
                </div>
                {invoiceData.purchaseOrderNumber && (
                  <div>
                    <Label className="text-gray-600">Purchase Order</Label>
                    <p className="font-medium">{invoiceData.purchaseOrderNumber}</p>
                  </div>
                )}
                {invoiceData.goodsReceiptNumber && (
                  <div>
                    <Label className="text-gray-600">Goods Receipt</Label>
                    <p className="font-medium">{invoiceData.goodsReceiptNumber}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Information */}
            {invoiceData.paidAmount && parseFloat(invoiceData.paidAmount) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-gray-600">Payment Date</Label>
                    <p className="font-medium">{invoiceData.paymentDate ? formatDate(invoiceData.paymentDate) : "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Payment Method</Label>
                    <p className="font-medium">{invoiceData.paymentMethod || "N/A"}</p>
                  </div>
                  {invoiceData.bankReference && (
                    <div>
                      <Label className="text-gray-600">Bank Reference</Label>
                      <p className="font-medium font-mono">{invoiceData.bankReference}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => setIsPaymentDialogOpen(true)}
                  disabled={invoiceData.paymentStatus === "Paid"}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
                <Button className="w-full" variant="outline" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {invoiceData?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={`Max: ${invoiceData?.currency} ${financials.remainingAmount.toFixed(2)}`}
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Letter of Credit">Letter of Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Transaction ID</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter reference number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={processPayment.isPending}>
              {processPayment.isPending ? "Processing..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice via Email</DialogTitle>
            <DialogDescription>
              Email functionality will be available soon.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

