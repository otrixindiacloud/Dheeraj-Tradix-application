import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { ArrowLeft, CheckCircle, Package, Truck, FileCheck, Edit, Trash2, Calculator, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUserId } from "@/hooks/useUserId";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { SalesOrder, SalesOrderItem, Customer } from "@shared/schema";

interface SalesOrderWithRelations extends SalesOrder {
  customer?: Customer;
  items?: SalesOrderItem[];
}

interface SalesOrderItemWithDetails extends SalesOrderItem {
  description?: string;
  supplierCode?: string;
  barcode?: string;
  category?: string;
  unitOfMeasure?: string;
  costPrice?: string;
  isActive?: boolean;
  supplierId?: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierContactPerson?: string;
  discountPercentage?: string | number;
  discountAmount?: string | number;
}

export default function SalesOrderDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  }>({ open: false, title: "", description: "", onConfirm: () => {} });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useUserId();

  // Fetch sales order details
  const { data: salesOrder, isLoading, error } = useQuery<SalesOrderWithRelations>({
    queryKey: ["/api/sales-orders", id],
    queryFn: async () => {
      const response = await fetch(`/api/sales-orders/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sales order: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch sales order items
  const { data: salesOrderItems = [] } = useQuery<SalesOrderItemWithDetails[]>({
    queryKey: ["/api/sales-orders", id, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/sales-orders/${id}/items`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sales order items: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch quotation details to get enquiry ID
  const { data: quotation } = useQuery({
    queryKey: ["/api/quotations", salesOrder?.quotationId],
    queryFn: async () => {
      if (!salesOrder?.quotationId) return null;
      const response = await fetch(`/api/quotations/${salesOrder.quotationId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch quotation: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!salesOrder?.quotationId,
  });

  // Fetch quotation items to source discount fields directly from quotation lines
  const { data: quotationItems = [] } = useQuery({
    queryKey: ["/api/quotations", salesOrder?.quotationId, "items"],
    queryFn: async () => {
      if (!salesOrder?.quotationId) return [];
      const response = await fetch(`/api/quotations/${salesOrder.quotationId}/items`);
      if (!response.ok) {
        throw new Error(`Failed to fetch quotation items: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!salesOrder?.quotationId,
  });

  // Fetch enquiry details to get enquiry ID
  const { data: enquiry } = useQuery({
    queryKey: ["/api/enquiries", quotation?.enquiryId],
    queryFn: async () => {
      if (!quotation?.enquiryId) return null;
      const response = await fetch(`/api/enquiries/${quotation.enquiryId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch enquiry: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!quotation?.enquiryId,
  });

  // Fetch enquiry items to get discount and tax details
  const { data: enquiryItems = [] } = useQuery({
    queryKey: ["/api/enquiries", enquiry?.id, "items"],
    queryFn: async () => {
      if (!enquiry?.id) return [];
      const response = await fetch(`/api/enquiries/${enquiry.id}/items`);
      if (!response.ok) {
        throw new Error(`Failed to fetch enquiry items: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!enquiry?.id,
  });

  // Update order status mutation
  const updateOrderStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const response = await apiRequest("PUT", `/api/sales-orders/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  // Delete order mutation
  const deleteSalesOrder = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/sales-orders/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast({
        title: "Success",
        description: "Sales order deleted successfully",
      });
      setLocation("/sales-orders");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete sales order",
        variant: "destructive",
      });
    },
  });

  // Validate customer LPO (approve/reject)
  const validateCustomerLpo = useMutation({
    mutationFn: async ({ status, notes, validatedBy }: { status: "Approved" | "Rejected"; notes?: string; validatedBy?: string }) => {
      const response = await apiRequest("PUT", `/api/sales-orders/${id}/validate-lpo`, {
        status,
        notes,
        validatedBy: validatedBy || userId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast({ title: "Success", description: "Customer LPO updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update LPO", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !salesOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-lg font-semibold">Sales Order Not Found</p>
        <Button onClick={() => setLocation("/sales-orders")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sales Orders
          </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/sales-orders")}
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Sales Orders
            </Button>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold">{salesOrder.orderNumber}</h1>
                <p className="text-gray-600">{salesOrder.customer?.name || "Unknown Customer"}</p>
              </div>
            </div>
          </div>
            <StatusPill status={salesOrder.status?.toLowerCase() || 'draft'} />
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {salesOrder.status === "Draft" && (
              <Button
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: "Confirm Sales Order",
                    description: `Are you sure you want to confirm sales order ${salesOrder.orderNumber}?`,
                    onConfirm: () => updateOrderStatus.mutate({ status: "Confirmed" }),
                  });
                }}
                disabled={updateOrderStatus.isPending}
              >
                {updateOrderStatus.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Order
                  </>
                )}
              </Button>
            )}
            
            {salesOrder.status === "Confirmed" && (
              <Button
                onClick={() => updateOrderStatus.mutate({ status: "Processing" })}
              >
                <Package className="h-4 w-4 mr-2" />
                Start Processing
              </Button>
            )}
            
            {salesOrder.status === "Processing" && (
              <Button
                onClick={() => updateOrderStatus.mutate({ status: "Shipped" })}
              >
                <Truck className="h-4 w-4 mr-2" />
                Mark as Shipped
              </Button>
            )}
            
            {salesOrder.status === "Draft" && (
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: "Delete Sales Order",
                    description: `Are you sure you want to delete sales order ${salesOrder.orderNumber}?`,
                    onConfirm: () => deleteSalesOrder.mutate(),
                    variant: "destructive",
                  });
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Order
              </Button>
            )}

            {salesOrder.customerLpoRequired && salesOrder.customerLpoValidationStatus === "Pending" && (
              <Button
                onClick={() => validateCustomerLpo.mutate({ status: "Approved" })}
                disabled={validateCustomerLpo.isPending}
              >
                {validateCustomerLpo.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Approve LPO
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

        {/* Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Order Number</label>
                      <p className="font-mono text-lg">{salesOrder.orderNumber}</p>
                    </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Customer LPO Status</label>
                    <div className="mt-1">
                      {salesOrder.customerLpoRequired ? (
                        <StatusPill status={(salesOrder.customerLpoValidationStatus || 'Pending').toLowerCase()} />
                      ) : (
                        <Badge variant="outline">N/A</Badge>
                      )}
                    </div>
                  </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <div className="mt-1">
                        <StatusPill status={salesOrder.status?.toLowerCase() || 'draft'} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Order Date</label>
                      <p>{salesOrder.orderDate ? formatDate(new Date(salesOrder.orderDate)) : "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Customer PO Number</label>
                      <p className="font-mono">{salesOrder.customerPoNumber || "N/A"}</p>
                    </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Pricing Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary Stats - Items, Amount */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Items Count */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Total Items:</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {(() => {
                          // Prefer quotation items count, fallback to sales order items
                          if (Array.isArray(quotationItems) && quotationItems.length > 0) {
                            return quotationItems.length;
                          }
                          return salesOrderItems?.length || 0;
                        })()}
                      </span>
                    </div>

                    {/* Total Amount */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-700">Total Amount:</span>
                      </div>
                      <span className="text-lg font-bold text-blue-900">
                        {(() => {
                          const currency = quotation?.currency || salesOrder?.currency || 'BHD';
                          // Prefer quotation items, fallback to sales order items
                          const items = (Array.isArray(quotationItems) && quotationItems.length > 0) 
                            ? quotationItems 
                            : salesOrderItems;
                          
                          let grossSubtotal = 0;
                          let totalDiscount = 0;
                          let totalTax = 0;
                          
                          items.forEach((it: any) => {
                            const qty = Number(it.quantity) || 0;
                            // Prefer cost+markup when available (align with line items table)
                            const costPrice = Number((it as any).costPrice) || 0;
                            const markupPct = Number((it as any).markup ?? (it as any).markupPercent) || 0;
                            const computedUnitFromMarkup = costPrice > 0 && markupPct > 0 
                              ? costPrice * (1 + Math.max(0, markupPct) / 100)
                              : 0;
                            const unitPrice = computedUnitFromMarkup > 0 ? computedUnitFromMarkup : (Number(it.unitPrice) || 0);
                            const subtotal = qty * unitPrice;
                            
                            const discountPercent = Number(it.discountPercentage) || 
                              Number((quotation as any)?.discountPercentage) || 
                              Number((salesOrder as any)?.discountPercentage) || 0;
                            const discountAmount = Number(it.discountAmount) || 0;
                            let appliedDiscount = 0;
                            if (discountPercent > 0) {
                              appliedDiscount = (subtotal * discountPercent) / 100;
                            } else if (discountAmount > 0) {
                              appliedDiscount = Math.min(subtotal, Math.abs(discountAmount));
                            }
                            
                            const afterDiscount = Math.max(0, subtotal - appliedDiscount);
                            
                            const taxPercent = Number((it as any).vatPercent) || 
                              Number((quotation as any)?.vatPercent) || 0;
                            const taxAmount = Number((it as any).vatAmount) || 0;
                            let appliedTax = 0;
                            if (taxPercent > 0) {
                              appliedTax = (afterDiscount * taxPercent) / 100;
                            } else if (taxAmount > 0) {
                              appliedTax = taxAmount;
                            }
                            
                            grossSubtotal += subtotal;
                            totalDiscount += appliedDiscount;
                            totalTax += appliedTax;
                          });
                          
                          const netAmount = Math.round((grossSubtotal - totalDiscount) * 100) / 100;
                          const totalAmount = Math.round((netAmount + totalTax) * 100) / 100;
                          return `${currency} ${totalAmount.toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Breakdown computed from items */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-3">Pricing Breakdown</h4>
                    <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                      {(() => {
                        const currency = quotation?.currency || salesOrder?.currency || 'BHD';
                        // Prefer quotation items, fallback to sales order items
                        const items = (Array.isArray(quotationItems) && quotationItems.length > 0) 
                          ? quotationItems 
                          : salesOrderItems;
                        
                        let grossSubtotal = 0;
                        let totalDiscount = 0;
                        let totalTax = 0;
                        
                        items.forEach((it: any) => {
                          const qty = Number(it.quantity) || 0;
                          // Subtotal = Unit Price × Quantity, but prefer cost+markup when available
                          const costPrice = Number((it as any).costPrice) || 0;
                          const markupPct = Number((it as any).markup ?? (it as any).markupPercent) || 0;
                          const computedUnitFromMarkup = costPrice > 0 && markupPct > 0
                            ? costPrice * (1 + Math.max(0, markupPct) / 100)
                            : 0;
                          const unitPrice = computedUnitFromMarkup > 0 ? computedUnitFromMarkup : (Number(it.unitPrice) || 0);
                          const subtotal = qty * unitPrice;
                          
                          // Get discount - prefer from item, fallback to quotation/sales order header
                          const discountPercent = Number(it.discountPercentage) || 
                            Number((quotation as any)?.discountPercentage) || 
                            Number((salesOrder as any)?.discountPercentage) || 0;
                          const discountAmount = Number(it.discountAmount) || 0;
                          let appliedDiscount = 0;
                          if (discountPercent > 0) {
                            // Prioritize discount percentage calculation
                            appliedDiscount = (subtotal * discountPercent) / 100;
                          } else if (discountAmount > 0) {
                            // Use explicit discount amount only if no percentage is provided
                            appliedDiscount = Math.min(subtotal, Math.abs(discountAmount));
                          }
                          
                          // After Discount = Subtotal - Discount Amount
                          const afterDiscount = Math.max(0, subtotal - appliedDiscount);
                          
                          // Get VAT - prefer from item, fallback to quotation/sales order header
                          const taxPercent = Number((it as any).vatPercent) || 
                            Number((quotation as any)?.vatPercent) || 0;
                          const taxAmount = Number((it as any).vatAmount) || 0;
                          let appliedTax = 0;
                          if (taxPercent > 0) {
                            // Prioritize VAT percentage calculation
                            appliedTax = (afterDiscount * taxPercent) / 100;
                          } else if (taxAmount > 0) {
                            // Use explicit VAT amount only if no percentage is provided
                            appliedTax = taxAmount;
                          }
                          
                          grossSubtotal += subtotal;
                          totalDiscount += appliedDiscount;
                          totalTax += appliedTax;
                        });
                        
                        // Net Amount after discount
                        const netAmount = Math.round((grossSubtotal - totalDiscount) * 100) / 100;
                        // Total Amount = Net Amount + VAT
                        const totalAmount = Math.round((netAmount + totalTax) * 100) / 100;
                        
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Subtotal</span>
                              <span className="font-medium">{currency} {grossSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Discount Amount</span>
                              <span className="font-medium text-red-600">-{currency} {totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Net Amount</span>
                              <span className="font-medium">{currency} {netAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">VAT Amount</span>
                              <span className="font-medium">{currency} {totalTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 font-bold">
                              <span>Total Amount</span>
                              <span>{currency} {totalAmount.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Customer Type Pricing Applied */}
                  {quotation?.customerType && (
                    <div className="pt-4 border-t">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-gray-800 font-medium">
                          {quotation.customerType} Pricing Applied
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
                      </div>
            
      {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Items</CardTitle>
                </CardHeader>
                <CardContent>
          {salesOrderItems.length > 0 ? (
                    <div className="overflow-x-auto">
              <table className="w-full">
                        <thead>
                          <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Description</th>
                    <th className="text-center p-3 font-semibold">Qty</th>
                            <th className="text-right p-3 font-semibold">Cost Price</th>
                            <th className="text-right p-3 font-semibold">Unit Price</th>
                            <th className="text-right p-3 font-semibold">Markup %</th>
                    <th className="text-right p-3 font-semibold">Discount %</th>
                    <th className="text-right p-3 font-semibold">VAT %</th>
                    <th className="text-right p-3 font-semibold">Disc. Amt</th>
                    <th className="text-right p-3 font-semibold">VAT Amt</th>
                    <th className="text-right p-3 font-semibold">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                  {salesOrderItems.map((item) => {
                    
                    // Match quotation item by description to get discount and VAT from quotation detail page
                    const matchedQuotationItem = Array.isArray(quotationItems)
                      ? (quotationItems as any[]).find((qi: any) => {
                          // Try to match by description first
                          if (qi?.description && item.description && qi.description === item.description) {
                            return true;
                          }
                          // Fallback: try to match by itemId if available
                          if (item.itemId && qi.itemId && qi.itemId === item.itemId) {
                            return true;
                          }
                          return false;
                        })
                      : undefined;
                    
                    // Prefer values from quotation item where available
                    const displayedQuantity = Number((matchedQuotationItem?.quantity ?? item.quantity) || 0);
                    const rawUnitPriceFromMatch = Number((matchedQuotationItem?.unitPrice ?? item.unitPrice) || 0);
                    const displayedCostPrice = Number((matchedQuotationItem?.costPrice ?? item.costPrice) || 0);

                    // Compute Unit Price using Quotation rule: unit = cost * (1 + markup%/100), fallback to stored unitPrice
                    const markupPct = Number((matchedQuotationItem?.markup ?? (matchedQuotationItem as any)?.markupPercent) || 0);
                    const computedUnitFromMarkup = displayedCostPrice > 0 ? displayedCostPrice * (1 + Math.max(0, markupPct) / 100) : 0;
                    const displayedUnitPrice = computedUnitFromMarkup > 0 ? computedUnitFromMarkup : rawUnitPriceFromMatch;

                    // Prefer discount values from quotation item; fallback to quotation header, then sales order item
                    const discountPercentage = Number(
                      (matchedQuotationItem?.discountPercentage ?? (quotation as any)?.discountPercentage ?? item.discountPercentage) || 0
                    );
                    const discountAmount = Number((matchedQuotationItem?.discountAmount ?? item.discountAmount) || 0);
                    const totalPrice = Number((matchedQuotationItem?.lineTotal ?? item.totalPrice) || 0);
                    
                    // Calculate discount for this item (match quotation logic: percent takes precedence over amount)
                    const grossAmount = displayedQuantity * displayedUnitPrice;
                    let appliedDiscount = 0;
                    if (Number(discountPercentage) > 0) {
                      appliedDiscount = (grossAmount * Number(discountPercentage)) / 100;
                    } else if (Number(discountAmount)) {
                      appliedDiscount = Math.min(grossAmount, Math.abs(Number(discountAmount)));
                    }

                    // Determine markup percentage (prefer quotation item markup)
                    const costPriceFromItem = displayedCostPrice;
                    const markupFromQuotation = Number(matchedQuotationItem?.markup || matchedQuotationItem?.markupPercent || 0);
                    let effectiveMarkupPercent = 0;
                    if (markupFromQuotation > 0) {
                      effectiveMarkupPercent = markupFromQuotation;
                    } else if (costPriceFromItem > 0 && displayedUnitPrice > 0) {
                      effectiveMarkupPercent = ((displayedUnitPrice - costPriceFromItem) / costPriceFromItem) * 100;
                    }
                    
                    // Get VAT from quotation item (preferred), fallback to quotation header, then sales order item
                    const vatPercentFromQuotation = matchedQuotationItem
                      ? Number((matchedQuotationItem as any).vatPercent || (quotation as any)?.vatPercent || 0)
                      : Number((quotation as any)?.vatPercent || (item as any).vatPercent || 0);
                    const vatAmountFromQuotation = matchedQuotationItem ? Number((matchedQuotationItem as any).vatAmount || 0) : Number((item as any).vatAmount || 0);
                    
                    // Calculate net amount after discount
                    const netAmount = Math.max(0, grossAmount - appliedDiscount);
                    
                    // Calculate VAT (match quotation logic: VAT % takes precedence over explicit amount)
                    let effectiveVatAmount = 0;
                    let effectiveVatPercent = 0;
                    if (vatPercentFromQuotation > 0 && netAmount > 0) {
                      effectiveVatPercent = vatPercentFromQuotation;
                      effectiveVatAmount = (netAmount * vatPercentFromQuotation) / 100;
                    } else if (vatAmountFromQuotation > 0) {
                      effectiveVatAmount = vatAmountFromQuotation;
                      effectiveVatPercent = netAmount > 0 ? (effectiveVatAmount / netAmount) * 100 : 0;
                    }
                    const displayVatAmount = effectiveVatAmount;

                    // Total Amount per line = After Discount + VAT Amount (match quotation UI)
                    const effectiveLineTotal = Math.max(0, netAmount + effectiveVatAmount);

                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {item.description || 'Item'}
                            </span>
                            <div className="flex flex-col gap-1 mt-1">
                              {item.supplierCode && (
                                <span className="text-xs text-gray-500">
                                  Code: {item.supplierCode}
                                </span>
                              )}
                              {item.barcode && (
                                <span className="text-xs text-gray-500">
                                  Barcode: {item.barcode}
                                </span>
                              )}
                              {item.category && (
                                <span className="text-xs text-gray-500">
                                  Category: {item.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">{displayedQuantity}</td>
                        <td className="p-3 text-right">
                          {displayedCostPrice ? formatCurrency(displayedCostPrice) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          {displayedUnitPrice ? formatCurrency(displayedUnitPrice) : '-'}
                        </td>
                        <td className="p-3 text-right">{effectiveMarkupPercent ? `${effectiveMarkupPercent.toFixed(2)}%` : '0%'}</td>
                        <td className="p-3 text-right">{Number.isFinite(discountPercentage) ? `${discountPercentage.toFixed(2)}%` : '0%'}</td>
                        <td className="p-3 text-right">{Number.isFinite(effectiveVatPercent) ? `${effectiveVatPercent.toFixed(2)}%` : '0%'}</td>
                        <td className="p-3 text-right">
                          {Number.isFinite(appliedDiscount) ? formatCurrency(appliedDiscount) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          {Number.isFinite(displayVatAmount as number) ? formatCurrency(Number(displayVatAmount)) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          {Number.isFinite(effectiveLineTotal as number) ? formatCurrency(Number(effectiveLineTotal)) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No items found in this sales order.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
