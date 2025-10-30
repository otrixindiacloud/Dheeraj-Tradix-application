import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { format as formatDateFns } from "date-fns";
import { 
  Eye, Truck, Package, Navigation, MapPin, FileText, BarChart3, ArrowLeft, 
  Globe, User, ShoppingCart, DollarSign, Calendar, Clock, Box, Shield, 
  CheckCircle2, AlertTriangle, Timer, Zap, AlertCircle, XCircle, 
  CircleDot, TrendingUp, Minus, Hash
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface Shipment {
  id: string;
  shipmentNumber: string;
  trackingNumber: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  supplierId?: string;
  supplierName?: string;
  carrierId: string;
  carrierName: string;
  serviceType: "Standard" | "Express" | "Overnight" | "Economy";
  status: "Pending" | "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered" | "Delayed" | "Cancelled" | "Lost";
  priority: "Low" | "Medium" | "High" | "Urgent";
  origin: string;
  destination: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  weight: string;
  dimensions: string;
  declaredValue: string;
  currency: string;
  shippingCost: string;
  customerReference?: string;
  customerName?: string; // Added for customer name
  specialInstructions?: string;
  packageCount: number;
  isInsured: boolean;
  requiresSignature: boolean;
  currentLocation?: string;
  lastUpdate: string;
  createdAt: string;
  updatedAt: string;
  // Additional LPO-related fields
  lpoId?: string;
  lpoNumber?: string;
  items?: Array<{
    id?: string;
    itemDescription: string;
    quantity: number;
    deliveredQuantity?: number;
    unitCost?: string;
    totalCost?: string;
    unitOfMeasure?: string;
    specialInstructions?: string;
    deliveryStatus?: "Partial" | "Complete" | "Pending";
  }>;
  subtotal?: string;
  taxAmount?: string;
  totalAmount?: string;
  total?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
}

function formatDate(dateStr?: string, pattern = 'MMM dd, yyyy') {
  if (!dateStr) return '—';
  try { return formatDateFns(new Date(dateStr), pattern); } catch { return dateStr; }
}

const priorityColor = (p: string) => {
  switch (p) {
    case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Urgent': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const priorityIcon = (p: string) => {
  switch (p) {
    case 'Low': return <Minus className="h-3.5 w-3.5" />;
    case 'Medium': return <Timer className="h-3.5 w-3.5" />;
    case 'High': return <TrendingUp className="h-3.5 w-3.5" />;
    case 'Urgent': return <AlertCircle className="h-3.5 w-3.5" />;
    default: return null;
  }
};

const serviceColor = (s: string) => {
  switch (s) {
    case 'Economy': return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'Standard': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Express': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Overnight': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const serviceIcon = (s: string) => {
  switch (s) {
    case 'Economy': return <Package className="h-3.5 w-3.5" />;
    case 'Standard': return <Truck className="h-3.5 w-3.5" />;
    case 'Express': return <Zap className="h-3.5 w-3.5" />;
    case 'Overnight': return <Clock className="h-3.5 w-3.5" />;
    default: return <Package className="h-3.5 w-3.5" />;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Picked Up': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'In Transit': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Out for Delivery': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Delayed': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Lost': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'Pending': return <Timer className="h-3.5 w-3.5" />;
    case 'Picked Up': return <Package className="h-3.5 w-3.5" />;
    case 'In Transit': return <Truck className="h-3.5 w-3.5" />;
    case 'Out for Delivery': return <Navigation className="h-3.5 w-3.5" />;
    case 'Delivered': return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'Delayed': return <AlertCircle className="h-3.5 w-3.5" />;
    case 'Cancelled': return <XCircle className="h-3.5 w-3.5" />;
    case 'Lost': return <AlertTriangle className="h-3.5 w-3.5" />;
    default: return <CircleDot className="h-3.5 w-3.5" />;
  }
};

export default function ShipmentDetailPage() {
  const [, params] = useRoute('/shipment-tracking/:id');
  const shipmentId = (params as any)?.id;
  const { toast } = useToast();

  const { data: shipment, isLoading, error } = useQuery<Shipment | null>({
    queryKey: ['shipment', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      if (!shipmentId) return null;
      const res = await fetch(`/api/shipments/${shipmentId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load shipment');
      }
      return res.json();
    }
  });

  useEffect(() => {
    if (error) {
      toast({ title: 'Error', description: (error as any).message || 'Failed to load shipment', variant: 'destructive' });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/shipment-tracking">
              <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow" data-testid="button-back-shipment-list">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
              </Button>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shipment Details</h1>
              <p className="text-sm text-slate-600">Complete shipment information and tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            {shipment?.trackingNumber && (
              <Button 
                onClick={() => window.open(`https://track.carrier.com/${shipment.trackingNumber}`, '_blank')} 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
                data-testid="button-track-online"
              >
                <Globe className="h-4 w-4 mr-2" /> Track Online
              </Button>
            )}
          </div>
        </div>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      )}

      {!isLoading && !shipment && (
        <Card className="p-12 text-center shadow-lg rounded-xl bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-600 text-lg font-medium mb-2">Shipment not found.</p>
            <Link href="/shipment-tracking"><Button className="shadow-md">Go Back to List</Button></Link>
          </div>
        </Card>
      )}

      {shipment && (
        <div className="space-y-6">
          {/* Status Overview Card */}
          <Card className="bg-white shadow-lg rounded-xl border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-medium">Shipment Number</p>
                    <p className="text-lg font-bold text-slate-900 font-mono">{shipment.shipmentNumber}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={null as any} className={`${statusColor(shipment.status)} border font-semibold px-3 py-1 text-xs flex items-center gap-1.5`}>
                    {statusIcon(shipment.status)}
                    {shipment.status}
                  </Badge>
                  <Badge variant={null as any} className={`${priorityColor(shipment.priority)} border font-semibold px-3 py-1 text-xs flex items-center gap-1.5`}>
                    {priorityIcon(shipment.priority)}
                    {shipment.priority} Priority
                  </Badge>
                  <Badge variant={null as any} className={`${serviceColor(shipment.serviceType)} border font-semibold px-3 py-1 text-xs flex items-center gap-1.5`}>
                    {serviceIcon(shipment.serviceType)}
                    {shipment.serviceType}
                  </Badge>
                  {shipment.isInsured && (
                    <Badge variant={null as any} className="bg-teal-50 text-teal-700 border-teal-200 border font-semibold px-3 py-1 text-xs flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" /> Insured
                    </Badge>
                  )}
                  {shipment.requiresSignature && (
                    <Badge variant={null as any} className="bg-purple-50 text-purple-700 border-purple-200 border font-semibold px-3 py-1 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Signature Required
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Identification & Route Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identification Card */}
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Identification Details</h2>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Shipment Number</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{shipment.shipmentNumber}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Tracking Number</span>
                    <span className="text-sm font-mono font-bold text-blue-600">{shipment.trackingNumber}</span>
                  </div>
                  {shipment.salesOrderNumber && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Sales Order</span>
                      <span className="text-sm font-semibold text-slate-900">{shipment.salesOrderNumber}</span>
                    </div>
                  )}
                  
                  <Separator className="my-2" />
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Carrier</span>
                    <span className="text-sm font-semibold text-slate-900">{shipment.carrierName}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Service Type</span>
                    <Badge variant={null as any} className={`${serviceColor(shipment.serviceType)} border text-xs font-semibold flex items-center gap-1.5`}>
                      {serviceIcon(shipment.serviceType)}
                      {shipment.serviceType}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Route & Timing Card */}
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Navigation className="h-5 w-5 text-violet-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Route & Timing</h2>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Origin</span>
                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-emerald-600" /> {shipment.origin}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Destination</span>
                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-rose-600" /> {shipment.destination}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Estimated Delivery
                    </span>
                    <span className="text-sm font-semibold text-blue-600">{formatDate(shipment.estimatedDelivery)}</span>
                  </div>
                  {shipment.actualDelivery && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Actual Delivery
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">{formatDate(shipment.actualDelivery)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Current Location</span>
                    <span className="text-sm font-semibold text-slate-900 text-right">{shipment.currentLocation || 'Updating...'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Last Update
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{formatDate(shipment.lastUpdate, 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* LPO Information */}
          {shipment.lpoNumber && (
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">LPO Information</h2>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">LPO Number</span>
                    <span className="text-sm font-mono font-bold text-emerald-600">{shipment.lpoNumber}</span>
                  </div>
                  {shipment.paymentTerms && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Payment Terms</span>
                      <span className="text-sm font-semibold text-slate-900">{shipment.paymentTerms}</span>
                    </div>
                  )}
                  {shipment.deliveryTerms && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Delivery Terms</span>
                      <span className="text-sm font-semibold text-slate-900">{shipment.deliveryTerms}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Customer Information */}
         

          {/* Items Information */}
          {shipment.items && shipment.items.length > 0 && (
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Items in Shipment</h2>
                  <Badge variant={null as any} className="bg-slate-100 text-slate-700 border-slate-200 border ml-auto font-semibold flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    {shipment.items.length} {shipment.items.length === 1 ? 'Item' : 'Items'}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-3">
                  {shipment.items.map((item, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={null as any} className="bg-blue-50 text-blue-700 border-blue-200 border text-xs font-semibold flex items-center gap-1.5">
                              <Hash className="h-3.5 w-3.5" />
                              {index + 1}
                            </Badge>
                            <h4 className="font-semibold text-slate-900">{item.itemDescription}</h4>
                          </div>
                          {item.specialInstructions && (
                            <div className="flex items-start gap-1 mt-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-slate-600 italic">{item.specialInstructions}</p>
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4 space-y-2">
                          <Badge variant={null as any} className="bg-indigo-50 text-indigo-700 border-indigo-200 border font-semibold flex items-center gap-1.5">
                            <Box className="h-3.5 w-3.5" />
                            {item.quantity} {item.unitOfMeasure || 'pcs'}
                          </Badge>
                          {item.deliveredQuantity !== undefined && (
                            <div className="space-y-1">
                              <Badge variant={null as any} className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Delivered: {item.deliveredQuantity} {item.unitOfMeasure || 'pcs'}
                              </Badge>
                              <Badge variant={null as any} className={`font-semibold flex items-center gap-1.5 ${
                                item.deliveryStatus === 'Complete' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                item.deliveryStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                              }`}>
                                {item.deliveryStatus === 'Complete' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                                 item.deliveryStatus === 'Partial' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                                 <Clock className="h-3.5 w-3.5" />}
                                {item.deliveryStatus || 'Pending'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      {(item.unitCost || item.totalCost) && (
                        <div className="flex gap-6 mt-3 pt-3 border-t border-slate-200">
                          {item.unitCost && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">Unit Cost:</span>
                              <span className="text-sm font-semibold text-slate-900">
                                {shipment.currency || 'BHD'} {parseFloat(item.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {item.totalCost && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">Total Cost:</span>
                              <span className="text-sm font-bold text-emerald-700">
                                {shipment.currency || 'BHD'} {parseFloat(item.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Financial Summary */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">Total Items:</span>
                        <span className="text-sm font-bold text-slate-900">{shipment.items.length}</span>
                      </div>
                      {(() => {
                        const calculatedTotal = shipment.items.reduce((sum, item) => {
                          return sum + (item.totalCost ? parseFloat(item.totalCost) : 0);
                        }, 0);
                        return calculatedTotal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Subtotal:</span>
                            <span className="text-sm font-bold text-blue-700">
                              {shipment.currency || 'BHD'} {calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })()}
                      {shipment.taxAmount && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">Tax Amount:</span>
                          <span className="text-sm font-bold text-slate-700">
                            {shipment.currency || 'BHD'} {parseFloat(shipment.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const calculatedTotal = shipment.items.reduce((sum, item) => {
                          return sum + (item.totalCost ? parseFloat(item.totalCost) : 0);
                        }, 0);
                        const taxAmount = shipment.taxAmount ? parseFloat(shipment.taxAmount) : 0;
                        const grandTotal = calculatedTotal + taxAmount;
                        return grandTotal > 0 && (
                          <>
                            <Separator className="my-2" />
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold text-slate-900">Grand Total:</span>
                              <span className="text-lg font-bold text-emerald-700">
                                {shipment.currency || 'BHD'} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Package, Value & Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Package Details */}
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Box className="h-5 w-5 text-orange-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Package Details</h2>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Weight</span>
                    <span className="text-sm font-semibold text-slate-900">{shipment.weight || '—'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Dimensions</span>
                    <span className="text-sm font-semibold text-slate-900 text-right">{shipment.dimensions || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Package Count</span>
                    <Badge variant={null as any} className="bg-indigo-50 text-indigo-700 border-indigo-200 border font-semibold flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      {shipment.packageCount}
                    </Badge>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Signature</span>
                    {shipment.requiresSignature ? (
                      <Badge variant={null as any} className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Required
                      </Badge>
                    ) : (
                      <Badge variant={null as any} className="bg-slate-50 text-slate-700 border-slate-200 border text-xs font-semibold flex items-center gap-1.5">
                        <Minus className="h-3.5 w-3.5" />
                        Not Required
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Financial Details */}
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Financial Details</h2>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Declared Value</span>
                    <span className="text-sm font-bold text-slate-900">
                      {shipment.declaredValue} {shipment.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Shipping Cost</span>
                    <span className="text-sm font-bold text-blue-600">
                      {shipment.shippingCost} {shipment.currency}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Insurance</span>
                    {shipment.isInsured ? (
                      <Badge variant={null as any} className="bg-teal-50 text-teal-700 border-teal-200 border text-xs font-semibold flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" /> Insured
                      </Badge>
                    ) : (
                      <Badge variant={null as any} className="bg-slate-50 text-slate-700 border-slate-200 border text-xs font-semibold flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        Not Insured
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Priority</span>
                    <Badge variant={null as any} className={`${priorityColor(shipment.priority)} border text-xs font-semibold flex items-center gap-1.5`}>
                      {priorityIcon(shipment.priority)}
                      {shipment.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Timestamps */}
            <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Timeline</h2>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Created</span>
                    <span className="text-sm font-semibold text-slate-900">{formatDate(shipment.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Updated</span>
                    <span className="text-sm font-semibold text-slate-900">{formatDate(shipment.updatedAt, 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Last Update</span>
                    <span className="text-sm font-semibold text-blue-600">{formatDate(shipment.lastUpdate, 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">Est. Lead Time</span>
                    <Badge variant={null as any} className="bg-violet-50 text-violet-700 border-violet-200 border font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {shipment.estimatedDelivery 
                        ? `${Math.max(0, Math.round((new Date(shipment.estimatedDelivery).getTime() - new Date(shipment.createdAt).getTime()) / (1000*60*60*24)))} days`
                        : '—'
                      }
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Special Instructions & Delivery Terms */}
          {(shipment.specialInstructions || shipment.deliveryTerms) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {shipment.specialInstructions && (
                <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">Special Instructions</h2>
                    </div>
                    <Separator />
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{shipment.specialInstructions}</p>
                    </div>
                  </div>
                </Card>
              )}
              
              {shipment.deliveryTerms && (
                <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">Delivery Terms</h2>
                    </div>
                    <Separator />
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{shipment.deliveryTerms}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Status Indicator */}
          <Card className="bg-gradient-to-r from-slate-50 to-slate-100 shadow-md rounded-xl border-slate-200">
            <div className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-1">Current Status</p>
                  <StatusPill status={shipment.status.toLowerCase().replace(' ', '-')} />
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-1">Last Updated</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(shipment.lastUpdate, 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
