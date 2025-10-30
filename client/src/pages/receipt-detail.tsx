import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
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
  MapPin,
  Hash,
  TrendingUp,
  TrendingDown,
  Shield,
  PackageX,
  ExternalLink
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
} from "@/components/ui/dialog";

interface ReceiptItem {
  id?: string;
  receiptHeaderId?: string;
  itemId?: string;
  variantId?: string;
  lpoItemId?: string;
  barcode?: string;
  supplierCode?: string;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  quantityExpected: number;
  quantityReceived: number;
  quantityDamaged?: number;
  quantityShort?: number;
  unitCost?: number | string;
  totalCost?: number | string;
  taxRate?: number | string;
  taxAmount?: number | string;
  discountRate?: number | string;
  discountAmount?: number | string;
  storageLocation?: string;
  batchNumber?: string;
  expiryDate?: string;
  condition?: string;
  discrepancyReason?: string;
  scannedAt?: string;
  receivedAt?: string;
  notes?: string;
}

interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  supplierLpoId?: string;
  supplierId: string;
  lpoNumber?: string;
  lpoValue?: string | number;
  lpoCurrency?: string;
  receiptDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  receivedBy?: string;
  status: "Draft" | "Pending" | "Partial" | "Complete" | "Completed" | "Discrepancy" | "Approved";
  notes?: string;
  storageLocation?: string;
  totalItems?: number;
  totalQuantityExpected?: number;
  totalQuantityReceived?: number;
  discrepancyFlag?: boolean;
  supplierName?: string;
  supplierAddress?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  items?: ReceiptItem[];
  createdAt?: string;
  updatedAt?: string;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === null || amount === undefined || amount === "") return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: typeof Clock }> = {
    Draft: {
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      icon: FileText,
    },
    Pending: {
      color: "text-yellow-700",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      icon: Clock,
    },
    Partial: {
      color: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      icon: Truck,
    },
    Complete: {
      color: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: CheckCircle,
    },
    Completed: {
      color: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: CheckCircle,
    },
    Discrepancy: {
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: AlertTriangle,
    },
    Approved: {
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      icon: Shield,
    },
  };

  const config = statusConfig[status] || statusConfig.Pending;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.color} ${config.bgColor} ${config.borderColor} inline-flex items-center gap-1.5 px-3 py-1.5 border font-medium`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{status}</span>
    </Badge>
  );
};

export default function ReceiptDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<Partial<GoodsReceipt>>({});

  // Fetch receipt details
  const { data: receiptData, isLoading, error, refetch } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/goods-receipt-headers/${id}`);
      const receipt = await response.json();
      
      // Fetch items for this receipt
      const itemsResponse = await apiRequest("GET", `/api/goods-receipt-headers/${id}/items`);
      const items = await itemsResponse.json();
      
      // Fetch supplier details if supplierId is available
      let supplierData = {};
      if (receipt.supplierId) {
        try {
          const supplierResponse = await apiRequest("GET", `/api/suppliers/${receipt.supplierId}`);
          supplierData = await supplierResponse.json();
        } catch (err) {
          console.warn("Failed to fetch supplier details:", err);
        }
      }
      
      return {
        ...receipt,
        ...supplierData,
        items: items || []
      } as GoodsReceipt;
    },
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GoodsReceipt>) => {
      // Convert camelCase to snake_case for database
      const dbData: any = {};
      if (data.receiptDate) dbData.receipt_date = data.receiptDate;
      if (data.expectedDeliveryDate) dbData.expected_delivery_date = data.expectedDeliveryDate;
      if (data.actualDeliveryDate) dbData.actual_delivery_date = data.actualDeliveryDate;
      if (data.receivedBy) dbData.received_by = data.receivedBy;
      if (data.status) dbData.status = data.status;
      if (data.notes !== undefined) dbData.notes = data.notes;
      if (data.storageLocation !== undefined) dbData.storage_location = data.storageLocation;
      
      const response = await apiRequest("PUT", `/api/goods-receipt-headers/${id}`, dbData);
      const json = await response.json();
      return json;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Receipt updated successfully",
      });
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (approvedBy: string) => {
      const response = await apiRequest("PATCH", `/api/goods-receipt-headers/${id}/approve`, { approvedBy });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Receipt approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editedData);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedData({});
  };

  const handleApprove = () => {
    const approvedBy = receiptData?.receivedBy || "System";
    if (confirm(`Are you sure you want to approve receipt ${receiptData?.receiptNumber}?`)) {
      approveMutation.mutate(approvedBy);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/goods-receipt-headers/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goods-receipt-${receiptData?.receiptNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Receipt link copied to clipboard",
    });
  };

  const handleEmailShare = () => {
    const subject = `Goods Receipt ${receiptData?.receiptNumber}`;
    const body = `View the goods receipt details: ${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading receipt details...</p>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Failed to load receipt details</p>
          <Button onClick={() => navigate("/receipts")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </Button>
        </div>
      </div>
    );
  }

  // Calculate totals
  const items = receiptData.items || [];
  const totalQuantityExpected = items.reduce((sum, item) => sum + (Number(item.quantityExpected) || 0), 0);
  const totalQuantityReceived = items.reduce((sum, item) => sum + (Number(item.quantityReceived) || 0), 0);
  const totalQuantityDamaged = items.reduce((sum, item) => sum + (Number(item.quantityDamaged) || 0), 0);
  const totalQuantityShort = items.reduce((sum, item) => sum + (Number(item.quantityShort) || 0), 0);
  
  // Calculate financial totals
  const grossAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantityReceived) || 0;
    const cost = parseFloat(String(item.unitCost || 0));
    return sum + (qty * cost);
  }, 0);
  
  const totalDiscount = items.reduce((sum, item) => sum + parseFloat(String(item.discountAmount || 0)), 0);
  const netAmount = grossAmount - totalDiscount;
  const totalTax = items.reduce((sum, item) => sum + parseFloat(String(item.taxAmount || 0)), 0);
  const grandTotal = netAmount + totalTax;

  const completionPercentage = totalQuantityExpected > 0 
    ? Math.round((totalQuantityReceived / totalQuantityExpected) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-content,
          #printable-content * {
            visibility: visible;
          }
          #printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header - aligned with Supplier Quote header style */}
      <div className="p-6 no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate("/receipts")}
              className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200"
            >
              <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
              <div className="text-sm font-bold">Back to Receipts</div>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Receipt #{receiptData.receiptNumber}</h1>
              <p className="text-gray-600">Created {formatDate(receiptData.createdAt)}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <>
                {receiptData.status !== "Approved" && receiptData.status !== "Completed" && receiptData.status !== "Complete" && (
                  <>
                    <Button variant="outline" onClick={() => setIsEditMode(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    {receiptData.status !== "Draft" && (
                      <Button
                        variant="outline"
                        onClick={handleApprove}
                        disabled={approveMutation.isPending}
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        {approveMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                    )}
                  </>
                )}
                <Button variant="outline" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => setIsShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6" id="printable-content">
        <div className="grid gap-6">
          {/* Receipt Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Receipt Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <Label className="text-gray-600 mb-2 block">Receipt Number</Label>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span className="font-mono font-medium">{receiptData.receiptNumber}</span>
                  </div>
                </div>
                
                <div>
                  <Label className="text-gray-600 mb-2 block">Receipt Date</Label>
                  {isEditMode ? (
                    <Input
                      type="date"
                      value={editedData.receiptDate || receiptData.receiptDate || ""}
                      onChange={(e) => setEditedData({ ...editedData, receiptDate: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{formatDate(receiptData.receiptDate)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Status</Label>
                  {isEditMode ? (
                    <Select
                      value={editedData.status || receiptData.status}
                      onValueChange={(value) => setEditedData({ ...editedData, status: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                        <SelectItem value="Discrepancy">Discrepancy</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getStatusBadge(receiptData.status)
                  )}
                </div>

                {receiptData.expectedDeliveryDate && (
                  <div>
                    <Label className="text-gray-600 mb-2 block">Expected Delivery Date</Label>
                    {isEditMode ? (
                      <Input
                        type="date"
                        value={editedData.expectedDeliveryDate || receiptData.expectedDeliveryDate || ""}
                        onChange={(e) => setEditedData({ ...editedData, expectedDeliveryDate: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(receiptData.expectedDeliveryDate)}</span>
                      </div>
                    )}
                  </div>
                )}

                {receiptData.actualDeliveryDate && (
                  <div>
                    <Label className="text-gray-600 mb-2 block">Actual Delivery Date</Label>
                    {isEditMode ? (
                      <Input
                        type="date"
                        value={editedData.actualDeliveryDate || receiptData.actualDeliveryDate || ""}
                        onChange={(e) => setEditedData({ ...editedData, actualDeliveryDate: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(receiptData.actualDeliveryDate)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-gray-600 mb-2 block">Received By</Label>
                  {isEditMode ? (
                    <Input
                      value={editedData.receivedBy || receiptData.receivedBy || ""}
                      onChange={(e) => setEditedData({ ...editedData, receivedBy: e.target.value })}
                      placeholder="Enter recipient name"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{receiptData.receivedBy || "N/A"}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Supplier</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{receiptData.supplierName || receiptData.supplierId || "N/A"}</span>
                  </div>
                  {receiptData.supplierAddress && (
                    <p className="text-sm text-gray-500 mt-1">{receiptData.supplierAddress}</p>
                  )}
                </div>

                {receiptData.lpoNumber && (
                  <div>
                    <Label className="text-gray-600 mb-2 block">LPO Number</Label>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{receiptData.lpoNumber}</span>
                      {receiptData.lpoValue && (
                        <span className="text-sm text-gray-500">
                          ({formatCurrency(receiptData.lpoValue)} {receiptData.lpoCurrency || "USD"})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {receiptData.storageLocation && (
                  <div>
                    <Label className="text-gray-600 mb-2 block">Storage Location</Label>
                    {isEditMode ? (
                      <Input
                        value={editedData.storageLocation || receiptData.storageLocation || ""}
                        onChange={(e) => setEditedData({ ...editedData, storageLocation: e.target.value })}
                        placeholder="Enter storage location"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{receiptData.storageLocation}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-gray-600 mb-2 block">Total Items</Label>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span>{items.length} items</span>
                  </div>
                </div>
              </div>

              {(receiptData.notes || isEditMode) && (
                <div className="mt-6">
                  <Label className="text-gray-600 mb-2 block">Notes</Label>
                  {isEditMode ? (
                    <Textarea
                      value={editedData.notes !== undefined ? editedData.notes : receiptData.notes || ""}
                      onChange={(e) => setEditedData({ ...editedData, notes: e.target.value })}
                      rows={3}
                      placeholder="Add notes about this receipt..."
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{receiptData.notes || "No notes"}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Expected Quantity</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">{totalQuantityExpected.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Total expected units</p>
                  </div>
                  <ClipboardCheck className="h-10 w-10 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Received Quantity</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">{totalQuantityReceived.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {completionPercentage}% complete
                    </p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-green-400" />
                </div>
                {completionPercentage < 100 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(totalQuantityDamaged > 0 || totalQuantityShort > 0) && (
              <>
                {totalQuantityDamaged > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Damaged</p>
                          <p className="text-2xl font-bold text-orange-700 mt-1">{totalQuantityDamaged.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-1">Damaged units</p>
                        </div>
                        <PackageX className="h-10 w-10 text-orange-400" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {totalQuantityShort > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Short</p>
                          <p className="text-2xl font-bold text-red-700 mt-1">{totalQuantityShort.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-1">Short units</p>
                        </div>
                        <TrendingDown className="h-10 w-10 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Value</p>
                    <p className="text-2xl font-bold text-purple-700 mt-1">
                      {formatCurrency(grandTotal)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {totalTax > 0 && <span>Tax: {formatCurrency(totalTax)}</span>}
                      {totalDiscount > 0 && <span className="ml-2">Disc: {formatCurrency(totalDiscount)}</span>}
                    </p>
                  </div>
                  <DollarSign className="h-10 w-10 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Receipt Items ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Item</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Expected</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Received</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Damaged</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Short</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Unit Cost</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Discount</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Tax</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, index) => {
                        const qtyReceived = Number(item.quantityReceived) || 0;
                        const qtyExpected = Number(item.quantityExpected) || 0;
                        const qtyDamaged = Number(item.quantityDamaged) || 0;
                        const qtyShort = Number(item.quantityShort) || 0;
                        const unitCost = parseFloat(String(item.unitCost || 0));
                        const discountAmount = parseFloat(String(item.discountAmount || 0));
                        const taxAmount = parseFloat(String(item.taxAmount || 0));
                        const itemTotal = (qtyReceived * unitCost) - discountAmount + taxAmount;
                        const isComplete = qtyReceived >= qtyExpected;
                        const hasIssues = qtyDamaged > 0 || qtyShort > 0;

                        return (
                          <tr key={item.id || index} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <p className="font-medium text-gray-900">
                                  {item.itemName || item.itemDescription || "N/A"}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                  {item.itemCode && (
                                    <span className="font-mono">{item.itemCode}</span>
                                  )}
                                  {item.supplierCode && (
                                    <span className="font-mono">Supp: {item.supplierCode}</span>
                                  )}
                                  {item.barcode && (
                                    <span className="font-mono">BC: {item.barcode}</span>
                                  )}
                                </div>
                                {item.batchNumber && (
                                  <p className="text-xs text-gray-400">Batch: {item.batchNumber}</p>
                                )}
                                {item.expiryDate && (
                                  <p className="text-xs text-gray-400">Expiry: {formatDate(item.expiryDate)}</p>
                                )}
                                {item.storageLocation && (
                                  <p className="text-xs text-blue-600 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {item.storageLocation}
                                  </p>
                                )}
                                {item.condition && item.condition !== "Good" && (
                                  <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                    {item.condition}
                                  </Badge>
                                )}
                                {item.discrepancyReason && (
                                  <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {item.discrepancyReason}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className="text-gray-700">{qtyExpected.toLocaleString()}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className={`font-medium ${
                                isComplete
                                  ? "text-green-600"
                                  : qtyReceived > 0
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}>
                                {qtyReceived.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-center py-3 px-4">
                              {qtyDamaged > 0 ? (
                                <span className="text-orange-600 font-medium">{qtyDamaged.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-center py-3 px-4">
                              {qtyShort > 0 ? (
                                <span className="text-red-600 font-medium">{qtyShort.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-right py-3 px-4">
                              <span className="text-gray-700 font-mono">{formatCurrency(unitCost)}</span>
                            </td>
                            <td className="text-right py-3 px-4">
                              {discountAmount > 0 ? (
                                <span className="text-blue-600 font-mono">{formatCurrency(discountAmount)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-right py-3 px-4">
                              {taxAmount > 0 ? (
                                <span className="text-purple-600 font-mono">{formatCurrency(taxAmount)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-right py-3 px-4">
                              <span className="font-medium text-gray-900 font-mono">
                                {formatCurrency(itemTotal)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-gray-500">
                          No items found for this receipt
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-medium border-t-2">
                        <td className="py-4 px-4 text-right" colSpan={5}>
                          <span className="text-gray-700">Totals:</span>
                        </td>
                        <td className="py-4 px-4 text-right text-gray-700">
                          <span className="font-mono">
                            {formatCurrency(items.reduce((sum, item) => sum + parseFloat(String(item.unitCost || 0)), 0) / items.length)}
                          </span>
                          <span className="text-xs text-gray-500 block">(avg)</span>
                        </td>
                        <td className="py-4 px-4 text-right text-blue-700">
                          <span className="font-mono font-semibold">{formatCurrency(totalDiscount)}</span>
                        </td>
                        <td className="py-4 px-4 text-right text-purple-700">
                          <span className="font-mono font-semibold">{formatCurrency(totalTax)}</span>
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          <span className="font-mono font-bold text-lg">{formatCurrency(grandTotal)}</span>
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="py-2 px-4 text-sm text-gray-600" colSpan={5}>
                          Breakdown:
                        </td>
                        <td colSpan={4} className="py-2 px-4 text-right text-sm text-gray-600">
                          Gross: {formatCurrency(grossAmount)} - Discount: {formatCurrency(totalDiscount)} + Tax: {formatCurrency(totalTax)} = {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Receipt</DialogTitle>
            <DialogDescription>
              Share this receipt with others
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleEmailShare}
            >
              <Mail className="h-4 w-4 mr-2" />
              Share via Email
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setIsShareDialogOpen(false);
                handlePrint();
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleDownloadPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
