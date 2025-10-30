import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, 
  FileText,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Receipt,
  Package,
  AlertTriangle,
  Edit,
  Save,
  X,
  CheckCircle,
  User,
  Truck,
  ClipboardCheck,
  MapPin,
  Hash,
  TrendingUp,
  TrendingDown,
  Shield,
  PackageX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
// Dialog imports removed (Share dialog deleted)

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

function formatCurrencyBy(amount: number | string | undefined | null, currency: string = "USD"): string {
  if (amount === null || amount === undefined || amount === "") return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
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
  
  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  // Share dialog removed
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

  // Removed PDF/Print/Share handlers

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
  const sortedItems = [...items].sort((a, b) => {
    const aName = (a.itemName || a.itemDescription || "").toString().toLowerCase();
    const bName = (b.itemName || b.itemDescription || "").toString().toLowerCase();
    return aName.localeCompare(bName);
  });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
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

      {/* Header - aligned with Shipment Detail header style */}
      <div className="max-w-7xl mx-auto space-y-8 no-print">
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/goods-receipt")}
              className="shadow-sm hover:shadow-md transition-shadow inline-flex items-center px-3 py-2 rounded-md"
              data-testid="button-back-goods-receipts"
              aria-label={`Back to Goods Receipts`}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </button>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipt Details</h1>
              <p className="text-sm text-slate-600">Complete receipt information and status</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(receiptData.status)}
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
                {/* PDF / Print / Share removed */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto" id="printable-content">
        <div className="grid gap-8">
          {/* Top Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-2 md:mt-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Items</p>
                  <p className="text-3xl font-bold text-gray-900">{items.length}</p>
                </div>
                <Package className="h-8 w-8 text-gray-300" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Qty Expected</p>
                  <p className="text-3xl font-bold text-gray-900">{totalQuantityExpected}</p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-gray-300" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Qty Received</p>
                  <p className="text-3xl font-bold text-gray-900">{totalQuantityReceived}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-gray-300" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Discrepancy</p>
                  <p className="text-3xl font-bold text-gray-900">{(items.some((i) => i.discrepancyReason) || !!receiptData.discrepancyFlag) ? 'Yes' : 'No'}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-gray-300" />
              </div>
            </div>
          </div>
          {/* Overview sections matching the requested layout */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Receipt Information */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-gray-900">Receipt Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Receipt Number</p>
                      <p className="text-lg font-bold text-gray-900 font-mono">{receiptData.receiptNumber || receiptData.id}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">LPO Number</p>
                      <p className="text-lg font-bold text-blue-600 font-mono">{receiptData.lpoNumber || receiptData.supplierLpoId || "N/A"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Supplier Name</p>
                      <p className="text-lg font-semibold text-gray-900">{receiptData.supplierName || "Unknown Supplier"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">LPO Value</p>
                      <p className="text-lg font-bold text-green-600">
                        {(() => {
                          const lpoValue = receiptData.lpoValue || (items.length > 0 ? items.reduce((s, it) => s + parseFloat(String(it.totalCost || 0)), 0) : undefined);
                          const lpoCurrency = receiptData.lpoCurrency || "USD";
                          return lpoValue !== undefined ? `${formatCurrencyBy(lpoValue, lpoCurrency)}` : "-";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Storage & Logistics */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-6 border border-purple-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-bold text-gray-900">Storage & Logistics</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Storage Location</p>
                      <p className="text-base font-semibold text-gray-900">{receiptData.storageLocation || "-"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Expected Delivery</p>
                      <p className="text-base font-semibold text-gray-900">{formatDate(receiptData.expectedDeliveryDate)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Actual Delivery</p>
                      <p className="text-base font-semibold text-gray-900">{formatDate(receiptData.actualDeliveryDate)}</p>
                    </div>
                  </div>
                </div>

                {/* Timestamps & Tracking */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-6 border border-gray-200 shadow-sm md:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-900">Timestamps & Tracking</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created At</p>
                      <p className="text-base font-semibold text-gray-900">{formatDate(receiptData.createdAt)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Updated At</p>
                      <p className="text-base font-semibold text-gray-900">{formatDate(receiptData.updatedAt)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Received By</p>
                      <p className="text-base font-semibold text-gray-900">{receiptData.receivedBy || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Notes & Comments */}
                {receiptData.notes && (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-6 border border-amber-200 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <h3 className="text-lg font-bold text-gray-900">Notes & Comments</h3>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-amber-100">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{receiptData.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Received Items - list style */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Package className="h-5 w-5" />Received Items</span>
                <Badge className="bg-green-100 text-green-700 border-green-300 text-sm px-3 py-1">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                  {sortedItems.map((item, idx) => (
                    <div key={item.id || idx} className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 text-base">
                                {item.itemName || item.itemDescription || item.itemId || `Item ${idx + 1}`}
                              </p>
                              {item.barcode && (
                                <p className="text-xs font-mono text-gray-500 mt-1">Barcode: {item.barcode}</p>
                              )}
                              {item.supplierCode && (
                                <p className="text-xs font-mono text-gray-500 mt-0.5">Supplier Code: {item.supplierCode}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-500">Qty Received</p>
                              <p className="text-xl font-bold text-green-600">{Number(item.quantityReceived || 0)}</p>
                              {item.quantityExpected && Number(item.quantityExpected) !== Number(item.quantityReceived || 0) && (
                                <p className="text-xs text-orange-600 mt-1">Expected: {Number(item.quantityExpected)}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                            {item.unitCost !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500">Unit Cost</p>
                                <p className="text-sm font-semibold text-gray-900">{formatCurrencyBy(String(item.unitCost), receiptData.lpoCurrency || "USD")}</p>
                              </div>
                            )}
                            {item.totalCost !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500">Total Cost</p>
                                <p className="text-sm font-semibold text-emerald-600">{formatCurrencyBy(String(item.totalCost), receiptData.lpoCurrency || "USD")}</p>
                              </div>
                            )}
                            {item.storageLocation && (
                              <div>
                                <p className="text-xs text-gray-500">Storage</p>
                                <p className="text-sm font-semibold text-gray-900">{item.storageLocation}</p>
                              </div>
                            )}
                            {item.condition && (
                              <div>
                                <p className="text-xs text-gray-500">Condition</p>
                                <Badge variant="outline" className={`text-xs ${
                                  item.condition === 'Good' ? 'bg-green-50 text-green-700 border-green-200' :
                                  item.condition === 'Damaged' ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-gray-50 text-gray-700 border-gray-200'
                                }`}>
                                  {item.condition}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No items found for this goods receipt</p>
                </div>
              )}
            </CardContent>
          </Card>

          

          {/* Close */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => navigate("/goods-receipt")}>Close</Button>
          </div>
        </div>
      </div>

      {/* Share dialog removed */}
    </div>
  );
}
