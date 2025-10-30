import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, FileText, Download, Mail, CheckCircle,
  Clock, DollarSign, Building2, User, Phone, AlertCircle
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  paymentStatus: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  paymentTerms?: string;
  notes?: string;
  customer: {
    id: string;
    name: string;
    type?: string;
    classification?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: InvoiceItem[];
  salesOrder?: {
    id: string;
    orderNumber: string;
  };
  delivery?: {
    id: string;
    deliveryNumber: string;
  };
}

interface InvoiceItem {
  id: string;
  description: string;
  productName?: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  discountPercentage?: string | number;
  discountAmount?: string | number;
  taxRate?: string | number;
  taxAmount?: string | number;
  unitOfMeasure?: string;
  barcode?: string;
  supplierCode?: string;
}

const getStatusBadge = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'paid') {
    return <Badge variant="outline" className="text-green-800 border-green-200">Paid</Badge>;
  } else if (normalizedStatus === 'sent') {
    return <Badge variant="outline" className="text-gray-800 border-gray-200">Sent</Badge>;
  } else if (normalizedStatus === 'draft') {
    return <Badge variant="outline" className="text-gray-800 border-gray-200">Draft</Badge>;
  } else if (normalizedStatus === 'cancelled') {
    return <Badge variant="outline" className="text-red-800 border-red-200">Cancelled</Badge>;
  } else if (normalizedStatus.includes('partial')) {
    return <Badge variant="outline" className="text-yellow-800 border-yellow-200">Partial Payment</Badge>;
  }
  return <Badge variant="outline" className="text-gray-800 border-gray-200">{status}</Badge>;
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();

  // Fetch invoice data
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/invoices/complete/${id}`);
      const result = await response.json();
      return result.data as Invoice;
    },
    enabled: !!id,
  });

  // Fetch related sales order (to discover quotation linkage)
  const { data: salesOrder } = useQuery({
    queryKey: invoice?.salesOrder?.id ? ["/api/sales-orders", invoice.salesOrder.id] : ["/api/sales-orders", null],
    queryFn: async () => {
      if (!invoice?.salesOrder?.id) return null;
      const response = await apiRequest("GET", `/api/sales-orders/${invoice.salesOrder.id}`);
      const result = await response.json();
      return result;
    },
    enabled: !!invoice?.salesOrder?.id,
  });

  // Fetch quotation by sales order's quotationId
  const { data: quotation } = useQuery({
    queryKey: salesOrder?.quotationId ? ["/api/quotations", salesOrder.quotationId] : ["/api/quotations", null],
    queryFn: async () => {
      if (!salesOrder?.quotationId) return null;
      const resp = await fetch(`/api/quotations/${salesOrder.quotationId}`);
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!salesOrder?.quotationId,
  });

  // Fetch quotation items to enrich invoice rows with cost, markup, discounts and VAT
  const { data: quotationItems = [] } = useQuery({
    queryKey: quotation?.id ? ["/api/quotations", quotation.id, "items"] : ["/api/quotations", null, "items"],
    queryFn: async () => {
      if (!quotation?.id) return [];
      const resp = await fetch(`/api/quotations/${quotation.id}/items`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!quotation?.id,
  });

  // Download PDF handler
  const handleDownloadPDF = async () => {
    try {
      const response = await apiRequest("GET", `/api/invoices/${id}/pdf`);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice?.invoiceNumber || 'unknown'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice Not Found</h2>
              <p className="text-gray-600 mb-6">The invoice you're looking for doesn't exist or has been removed.</p>
              <Link href="/invoicing">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Invoices
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const actualFinancials = {
    totalSubtotal: parseFloat(invoice.subtotal || '0'),
    totalTax: parseFloat(invoice.taxAmount || '0'),
    discountAmount: parseFloat(invoice.discountAmount || '0'),
    grandTotal: parseFloat(invoice.totalAmount || '0'),
    paidAmount: parseFloat(invoice.paidAmount || '0'),
    outstandingAmount: parseFloat(invoice.outstandingAmount || '0'),
    totalQuantity: invoice.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/invoicing">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <h1 className="text-2xl font-semibold text-gray-900">Invoice Details</h1>
                </div>
                <p className="text-sm text-gray-500 font-mono ml-8 mt-1">{invoice.invoiceNumber}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusBadge(invoice.status || invoice.paymentStatus || 'Draft')}
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items ({invoice.items?.length || 0})</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invoice Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <FileText className="h-4 w-4 mr-2 text-blue-600" />
                    Invoice Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Number</span>
                    <span className="text-sm font-semibold">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type</span>
                    <Badge variant="secondary">{invoice.invoiceType}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Currency</span>
                    <span className="text-sm font-semibold">{invoice.currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Date</span>
                    <span className="text-sm font-semibold">
                      {formatDate(new Date(invoice.invoiceDate))}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Due Date</span>
                      <span className="text-sm font-semibold">
                        {formatDate(new Date(invoice.dueDate))}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <User className="h-4 w-4 mr-2 text-green-600" />
                    Customer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600 block">Name</span>
                    <span className="text-sm font-semibold">{invoice.customer.name}</span>
                  </div>
                  {invoice.customer.type && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Type</span>
                      <Badge variant="secondary">{invoice.customer.type}</Badge>
                    </div>
                  )}
                  {invoice.customer.classification && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Classification</span>
                      <span className="text-sm font-semibold">{invoice.customer.classification}</span>
                    </div>
                  )}
                  {invoice.customer.email && (
                    <div>
                      <span className="text-sm text-gray-600 block">Email</span>
                      <a href={`mailto:${invoice.customer.email}`} className="text-sm text-blue-600 hover:underline">
                        {invoice.customer.email}
                      </a>
                    </div>
                  )}
                  {invoice.customer.phone && (
                    <div>
                      <span className="text-sm text-gray-600 block">Phone</span>
                      <a href={`tel:${invoice.customer.phone}`} className="text-sm text-gray-900">
                        {invoice.customer.phone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <DollarSign className="h-4 w-4 mr-2 text-purple-600" />
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subtotal</span>
                      <span className="text-sm font-semibold">
                        {invoice.currency} {actualFinancials.totalSubtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">VAT</span>
                      <span className="text-sm font-semibold">
                        {invoice.currency} {actualFinancials.totalTax.toFixed(2)}
                      </span>
                    </div>
                    {actualFinancials.discountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span className="text-sm">Discount</span>
                        <span className="text-sm font-semibold">
                          -{invoice.currency} {actualFinancials.discountAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-bold">
                        {invoice.currency} {actualFinancials.grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm text-green-700">Paid</span>
                      <span className="text-sm font-semibold text-green-700">
                        {invoice.currency} {actualFinancials.paidAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm text-red-700">Outstanding</span>
                      <span className="text-sm font-semibold text-red-700">
                        {invoice.currency} {actualFinancials.outstandingAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Progress */}
            {actualFinancials.grandTotal > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {Math.round((actualFinancials.paidAmount / actualFinancials.grandTotal) * 100)}% Paid
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatCurrency(actualFinancials.paidAmount)} / {formatCurrency(actualFinancials.grandTotal)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min((actualFinancials.paidAmount / actualFinancials.grandTotal) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Documents */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {invoice.salesOrder && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sales Order</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/sales-orders/${invoice.salesOrder.id}`}>
                      <Button variant="link" className="p-0 h-auto">
                        <FileText className="h-4 w-4 mr-2" />
                        {invoice.salesOrder.orderNumber}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
              
              {invoice.delivery && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Delivery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-600" />
                      <span className="text-sm">{invoice.delivery.deliveryNumber}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Notes */}
            {invoice.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Payment Terms */}
            {invoice.paymentTerms && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{invoice.paymentTerms}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">S.I.</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item Description & Specifications</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Cost Price</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Markup %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Disc. %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Disc. Amt</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">VAT %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">VAT Amt</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoice.items?.map((item, index) => {
                        const quantity = Number(item.quantity) || 0;
                        const unitPrice = Number(item.unitPrice) || 0;

                        // Try to match the invoice item with a quotation item
                        const matchedQuotationItem = Array.isArray(quotationItems)
                          ? (quotationItems as any[]).find((qi: any) => {
                              // Prefer itemId match if available
                              if ((item as any).itemId && qi.itemId && (item as any).itemId === qi.itemId) return true;
                              // Fallback to description/productName
                              const desc = item.productName || item.description;
                              return desc && qi.description && qi.description === desc;
                            })
                          : undefined;

                        const costPrice = Number((matchedQuotationItem?.costPrice as any) ?? 0) || 0;
                        const markupPct = costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : Number((matchedQuotationItem?.markup as any) ?? 0) || 0;

                        const gross = quantity * unitPrice;
                        
                        // Priority 1: Use stored invoice item values
                        // Priority 2: Calculate from stored percentages
                        // Priority 3: Fallback to quotation item values
                        const invoiceDiscPct = Number((item as any).discountPercentage || 0) || 0;
                        const invoiceDiscAmt = Number((item as any).discountAmount || 0) || 0;
                        const quotationDiscPct = Number((matchedQuotationItem?.discountPercentage as any) ?? 0) || 0;
                        const quotationDiscAmt = Number((matchedQuotationItem?.discountAmount as any) ?? 0) || 0;
                        
                        // Use invoice item discount amount if available, otherwise calculate from invoice item percentage, otherwise use quotation values
                        const discPct = invoiceDiscPct > 0 ? invoiceDiscPct : quotationDiscPct;
                        const discountAmt = invoiceDiscAmt > 0 
                          ? invoiceDiscAmt 
                          : (discPct > 0 ? (gross * discPct / 100) : (quotationDiscAmt > 0 ? quotationDiscAmt : 0));
                        
                        const net = Math.max(0, gross - Math.max(0, discountAmt));

                        // Same priority logic for VAT
                        const invoiceTaxRate = Number((item as any).taxRate || 0) || 0;
                        const invoiceTaxAmt = Number((item as any).taxAmount || 0) || 0;
                        const quotationVatPct = Number((matchedQuotationItem?.vatPercent as any) ?? 0) || 0;
                        const quotationVatAmt = Number((matchedQuotationItem?.vatAmount as any) ?? 0) || 0;
                        
                        // Use invoice item tax amount if available, otherwise calculate from invoice item tax rate, otherwise use quotation values
                        const vatPct = invoiceTaxRate > 0 ? invoiceTaxRate : quotationVatPct;
                        const vatAmt = invoiceTaxAmt > 0 
                          ? invoiceTaxAmt 
                          : (vatPct > 0 ? (net * vatPct / 100) : (quotationVatAmt > 0 ? quotationVatAmt : 0));
                        
                        // Use totalPrice from invoice item if available, otherwise calculate
                        const storedTotalPrice = Number((item as any).totalPrice || 0) || 0;
                        const lineTotal = storedTotalPrice > 0 ? storedTotalPrice : (net + vatAmt);

                        return (
                          <tr key={item.id || index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{item.productName || item.description || 'No description'}</span>
                                {(item as any).unitOfMeasure && (
                                  <span className="text-xs text-gray-500">{(item as any).unitOfMeasure}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-medium">{quantity}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm">{invoice.currency} {costPrice.toFixed(3)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm">{Number.isFinite(markupPct) ? markupPct.toFixed(1) : '0.0'}%</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm">{invoice.currency} {unitPrice.toFixed(3)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm">{discPct ? discPct.toFixed(1) : '0.0'}%</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm text-green-700">{invoice.currency} {Math.max(0, discountAmt).toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm">{vatPct ? vatPct.toFixed(1) : '0.0'}%</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm">{invoice.currency} {Math.max(0, vatAmt).toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-semibold">{invoice.currency} {Math.max(0, lineTotal).toFixed(2)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right font-semibold">TOTAL</td>
                        <td className="px-4 py-3 text-right font-semibold">{actualFinancials.totalQuantity}</td>
                        <td className="px-4 py-3 text-right" colSpan={8}>
                          <span className="font-bold text-lg">{invoice.currency} {actualFinancials.grandTotal.toFixed(2)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Amount Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">
                      {invoice.currency} {actualFinancials.totalSubtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">VAT</span>
                    <span className="font-semibold">
                      {invoice.currency} {actualFinancials.totalTax.toFixed(2)}
                    </span>
                  </div>
                  {actualFinancials.discountAmount > 0 && (
                    <div className="flex justify-between py-2 border-b text-red-600">
                      <span>Discount</span>
                      <span className="font-semibold">
                        -{invoice.currency} {actualFinancials.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 pt-3">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-lg font-bold">
                      {invoice.currency} {actualFinancials.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-700">Paid Amount</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">
                        {invoice.currency} {actualFinancials.paidAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-red-600 mr-2" />
                        <span className="text-sm font-medium text-red-700">Outstanding</span>
                      </div>
                      <span className="text-lg font-bold text-red-700">
                        {invoice.currency} {actualFinancials.outstandingAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {actualFinancials.outstandingAmount === 0 && (
                    <div className="p-4 bg-green-100 rounded-lg text-center">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-green-700">Fully Paid</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

