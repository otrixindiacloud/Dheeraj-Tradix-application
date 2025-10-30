import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { formatDate } from "date-fns";
import { useParams, useLocation, Link } from "wouter";
import html2canvas from "html2canvas";
import {  
  ArrowLeft, 
  Edit, 
  Download, 
  FileText,
  DollarSign,
  Building2,
  Package,
  MessageSquare,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  Receipt,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  Send,
  Printer,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUserId } from "@/hooks/useUserId";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import type { SupplierLpo, SupplierLpoItem } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EditLpoDialog from "./EditLpoDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper function to calculate LPO totals from items
function calculateLpoTotals(items: SupplierLpoItem[]) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      totalDiscount: 0,
      totalVAT: 0,
      netAmount: 0,
      totalAmount: 0
    };
  }

  let subtotal = 0;
  let totalDiscount = 0;
  let totalVAT = 0;

  items.forEach((it: any) => {
    const qty = Number(it.quantity) || 0;
    const unitCost = Number(it.unitCost) || 0;
    const gross = qty * unitCost;
    
    // Discount calculation
    const discountPercent = Number(it.discountPercent) || 0;
    const discountAmount = Number(it.discountAmount) || 0;
    const appliedDiscount = discountAmount > 0 ? discountAmount : (gross * discountPercent / 100);
    
    // Net after discount
    const net = Math.max(0, gross - appliedDiscount);
    
    // VAT calculation
    const vatPercent = Number(it.vatPercent) || 0;
    const vatAmount = Number(it.vatAmount) || 0;
    const appliedVAT = vatAmount > 0 ? vatAmount : (net * vatPercent / 100);

    subtotal += gross;
    totalDiscount += appliedDiscount;
    totalVAT += appliedVAT;
  });

  const netAmount = subtotal - totalDiscount;
  const totalAmount = netAmount + totalVAT;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalVAT: Math.round(totalVAT * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100
  };
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
    Draft: { 
      label: "Draft", 
      className: "text-gray-800 border-gray-300",
      icon: FileText
    },
    Pending: { 
      label: "Pending", 
      className: "text-yellow-800 border-yellow-300",
      icon: Clock
    },
    Sent: { 
      label: "Sent", 
      className: "text-blue-800 border-blue-300",
      icon: Send
    },
    Confirmed: { 
      label: "Confirmed", 
      className: "text-green-800 border-green-300",
      icon: CheckCircle2
    },
    Received: { 
      label: "Received", 
      className: "text-purple-800 border-purple-300",
      icon: Receipt
    },
    Cancelled: { 
      label: "Cancelled", 
      className: "text-red-800 border-red-300",
      icon: XCircle
    },
  };

  const config = statusConfig[status] || statusConfig.Draft;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} flex items-center gap-1.5 px-3 py-1`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </Badge>
  );
}

export default function LpoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const userId = useUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lpo, isLoading } = useQuery({
    queryKey: ["/api/supplier-lpos", id],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-lpos/${id}`);
      if (!response.ok) throw new Error("Failed to fetch LPO");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: lpoItems = [] } = useQuery({
    queryKey: ["/api/supplier-lpos", id, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-lpos/${id}/items`);
      if (!response.ok) throw new Error("Failed to fetch LPO items");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: supplier } = useQuery({
    queryKey: ["/api/suppliers", lpo?.supplierId],
    queryFn: async () => {
      if (!lpo?.supplierId) return null;
      const response = await fetch(`/api/suppliers/${lpo.supplierId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!id && !!lpo?.supplierId,
  });

  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ["/api/purchase-invoices/by-lpo", id],
    queryFn: async () => {
      if (!id) return [];
      const response = await fetch(`/api/purchase-invoices/by-lpo/${id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!id,
  });

  // Calculate totals
  const totals = calculateLpoTotals(lpoItems);

  // Download PDF
  const downloadPDF = async () => {
    if (!lpo) return;
    try {
      const response = await fetch(`/api/supplier-lpos/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lpo-${lpo.lpoNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to download PDF", variant: "destructive" });
    }
  };

  // Download purchase invoice PDF
  const downloadPurchaseInvoicePDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}/pdf?mode=enhanced`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase-invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Success", description: "Purchase invoice PDF downloaded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to download PDF", variant: "destructive" });
    }
  };

  // Capture screenshot
  const captureScreenshot = async () => {
    if (!lpo || !contentRef.current) return;
    
    setIsCapturing(true);
    try {
      // Scroll to top to ensure we capture from the beginning
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({ title: "Error", description: "Failed to create screenshot", variant: "destructive" });
          setIsCapturing(false);
          return;
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lpo-${lpo.lpoNumber}-screenshot.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: "Success", description: "Screenshot captured successfully" });
        setIsCapturing(false);
      }, "image/png", 0.95);
    } catch (error: any) {
      console.error("Screenshot error:", error);
      toast({ title: "Error", description: error.message || "Failed to capture screenshot", variant: "destructive" });
      setIsCapturing(false);
    }
  };

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/supplier-lpos/${id}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "LPO status updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", id] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  // Send to supplier mutation
  const sendToSupplierMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/supplier-lpos/${id}/send-to-supplier`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "LPO sent to supplier successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", id] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send LPO", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lpo) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-12 w-12 text-gray-400" />
              <p className="text-lg font-medium">LPO not found</p>
              <Link href="/supplier-lpo">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to LPOs
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = lpo.currency || "BHD";

  return (
    <div ref={contentRef} className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/supplier-lpo">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">LPO {lpo.lpoNumber}</h1>
                <p className="text-gray-600 mt-1">
                  {supplier?.name || lpo.supplierName || "Unknown Supplier"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={lpo.status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit LPO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={captureScreenshot} disabled={isCapturing}>
                <Camera className="h-4 w-4 mr-2" />
                {isCapturing ? "Capturing..." : "Capture Screenshot"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
              {lpo.status === "Draft" && (
                <DropdownMenuItem onClick={() => sendToSupplierMutation.mutate()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Supplier
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={downloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(totals.totalAmount, currency)}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Items Count</p>
                <p className="text-2xl font-bold mt-1">{lpoItems.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">LPO Date</p>
                <p className="text-lg font-semibold mt-1">
                  {lpo.lpoDate ? formatDate(new Date(lpo.lpoDate), "MMM dd, yyyy") : "Not set"}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expected Delivery</p>
                <p className="text-lg font-semibold mt-1">
                  {lpo.expectedDeliveryDate 
                    ? formatDate(new Date(lpo.expectedDeliveryDate), "MMM dd, yyyy") 
                    : "Not set"}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items ({lpoItems.length})</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({purchaseInvoices.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LPO Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  LPO Information
                </CardTitle>
                <CardDescription>Basic details and metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-500">LPO Number</Label>
                    <p className="font-medium mt-1">{lpo.lpoNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={lpo.status} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">LPO Date</Label>
                    <p className="font-medium mt-1">
                      {lpo.lpoDate ? formatDate(new Date(lpo.lpoDate), "MMM dd, yyyy") : "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Expected Delivery</Label>
                    <p className="font-medium mt-1">
                      {lpo.expectedDeliveryDate 
                        ? formatDate(new Date(lpo.expectedDeliveryDate), "MMM dd, yyyy") 
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Currency</Label>
                    <p className="font-medium mt-1">{currency}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Version</Label>
                    <p className="font-medium mt-1">v{lpo.version || 1}</p>
                  </div>
                </div>
                {lpo.requestedDeliveryDate && (
                  <div>
                    <Label className="text-sm text-gray-500">Requested Delivery Date</Label>
                    <p className="font-medium mt-1">
                      {formatDate(new Date(lpo.requestedDeliveryDate), "MMM dd, yyyy")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Supplier Information
                </CardTitle>
                <CardDescription>Contact and company details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">Supplier Name</Label>
                  <p className="font-medium mt-1">{supplier?.name || lpo.supplierName || "Not specified"}</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {supplier?.contactPerson || lpo.supplierContactPerson ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <Label className="text-xs text-gray-500">Contact Person</Label>
                        <p className="font-medium text-sm">
                          {supplier?.contactPerson || lpo.supplierContactPerson}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {supplier?.email || lpo.supplierEmail ? (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <div>
                        <Label className="text-xs text-gray-500">Email</Label>
                        <p className="font-medium text-sm">
                          {supplier?.email || lpo.supplierEmail}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {supplier?.phone || lpo.supplierPhone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <div>
                        <Label className="text-xs text-gray-500">Phone</Label>
                        <p className="font-medium text-sm">
                          {supplier?.phone || lpo.supplierPhone}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {supplier?.address ? (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <Label className="text-xs text-gray-500">Address</Label>
                        <p className="font-medium text-sm">{supplier.address}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Terms and Conditions */}
          {(lpo.paymentTerms || lpo.deliveryTerms || lpo.termsAndConditions || lpo.specialInstructions) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Terms & Conditions
                </CardTitle>
                <CardDescription>Payment, delivery, and special instructions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lpo.paymentTerms && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Payment Terms</Label>
                      <p className="text-sm text-gray-600 mt-1">{lpo.paymentTerms}</p>
                    </div>
                  )}
                  {lpo.deliveryTerms && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Delivery Terms</Label>
                      <p className="text-sm text-gray-600 mt-1">{lpo.deliveryTerms}</p>
                    </div>
                  )}
                </div>
                {lpo.termsAndConditions && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Terms & Conditions</Label>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{lpo.termsAndConditions}</p>
                  </div>
                )}
                {lpo.specialInstructions && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Special Instructions</Label>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{lpo.specialInstructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                LPO Items
              </CardTitle>
              <CardDescription>{lpoItems.length} item(s) in this LPO</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">S.I.</TableHead>
                      <TableHead>Item Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Disc. %</TableHead>
                      <TableHead className="text-right">Disc. Amt</TableHead>
                      <TableHead className="text-right">VAT %</TableHead>
                      <TableHead className="text-right">VAT Amt</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lpoItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      lpoItems.map((item: SupplierLpoItem, index: number) => {
                        const qty = Number(item.quantity) || 0;
                        const unitCost = Number(item.unitCost) || 0;
                        const gross = qty * unitCost;
                        const discountPercent = Number(item.discountPercent) || 0;
                        const discountAmount = Number(item.discountAmount) || 0;
                        const appliedDiscount = discountAmount > 0 ? discountAmount : (gross * discountPercent / 100);
                        const net = Math.max(0, gross - appliedDiscount);
                        const vatPercent = Number(item.vatPercent) || 0;
                        const vatAmount = Number(item.vatAmount) || 0;
                        const appliedVAT = vatAmount > 0 ? vatAmount : (net * vatPercent / 100);
                        const lineTotal = net + appliedVAT;

                        return (
                          <TableRow key={item.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.itemDescription}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {item.supplierCode && (
                                    <span className="text-xs text-gray-500">Code: {item.supplierCode}</span>
                                  )}
                                  {item.barcode && (
                                    <span className="text-xs text-gray-500">Barcode: {item.barcode}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{qty.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{formatCurrency(unitCost, currency)}</TableCell>
                            <TableCell className="text-right">
                              {discountPercent > 0 ? `${discountPercent.toFixed(1)}%` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {appliedDiscount > 0 ? formatCurrency(appliedDiscount, currency) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {vatPercent > 0 ? `${vatPercent.toFixed(1)}%` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {appliedVAT > 0 ? formatCurrency(appliedVAT, currency) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(lineTotal, currency)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Summary
              </CardTitle>
              <CardDescription>Breakdown of amounts and calculations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md ml-auto space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Discount Amount</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(totals.totalDiscount, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Net Amount</span>
                  <span className="font-medium">{formatCurrency(totals.netAmount, currency)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">VAT Amount</span>
                  <span className="font-medium">{formatCurrency(totals.totalVAT, currency)}</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between py-3 bg-gray-50 rounded-lg px-4">
                  <span className="text-lg font-bold">Total Amount</span>
                  <span className="text-lg font-bold">{formatCurrency(totals.totalAmount, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Purchase Invoices
              </CardTitle>
              <CardDescription>
                {purchaseInvoices.length === 0 
                  ? "No purchase invoices found for this LPO"
                  : `${purchaseInvoices.length} purchase invoice(s) associated with this LPO`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {purchaseInvoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No purchase invoices have been created for this LPO yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {purchaseInvoices.map((invoice: any) => (
                    <Card key={invoice.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">
                                {invoice.invoiceNumber}
                              </h3>
                              <Badge variant="outline" className={
                                invoice.status === "Paid" ? "text-green-800 border-green-300" :
                                invoice.status === "Approved" ? "text-blue-800 border-blue-300" :
                                invoice.status === "Pending Approval" ? "text-yellow-800 border-yellow-300" :
                                "text-gray-800 border-gray-300"
                              }>
                                {invoice.status}
                              </Badge>
                              {invoice.supplierInvoiceNumber && (
                                <Badge variant="outline" className="text-gray-600">
                                  Supplier: {invoice.supplierInvoiceNumber}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                              <div>
                                <Label className="text-xs text-gray-500">Invoice Date</Label>
                                <p className="font-medium mt-1">
                                  {invoice.invoiceDate 
                                    ? formatDate(new Date(invoice.invoiceDate), "MMM dd, yyyy") 
                                    : "N/A"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">Due Date</Label>
                                <p className="font-medium mt-1">
                                  {invoice.dueDate 
                                    ? formatDate(new Date(invoice.dueDate), "MMM dd, yyyy") 
                                    : "N/A"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">Total Amount</Label>
                                <p className="font-medium mt-1">
                                  {formatCurrency(invoice.totalAmount || "0", invoice.currency || currency)}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">Payment Status</Label>
                                <p className="font-medium mt-1">
                                  {invoice.paymentStatus || "Unpaid"}
                                </p>
                              </div>
                            </div>
                            {invoice.notes && (
                              <div className="mt-3 pt-3 border-t">
                                <Label className="text-xs text-gray-500">Notes</Label>
                                <p className="text-sm text-gray-600 mt-1">{invoice.notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="ml-4 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadPurchaseInvoicePDF(invoice.id, invoice.invoiceNumber)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </Button>
                            <Link href={`/purchase-invoices/${invoice.id}`}>
                              <Button variant="ghost" size="sm">
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                LPO History
              </CardTitle>
              <CardDescription>Timeline of events and status changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 pb-4 border-b">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">LPO Created</p>
                      <Badge variant="outline" className="text-xs">Draft</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {lpo.createdAt 
                        ? formatDate(new Date(lpo.createdAt), "MMM dd, yyyy 'at' HH:mm") 
                        : "Unknown"}
                    </p>
                  </div>
                </div>
                {lpo.sentToSupplierAt && (
                  <div className="flex items-start gap-4 pb-4 border-b">
                    <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Sent to Supplier</p>
                        <Badge variant="outline" className="text-xs bg-green-50">Sent</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(new Date(lpo.sentToSupplierAt), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                )}
                {lpo.confirmedBySupplierAt && (
                  <div className="flex items-start gap-4 pb-4 border-b">
                    <div className="w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Confirmed by Supplier</p>
                        <Badge variant="outline" className="text-xs bg-purple-50">Confirmed</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(new Date(lpo.confirmedBySupplierAt), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                      {lpo.supplierConfirmationReference && (
                        <p className="text-sm text-gray-600 mt-1">
                          Reference: <span className="font-medium">{lpo.supplierConfirmationReference}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {lpo.updatedAt && (
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-gray-600 mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="font-medium">Last Updated</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(new Date(lpo.updatedAt), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {showEditDialog && (
        <EditLpoDialog
          lpo={lpo}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSave={async (updates) => {
            await apiRequest("PATCH", `/api/supplier-lpos/${id}`, updates);
            queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", id] });
            setShowEditDialog(false);
            toast({ title: "Success", description: "LPO updated successfully" });
          }}
        />
      )}
    </div>
  );
}
