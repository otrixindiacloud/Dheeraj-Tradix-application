import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { formatDate } from "date-fns";
import { 
  Plus, 
  Save, 
  ArrowLeft, 
  Package, 
  Truck, 
  MapPin, 
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Box,
  Building2,
  User,
  Clock,
  Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LPOItem {
  id: string;
  itemDescription: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
  unitOfMeasure: string;
  specialInstructions?: string;
}

interface LPOData {
  id: string;
  lpoNumber: string;
  supplierName: string;
  totalValue: string;
  expectedDelivery: string;
  items: LPOItem[];
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  paymentTerms?: string;
  deliveryTerms?: string;
}

interface ShipmentFormData {
  shipmentNumber: string;
  trackingNumber: string;
  lpoId: string;
  lpoNumber: string;
  carrierId: string;
  carrierName: string;
  serviceType: "Standard" | "Express" | "Overnight" | "Economy";
  priority: "Low" | "Medium" | "High" | "Urgent";
  origin: string;
  destination: string;
  estimatedDelivery: string;
  weight: string;
  dimensions: string;
  declaredValue: string;
  currency: string;
  shippingCost: string;
  specialInstructions?: string;
  packageCount: number;
  isInsured: boolean;
  requiresSignature: boolean;
  items: Array<{
    itemDescription: string;
    quantity: number;
    deliveredQuantity: number;
    unitCost: string;
    totalCost: string;
    unitOfMeasure: string;
    specialInstructions?: string;
    deliveryStatus: "Partial" | "Complete" | "Pending";
  }>;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paymentTerms?: string;
  deliveryTerms?: string;
}

export default function ShipmentCreateLPO() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLPOId, setSelectedLPOId] = useState<string>("");
  const [formData, setFormData] = useState<ShipmentFormData>({
    shipmentNumber: "",
    trackingNumber: "",
    lpoId: "",
    lpoNumber: "",
    carrierId: "",
    carrierName: "",
    serviceType: "Standard",
    priority: "Medium",
    origin: "",
    destination: "",
    estimatedDelivery: "",
    weight: "",
    dimensions: "",
    declaredValue: "",
    currency: "BHD",
    shippingCost: "",
    specialInstructions: "",
    packageCount: 1,
    isInsured: false,
    requiresSignature: false,
    items: [],
    subtotal: "",
    taxAmount: "",
    totalAmount: "",
    paymentTerms: "",
    deliveryTerms: ""
  });

  // Fetch LPOs for selection
  const { data: lposResponse, isLoading: lposLoading } = useQuery({
    queryKey: ['supplier-lpos'],
    queryFn: async () => {
      const res = await fetch('/api/supplier-lpos');
      if (!res.ok) throw new Error('Failed to fetch LPOs');
      return res.json();
    }
  });

  // Extract the array from the API response
  const lpos = Array.isArray(lposResponse?.data) 
    ? lposResponse.data 
    : (Array.isArray(lposResponse) ? lposResponse : []);

  // Fetch selected LPO details
  const { data: selectedLPO, isLoading: lpoLoading } = useQuery({
    queryKey: ['supplier-lpo', selectedLPOId],
    enabled: !!selectedLPOId,
    queryFn: async () => {
      const res = await fetch(`/api/supplier-lpos/${selectedLPOId}`);
      if (!res.ok) throw new Error('Failed to fetch LPO details');
      return res.json();
    }
  });

  // Create shipment mutation
  const createShipmentMutation = useMutation({
    mutationFn: async (shipmentData: ShipmentFormData) => {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create shipment');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Shipment created successfully",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setLocation(`/shipment-tracking/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shipment",
        variant: "destructive"
      });
    }
  });

  // Update form when LPO is selected
  useEffect(() => {
    if (selectedLPO) {
      const lpoItems = selectedLPO.items || [];
      const shipmentItems = lpoItems.map((item: LPOItem) => ({
        itemDescription: item.itemDescription,
        quantity: item.quantity,
        deliveredQuantity: 0, // Start with 0 delivered
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        unitOfMeasure: item.unitOfMeasure,
        specialInstructions: item.specialInstructions,
        deliveryStatus: "Pending" as const
      }));

      setFormData(prev => ({
        ...prev,
        lpoId: selectedLPO.id,
        lpoNumber: selectedLPO.lpoNumber,
        items: shipmentItems,
        subtotal: selectedLPO.subtotal || "",
        taxAmount: selectedLPO.taxAmount || "",
        totalAmount: selectedLPO.totalAmount || "",
        currency: selectedLPO.currency || "BHD",
        paymentTerms: selectedLPO.paymentTerms || "",
        deliveryTerms: selectedLPO.deliveryTerms || "",
        estimatedDelivery: selectedLPO.expectedDelivery ? formatDate(new Date(selectedLPO.expectedDelivery), 'yyyy-MM-dd') : ""
      }));
    }
  }, [selectedLPO]);

  const handleDeliveredQuantityChange = (itemIndex: number, deliveredQuantity: number) => {
    const updatedItems = [...formData.items];
    updatedItems[itemIndex].deliveredQuantity = deliveredQuantity;
    
    // Update delivery status
    if (deliveredQuantity === 0) {
      updatedItems[itemIndex].deliveryStatus = "Pending";
    } else if (deliveredQuantity >= updatedItems[itemIndex].quantity) {
      updatedItems[itemIndex].deliveryStatus = "Complete";
    } else {
      updatedItems[itemIndex].deliveryStatus = "Partial";
    }

    setFormData(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.shipmentNumber || !formData.trackingNumber || !formData.carrierName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select an LPO with items",
        variant: "destructive"
      });
      return;
    }

    createShipmentMutation.mutate(formData);
  };

  const getDeliveryStatusColor = (status: string) => {
    switch (status) {
      case 'Complete': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Partial': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Pending': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'Complete': return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'Partial': return <AlertTriangle className="h-3.5 w-3.5" />;
      case 'Pending': return <Clock className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/shipment-tracking">
              <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
              </Button>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Shipment from LPO</h1>
              <p className="text-sm text-slate-600">Generate shipment tracking with LPO information</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* LPO Selection */}
          <Card className="bg-white shadow-md rounded-xl border-slate-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
              <CardTitle className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                LPO Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lpo-select">Select LPO</Label>
                  <Select value={selectedLPOId} onValueChange={setSelectedLPOId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose an LPO to create shipment from" />
                    </SelectTrigger>
                    <SelectContent>
                      {lpos.map((lpo: any) => (
                        <SelectItem key={lpo.id} value={lpo.id}>
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold">{lpo.lpoNumber}</span>
                            <span className="text-sm text-slate-500 ml-4">
                              {lpo.supplierName} - {lpo.totalAmount} {lpo.currency}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLPO && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">LPO Number</p>
                        <p className="text-lg font-bold text-blue-700">{selectedLPO.lpoNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Supplier</p>
                        <p className="text-lg font-semibold text-slate-900">{selectedLPO.supplierName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Total Value</p>
                        <p className="text-lg font-bold text-emerald-700">
                          {selectedLPO.totalAmount} {selectedLPO.currency}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Expected Delivery</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedLPO.expectedDelivery ? formatDate(new Date(selectedLPO.expectedDelivery), 'MMM dd, yyyy') : 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Items Count</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedLPO.items?.length || 0} items
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipment Details */}
          <Card className="bg-white shadow-md rounded-xl border-slate-200">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-200">
              <CardTitle className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-violet-600" />
                </div>
                Shipment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="shipmentNumber">Shipment Number *</Label>
                  <Input
                    id="shipmentNumber"
                    value={formData.shipmentNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipmentNumber: e.target.value }))}
                    placeholder="SH-2024-001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trackingNumber">Tracking Number *</Label>
                  <Input
                    id="trackingNumber"
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                    placeholder="TRK123456789"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="carrierName">Carrier Name *</Label>
                  <Input
                    id="carrierName"
                    value={formData.carrierName}
                    onChange={(e) => setFormData(prev => ({ ...prev, carrierName: e.target.value }))}
                    placeholder="DHL, FedEx, etc."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select value={formData.serviceType} onValueChange={(value: any) => setFormData(prev => ({ ...prev, serviceType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Express">Express</SelectItem>
                      <SelectItem value="Overnight">Overnight</SelectItem>
                      <SelectItem value="Economy">Economy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
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
                  <Label htmlFor="estimatedDelivery">Estimated Delivery</Label>
                  <Input
                    id="estimatedDelivery"
                    type="date"
                    value={formData.estimatedDelivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedDelivery: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <Input
                    id="origin"
                    value={formData.origin}
                    onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                    placeholder="Warehouse Location"
                  />
                </div>
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    value={formData.destination}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="Delivery Address"
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="10.5 kg"
                  />
                </div>
                <div>
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                    placeholder="30x20x15 cm"
                  />
                </div>
                <div>
                  <Label htmlFor="declaredValue">Declared Value</Label>
                  <Input
                    id="declaredValue"
                    value={formData.declaredValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, declaredValue: e.target.value }))}
                    placeholder="1000.00"
                  />
                </div>
                <div>
                  <Label htmlFor="shippingCost">Shipping Cost</Label>
                  <Input
                    id="shippingCost"
                    value={formData.shippingCost}
                    onChange={(e) => setFormData(prev => ({ ...prev, shippingCost: e.target.value }))}
                    placeholder="50.00"
                  />
                </div>
              </div>
              <div className="mt-6">
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special handling instructions..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items and Delivery Tracking */}
          {formData.items.length > 0 && (
            <Card className="bg-white shadow-md rounded-xl border-slate-200">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200">
                <CardTitle className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Package className="h-4 w-4 text-emerald-600" />
                  </div>
                  Items & Delivery Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Hash className="h-3 w-3 mr-1" />
                              {index + 1}
                            </Badge>
                            <h4 className="font-semibold text-slate-900">{item.itemDescription}</h4>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>Unit Cost: {formData.currency} {parseFloat(item.unitCost).toFixed(2)}</span>
                            <span>Total Cost: {formData.currency} {parseFloat(item.totalCost).toFixed(2)}</span>
                          </div>
                          {item.specialInstructions && (
                            <div className="mt-2 flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-slate-600 italic">{item.specialInstructions}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <Label htmlFor={`quantity-${index}`}>Ordered Quantity</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`quantity-${index}`}
                              value={item.quantity}
                              disabled
                              className="bg-slate-100"
                            />
                            <span className="text-sm text-slate-600">{item.unitOfMeasure}</span>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`delivered-${index}`}>Delivered Quantity</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`delivered-${index}`}
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={item.deliveredQuantity}
                              onChange={(e) => handleDeliveredQuantityChange(index, parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                            <span className="text-sm text-slate-600">{item.unitOfMeasure}</span>
                          </div>
                          <div className="mt-2">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs font-semibold flex items-center gap-1.5 w-fit", getDeliveryStatusColor(item.deliveryStatus))}
                            >
                              {getDeliveryStatusIcon(item.deliveryStatus)}
                              {item.deliveryStatus}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Link href="/shipment-tracking">
              <Button type="button" variant="outline" className="shadow-sm">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
              disabled={createShipmentMutation.isPending || !selectedLPOId}
            >
              {createShipmentMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Shipment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
