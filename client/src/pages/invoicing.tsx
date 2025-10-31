import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useLocation as useLocationForNavigation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, FileText, Send, DollarSign, Clock, CheckCircle, Download, Edit, Plane, AlertTriangle, FileDown, ChevronDown, Receipt, User, X, Building2, Package, Printer, Eye, Trash2 } from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmailSendButton } from "@/components/email/EmailSendButton";
import { formatDate, formatCurrency, formatCurrencyCompact, getStatusColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as ConfirmDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Invoicing() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [, setLocationForNavigation] = useLocationForNavigation();
  
  // Parse search parameters from URL
  const getSearchParams = () => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    return {
      get: (key: string) => urlParams.get(key)
    };
  };
  const searchParams = getSearchParams();

  // Email invoice mutation (legacy - keeping for backward compatibility)
  const emailInvoice = useMutation({
    mutationFn: async ({ id, email }: { id: string; email?: string }) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/send`, { email });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sent", description: "Invoice email dispatched (status set to Sent)." });
    },
    onError: (err: any) => {
      console.error("Send invoice error", err);
      toast({ title: "Error", description: "Failed to send invoice", variant: "destructive" });
    },
  });

  const { data: invoices, isLoading, error: invoicesError } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const response = await fetch("/api/invoices");
      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: deliveries, error: deliveriesError } = useQuery({
    queryKey: ["/api/deliveries"],
    queryFn: async () => {
      const response = await fetch("/api/deliveries");
      if (!response.ok) {
        throw new Error(`Failed to fetch deliveries: ${response.statusText}`);
      }
      return response.json();
    },
  });

  // Fetch customers data to get customer names
  const { data: customersData = { customers: [] } } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const customers = customersData.customers || [];

  // Handle URL parameters for invoice viewing

  // Dialog state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [invoiceType, setInvoiceType] = useState("Standard");
  const [deliveryFilter, setDeliveryFilter] = useState("all"); // "all", "partial", "full"
  // Partial delivery invoice state
  const [selectedDeliveryForInvoice, setSelectedDeliveryForInvoice] = useState<any>(null);
  const [selectedDeliveryItems, setSelectedDeliveryItems] = useState<Record<string, boolean>>({});
  const [showPartialInvoiceDialog, setShowPartialInvoiceDialog] = useState(false);
  const [invoicedItems, setInvoicedItems] = useState<Set<string>>(new Set());

  // Fetch delivery items for selected delivery
  const { data: deliveryItems = [], isLoading: isLoadingDeliveryItems } = useQuery({
    queryKey: ["/api/deliveries", selectedDeliveryForInvoice?.id, "items"],
    enabled: !!selectedDeliveryForInvoice?.id,
    queryFn: async () => {
      const response = await fetch(`/api/deliveries/${selectedDeliveryForInvoice.id}/items`);
      if (!response.ok) throw new Error("Failed to fetch delivery items");
      return response.json();
    },
  });

  // Fetch already invoiced items for the selected delivery
  const { data: invoicedItemsData = [] } = useQuery({
    queryKey: ["/api/deliveries", selectedDeliveryForInvoice?.id, "invoiced-items"],
    enabled: !!selectedDeliveryForInvoice?.id,
    queryFn: async () => {
      const response = await fetch(`/api/deliveries/${selectedDeliveryForInvoice.id}/invoiced-items`);
      if (!response.ok) throw new Error("Failed to fetch invoiced items");
      return response.json();
    },
  });

  // Update invoiced items set when data changes
  useEffect(() => {
    if (invoicedItemsData && Array.isArray(invoicedItemsData)) {
      const invoicedItemIds = new Set(invoicedItemsData.map((item: any) => item.deliveryItemId));
      setInvoicedItems(invoicedItemIds);
    }
  }, [invoicedItemsData]);

  const createInvoice = useMutation({
    mutationFn: async ({ deliveryId, invoiceType, selectedItems }: { deliveryId: string; invoiceType: string; selectedItems?: string[] }) => {
      console.log(`[Invoice Creation] Starting invoice generation for delivery ${deliveryId} with ${selectedItems?.length || 0} selected items`);
      
      // Use dedicated generation endpoint for consistency with backend route
      const response = await apiRequest("POST", "/api/invoices/generate-from-delivery", { 
        deliveryId, 
        invoiceType,
        selectedDeliveryItemIds: selectedItems 
      });
      
      console.log(`[Invoice Creation] Invoice generation completed for delivery ${deliveryId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries", selectedDeliveryForInvoice?.id, "invoiced-items"] });
      toast({
        title: "Success",
        description: "Invoice generated successfully",
      });
      setSelectedDelivery(null);
      setSelectedDeliveryForInvoice(null);
      setSelectedDeliveryItems({});
      setShowGenerateDialog(false);
      setShowPartialInvoiceDialog(false);
    },
    onError: (err: any) => {
      console.error("Generate invoice error", err);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive",
      });
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status, paidAmount }: { id: string; status: string; paidAmount?: number }) => {
      const updateData: any = { status };
      if (paidAmount !== undefined) {
        // Convert number to string for decimal field
        updateData.paidAmount = paidAmount.toFixed(2);
      }
      const response = await apiRequest("PUT", `/api/invoices/${id}`, updateData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const message = variables.paidAmount !== undefined 
        ? `Invoice marked as paid. Paid amount: ${formatCurrency(variables.paidAmount)}`
        : "Invoice status updated successfully";
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error: any) => {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/invoices/${id}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({} as any));
        throw new Error(err?.message || "Failed to delete invoice");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Deleted", description: "Invoice deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to delete invoice", variant: "destructive" });
    }
  });

  // Remove alternate mutation, use only main mutation for proforma

  const downloadInvoicePDF = async (invoiceId: string, invoiceNumber: string, invoiceType: string = 'Standard') => {
    const startTime = Date.now();
    try {
      // Show loading state
      const isProforma = invoiceType === 'Proforma';
      toast({
        title: "Generating PDF",
        description: `Creating comprehensive ${isProforma ? 'proforma' : ''} invoice with material specifications...`,
      });

      console.log(`[PDF Download] Starting PDF download for invoice ${invoiceNumber} (${invoiceId})`);

      // Pass invoiceType as query param for backend compatibility
      const response = await fetch(`/api/invoices/${invoiceId}/pdf?invoiceType=${encodeURIComponent(invoiceType)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
        throw new Error(errorData.message || 'Failed to generate PDF');
      }

      console.log(`[PDF Download] PDF response received, content-length: ${response.headers.get('content-length')}`);

      const blob = await response.blob();
      console.log(`[PDF Download] Blob created, size: ${blob.size} bytes`);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filePrefix = isProforma ? 'Golden-Tag-Proforma' : 'Golden-Tag-Invoice';
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `${filePrefix}-${invoiceNumber}-${timestamp}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      const endTime = Date.now();
      console.log(`[PDF Download] PDF download completed in ${endTime - startTime}ms for invoice ${invoiceNumber}`);

      toast({
        title: "Success",
        description: `Comprehensive ${isProforma ? 'proforma' : ''} invoice PDF downloaded successfully with all material specifications and company details`,
      });
    } catch (error) {
      const endTime = Date.now();
      console.error(`[PDF Download] Error generating PDF for invoice ${invoiceNumber} (${endTime - startTime}ms):`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const viewInvoicePDF = async (invoiceId: string, invoiceNumber: string, invoiceType: string = 'Standard') => {
    try {
      // Show loading state
      const isProforma = invoiceType === 'Proforma';
      console.log('Viewing invoice PDF:', { invoiceId, invoiceNumber, invoiceType, isProforma });
      
      toast({
        title: "Opening PDF",
        description: `Opening ${isProforma ? 'proforma' : ''} invoice in new tab...`,
      });

      // Check if invoiceId is valid
      if (!invoiceId || invoiceId === 'undefined' || invoiceId === 'null') {
        throw new Error('Invalid invoice ID');
      }

      const apiUrl = `/api/invoices/${invoiceId}/pdf?invoiceType=${encodeURIComponent(invoiceType)}`;
      console.log('Making request to:', apiUrl);

      // Pass invoiceType as query param for backend compatibility
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('API Error Response:', errorData);
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          // Try to get text response
          try {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.error('Failed to get error response as text:', textError);
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      console.log('PDF blob size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Received empty PDF file');
      }

      const url = window.URL.createObjectURL(blob);
      
      // Open PDF in new tab
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Cleanup URL after a delay to allow the new tab to load
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 10000); // 10 seconds should be enough for the PDF to load

      toast({
        title: "Success",
        description: `${isProforma ? 'Proforma' : 'Invoice'} PDF opened in new tab`,
      });
    } catch (error) {
      console.error("Error opening PDF:", error);
      
      let errorMessage = "Failed to open PDF";
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = "Network error: Unable to connect to server. Please check your connection and try again.";
        } else if (error.message.includes('Invalid invoice ID')) {
          errorMessage = "Invalid invoice ID. Please refresh the page and try again.";
        } else if (error.message.includes('empty PDF')) {
          errorMessage = "PDF generation failed: Received empty file. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const printInvoicePDF = async (invoiceId: string, invoiceType: string = 'Standard') => {
    try {
      const apiUrl = `/api/invoices/${invoiceId}/pdf?invoiceType=${encodeURIComponent(invoiceType)}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/pdf' },
      });
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) throw new Error('Popup blocked. Please allow popups for this site.');
      setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 500);
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to open print dialog', variant: 'destructive' });
    }
  };


  const exportInvoices = (format: 'csv' | 'excel') => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast({
        title: "No Data",
        description: "No invoices to export",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredInvoices.map((invoice: any) => ({
        'Invoice Number': invoice.invoiceNumber || '',
        'Customer Name': invoice.customer?.name || '',
        'Customer Type': invoice.customer?.customerType || '',
        'Sales Order': invoice.salesOrder?.orderNumber || '',
        'Status': invoice.status || '',
        'Invoice Amount': invoice.totalAmount || 0,
        'Paid Amount': invoice.paidAmount || 0,
        'Due Date': invoice.dueDate ? formatDate(invoice.dueDate) : '',
        'Invoice Date': invoice.invoiceDate ? formatDate(invoice.invoiceDate) : '',
        'Subtotal': invoice.subtotal || 0,
        'Tax Amount': invoice.taxAmount || 0,
        'Notes': invoice.notes || ''
      }));

      if (format === 'csv') {
        // Convert to CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join(','),
          ...exportData.map((row: Record<string, unknown>) =>
            headers.map(header => {
              const value = row[header];
              // Escape commas, quotes, and newlines in CSV
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
              }
              return value ?? "";
            }).join(',')
          )
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (format === 'excel') {
        // For Excel, we'll create a simple CSV that Excel can open
        // In a real application, you might want to use a library like xlsx
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join('\t'),
          ...exportData.map((row: Record<string, unknown>) =>
            headers.map(header => {
              const value = row[header];
              // For Excel, tab-separated values are preferred
              if (typeof value === 'string' && (value.includes('\t') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
              }
              return value ?? "";
            }).join('\t')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast({
        title: "Success",
        description: `Invoices exported as ${format.toUpperCase()} successfully`,
      });
    } catch (error) {
      console.error("Error exporting invoices:", error);
      toast({
        title: "Error",
        description: "Failed to export invoices",
        variant: "destructive",
      });
    }
  };

  // Filter for completed deliveries ready for invoicing
  const enrichedDeliveries = deliveries?.map((delivery: any) => {
    if (delivery.salesOrder?.customerId) {
      const customer = customers.find((c: any) => c.id === delivery.salesOrder.customerId);
      return {
        ...delivery,
        salesOrder: {
          ...delivery.salesOrder,
        customer: customer ? {
          ...customer,
          name: customer.name || 'No Customer'
        } : delivery.salesOrder.customer || { name: 'No Customer', customerType: '-' }
        }
      };
    }
    return delivery;
  });

  // All completed deliveries with invoice status
  const allCompletedDeliveries = enrichedDeliveries?.filter((delivery: any) => 
    delivery.status === "Complete"
  ).map((delivery: any) => {
    const existingInvoice = invoices?.find((inv: any) => inv.salesOrderId === delivery.salesOrderId);
    return {
      ...delivery,
      hasInvoice: !!existingInvoice,
      existingInvoice: existingInvoice,
      invoiceStatus: existingInvoice?.status || null
    };
  });

  // Separate deliveries with and without invoices
  const completedDeliveries = allCompletedDeliveries?.filter((delivery: any) => !delivery.hasInvoice) || [];
  const deliveriesWithInvoices = allCompletedDeliveries?.filter((delivery: any) => delivery.hasInvoice) || [];
  
  // Categorize deliveries for Partial and Full Invoice tabs
  // Partial Invoice: All completed deliveries (partial can be generated from any completed delivery)
  const deliveriesForPartialInvoice = allCompletedDeliveries || [];
  // Full Invoice: Only deliveries explicitly marked as Full delivery type
  const deliveriesForFullInvoice = (allCompletedDeliveries || []).filter((delivery: any) => {
    const type = (delivery?.deliveryType || "").toLowerCase();
    return type === "full";
  });
  // Partial delivery type (anything that's not Full)
  const deliveriesForPartialType = (allCompletedDeliveries || []).filter((delivery: any) => {
    const type = (delivery?.deliveryType || "").toLowerCase();
    return type !== "full";
  });

  // Enrich invoices with customer names from customers API
  const enrichedInvoices = invoices?.map((invoice: any) => {
    const customer = customers.find((c: any) => c.id === invoice.customerId);
    return {
      ...invoice,
      customer: customer ? {
        ...customer,
        name: customer.name || 'No Customer'
      } : invoice.customer || { name: 'No Customer', customerType: '-' }
    };
  });


  const filteredInvoices = enrichedInvoices?.filter((invoice: any) => {
    const matchesSearch = invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesType = typeFilter === "all" || invoice.invoiceType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }) || [];
  // Pagination logic
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);


  const columns: Column<any>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice ID",
      render: (value: string) => (
        <span className="font-mono text-sm text-blue-600 font-medium">{value}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (_: any, invoice: any) => {
        const customer = invoice.customer;
        if (!customer || !customer.name) {
          return (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">No Customer</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{customer.name}</span>
              {customer.customerType && (
                <span className="text-xs text-gray-500">{customer.customerType}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "salesOrderNumber",
      header: "Sales Order",
      render: (_, invoice: any) => {
        // Try to get order number from salesOrder, fallback to searching deliveries if missing
        let orderNumber = invoice.salesOrder?.orderNumber || invoice.salesOrderNumber || "";
        if (!orderNumber && invoice.salesOrderId && Array.isArray(deliveries)) {
          const delivery = deliveries.find((d: any) => d.salesOrderId === invoice.salesOrderId);
          orderNumber = delivery?.salesOrder?.orderNumber || "N/A";
        }
        return (
          <span className="font-mono text-sm text-blue-600 font-semibold">
            {orderNumber || "N/A"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
        render: (value: string) => (
          value === "Draft"
            ? <Badge variant="outline" className="border-gray-400 text-gray-600 bg-gray-50">{value}</Badge>
            : <Badge variant="outline" className={getStatusColor(value)}>{value}</Badge>
        ),
    },
    {
      key: "totalAmount",
      header: "Invoice Amount",
      render: (value: number) => value ? formatCurrency(value) : "-",
      className: "text-right",
    },
    {
      key: "paidAmount",
      header: "Paid Amount",
      render: (value: number) => value ? formatCurrency(value) : formatCurrency(0),
      className: "text-right",
    },
    // {
    //   key: "dueDate",
    //   header: "Due Date",
    //   render: (value: string) => {
    //     if (!value) return "-";
    //     const isOverdue = new Date(value) < new Date();
    //     return (
    //       <div className={isOverdue ? "text-red-600 font-medium" : ""}>
    //         {formatDate(value)}
    //         {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
    //       </div>
    //     );
    //   },
    // },
    {
      key: "invoiceDate",
      header: "Invoice Date",
      render: (value: string) => formatDate(value),
    },
    {
      key: "invoiceType",
      header: "Type",
      render: (value: string) => (
        <Badge 
          variant="outline" 
          className={
            value === "Proforma" 
              ? "bg-purple-100 text-purple-800 border-purple-300 font-semibold" 
              : value === "Standard"
              ? "bg-blue-100 text-blue-800 border-blue-300"
              : "bg-gray-100 text-gray-800 border-gray-300"
          }
        >
          {value === "Proforma" ? "Proforma" : value || "Standard"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, invoice: any) => (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setLocationForNavigation(`/invoices/${invoice.id}`);
            }}
            data-testid={`button-view-${invoice.id}`}
            title="View Invoice Details"
            className="text-black hover:text-black hover:bg-gray-50"
          >
            <Eye className="h-4 w-4 text-black" />
          </Button>
          {invoice.status === "Draft" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                updateInvoiceStatus.mutate({ id: invoice.id, status: "Sent" });
              }}
              data-testid={`button-send-${invoice.id}`}
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          )}
          {invoice.status === "Sent" && (
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                updateInvoiceStatus.mutate({ 
                  id: invoice.id, 
                  status: "Paid",
                  paidAmount: Number(invoice.totalAmount) || 0
                });
              }}
              data-testid={`button-mark-paid-${invoice.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Paid
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              downloadInvoicePDF(invoice.id, invoice.invoiceNumber, invoice.invoiceType);
            }}
            data-testid={`button-download-${invoice.id}`}
            title={`Download ${invoice.invoiceType === 'Proforma' ? 'Proforma' : 'Standard'} Invoice PDF with Material Specs`}
            className="text-black hover:text-black hover:bg-gray-50"
          >
            <Download className="h-4 w-4 text-black" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              printInvoicePDF(invoice.id, invoice.invoiceType);
            }}
            data-testid={`button-print-${invoice.id}`}
            title="Print Invoice"
            className="text-black hover:text-black hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 text-black" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                data-testid={`button-delete-${invoice.id}`}
                title="Delete Invoice"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </AlertDialogTrigger>
            <ConfirmDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete invoice {invoice.invoiceNumber}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteInvoice.mutate(invoice.id);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </ConfirmDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  const invoiceStats = {
    draft: invoices?.filter((inv: any) => inv.status === "Draft").length || 0,
    sent: invoices?.filter((inv: any) => inv.status === "Sent").length || 0,
    paid: invoices?.filter((inv: any) => inv.status === "Paid").length || 0,
    overdue: invoices?.filter((inv: any) => {
      return inv.status === "Sent" && inv.dueDate && new Date(inv.dueDate) < new Date();
    }).length || 0,
    totalRevenue: invoices?.filter((inv: any) => inv.status === "Paid")
      .reduce((sum: number, inv: any) => {
        const amt = Number(inv.totalAmount);
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0) || 0,
  };

  // Ref for scrolling to deliveries section
  const deliveriesSectionRef = useState<any>(null);

  const handleReadyForInvoiceClick = () => {
    if (deliveriesSectionRef[0] && deliveriesSectionRef[0].scrollIntoView) {
      deliveriesSectionRef[0].scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div>
      {/* Page Header - Card Style */}
      <div className="mb-6">
        <Card className="rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <Receipt className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent" data-testid="text-page-title">
                    Invoicing
                  </h2>
                </div>
                <p className="text-muted-foreground text-lg">
                  Step 10: Generate and manage customer invoices with multi-currency support
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="font-medium">Invoice Generation</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Invoices: {Array.isArray(invoices) ? invoices.length : 0}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3" style={{ visibility: 'visible' }}>
              <Button
                variant="outline"
                onClick={() => setShowGenerateDialog(true)}
                data-testid="button-open-generate-invoice"
                className="flex items-center gap-2 "
              >
                <Plus className="h-4 w-4" /> 
                Generate Invoice
              </Button>
              <Button
                variant="success"
                className="flex items-center px-4 py-2 gap-2"
                data-testid="badge-ready-for-invoice"
                onClick={handleReadyForInvoiceClick}
                style={{ cursor: "pointer" }}
              >
                <DollarSign className="h-4 w-4" />
                {completedDeliveries?.length || 0} Ready for Invoice
              </Button>
            </div>
          </div>
        </Card>
      </div>



      {/* Invoice Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mt-1">
                <Edit className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Draft Invoices</p>
                <p className="text-2xl font-bold text-gray-600" data-testid="stat-draft-invoices">
                  {invoiceStats.draft}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Sent Invoices</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-sent-invoices">
                  {invoiceStats.sent}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mt-1">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Paid Invoices</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-paid-invoices">
                  {invoiceStats.paid}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mt-1">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Overdue</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-overdue-invoices">
                  {invoiceStats.overdue}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mt-1">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Total Revenue</p>
                <p
                  className="text-2xl font-bold text-green-600 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] md:max-w-[140px] lg:max-w-[180px]"
                  data-testid="stat-total-revenue"
                  title={formatCurrency(invoiceStats.totalRevenue)}
                >
                  {formatCurrencyCompact(invoiceStats.totalRevenue).short}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  From paid invoices
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Invoices</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-10 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md shadow-none"
                  data-testid="input-search-invoices"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Proforma">Proforma</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" data-testid="button-filter">
                <Filter className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-export">
                    <FileDown className="h-4 w-4 mr-2" />
                    Export
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportInvoices('csv')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportInvoices('excel')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <DataTable
              data={paginatedInvoices}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No invoices found. Invoices are created from completed deliveries."
              onRowClick={(invoice) => {
                setLocationForNavigation(`/invoices/${invoice.id}`);
              }}
            />
            {/* Pagination Controls */}
            {filteredInvoices.length > pageSize && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="mx-2 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Generate Invoice Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {invoiceType === "Proforma" ? (
                <>
                  <FileText className="h-5 w-5 text-purple-600" />
                  Generate Proforma Invoice from Delivery
                </>
              ) : (
                "Generate Invoice from Delivery"
              )}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              {invoiceType === "Proforma" 
                ? "Generate proforma invoices from completed deliveries for preliminary billing"
                : "View and generate invoices from completed deliveries"
              }
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search deliveries..."
                value={deliverySearch}
                onChange={(e) => setDeliverySearch(e.target.value)}
                data-testid="input-search-deliveries"
                className="flex-1"
              />
              <Select value={invoiceType} onValueChange={setInvoiceType}>
                <SelectTrigger className="w-48" data-testid="select-invoice-type">
                  <SelectValue placeholder="Invoice Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Proforma">Proforma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Filter Tabs: Filter by delivery type (Full/Partial) */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setDeliveryFilter("all")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  deliveryFilter === "all" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Deliveries ({allCompletedDeliveries?.length || 0})
              </button>
              <button
                onClick={() => setDeliveryFilter("full")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  deliveryFilter === "full" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Full ({deliveriesForFullInvoice?.length || 0})
              </button>
              <button
                onClick={() => setDeliveryFilter("partial")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  deliveryFilter === "partial" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Partial ({deliveriesForPartialType?.length || 0})
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto border rounded-md divide-y" data-testid="list-deliveries-for-invoice">
              {(() => {
                // Show loading state
                if (isLoading || (!deliveries && !deliveriesError)) {
                  return (
                    <div className="p-4 text-sm text-gray-500 text-center" data-testid="loading-deliveries">
                      Loading deliveries...
                    </div>
                  );
                }

                // Show error state
                if (deliveriesError) {
                  return (
                    <div className="p-4 text-sm text-red-500 text-center" data-testid="error-deliveries">
                      Error loading deliveries. Please try again later.
                    </div>
                  );
                }

                // Filter deliveries based on delivery type (Full/Partial)
                let filteredDeliveries = [];
                if (deliveryFilter === "full") {
                  // Show only Full delivery type
                  filteredDeliveries = deliveriesForFullInvoice || [];
                } else if (deliveryFilter === "partial") {
                  // Show only Partial delivery type (anything that's not Full)
                  filteredDeliveries = deliveriesForPartialType || [];
                } else {
                  // Show all deliveries
                  filteredDeliveries = allCompletedDeliveries || [];
                }

                // Apply search filter
                const searchFilteredDeliveries = filteredDeliveries.filter((d: any) => {
                  if (!deliverySearch) return true;
                  const term = deliverySearch.toLowerCase();
                  return (
                    d.deliveryNumber?.toLowerCase().includes(term) ||
                    d.salesOrder?.orderNumber?.toLowerCase().includes(term) ||
                    d.salesOrder?.customer?.name?.toLowerCase().includes(term)
                  );
                });

                // Show empty state if no deliveries found
                if (searchFilteredDeliveries.length === 0) {
                  return (
                    <div className="p-4 text-sm text-gray-500 text-center" data-testid="empty-no-deliveries">
                      {deliveryFilter === "full" ? "No Full deliveries available for invoicing." :
                       deliveryFilter === "partial" ? "No Partial deliveries available for invoicing." :
                       "No deliveries available for invoicing."}
                    </div>
                  );
                }

                // Map deliveries if found
                return searchFilteredDeliveries.map((delivery: any) => {
                  const isFullDelivery = (delivery?.deliveryType || "").toLowerCase() === "full";
                  const canGenerateFull = !delivery.hasInvoice && isFullDelivery;
                  return (
                  <div key={delivery.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium ${canGenerateFull ? 'text-blue-700 cursor-pointer hover:underline' : 'text-gray-900'}`}
                          title={canGenerateFull ? 'Click to generate full invoice from this delivery' : undefined}
                          onClick={() => {
                            if (canGenerateFull) {
                              createInvoice.mutate({ deliveryId: delivery.id, invoiceType, selectedItems: undefined });
                            }
                          }}
                        >
                          {delivery.deliveryNumber} / {delivery.salesOrder?.orderNumber}
                        </p>
                        {delivery.hasInvoice && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            delivery.invoiceStatus === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                            delivery.invoiceStatus === 'Sent' ? 'bg-blue-100 text-blue-800' :
                            delivery.invoiceStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                            delivery.invoiceStatus === 'Overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {delivery.invoiceStatus || 'Invoice Created'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {delivery.salesOrder?.customer?.name} · Value {formatCurrency(delivery.salesOrder?.totalAmount)}
                      </p>
                      {delivery.hasInvoice && delivery.existingInvoice && (
                        <p className="text-xs text-blue-600 mt-1">
                          Invoice: {delivery.existingInvoice.invoiceNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`${isFullDelivery ? 'border-green-300 text-green-700 bg-green-50' : 'border-yellow-300 text-yellow-700 bg-yellow-50'}`}
                        title="Delivery Type"
                      >
                        {isFullDelivery ? 'Full' : 'Partial'}
                      </Badge>
                      <div className="flex gap-2">
                      {!delivery.hasInvoice ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDeliveryForInvoice(delivery);
                              setSelectedDeliveryItems({});
                              setShowPartialInvoiceDialog(true);
                            }}
                            disabled={createInvoice.isPending}
                            data-testid={`button-partial-invoice-${delivery.id}`}
                            className={invoiceType === "Proforma" ? "border-purple-300 text-purple-700 hover:bg-purple-50" : ""}
                          >
                            {invoiceType === "Proforma" ? "Create Proforma" : "Create"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDeliveryForInvoice(delivery);
                            setSelectedDeliveryItems({});
                            setShowPartialInvoiceDialog(true);
                          }}
                          disabled={createInvoice.isPending}
                          data-testid={`button-partial-invoice-existing-${delivery.id}`}
                          className={invoiceType === "Proforma" ? "border-purple-300 text-purple-700 hover:bg-purple-50" : ""}
                        >
                          {invoiceType === "Proforma" ? "Create Proforma" : "Create"}
                        </Button>
                      )}
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowGenerateDialog(false)} data-testid="button-close-generate-dialog">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial Invoice Generation Dialog */}
      <Dialog open={showPartialInvoiceDialog} onOpenChange={setShowPartialInvoiceDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generate Partial Invoice from Delivery</DialogTitle>
            <p className="text-sm text-gray-600">
              Select specific items from delivery {selectedDeliveryForInvoice?.deliveryNumber} to include in the invoice
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingDeliveryItems ? (
              <div className="text-center py-4">Loading delivery items...</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Delivery Type: <Badge variant="outline">{selectedDeliveryForInvoice?.deliveryType || 'Unknown'}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Object.values(selectedDeliveryItems).filter(Boolean).length} of {deliveryItems.length} items selected
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
                  {deliveryItems.map((item: any) => {
                    const isInvoiced = invoicedItems.has(item.id);
                    return (
                      <div key={item.id} className={`p-3 flex items-center space-x-3 hover:bg-gray-50 ${isInvoiced ? 'bg-gray-100 opacity-75' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedDeliveryItems[item.id] || false}
                          onChange={(e) => {
                            setSelectedDeliveryItems(prev => ({
                              ...prev,
                              [item.id]: e.target.checked
                            }));
                          }}
                          disabled={isInvoiced}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.description || 'Item'}
                            </p>
                            {isInvoiced && (
                              <Badge variant="secondary" className="text-xs">
                                Already Invoiced
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Qty: {item.deliveredQuantity || item.pickedQuantity || item.orderedQuantity}</span>
                            <span>Price: {formatCurrency(item.unitPrice)}</span>
                            <span>Total: {formatCurrency(item.totalPrice)}</span>
                            {item.barcode && <span>Barcode: {item.barcode}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {deliveryItems.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">No delivery items found.</div>
                  )}
                </div>
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPartialInvoiceDialog(false);
                      setSelectedDeliveryForInvoice(null);
                      setSelectedDeliveryItems({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const selectedItemIds = Object.entries(selectedDeliveryItems)
                        .filter(([_, selected]) => selected)
                        .map(([itemId, _]) => itemId);
                      
                      if (selectedItemIds.length === 0) {
                        toast({
                          title: "Error",
                          description: "Please select at least one item for the invoice",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      createInvoice.mutate({ 
                        deliveryId: selectedDeliveryForInvoice.id, 
                        invoiceType,
                        selectedItems: selectedItemIds
                      });
                    }}
                    disabled={createInvoice.isPending || Object.values(selectedDeliveryItems).filter(Boolean).length === 0}
                  >
                    {createInvoice.isPending ? "Generating..." : `Generate Invoice (${Object.values(selectedDeliveryItems).filter(Boolean).length} items)`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      

    </div>
  );
}

