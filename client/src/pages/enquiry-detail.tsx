import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Package, Paperclip, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import EnquiryItemsManager from "@/components/enquiry/enquiry-items-manager";
import AttachmentManager from "@/components/enquiry/attachment-manager";
import { formatDate, getStatusColor, formatCurrency } from "@/lib/utils";
import { SYSTEM_USER_ID } from "@shared/utils/uuid";
import { useUserId } from "@/hooks/useUserId";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function EnquiryDetail() {
  // State for supplier RFQ tab
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [rfqLoading, setRfqLoading] = useState(false);

  // RFQ form state
  const [rfqPaymentTerms, setRfqPaymentTerms] = useState("Net 30");
  const [rfqDeliveryTerms, setRfqDeliveryTerms] = useState("FOB Destination");
  const [rfqPriority, setRfqPriority] = useState("Medium");

  // Fetch suppliers for multi-select with optimized caching
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - suppliers don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
  });
  // const { toast } = useToast(); // Removed duplicate declaration
  const userId = useUserId();
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: enquiry, isLoading } = useQuery({
    queryKey: ["/api/enquiries", id],
    queryFn: async () => {
      const response = await fetch(`/api/enquiries/${id}`);
      if (!response.ok) throw new Error("Enquiry not found");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: customer } = useQuery({
    queryKey: ["/api/customers", enquiry?.customerId],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${enquiry.customerId}`);
      return response.json();
    },
    enabled: !!enquiry?.customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes - customer data is relatively stable
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Fetch referral customer, if present
  const { data: referralCustomer } = useQuery({
    queryKey: ["/api/customers", enquiry?.referralCustomerId],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${enquiry.referralCustomerId}`);
      return response.json();
    },
    enabled: !!enquiry?.referralCustomerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Fetch enquiry items for financial summary
  const { data: enquiryItems = [] } = useQuery({
    queryKey: ["/api/enquiries", id, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/enquiries/${id}/items`);
      if (!response.ok) throw new Error("Failed to fetch enquiry items");
      return response.json();
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PUT", `/api/enquiries/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      toast({
        title: "Success",
        description: "Enquiry status updated successfully",
      });
      setShowStatusDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update enquiry status",
        variant: "destructive",
      });
    },
  });

  const deleteEnquiry = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/enquiries/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Enquiry deleted successfully",
      });
      navigate("/enquiries");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete enquiry",
        variant: "destructive",
      });
    },
  });


  const updateAttachments = useMutation({
    mutationFn: async (attachments: any[]) => {
      const response = await apiRequest("PUT", `/api/enquiries/${id}/attachments`, { attachments });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", id] });
      toast({
        title: "Success",
        description: "Attachments updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update attachments",
        variant: "destructive",
      });
    },
  });

  const convertToQuotation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/quotations/generate/${id}`, { userId });
      return response.json();
    },
    onSuccess: (quotation) => {
      toast({
        title: "Success", 
        description: "Quotation created successfully and enquiry status updated to 'Quoted'",
      });
      
      // Invalidate ALL enquiry queries (including those with different filters)
      // This ensures the enquiries table updates regardless of active filters
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/enquiries";
        }
      });
      
      // Invalidate quotation queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/quotations";
        }
      });
      
      // Invalidate customers (for any customer-related stats)
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      // Invalidate dashboard stats to update counts
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      setShowConvertDialog(false);
      navigate(`/quotations/${quotation.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to convert enquiry to quotation",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = () => {
    if (newStatus) {
      updateStatus.mutate(newStatus);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "New":
        return <AlertCircle className="h-4 w-4" />;
      case "In Progress":
        return <Clock className="h-4 w-4" />;
      case "Quoted":
        return <FileText className="h-4 w-4" />;
      case "Closed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading enquiry details...</p>
            </div>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Enquiry not found</h2>
        <p className="text-muted-foreground mb-4">The enquiry you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/enquiries")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Enquiries
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
  {/* Supplier Management Section */}
  {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/enquiries")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-enquiry-number">
              {enquiry.enquiryNumber}
            </h1>
            <p className="text-muted-foreground">
              Created on {formatDate(enquiry.enquiryDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-change-status">
                Change Status
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Enquiry Status</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Quoted">Quoted</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowStatusDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={!newStatus || updateStatus.isPending}
                    data-testid="button-update-status"
                  >
                    Update Status
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="default"
            onClick={() => setShowConvertDialog(true)}
            disabled={
              enquiry.status === "Quoted" ||
              enquiry.status === "Closed" ||
              (Array.isArray(enquiryItems) ? enquiryItems.length === 0 : true)
            }
            data-testid="button-convert-to-quotation"
          >
            <FileText className="h-4 w-4 mr-2" />
            Convert to Quotation
          </Button>

          <Button
            variant="default"
            disabled={rfqLoading || !selectedSupplier}
            onClick={async () => {
              setRfqLoading(true);
              try {
                // Build supplier data for single supplier
                const supplierMap = (suppliers || []).reduce((acc: Record<string, any>, s: any) => {
                  acc[s.id] = s;
                  return acc;
                }, {});
                
                const selectedSupplierData = [{
                  supplierId: selectedSupplier,
                  supplierName: supplierMap[selectedSupplier]?.name || ''
                }];

                // Prepare enquiry items for supplier quote
                const enquiryItems = (enquiry.items || []).map((item: any) => ({
                  itemDescription: item.description || item.itemDescription || '',
                  quantity: item.quantity || 1,
                  unitOfMeasure: 'pcs', // Default since enquiry_items doesn't have unitOfMeasure
                  unitPrice: parseFloat(item.unitPrice) || 0,
                  specification: item.notes || item.specification || '',
                  brand: '', // Extract from notes if needed
                  model: '', // Extract from notes if needed
                  warranty: '', // Extract from notes if needed
                  leadTime: '', // Extract from notes if needed
                  // Include discount and VAT fields from enquiry items
                  discountPercent: parseFloat(item.discountPercent || '0') || 0,
                  discountAmount: parseFloat(item.discountAmount || '0') || 0,
                  vatPercent: parseFloat(item.vatPercent || '0') || 0,
                  vatAmount: parseFloat(item.vatAmount || '0') || 0
                }));

                const response = await fetch('/api/customer-quotes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    enquiryId: enquiry.id, 
                    customerId: enquiry.customerId, 
                    suppliers: selectedSupplierData,
                    items: enquiryItems,
                    paymentTerms: rfqPaymentTerms,
                    deliveryTerms: rfqDeliveryTerms,
                    priority: rfqPriority,
                    currency: enquiry.currency || 'BHD'
                  })
                });

                if (response.ok) {
                  const contentType = response.headers.get('content-type');
                  if (contentType && contentType.includes('application/json')) {
                    const result = await response.json();
                    toast({ 
                      title: 'Quote Request Sent Successfully!', 
                      description: `Quotation ${result.quoteNumber} created for ${supplierMap[selectedSupplier]?.name || 'selected supplier'}. ${result.itemsCount} items included.`,
                      duration: 5000
                    });
                    // Reset selection after successful creation
                    setSelectedSupplier('');
                    // Refresh supplier quotes table
                    queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes"] });
                    // Refresh quotations table
                    queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
                  } else {
                    throw new Error('Server returned non-JSON response');
                  }
                } else {
                  const contentType = response.headers.get('content-type');
                  if (contentType && contentType.includes('application/json')) {
                    const error = await response.json();
                    toast({ 
                      title: 'Error', 
                      description: error.message || 'Failed to create quotation', 
                      variant: 'destructive' 
                    });
                  } else {
                    const errorText = await response.text();
                    console.error('Non-JSON error response:', errorText);
                    toast({ 
                      title: 'Error', 
                      description: `Server error: ${response.status} ${response.statusText}`, 
                      variant: 'destructive' 
                    });
                  }
                }
              } catch (err) {
                toast({ 
                  title: 'Error', 
                  description: err instanceof Error ? err.message : 'Unknown error', 
                  variant: 'destructive' 
                });
              }
              setRfqLoading(false);
            }}
            data-testid="button-send-request"
          >
            <Package className="h-4 w-4 mr-2" />
            {rfqLoading ? "Sending..." : "Send Request"}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Status Card */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-gray-50 to-white">
          <CardContent className="p-6 flex items-center gap-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              {getStatusIcon(enquiry.status)
                ? React.cloneElement(getStatusIcon(enquiry.status) as React.ReactElement, { className: "h-7 w-7 text-primary" })
                : null}
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Status</p>
              <Badge variant="outline" className={getStatusColor(enquiry.status) + " text-base px-3 py-1"} data-testid="badge-status">
                {enquiry.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Source Card */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6 flex items-center gap-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
              <Paperclip className="h-7 w-7 text-blue-500" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</p>
              <p className="font-semibold text-base text-blue-900" data-testid="text-source">{enquiry.source}</p>
            </div>
          </CardContent>
        </Card>

        {/* Customer Card */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6 flex items-center gap-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
              <Package className="h-7 w-7 text-green-500" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Customer</p>
              <p className="font-semibold text-base text-green-900" data-testid="text-customer-name">
                {customer?.name || "Loading..."}
              </p>
              {customer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {customer.customerType}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Target Delivery Card */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-6 flex items-center gap-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100">
              <Clock className="h-7 w-7 text-purple-500" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Target Delivery</p>
              <p className="font-semibold text-base text-purple-900" data-testid="text-target-delivery">
                {enquiry.targetDeliveryDate ? formatDate(enquiry.targetDeliveryDate) : "Not specified"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="supplier-source">Supplier Source</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enquiry Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Basic Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-muted-foreground">Enquiry Number:</span>
                      <p className="font-mono">{enquiry.enquiryNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Date Created:</span>
                      <p>{formatDate(enquiry.enquiryDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Source:</span>
                      <p>{enquiry.source}</p>
                    </div>
                    {enquiry.source === 'Referral' && (enquiry.referralCustomerId || enquiry.referralName) && (
                      <div>
                        <span className="text-sm text-muted-foreground">Referred By:</span>
                        <p>{enquiry.referralName || referralCustomer?.name || enquiry.referralCustomerId}</p>
                      </div>
                    )}
                  </div>
                </div>
  
                <div>
                  <h4 className="font-medium mb-2">Customer Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-muted-foreground">Name:</span>
                      <p>{customer?.name || "Loading..."}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Type:</span>
                      <p>{customer?.customerType || "-"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Email:</span>
                      <p>{customer?.email || "-"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Phone:</span>
                      <p>{customer?.phone || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {enquiry.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm bg-muted p-3 rounded-md" data-testid="text-notes">
                      {enquiry.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Calculate financial totals from enquiry items */}
              {(() => {
                let grossSubtotal = 0;
                let totalDiscount = 0;
                let totalTax = 0;
                
                // Calculate gross subtotal, discount, and tax from items
                enquiryItems.forEach(item => {
                  const quantity = Number(item.quantity) || 0;
                  const unitPrice = Number(item.unitPrice) || 0;
                  
                  const grossAmount = quantity * unitPrice;
                  
                  // Calculate discount amount
                  const discountPercent = Number(item.discountPercent) || 0;
                  const discountAmount = Number(item.discountAmount) || 0;
                  const appliedDiscount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
                  
                  // Calculate net amount after discount
                  const netAmount = Math.max(0, grossAmount - appliedDiscount);
                  
                  // Calculate VAT amount - VAT is calculated on net amount (after discount), not on gross
                  const vatPercent = Number(item.vatPercent) || 0;
                  const vatAmount = Number(item.vatAmount) || 0;
                  const appliedVat = vatAmount > 0 ? vatAmount : (netAmount * Math.max(0, vatPercent) / 100);
                  
                  grossSubtotal += grossAmount;
                  totalDiscount += Math.min(grossAmount, Math.max(0, appliedDiscount));
                  totalTax += Math.max(0, appliedVat);
                });
                
                const subtotal = grossSubtotal - totalDiscount;
                const totalAmount = subtotal + totalTax;
                
                return (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Subtotal</label>
                      <p className="text-xl font-bold">
                        {formatCurrency(subtotal)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">VAT</label>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(totalTax)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Discount</label>
                      <p className="text-xl font-bold text-green-600">
                        -{formatCurrency(totalDiscount)}
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <label className="text-sm font-medium text-gray-500">Total</label>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Enquiry Items */}
          <EnquiryItemsManager enquiryId={enquiry.id} />
        </TabsContent>
<TabsContent value="supplier-source" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Package className="h-6 w-6 text-primary" />
                  <span className="font-bold text-lg text-gray-900">Supplier RFQ</span>
                </div>
              </CardTitle>
            </CardHeader>
      <CardContent className="space-y-4">
        {/* Supplier selection */}
        {suppliersLoading ? (
          <div className="text-muted-foreground text-sm">Loading suppliers...</div>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suppliers.map((supplier: any) => (
              <label key={supplier.id} className={`flex items-center border rounded-xl p-4 bg-white shadow-sm cursor-pointer hover:border-primary transition ${rfqLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="radio"
                  name="supplier"
                  value={supplier.id}
                  checked={selectedSupplier === supplier.id}
                  disabled={rfqLoading}
                  onChange={e => {
                    setSelectedSupplier(e.target.value);
                  }}
                  className="accent-primary h-5 w-5 mr-4"
                />
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg">
                    {supplier.name ? supplier.name.charAt(0) : "S"}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-base text-gray-900">{supplier.name}</span>
                    <span className="text-xs text-muted-foreground">{supplier.companyType || "Supplier"}</span>
                    <span className="text-xs text-muted-foreground">{supplier.email}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">No suppliers found.</div>
        )}
      </CardContent>
    </Card>
  </TabsContent>
        <TabsContent value="attachments">
          <AttachmentManager
            attachments={enquiry.attachments || []}
            onAttachmentsChange={(attachments) => {
              updateAttachments.mutate(attachments);
            }}
          />
        </TabsContent>
      </Tabs>
    {/* Convert to Quotation Confirmation Dialog */}
    <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert Enquiry to Quotation</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new quotation based on this enquiry. Pricing will be calculated automatically based on the customer type and markup rules. The enquiry status will be updated to "Quoted".
            <br /><br />
            Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setShowConvertDialog(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => convertToQuotation.mutate()}
            disabled={convertToQuotation.isPending}
            data-testid="button-confirm-convert"
          >
            {convertToQuotation.isPending ? "Converting..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
   );
  } 