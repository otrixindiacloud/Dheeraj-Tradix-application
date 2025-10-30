import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useParams } from "wouter";
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
  Truck,
  Package,
  MapPin,
  User,
  RefreshCw,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  salesOrderId: string;
  salesOrder?: {
    id: string;
    orderNumber: string;
    customer?: {
      id: string;
      name: string;
    };
  };
  deliveryDate: string | null;
  status: "Pending" | "Partial" | "Complete" | "Cancelled";
  deliveryType: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  trackingNumber: string | null;
  carrierName: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  pickingStartedBy: string | null;
  pickingStartedAt: string | null;
  pickingCompletedBy: string | null;
  pickingCompletedAt: string | null;
  pickingNotes: string | null;
  deliveryConfirmedBy: string | null;
  deliveryConfirmedAt: string | null;
  deliverySignature: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryItem {
  id: string;
  deliveryId: string;
  salesOrderItemId: string;
  itemId: string;
  barcode: string;
  supplierCode: string;
  description: string;
  orderedQuantity: number;
  pickedQuantity: number;
  deliveredQuantity: number;
  unitPrice: string;
  totalPrice: string;
  pickedBy: string | null;
  pickedAt: string | null;
  storageLocation: string | null;
  pickingNotes: string | null;
  qualityChecked: boolean;
  qualityCheckedBy: string | null;
  qualityCheckedAt: string | null;
  qualityNotes: string | null;
}

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<DeliveryNote | null>(null);
  const deliveryId = params.id;

  // Fetch delivery note details from API
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Related deliveries for the same sales order (history)
  const [relatedDeliveries, setRelatedDeliveries] = useState<DeliveryNote[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [aggregateRemainingQty, setAggregateRemainingQty] = useState<number | null>(null);
  const [aggregateDeliveredQty, setAggregateDeliveredQty] = useState<number | null>(null);
  const [aggregateOrderedQty, setAggregateOrderedQty] = useState<number | null>(null);
  const [remainingBySoItem, setRemainingBySoItem] = useState<Record<string, number>>({});

  // Fetch delivery note and items on mount or deliveryId change
  React.useEffect(() => {
    if (!deliveryId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/delivery-notes/${deliveryId}`).then(async r => {
        if (!r.ok) throw new Error("Failed to fetch delivery note");
        return r.json();
      }),
      fetch(`/api/deliveries/${deliveryId}/items`).then(async r => {
        if (!r.ok) throw new Error("Failed to fetch items");
        return r.json();
      })
    ]).then(([deliveryData, itemsData]) => {
      setDeliveryNote(deliveryData);
      setItems(itemsData);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [deliveryId]);

  // Fetch all deliveries for the same sales order to build history table
  React.useEffect(() => {
    const soId = deliveryNote?.salesOrderId;
    if (!soId) return;
    setRelatedLoading(true);
    setRelatedError(null);
    fetch(`/api/delivery-notes?salesOrderId=${encodeURIComponent(soId)}`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch related deliveries");
        return r.json();
      })
      .then((list: DeliveryNote[]) => {
        // Ensure the current delivery is included and sort by createdAt desc
        const uniqueById: Record<string, DeliveryNote> = {};
        for (const d of list) uniqueById[d.id] = d;
        if (deliveryNote) uniqueById[deliveryNote.id] = deliveryNote as any;
        const merged = Object.values(uniqueById).sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        setRelatedDeliveries(merged);
        setRelatedLoading(false);
      })
      .catch(e => {
        setRelatedError(e.message || "Failed to load related deliveries");
        setRelatedLoading(false);
      });
  }, [deliveryNote?.salesOrderId, deliveryNote?.id]);

  // Compute aggregate ordered/delivered/remaining across all related deliveries by fetching their items
  React.useEffect(() => {
    if (!relatedDeliveries || relatedDeliveries.length === 0) return;
    // Fire parallel item fetches, then aggregate
    const controller = new AbortController();
    Promise.all(
      relatedDeliveries.map(d =>
        fetch(`/api/deliveries/${d.id}/items`, { signal: controller.signal })
          .then(r => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    ).then((allItemsGroups: DeliveryItem[][]) => {
      const flatItems = allItemsGroups.flat();
      // Build cumulative delivered by SO item id
      const bySoItem: Record<string, { ordered: number; delivered: number }> = {};
      for (const it of flatItems as any[]) {
        const key = String(it.salesOrderItemId || it.itemId || it.id);
        const ordered = Number(it.orderedQuantity || 0);
        const delivered = Number(it.deliveredQuantity || it.pickedQuantity || 0);
        if (!bySoItem[key]) bySoItem[key] = { ordered: 0, delivered: 0 };
        // ordered can vary per split; take the max
        bySoItem[key].ordered = Math.max(bySoItem[key].ordered, ordered);
        bySoItem[key].delivered += delivered;
      }

      const remainingMap: Record<string, number> = {};
      let totalOrdered = 0;
      let totalDelivered = 0;
      for (const [key, v] of Object.entries(bySoItem)) {
        totalOrdered += v.ordered;
        totalDelivered += v.delivered;
        remainingMap[key] = Math.max(0, v.ordered - v.delivered);
      }
      const totalRemaining = Math.max(0, totalOrdered - totalDelivered);
      setAggregateOrderedQty(totalOrdered);
      setAggregateDeliveredQty(totalDelivered);
      setAggregateRemainingQty(totalRemaining);
      setRemainingBySoItem(remainingMap);
    });
    return () => controller.abort();
  }, [relatedDeliveries]);

  const handleDelete = () => {
    if (!deliveryId) return;
    fetch(`/api/delivery-notes/${deliveryId}`, {
      method: "DELETE"
    })
      .then(async r => {
        if (!r.ok) throw new Error("Failed to delete delivery note");
        return r.json();
      })
      .then(() => {
        toast({
          title: "Success",
          description: "Delivery note deleted successfully.",
        });
        navigate("/delivery-note");
        setShowDeleteDialog(false);
        queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      })
      .catch(e => {
        toast({
          title: "Error",
          description: e.message || "Failed to delete delivery note.",
          variant: "destructive"
        });
      });
  };

  const handleEditClick = () => {
    if (deliveryNote) {
      setEditForm(deliveryNote);
      setShowEditDialog(true);
    }
  };

  const handleEditChange = <K extends keyof DeliveryNote>(key: K, value: DeliveryNote[K]) => {
    setEditForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleEditSave = () => {
    if (!deliveryId || !editForm) return;
    
    const updateData = {
      status: editForm.status,
      deliveryType: editForm.deliveryType || "",
      deliveryAddress: editForm.deliveryAddress || "",
      deliveryNotes: editForm.deliveryNotes || "",
      trackingNumber: editForm.trackingNumber || "",
      carrierName: editForm.carrierName || "",
      deliveryDate: editForm.deliveryDate || null,
      estimatedDeliveryDate: editForm.estimatedDeliveryDate || null,
      actualDeliveryDate: editForm.actualDeliveryDate || null
    };
    
    fetch(`/api/delivery-notes/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    })
      .then(async r => {
        if (!r.ok) {
          const errorData = await r.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to update delivery note");
        }
        return r.json();
      })
      .then(() => {
        toast({
          title: "Success",
          description: "Delivery note updated successfully.",
        });
        setShowEditDialog(false);
        // Refetch data
        fetch(`/api/delivery-notes/${deliveryId}`).then(async r => {
          if (r.ok) {
            const data = await r.json();
            setDeliveryNote(data);
          }
        });
        queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      })
      .catch(e => {
        toast({
          title: "Error",
          description: e.message || "Failed to update delivery note.",
          variant: "destructive"
        });
      });
  };

  const downloadPDF = async () => {
    if (!deliveryId) return;
    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while the PDF is being generated...",
      });

      const response = await fetch(`/api/delivery-notes/${deliveryId}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delivery-note-${deliveryNote?.deliveryNumber || deliveryId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Delivery note PDF downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const calculateDeliveryCompletion = (items: DeliveryItem[]) => {
    // Prefer cumulative remaining if available; derive delivered as ordered - remaining
    const totals = items.reduce(
      (acc, item) => {
        const ordered = Number(item.orderedQuantity || 0);
        const key = String((item as any).salesOrderItemId || (item as any).itemId || item.id);
        const hasRemaining = remainingBySoItem && Object.prototype.hasOwnProperty.call(remainingBySoItem, key);
        const remaining = hasRemaining
          ? Math.max(0, Number(remainingBySoItem[key]))
          : Math.max(0, ordered - Number(item.deliveredQuantity || 0));
        const delivered = Math.max(0, ordered - remaining);
        acc.totalOrdered += ordered;
        acc.totalDelivered += delivered;
        acc.totalRemaining += remaining;
        return acc;
      },
      { totalOrdered: 0, totalDelivered: 0, totalRemaining: 0 }
    );

    const completionPercentage = totals.totalOrdered > 0 ? Math.round((totals.totalDelivered / totals.totalOrdered) * 100) : 0;
    const isComplete = totals.totalDelivered >= totals.totalOrdered && totals.totalOrdered > 0;
    const isPartial = totals.totalDelivered > 0 && totals.totalDelivered < totals.totalOrdered;

    return {
      totalOrdered: totals.totalOrdered,
      totalDelivered: totals.totalDelivered,
      totalRemaining: totals.totalRemaining,
      completionPercentage,
      isComplete,
      isPartial
    };
  };

  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900">Loading Delivery Note...</h2>
          <p className="text-gray-600 mt-2">Please wait while we fetch the delivery note details.</p>
        </div>
      </div>
    );
  }

  // Show error state if there was an error fetching data
  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Error Loading Delivery Note</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <button 
            onClick={() => navigate("/delivery-note")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200 mt-4"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            <div className="text-sm font-bold">Back to Delivery Notes</div>
          </button>
        </div>
      </div>
    );
  }

  // Show not found state only if we're not loading and there's no error but no delivery note data
  if (!deliveryNote && !loading && !error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Delivery Note Not Found</h2>
          <p className="text-gray-600 mt-2">The delivery note you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate("/delivery-note")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200 mt-4"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            <div className="text-sm font-bold">Back to Delivery Notes</div>
          </button>
        </div>
      </div>
    );
  }

  const completion = calculateDeliveryCompletion(items);
  const totalValue = items.reduce((sum, item) => sum + parseFloat(item.totalPrice || "0"), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate("/delivery-note")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            <div className="text-sm font-bold">Back to Delivery Notes</div>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {deliveryNote?.deliveryNumber || 'Loading...'}
            </h1>
            <p className="text-gray-600">
              {deliveryNote?.salesOrder?.customer?.name || 'Loading...'}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={downloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
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
                <StatusPill status={deliveryNote?.status || ''} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Items</p>
                <p className="font-semibold">{items.length}</p>
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
                <p className="text-sm font-bold text-black">Total Value</p>
                <p className="font-semibold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Progress</p>
                <p className="font-semibold">{completion.completionPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Calendar className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Delivery Date</p>
                <p className="font-semibold text-sm">
                  {deliveryNote?.deliveryDate 
                    ? formatDate(new Date(deliveryNote.deliveryDate), 'MMM dd, yyyy')
                    : 'Not scheduled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Customer</label>
                <p className="mt-1">{deliveryNote?.salesOrder?.customer?.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Sales Order</label>
                <p className="mt-1">
                  {deliveryNote?.salesOrder?.orderNumber ? (
                    <span className="text-blue-600 font-medium">
                      {deliveryNote.salesOrder.orderNumber}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">N/A</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Delivery Type</label>
                <p className="mt-1">{deliveryNote?.deliveryType || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Delivery Date</label>
                <p className="mt-1">
                  {deliveryNote?.deliveryDate && !isNaN(Date.parse(deliveryNote.deliveryDate))
                    ? formatDate(new Date(deliveryNote.deliveryDate), 'MMM dd, yyyy')
                    : 'Not scheduled'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="mt-1">
                  {deliveryNote?.createdAt && !isNaN(Date.parse(deliveryNote.createdAt))
                    ? formatDate(new Date(deliveryNote.createdAt), 'MMM dd, yyyy HH:mm')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Updated At</label>
                <p className="mt-1">
                  {deliveryNote?.updatedAt && !isNaN(Date.parse(deliveryNote.updatedAt))
                    ? formatDate(new Date(deliveryNote.updatedAt), 'MMM dd, yyyy HH:mm')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Information */}
        <Card>
          <CardHeader>
            <CardTitle>Tracking Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Tracking Number</label>
              <p className="mt-1 text-gray-900">{deliveryNote?.trackingNumber || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Carrier</label>
              <p className="mt-1 text-gray-900">{deliveryNote?.carrierName || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Estimated Delivery</label>
              <p className="mt-1 text-gray-900">
                {deliveryNote?.estimatedDeliveryDate && !isNaN(Date.parse(deliveryNote.estimatedDeliveryDate))
                  ? formatDate(new Date(deliveryNote.estimatedDeliveryDate), 'MMM dd, yyyy')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Actual Delivery</label>
              <p className="mt-1 text-gray-900">
                {deliveryNote?.actualDeliveryDate && !isNaN(Date.parse(deliveryNote.actualDeliveryDate))
                  ? formatDate(new Date(deliveryNote.actualDeliveryDate), 'MMM dd, yyyy')
                  : 'Pending'}
              </p>
            </div>
            {deliveryNote?.deliveryAddress && (
              <div>
                <label className="text-sm font-medium text-gray-500">Delivery Address</label>
                <p className="mt-1 text-gray-900">{deliveryNote.deliveryAddress}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Notes */}
      {deliveryNote?.deliveryNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-900 whitespace-pre-wrap">{deliveryNote.deliveryNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Delivery Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2 text-left text-sm font-medium">Description</th>
                      <th className="border p-2 text-left text-sm font-medium">Supplier Code</th>
                      <th className="border p-2 text-center text-sm font-medium">Ordered</th>
                      <th className="border p-2 text-center text-sm font-medium">Picked</th>
                      <th className="border p-2 text-center text-sm font-medium">Delivered</th>
                      <th className="border p-2 text-center text-sm font-medium">Remaining</th>
                      <th className="border p-2 text-right text-sm font-medium">Unit Price</th>
                      <th className="border p-2 text-right text-sm font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const orderedQty = item.orderedQuantity || 0;
                      const deliveredQty = item.deliveredQuantity || 0;
                      const pickedQty = item.pickedQuantity || 0;
                      const key = String((item as any).salesOrderItemId || (item as any).itemId || item.id);
                      const remainingQty = Object.prototype.hasOwnProperty.call(remainingBySoItem, key)
                        ? Number(remainingBySoItem[key])
                        : Math.max(0, orderedQty - deliveredQty);
                      const deliveryPercentage = orderedQty > 0 ? Math.round((deliveredQty / orderedQty) * 100) : 0;
                      
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border p-2 text-sm">{item.description}</td>
                          <td className="border p-2 text-sm text-gray-600">{item.supplierCode || 'N/A'}</td>
                          <td className="border p-2 text-sm text-center">{orderedQty}</td>
                          <td className="border p-2 text-sm text-center">{pickedQty}</td>
                          <td className="border p-2 text-sm text-center font-medium">{deliveredQty}</td>
                          <td className="border p-2 text-sm text-center">
                            <span className={remainingQty > 0 ? "text-orange-600" : "text-green-600"}>
                              {remainingQty}
                            </span>
                          </td>
                          <td className="border p-2 text-sm text-right">{formatCurrency(parseFloat(item.unitPrice || "0"))}</td>
                          <td className="border p-2 text-sm text-right font-medium">{formatCurrency(parseFloat(item.totalPrice || "0"))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={6} className="border p-2 text-right">Total:</td>
                      <td className="border p-2 text-right" colSpan={2}>
                        {formatCurrency(totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Progress Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">
                      {completion.totalOrdered}
                    </div>
                    <div className="text-sm text-gray-600">Total Ordered</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">
                      {completion.totalDelivered}
                    </div>
                    <div className="text-sm text-gray-600">Total Delivered</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-orange-600">
                      {completion.totalRemaining}
                    </div>
                    <div className="text-sm text-gray-600">Remaining</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {completion.completionPercentage}%
                      </span>
                      {completion.isComplete && (
                        <Badge variant={null as any} className="bg-green-100 text-green-800">
                          ✓ Complete
                        </Badge>
                      )}
                      {completion.isPartial && (
                        <Badge variant={null as any} className="bg-yellow-100 text-yellow-800">
                          ⚠ Partial
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${
                        completion.isComplete ? 'bg-gradient-to-r from-green-500 to-green-600' :
                        completion.isPartial ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                        'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}
                      style={{ 
                        width: `${Math.min(100, completion.completionPercentage)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No items found for this delivery note.</p>
          )}
        </CardContent>
      </Card>

      {/* Delivery History (All deliveries for this Sales Order) */}
      {deliveryNote?.salesOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery History for Sales Order {deliveryNote?.salesOrder?.orderNumber || ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Partial Deliveries</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {relatedDeliveries.filter(d => d.status === 'Partial').length}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Complete Deliveries</div>
                <div className="text-2xl font-bold text-green-600">
                  {relatedDeliveries.filter(d => d.status === 'Complete').length}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Remaining Quantity (All)</div>
                <div className="text-2xl font-bold text-blue-600">
                  {aggregateRemainingQty != null ? aggregateRemainingQty : '—'}
                </div>
              </div>
            </div>

            {relatedError && (
              <p className="text-sm text-red-600">{relatedError}</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left text-sm font-medium">Delivery Number</th>
                    <th className="border p-2 text-left text-sm font-medium">Customer</th>
                    <th className="border p-2 text-left text-sm font-medium">Status</th>
                    <th className="border p-2 text-left text-sm font-medium">Type</th>
                    <th className="border p-2 text-left text-sm font-medium">Delivery Date</th>
                    <th className="border p-2 text-left text-sm font-medium">Tracking</th>
                    <th className="border p-2 text-left text-sm font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedLoading ? (
                    <tr>
                      <td className="border p-3 text-center text-sm" colSpan={7}>Loading history…</td>
                    </tr>
                  ) : relatedDeliveries.length === 0 ? (
                    <tr>
                      <td className="border p-3 text-center text-sm" colSpan={7}>No related deliveries found.</td>
                    </tr>
                  ) : (
                    relatedDeliveries.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/delivery-note/${d.id}`)}>
                        <td className="border p-2 text-sm font-medium text-blue-700">{d.deliveryNumber}</td>
                        <td className="border p-2 text-sm">{d.salesOrder?.customer?.name || '-'}</td>
                        <td className="border p-2 text-sm"><StatusPill status={d.status} /></td>
                        <td className="border p-2 text-sm">{d.deliveryType || '-'}</td>
                        <td className="border p-2 text-sm">
                          {d.deliveryDate && !isNaN(Date.parse(d.deliveryDate)) ? formatDate(new Date(d.deliveryDate), 'MMM dd, yyyy') : '-'}
                        </td>
                        <td className="border p-2 text-sm">{d.trackingNumber || '-'}</td>
                        <td className="border p-2 text-sm">
                          {d.createdAt && !isNaN(Date.parse(d.createdAt)) ? formatDate(new Date(d.createdAt), 'MMM dd, yyyy HH:mm') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Delivery Note</DialogTitle>
            {editForm && (
              <p className="text-sm text-muted-foreground">
                Delivery Number: {editForm.deliveryNumber}
              </p>
            )}
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value: "Pending" | "Partial" | "Complete" | "Cancelled") => 
                      handleEditChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Complete">Complete</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-deliveryType">Delivery Type</Label>
                  <Input
                    id="edit-deliveryType"
                    value={editForm.deliveryType || ""}
                    onChange={e => handleEditChange("deliveryType", e.target.value)}
                    placeholder="e.g., Standard, Express"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-trackingNumber">Tracking Number</Label>
                <Input
                  id="edit-trackingNumber"
                  value={editForm.trackingNumber || ""}
                  onChange={e => handleEditChange("trackingNumber", e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
              <div>
                <Label htmlFor="edit-carrierName">Carrier Name</Label>
                <Input
                  id="edit-carrierName"
                  value={editForm.carrierName || ""}
                  onChange={e => handleEditChange("carrierName", e.target.value)}
                  placeholder="Enter carrier name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-deliveryDate">Delivery Date</Label>
                  <Input
                    id="edit-deliveryDate"
                    type="date"
                    value={editForm.deliveryDate ? new Date(editForm.deliveryDate).toISOString().split('T')[0] : ""}
                    onChange={e => handleEditChange("deliveryDate", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-estimatedDeliveryDate">Estimated Delivery Date</Label>
                  <Input
                    id="edit-estimatedDeliveryDate"
                    type="date"
                    value={editForm.estimatedDeliveryDate ? new Date(editForm.estimatedDeliveryDate).toISOString().split('T')[0] : ""}
                    onChange={e => handleEditChange("estimatedDeliveryDate", e.target.value || null)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-deliveryAddress">Delivery Address</Label>
                <Textarea
                  id="edit-deliveryAddress"
                  value={editForm.deliveryAddress || ""}
                  onChange={e => handleEditChange("deliveryAddress", e.target.value)}
                  placeholder="Enter delivery address"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-deliveryNotes">Delivery Notes</Label>
                <Textarea
                  id="edit-deliveryNotes"
                  value={editForm.deliveryNotes || ""}
                  onChange={e => handleEditChange("deliveryNotes", e.target.value)}
                  placeholder="Additional notes or requirements"
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
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this delivery note? This action cannot be undone.
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
    </div>
  );
}
