import React, { useState } from "react";
import { useUserId } from "@/hooks/useUserId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarIcon, Package, Truck, FileText, Plus, Search, Filter, RefreshCw, CheckCircle, XCircle, Clock, Send, Eye, CreditCard, Building2, Download, Pencil, Trash2, Printer, Settings } from "lucide-react";
  // Remove this block from the top-level scope and place it inside SupplierLpoPage after:
  //   const [editLpo, setEditLpo] = useState<SupplierLpo | null>(null);
  // (Moved below inside SupplierLpoPage)
  
  // ...rest of imports...
  
  // (No code here; move the block below inside SupplierLpoPage)
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";
import type { SupplierLpo, SupplierLpoItem, Supplier } from "@shared/schema";
import EditLpoDialog from "./EditLpoDialog";

interface LpoFilters {
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const statusColors = {
  Draft: "text-gray-700 bg-gray-100 border border-gray-300",
  Sent: "text-gray-700 bg-gray-100 border border-gray-300",
  Confirmed: "text-green-700 bg-green-100 border border-green-300",
  Received: "text-purple-700 bg-purple-100 border border-purple-300",
  Cancelled: "text-red-700 bg-red-100 border border-red-300",
  Missing: "flex items-center gap-2 text-red-700 bg-red-100 border border-red-300 px-4 h-8 min-w-[100px] justify-center font-medium text-base",
};


// (Remove this duplicate/incomplete SupplierLpoPage function definition)
export default function SupplierLpoPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const userId = useUserId();
  const [filters, setFilters] = useState<LpoFilters>({});
  const [selectedLpo, setSelectedLpo] = useState<SupplierLpo | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Auto Generate state removed
  const [showBacklog, setShowBacklog] = useState(false);
  const [showCreateLpo, setShowCreateLpo] = useState(false);
  const [settingDeliveryLpoId, setSettingDeliveryLpoId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState<string>("");
  const [editLpo, setEditLpo] = useState<SupplierLpo | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [readyForLpoOrders, setReadyForLpoOrders] = useState<any[]>([]);
  const [viewingOrderItems, setViewingOrderItems] = useState<any[]>([]);

  // Mutation for editing LPO (moved from top-level)
  const editLpoMutation = useMutation({
    mutationFn: async ({ lpoId, updates }: { lpoId: string; updates: Partial<SupplierLpo> }) => {
      const response = await apiRequest("PATCH", `/api/supplier-lpos/${lpoId}`, updates);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "LPO updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
      setEditLpo(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update LPO", variant: "destructive" });
    },
  });

  const handleEditLpoSave = (updates: Partial<SupplierLpo>) => {
    if (!editLpo) return;
    editLpoMutation.mutate({ lpoId: editLpo.id, updates });
  };

  // Mutation for updating expected delivery date and status
  const updateExpectedDeliveryMutation = useMutation({
    mutationFn: async (args: { lpoId: string; expectedDeliveryDate: string; status?: string }) => {
      const { lpoId, expectedDeliveryDate, status } = args;
      const payload: any = { expectedDeliveryDate };
      if (typeof status !== 'undefined') payload.status = status;
      const response = await apiRequest("PATCH", `/api/supplier-lpos/${lpoId}`, payload);
      // If using fetch, check for ok, else check for error property
      if (response && response.ok === false) {
        let errorText = '';
        try {
          errorText = typeof response.text === 'function' ? await response.text() : 'Failed to update';
        } catch (e) {
          errorText = 'Failed to update';
        }
        throw new Error(errorText);
      }
      // If response.json exists, return parsed json, else return response
      if (typeof response.json === 'function') {
        return await response.json();
      }
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Expected delivery date updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
      setSettingDeliveryLpoId(null);
      setCalendarDate("");
      setEditLpo(null);
    },
    onError: (error: any) => {
      console.error("Delivery date update error:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update expected delivery date", 
        variant: "destructive" 
      });
    },
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch supplier LPOs with filters
  const { data: supplierLpos, isLoading } = useQuery({
    queryKey: ["/api/supplier-lpos", filters, currentPage],
    queryFn: async ({ queryKey }) => {
      const [url, filterParams, page] = queryKey as [string, typeof filters, number];
      const params = new URLSearchParams();
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      // Add pagination parameters
      params.append('limit', pageSize.toString());
      params.append('offset', ((page - 1) * pageSize).toString());
      const response = await fetch(`${url}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  // Fetch suppliers for filter dropdown
  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  // Fetch backlog data
  const { data: backlogData } = useQuery({
    queryKey: ["/api/supplier-lpos/backlog"],
    enabled: showBacklog,
  });

  // Fetch customer order backlog
  const { data: customerBacklog } = useQuery({
    queryKey: ["/api/customer-orders/backlog"],
    enabled: showBacklog,
  });

  // Fetch supplier quotes ready for LPO generation (Accepted status)
  const { data: supplierQuotes = [], isLoading: supplierQuotesLoading } = useQuery({
    queryKey: ["/api/supplier-quotes", "ready-for-lpo"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/supplier-quotes?status=Accepted&limit=50");
        if (!res.ok) {
          const errorText = await res.text();
          console.error("API Error:", res.status, errorText);
          throw new Error(`Server returned HTML instead of JSON. This usually means the API endpoint doesn't exist or there's a server error. Status: ${res.status}`);
        }
        const result = await res.json();
        return result.data || [];
      } catch (error) {
        console.error("Fetch error:", error);
        throw error;
      }
    },
  });

  // Fetch suppliers to enrich quotes with supplier names
  const { data: suppliersForEnrichment = [] } = useQuery({
    queryKey: ["/api/suppliers", "for-enrichment"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      const result = await res.json();
      return Array.isArray(result) ? result : [];
    },
  });

  // Fetch quote items when viewing a quote
  const { data: quoteItems = [] } = useQuery({
    queryKey: ["/api/supplier-quotes", "items", viewingOrder?.quoteData?.id],
    queryFn: async () => {
      if (!viewingOrder?.quoteData?.id) return [];
      const res = await fetch(`/api/supplier-quotes/${viewingOrder.quoteData.id}/items`);
      if (!res.ok) throw new Error("Failed to fetch quote items");
      return res.json();
    },
    enabled: !!viewingOrder?.quoteData?.id,
  });

  // Enrich supplier quotes with supplier information
  const enrichedSupplierQuotes = supplierQuotes.map((quote: any) => {
    const supplier = (suppliersForEnrichment as any[]).find((s: any) => s.id === quote.supplierId);
    return {
      ...quote,
      supplier: supplier || null,
    };
  });

  // Fetch existing LPOs to check which quotes have already been converted
  const { data: existingLpos = [] } = useQuery({
    queryKey: ["/api/supplier-lpos", "for-filtering"],
    queryFn: async () => {
      const res = await fetch("/api/supplier-lpos?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch LPOs");
      const result = await res.json();
      return result.data || [];
    },
  });

  // Filter out quotes that already have LPOs generated
  const quotesWithoutLpos = enrichedSupplierQuotes.filter((quote: any) => {
    // Check if this quote has already been converted to an LPO
    const hasExistingLpo = existingLpos.some((lpo: any) => {
      // Check if the LPO was created from this quote
      return lpo.sourceQuotationIds && lpo.sourceQuotationIds.includes(quote.id);
    });
    return !hasExistingLpo;
  });

  // Mutation for generating LPO from supplier quote
  const generateLpoFromQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest("POST", "/api/supplier-lpos/from-supplier-quotes", {
        quoteIds: [quoteId],
        groupBy: "supplier",
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "LPO generated successfully from supplier quote",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", "for-filtering"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", "ready-for-lpo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", "for-enrichment"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate LPO from supplier quote",
        variant: "destructive",
      });
    },
  });

  // Mutation for sending LPO to supplier
  const sendToSupplierMutation = useMutation({
    mutationFn: async (lpoId: string) => {
      const response = await apiRequest("POST", `/api/supplier-lpos/${lpoId}/send-to-supplier`, { userId });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "LPO sent to supplier successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send LPO to supplier", 
        variant: "destructive" 
      });
    },
  });


  // Mutation for approving LPO
  const approveLpoMutation = useMutation({
    mutationFn: async ({ lpoId, notes }: { lpoId: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/supplier-lpos/${lpoId}/approve`, { userId, notes });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "LPO approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to approve LPO",
        variant: "destructive" 
      });
    },
  });

  const handleFilterChange = (key: keyof LpoFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const approvalStatusColors = {
    "Pending": "text-yellow-700 bg-yellow-100 border border-yellow-300 px-3 py-1 rounded-full",
    "Approved": "text-green-700 bg-green-100 border border-green-300 px-3 py-1 rounded-full",
    "Rejected": "text-red-700 bg-red-100 border border-red-300 px-3 py-1 rounded-full",
    "Draft": "text-gray-700 bg-gray-100 border border-gray-300 px-3 py-1 rounded-full",
  };

  const getApprovalStatusBadge = (status: string) => (
    <span className={`inline-flex items-center text-sm font-medium ${approvalStatusColors[status as keyof typeof approvalStatusColors] || "text-gray-700 bg-gray-100 border border-gray-300 px-3 py-1 rounded-full"}`}>
      {status}
    </span>
  );

  // Handler for saving expected delivery date and status in EditExpectedDeliveryDialog
  const handleEditSave = async (date: string, status?: string) => {
    if (!editLpo) return;
    updateExpectedDeliveryMutation.mutate({
      lpoId: editLpo.id,
      expectedDeliveryDate: date,
      status
    });
    
    // If status is being changed to "Confirmed", prepare data for shipment tracking
    if (status === "Confirmed") {
      try {
        // Extract customer name from notes or supplier quote
        let customerName = "Unknown Customer";
        if ((editLpo as any).notes) {
          const customerMatch = (editLpo as any).notes.match(/from customer\s+([^,\s]+)/i);
          if (customerMatch && customerMatch[1]) {
            customerName = customerMatch[1];
          }
        }
        
        // Get supplier name from the LPO data
        const supplierName = (editLpo as any).supplierName || "Unknown Supplier";
        
        // Fetch LPO items for detailed information
        let lpoItems = [];
        try {
          const itemsResponse = await fetch(`/api/supplier-lpos/${editLpo.id}/items`);
          if (itemsResponse.ok) {
            const rawItems = await itemsResponse.json();
            console.log('Fetched LPO items:', rawItems);
            
            // Transform LPO items to shipment format
            lpoItems = rawItems.map((item: any) => ({
              id: item.id,
              itemDescription: item.itemDescription,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              unitOfMeasure: 'pcs', // Default unit of measure
              specialInstructions: item.specialInstructions || '',
              supplierCode: item.supplierCode,
              barcode: item.barcode
            }));
            console.log('Transformed LPO items for shipment:', lpoItems);
          }
        } catch (error) {
          console.error('Error fetching LPO items:', error);
        }
        
        // Store LPO data for shipment tracking with enhanced details
        const lpoData = {
          lpoId: editLpo.id,
          lpoNumber: editLpo.lpoNumber,
          supplierId: editLpo.supplierId, // Include supplierId for shipment tracking
          supplierName: supplierName,
          customerName: customerName,
          expectedDeliveryDate: date,
          totalAmount: editLpo.totalAmount,
          currency: editLpo.currency,
          items: lpoItems, // Include fetched items
          createdAt: editLpo.createdAt,
          status: "Confirmed",
          // Additional details for shipment tracking
          subtotal: editLpo.subtotal,
          taxAmount: editLpo.taxAmount,
          paymentTerms: editLpo.paymentTerms,
          deliveryTerms: editLpo.deliveryTerms,
          specialInstructions: editLpo.specialInstructions
        };
        
        // Store in sessionStorage for shipment tracking page
        console.log('Storing enhanced LPO data for shipment tracking:', lpoData);
        sessionStorage.setItem('confirmedLpoData', JSON.stringify(lpoData));
        console.log('Enhanced LPO data stored in sessionStorage');
        
        // Show notification about shipment tracking availability
        toast({
          title: "LPO Confirmed",
          description: "LPO has been confirmed. You can now generate shipment tracking.",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Navigate to shipment tracking page
                window.location.href = '/shipment-tracking';
              }}
            >
              Go to Shipment Tracking
            </Button>
          ),
        });
      } catch (error) {
        console.error('Error preparing LPO data for shipment tracking:', error);
        // Still show the toast even if there's an error
        toast({
          title: "LPO Confirmed",
          description: "LPO has been confirmed. You can now generate shipment tracking.",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Navigate to shipment tracking page
                window.location.href = '/shipment-tracking';
              }}
            >
              Go to Shipment Tracking
            </Button>
          ),
        });
      }
    }
  };

  // Pagination logic - API already handles pagination
  const lpoList = Array.isArray(supplierLpos?.data) ? supplierLpos.data : [];
  const totalPages = supplierLpos?.totalPages || 1;
  // Always use backend data for paginated LPOs
  const paginatedLpos = lpoList;

  // Status chip styles (icon + colored border/background) for main table
  const statusChipStyles: Record<string, string> = {
    Draft: "border-slate-300 text-slate-700 bg-slate-50",
    Sent: "border-blue-300 text-blue-700 bg-blue-50",
    Confirmed: "border-emerald-300 text-emerald-700 bg-emerald-50",
    Received: "border-purple-300 text-purple-700 bg-purple-50",
    Cancelled: "border-rose-300 text-rose-700 bg-rose-50",
    Missing: "border-red-300 text-red-700 bg-red-50"
  };
  const statusIconMap: Record<string, React.ReactNode> = {
    Draft: <FileText className="h-3.5 w-3.5" />,
    Sent: <Send className="h-3.5 w-3.5" />,
    Confirmed: <CheckCircle className="h-3.5 w-3.5" />,
    Received: <Package className="h-3.5 w-3.5" />,
    Cancelled: <XCircle className="h-3.5 w-3.5" />,
    Missing: <XCircle className="h-3.5 w-3.5" />
  };

  const renderStatusChip = (status?: string) => {
    const key = status || 'Missing';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm ${statusChipStyles[key] || statusChipStyles.Missing}`}>
        {statusIconMap[key]}
        <span>{key}</span>
      </span>
    );
  };

  // Helper: convert number to words (basic, integer part only)
  const numberToWords = (num: number) => {
    if (num === 0) return 'Zero';
    const below20 = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const thousandUnits = ['','Thousand','Million','Billion'];
    const toWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return below20[n] + ' ';
      if (n < 100) return tens[Math.floor(n/10)] + (n%10? ' ' + below20[n%10] : '') + ' ';
      if (n < 1000) return below20[Math.floor(n/100)] + ' Hundred ' + (n%100? toWords(n%100):'');
      return '';
    };
    let i = 0; let words = '';
    while (num > 0) {
      const chunk = num % 1000;
      if (chunk) {
        words = toWords(chunk) + thousandUnits[i] + ' ' + words;
      }
      num = Math.floor(num/1000); i++;
    }
    return words.trim();
  };


  // Download LPO as PDF
  const downloadLpoPdf = async (lpo: SupplierLpo & { supplierName?: string }) => {
    try {
      const response = await fetch(`/api/supplier-lpos/${lpo.id}/pdf`);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lpo-${lpo.lpoNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Downloaded",
        description: `LPO ${lpo.lpoNumber} has been downloaded successfully.`,
      });
    } catch (error: any) {
      console.error('Error downloading LPO PDF:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to download LPO PDF', 
        variant: 'destructive' 
      });
    }
  };

  // Print LPO PDF
  const printLpoPdf = async (lpo: SupplierLpo & { supplierName?: string }) => {
    try {
      const response = await fetch(`/api/supplier-lpos/${lpo.id}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) throw new Error('Popup blocked. Please allow popups for this site.');
      setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 500);
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to open print dialog', variant: 'destructive' });
    }
  };


  return (
    <div className="space-y-6 p-6">
      {/* Enhanced Card-style header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 backdrop-blur-sm relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-indigo-100/30 to-transparent rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-48 h-24 bg-gradient-to-tr from-gray-100/20 to-transparent rounded-tr-full"></div>
        
        <div className="relative px-8 py-6 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 bg-clip-text text-transparent">
                  Supplier LPO Management
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                    Step 6
                  </span>
                  <span className="text-gray-600 text-sm">
                    Manage Local Purchase Orders with suppliers
                  </span>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-base max-w-2xl leading-relaxed">
              Streamline your supplier relationships with automated LPO generation, amendment tracking, and comprehensive approval workflows
            </p>
          </div>
          
          <div className="flex gap-4 ml-8">
            {/* Auto Generate button removed */}
          </div>
        </div>
      </div>
      {/* Create Supplier LPO Dialog */}
      {showCreateLpo && (
        <Dialog open={showCreateLpo} onOpenChange={open => setShowCreateLpo(open)}>
          <DialogContent className="max-w-md w-full p-0" style={{ maxHeight: '80vh',maxWidth:'80vh' ,overflowY: 'auto' }}>
            <DialogHeader className="px-4 pt-4">
              <DialogTitle className="text-xl">New Supplier LPO</DialogTitle>
            </DialogHeader>
            <div className="px-4 pb-4">
              <CreateLpoForm 
                onClose={() => setShowCreateLpo(false)} 
                onCreated={() => {
                  setShowCreateLpo(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Auto Generate LPOs Dialog removed */}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="h-6 w-6 text-gray-600" />
              <span className="font-bold text-lg">Total LPOs</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-gray-600">
                {Array.isArray(supplierLpos?.data) ? supplierLpos.data.length : 0}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Send className="h-6 w-6 text-gray-600" />
              <span className="font-bold text-lg">Sent to Suppliers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-gray-600">
                {Array.isArray(supplierLpos?.data) ? supplierLpos.data.filter((lpo: SupplierLpo) => lpo.status === "Sent").length : 0}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <span className="font-bold text-lg">Confirmed</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-green-600">
                {Array.isArray(supplierLpos?.data) ? supplierLpos.data.filter((lpo: SupplierLpo) => lpo.status === "Confirmed").length : 0}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Settings className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-lg">Supplier LPO Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-blue-600">
                {Array.isArray(supplierLpos?.data) ? supplierLpos.data.filter((lpo: SupplierLpo) => lpo.status === "Draft" || lpo.status === "Pending").length : 0}
              </div>
              <div className="flex flex-col text-sm text-gray-500">
                <span>Pending Management</span>
                <span className="text-xs">
                  {Array.isArray(supplierLpos?.data) ? 
                    `${supplierLpos.data.filter((lpo: SupplierLpo) => lpo.status === "Draft").length} Draft, ${supplierLpos.data.filter((lpo: SupplierLpo) => lpo.status === "Pending").length} Pending` 
                    : '0 Draft, 0 Pending'
                  }
                </span>
                <span className="text-xs font-medium text-blue-600 mt-1">
                  {Array.isArray(supplierLpos?.data) ? 
                    `BHD ${supplierLpos.data
                      .filter((lpo: SupplierLpo) => lpo.status === "Draft" || lpo.status === "Pending")
                      .reduce((sum: number, lpo: SupplierLpo) => sum + (Number(lpo.totalAmount) || 0), 0)
                      .toLocaleString()} value`
                    : 'BHD 0 value'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LPOs Ready for Generation */}
      <Card className="bg-gradient-to-br from-slate-50 via-white to-slate-50 border-slate-200 shadow-lg">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-slate-800 mb-1">
                  LPOs Ready for Generation
                </CardTitle>
                <CardDescription className="text-slate-600 text-base">
                  Top 3 accepted supplier quotes ready to be converted into supplier LPOs
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                {Math.min(quotesWithoutLpos.length, 3)} of {quotesWithoutLpos.length} Ready
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-slate-600 hover:text-slate-800"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", "ready-for-lpo"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", "for-filtering"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/suppliers", "for-enrichment"] });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {supplierQuotesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="text-sm text-slate-600 mt-2">Loading supplier quotes...</p>
              </div>
            ) : quotesWithoutLpos.length > 0 ? (
              quotesWithoutLpos.slice(0, 3).map((quote: any) => (
                <div key={quote.id} className="group bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:border-emerald-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-sm"></div>
                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 text-base">{quote.quoteNumber || quote.id}</h3>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-0.5">
                            {quote.supplier?.name || 'Unknown Supplier'}
                          </Badge>
                          <Badge variant="outline" className={
                            quote.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200 text-xs px-2 py-0.5' :
                            quote.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200 text-xs px-2 py-0.5' :
                            'bg-green-50 text-green-700 border-green-200 text-xs px-2 py-0.5'
                          }>
                            {quote.priority || 'Medium'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {quote.currency || 'BHD'} {quote.totalAmount ? parseFloat(quote.totalAmount).toLocaleString() : '0.00'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {quote.supplier?.name || 'No Supplier'}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {quote.itemCount || 0} items
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-slate-600 hover:text-slate-800 h-8 px-3 text-xs"
                        onClick={() => {
                          // Extract customer name from notes if available
                          let customerName = quote.customer?.name || 'Unknown Customer';
                          if (quote.notes && !quote.customer?.name) {
                            const customerMatch = quote.notes.match(/from customer\s+([^,\n]+)/i);
                            if (customerMatch && customerMatch[1]) {
                              customerName = customerMatch[1].trim();
                            }
                          }
                          
                          setViewingOrder({
                            id: quote.quoteNumber || quote.id,
                            customer: customerName,
                            value: `${quote.currency || 'BHD'} ${quote.totalAmount ? parseFloat(quote.totalAmount).toLocaleString() : '0.00'}`,
                            supplier: quote.supplier?.name || 'No Supplier',
                            priority: quote.priority || 'Medium',
                            created: quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'Unknown',
                            status: 'Ready for LPO',
                            quoteData: quote
                          });
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button 
                        className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium px-4 py-1.5 rounded-md shadow-sm hover:shadow-md transition-all duration-200 h-8 text-xs"
                        onClick={() => {
                          generateLpoFromQuoteMutation.mutate(quote.id);
                        }}
                        disabled={generateLpoFromQuoteMutation.isPending}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {generateLpoFromQuoteMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Quotes Ready</h3>
                <p className="text-sm text-slate-600 mb-4">
                  There are currently no accepted supplier quotes ready for LPO generation.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", "ready-for-lpo"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", "for-filtering"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/suppliers", "for-enrichment"] });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            )}

            {/* More LPOs indicator */}
            {quotesWithoutLpos.length > 3 && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-600">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className="font-medium text-sm">
                    +{quotesWithoutLpos.length - 3} more quotes ready for LPO generation
                  </span>
                  {/* Auto Generate button removed */}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backlog Report */}
      {showBacklog && (
        <Tabs defaultValue="supplier-backlog" className="w-full">
          <TabsList>
            <TabsTrigger value="supplier-backlog">Supplier LPO Backlog</TabsTrigger>
            <TabsTrigger value="customer-backlog">Customer Order Backlog</TabsTrigger>
          </TabsList>
          <TabsContent value="supplier-backlog">
            <Card>
              <CardHeader>
                <CardTitle>Supplier LPO Backlog Report</CardTitle>
                <CardDescription>
                  Outstanding supplier orders requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BacklogTable data={backlogData as any[]} type="supplier" />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="customer-backlog">
            <Card>
              <CardHeader>
                <CardTitle>Customer Order Backlog Report</CardTitle>
                <CardDescription>
                  Outstanding customer orders requiring supplier fulfillment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BacklogTable data={customerBacklog as any[]} type="customer" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                <Filter className="h-4 w-4 text-gray-600" />
              </div>
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="shadow-sm flex items-center gap-1 px-2 py-0 h-6 min-h-0 text-xs"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="w-3 h-3 mr-1" />
                {showFilters ? "Hide" : "Show"} Filters
              </Button>
              {Object.keys(filters).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={filters.status || ""}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Received">Received</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="supplier-filter">Supplier</Label>
              <Select
                value={filters.supplierId || ""}
                onValueChange={(value) => handleFilterChange("supplierId", value)}
              >
                <SelectTrigger data-testid="select-supplier-filter">
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  {(Array.isArray(suppliers) ? suppliers : []).map((supplier: Supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date-from">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div>
              <Label htmlFor="date-to">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="LPO number, supplier..."
                value={filters.search || ""}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                data-testid="input-search"
                className="border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md shadow-none"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* LPOs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier LPOs</CardTitle>
          <CardDescription>
            Manage and track all Local Purchase Orders with suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table className="min-w-[1200px] w-full">
                <TableHeader>
                  <TableRow className="border-b border-gray-200 bg-gray-50">
                    <TableHead className="border-r border-gray-200 text-left font-semibold text-gray-700 px-4 py-3">LPO Number</TableHead>
                    <TableHead className="border-r border-gray-200 text-left font-semibold text-gray-700 px-4 py-3">Supplier Name</TableHead>
                    <TableHead className="border-r border-gray-200 text-center font-semibold text-gray-700 px-4 py-3">Status</TableHead>
                    <TableHead className="border-r border-gray-200 text-center font-semibold text-gray-700 px-4 py-3">LPO Date</TableHead>
                    <TableHead className="border-r border-gray-200 text-center font-semibold text-gray-700 px-4 py-3">Expected Delivery</TableHead>
                    <TableHead className="text-center font-semibold text-gray-700 px-4 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLpos.map((lpo: SupplierLpo & { supplierName?: string }) => (
                    <TableRow
                      key={lpo.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200"
                      data-testid={`row-lpo-${lpo.id}`}
                    >
                      <TableCell className="font-medium border-r border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">{lpo.lpoNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-gray-200 px-4 py-3">
                        {lpo.supplierName ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <div className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={lpo.supplierName}>
                                {lpo.supplierName}
                              </div>
                            </div>
                            {lpo.supplierContactPerson && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-[150px]" title={lpo.supplierContactPerson}>
                                Contact: {lpo.supplierContactPerson}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm italic">No supplier assigned</div>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-gray-200 px-4 py-3 text-center">
                        {renderStatusChip(lpo.status || undefined)}
                      </TableCell>
                      <TableCell className="border-r border-gray-200 px-4 py-3 text-center">
                        <div className="text-sm">
                          {lpo.lpoDate ? format(new Date(lpo.lpoDate), "MMM dd, yyyy") : "-"}
                        </div>
                        {lpo.sentToSupplierAt && (
                          <div className="text-xs text-gray-500">
                            Sent: {format(new Date(lpo.sentToSupplierAt), "MMM dd")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-gray-200 px-4 py-3 text-center">
                        {lpo.expectedDeliveryDate ? (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-semibold border border-green-200 text-xs">
                              {format(new Date(lpo.expectedDeliveryDate), "MMM dd, yyyy")}
                            </span>
                            {lpo.confirmedBySupplierAt && (
                              <span className="text-xs text-gray-500 mt-1">
                                Confirmed: {format(new Date(lpo.confirmedBySupplierAt), "MMM dd")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-500 border border-gray-200 text-xs">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <div className="flex gap-3 justify-center">
                          {/* View Button - Navigate to detail page */}
                          <Link href={`/supplier-lpo/${lpo.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={e => {
                                e.stopPropagation();
                              }}
                              data-testid={`button-view-${lpo.id}`}
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </Button>
                          </Link>
                          
                          {/* Download Button - Simple icon */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadLpoPdf(lpo);
                            }}
                            title="Download LPO PDF"
                            data-testid={`button-download-${lpo.id}`}
                          >
                            <Download className="w-4 h-4 text-gray-600" />
                          </Button>
                          {/* Print Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              printLpoPdf(lpo);
                            }}
                            title="Print LPO"
                            data-testid={`button-print-${lpo.id}`}
                          >
                            <Printer className="w-4 h-4 text-gray-600" />
                          </Button>
                          
                          
                          {/* Edit Button - Simple icon */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => {
                              e.stopPropagation();
                              setEditLpo(lpo);
                            }}
                            data-testid={`button-edit-${lpo.id}`}
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                          >
                            <Pencil className="w-4 h-4 text-gray-600" />
                          </Button>
                          
                          {/* Delete Button - Simple icon with red color */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add delete functionality here
                              console.log('Delete LPO:', lpo.id);
                            }}
                            title="Delete LPO"
                            data-testid={`button-delete-${lpo.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                          
                          {/* Approve Button - Simple icon with green color */}
                          {lpo.status === "Draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveLpoMutation.mutate({ lpoId: lpo.id });
                              }}
                              data-testid={`button-approve-${lpo.id}`}
                              title="Approve LPO"
                            >
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {/* Enhanced Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 bg-gray-50 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, lpoList.length)} of {supplierLpos?.total || lpoList.length} LPOs
                    </div>
                    <div className="text-sm text-gray-500">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="page-size" className="text-sm text-gray-600">Show:</Label>
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setCurrentPage(1); // Reset to first page when changing page size
                        }}
                      >
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-500">per page</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="h-8 px-3"
                      data-testid="button-first-page"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="h-8 w-8 p-0"
                      data-testid="button-prev-page"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="h-8 w-8 p-0"
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="h-8 w-8 p-0"
                      data-testid="button-next-page"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="h-8 px-3"
                      data-testid="button-last-page"
                    >
                      Last
                    </Button>
                    
                    {/* Go to page input */}
                    <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                      <Label htmlFor="goto-page" className="text-sm text-gray-600">Go to:</Label>
                      <Input
                        id="goto-page"
                        type="number"
                        min="1"
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                          const page = parseInt(e.target.value);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page);
                          }
                        }}
                        className="w-16 h-8 text-center"
                        data-testid="input-goto-page"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LPO Detail Dialog */}
      {selectedLpo && (
        <LpoDetailDialog
          lpo={selectedLpo}
          open={!!selectedLpo}
          onClose={() => setSelectedLpo(null)}
        />
      )}
      {editLpo && (
        <EditLpoDialog
          lpo={editLpo}
          open={!!editLpo}
          onClose={() => setEditLpo(null)}
          onSave={handleEditLpoSave}
        />
      )}

      {/* Order Details View Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={() => {
        setViewingOrder(null);
        setViewingOrderItems([]);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-slate-900">Quote #{viewingOrder?.id}</div>
                <CardDescription className="text-xs mt-0.5">Ready for LPO Generation</CardDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {viewingOrder && (
            <div className="space-y-4 py-4">
              {/* Key Information Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-900">Customer</span>
                  </div>
                  <p className="font-semibold text-sm text-blue-950 truncate" title={viewingOrder.customer}>
                    {viewingOrder.customer}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-900">Supplier</span>
                  </div>
                  <p className="font-semibold text-sm text-purple-950 truncate" title={viewingOrder.supplier}>
                    {viewingOrder.supplier}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-lg p-3 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-900">Total Value</span>
                  </div>
                  <p className="font-semibold text-sm text-emerald-950">
                    {viewingOrder.value}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-xs text-slate-600">Items:</span>
                  <span className="font-semibold text-sm text-slate-900">{quoteItems?.length || 0}</span>
                </div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-xs text-slate-600">Created:</span>
                  <span className="font-semibold text-sm text-slate-900">{viewingOrder.created}</span>
                </div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Priority:</span>
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                    viewingOrder.priority === 'High' ? 'bg-red-50 text-red-700 border-red-300' :
                    viewingOrder.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                    'bg-green-50 text-green-700 border-green-300'
                  }`}>
                    {viewingOrder.priority}
                  </Badge>
                </div>
              </div>

              {/* Notes Section */}
              {(viewingOrder.orderData?.notes || viewingOrder.quoteData?.notes) && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-amber-600" />
                    <h4 className="font-semibold text-sm text-slate-900">Notes</h4>
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap bg-white p-2.5 rounded border border-amber-100 max-h-32 overflow-y-auto">
                    {viewingOrder.orderData?.notes || viewingOrder.quoteData?.notes}
                  </div>
                </div>
              )}

              {/* Quote Items - Compact View */}
              {quoteItems && quoteItems.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 mb-2 px-1">Quote Items</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                    {quoteItems.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-md hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-slate-600">{i + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-slate-900 truncate">{item.itemDescription || item.description || `Item ${i + 1}`}</p>
                            <p className="text-xs text-slate-500 truncate">{item.specification || item.specifications || item.notes || 'No specifications'}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-semibold text-sm text-slate-900">
                            {viewingOrder.quoteData?.currency || 'BHD'} {item.unitPrice ? parseFloat(item.unitPrice).toFixed(2) : '0.00'}
                          </p>
                          <p className="text-xs text-slate-600">
                            Qty: {item.quantity || 1} {item.unitOfMeasure ? `(${item.unitOfMeasure})` : ''}
                          </p>
                          {(item.discountPercent && parseFloat(item.discountPercent || "0") > 0) || (item.vatPercent && parseFloat(item.vatPercent || "0") > 0) ? (
                            <p className="text-xs text-slate-500">
                              Disc: {parseFloat(item.discountPercent || "0").toFixed(1)}% | VAT: {parseFloat(item.vatPercent || "0").toFixed(1)}%
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Badge */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-emerald-800">Ready for LPO Generation</span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setViewingOrder(null)}
                  className="px-4"
                >
                  Close
                </Button>
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4"
                  onClick={() => {
                    if (viewingOrder.quoteData?.id) {
                      generateLpoFromQuoteMutation.mutate(viewingOrder.quoteData.id);
                      setViewingOrder(null);
                    }
                  }}
                  disabled={generateLpoFromQuoteMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {generateLpoFromQuoteMutation.isPending ? "Generating..." : "Generate LPO"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Auto Generate LPOs Form Component removed

// Backlog Table Component
function BacklogTable({ data, type }: { data: any[]; type: "supplier" | "customer" }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No pending items found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type === "supplier" ? "LPO Number" : "Order Number"}</TableHead>
          <TableHead>{type === "supplier" ? "Supplier" : "Customer"}</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Days Pending</TableHead>
          <TableHead>Total Amount</TableHead>
          <TableHead>Items</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.lpoId || item.orderId}>
            <TableCell className="font-medium">
              {item.lpoNumber || item.orderNumber}
            </TableCell>
            <TableCell>{item.supplierName || item.customerName}</TableCell>
            <TableCell>
              <Badge className={statusColors[item.status as keyof typeof statusColors]}>
                {item.status}
              </Badge>
            </TableCell>
            <TableCell>
              {format(new Date(item.lpoDate || item.orderDate), "MMM dd, yyyy")}
            </TableCell>
            <TableCell>
              <span className={`font-medium ${Number(item.daysPending) > 7 ? "text-red-600" : "text-gray-600"}`}>
                {item.daysPending} days
              </span>
            </TableCell>
            <TableCell>
              ${Number(item.totalAmount || 0).toLocaleString()}
            </TableCell>
            <TableCell>
              {item.itemCount} items
              {item.pendingItems && ` (${item.pendingItems} pending)`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// LPO Detail Dialog Component
function LpoDetailDialog({ 
  lpo, 
  open, 
  onClose 
}: { 
  lpo: SupplierLpo; 
  open: boolean; 
  onClose: () => void; 
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch detailed LPO data
  const { data: detailedLpo, isLoading: lpoLoading } = useQuery({
    queryKey: ["/api/supplier-lpos", lpo.id],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-lpos/${lpo.id}`);
      if (!response.ok) throw new Error('Failed to fetch LPO details');
      return response.json();
    },
    enabled: open,
  });

  // Fetch LPO items
  const { data: lpoItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/supplier-lpos", lpo.id, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-lpos/${lpo.id}/items`);
      if (!response.ok) throw new Error('Failed to fetch LPO items');
      return response.json();
    },
    enabled: open,
  });

  // Fetch supplier details
  const { data: supplier } = useQuery({
    queryKey: ["/api/suppliers", detailedLpo?.supplierId],
    queryFn: async () => {
      if (!detailedLpo?.supplierId) return null;
      const response = await fetch(`/api/suppliers/${detailedLpo.supplierId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: open && !!detailedLpo?.supplierId,
  });

  // Fetch customer details from source sales orders
  const { data: customerDetails } = useQuery({
    queryKey: ["/api/customers", "from-lpo", lpo.id],
    queryFn: async () => {
      if (!detailedLpo?.sourceSalesOrderIds || !Array.isArray(detailedLpo.sourceSalesOrderIds) || detailedLpo.sourceSalesOrderIds.length === 0) {
        return null;
      }
      
      // Fetch the first sales order to get customer details
      const firstSalesOrderId = detailedLpo.sourceSalesOrderIds[0];
      const response = await fetch(`/api/sales-orders/${firstSalesOrderId}`);
      if (!response.ok) return null;
      const salesOrder = await response.json();
      return salesOrder.customer || null;
    },
    enabled: open && !!detailedLpo?.sourceSalesOrderIds && Array.isArray(detailedLpo.sourceSalesOrderIds) && detailedLpo.sourceSalesOrderIds.length > 0,
  });

  // Fetch original sales order items from source sales orders
  const { data: originalItems } = useQuery({
    queryKey: ["/api/sales-orders", "items", "from-lpo", lpo.id],
    queryFn: async () => {
      if (!detailedLpo?.sourceSalesOrderIds || !Array.isArray(detailedLpo.sourceSalesOrderIds) || detailedLpo.sourceSalesOrderIds.length === 0) {
        return [];
      }
      
      // Fetch items from all source sales orders
      const allItems = [];
      for (const salesOrderId of detailedLpo.sourceSalesOrderIds) {
        const response = await fetch(`/api/sales-orders/${salesOrderId}/items`);
        if (response.ok) {
          const items = await response.json();
          if (Array.isArray(items)) {
            allItems.push(...items.map((item: any) => ({
              ...item,
              sourceSalesOrderId: salesOrderId
            })));
          }
        }
      }
      return allItems;
    },
    enabled: open && !!detailedLpo?.sourceSalesOrderIds && Array.isArray(detailedLpo.sourceSalesOrderIds) && detailedLpo.sourceSalesOrderIds.length > 0,
  });

  // Fetch source supplier quotes if LPO was created from quotes
  const { data: sourceQuotes } = useQuery({
    queryKey: ["/api/supplier-quotes", "from-lpo", lpo.id],
    queryFn: async () => {
      if (!detailedLpo?.sourceQuotationIds || !Array.isArray(detailedLpo.sourceQuotationIds) || detailedLpo.sourceQuotationIds.length === 0) {
        return [];
      }
      
      // Fetch all source supplier quotes
      const allQuotes = [];
      for (const quoteId of detailedLpo.sourceQuotationIds) {
        const response = await fetch(`/api/supplier-quotes/${quoteId}`);
        if (response.ok) {
          const quote = await response.json();
          allQuotes.push(quote);
        }
      }
      return allQuotes;
    },
    enabled: open && !!detailedLpo?.sourceQuotationIds && Array.isArray(detailedLpo.sourceQuotationIds) && detailedLpo.sourceQuotationIds.length > 0,
  });

  // Fetch supplier quote items to get original item descriptions
  const { data: sourceQuoteItems } = useQuery({
    queryKey: ["/api/supplier-quotes", "items", "from-lpo", lpo.id],
    queryFn: async () => {
      if (!detailedLpo?.sourceQuotationIds || !Array.isArray(detailedLpo.sourceQuotationIds) || detailedLpo.sourceQuotationIds.length === 0) {
        return [];
      }
      
      // Fetch items from all source supplier quotes
      const allItems = [];
      for (const quoteId of detailedLpo.sourceQuotationIds) {
        const response = await fetch(`/api/supplier-quotes/${quoteId}/items`);
        if (response.ok) {
          const items = await response.json();
          if (Array.isArray(items)) {
            allItems.push(...items.map((item: any) => ({
              ...item,
              sourceQuoteId: quoteId
            })));
          }
        }
      }
      return allItems;
    },
    enabled: open && !!detailedLpo?.sourceQuotationIds && Array.isArray(detailedLpo.sourceQuotationIds) && detailedLpo.sourceQuotationIds.length > 0,
  });

  const lpoData = detailedLpo || lpo;

  // Pagination logic for items
  const items = Array.isArray(lpoItems) ? lpoItems : [];
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);

  // Reset pagination when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setCurrentPage(1);
    }
  }, [open]);

  if (lpoLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">LPO Details</div>
              <div className="text-lg text-gray-600">{lpoData.lpoNumber}</div>
              {(supplier || lpoData.supplierName) && (
                <div className="text-sm text-gray-500 mt-1">
                  Supplier: <span className="font-medium text-gray-700">{supplier?.name || lpoData.supplierName}</span>
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <div className="mt-1">
                  {lpoData.status && (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[lpoData.status as keyof typeof statusColors] || "text-gray-700 bg-gray-100 border border-gray-300"}`}>
                      {lpoData.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">LPO Date</Label>
                <div className="mt-1 text-sm font-medium">
                  {lpoData.lpoDate ? format(new Date(lpoData.lpoDate), "MMM dd, yyyy") : "Not set"}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Expected Delivery</Label>
                <div className="mt-1 text-sm font-medium">
                  {lpoData.expectedDeliveryDate ? format(new Date(lpoData.expectedDeliveryDate), "MMM dd, yyyy") : "Not set"}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Version</Label>
                <div className="mt-1 text-sm font-medium">v{lpoData.version || 1}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Source</Label>
                <div className="mt-1 text-sm font-medium">
                  {lpoData.sourceType || "Manual"}
                  {lpoData.sourceType === "SupplierQuote" && sourceQuotes && sourceQuotes.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600">
                      From {sourceQuotes.length} quote{sourceQuotes.length > 1 ? 's' : ''}: {sourceQuotes.map((q: any) => q.quoteNumber).join(', ')}
                    </div>
                  )}
                  {lpoData.sourceType === "SalesOrder" && lpoData.sourceSalesOrderIds && lpoData.sourceSalesOrderIds.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600">
                      From {lpoData.sourceSalesOrderIds.length} sales order{lpoData.sourceSalesOrderIds.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Information */}
          {(supplier || lpoData.supplierName) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Supplier Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Supplier Name</Label>
                    <div className="mt-1 text-sm font-medium">{supplier?.name || lpoData.supplierName || "Not specified"}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Contact Person</Label>
                    <div className="mt-1 text-sm font-medium">{supplier.contactPerson || "Not specified"}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <div className="mt-1 text-sm font-medium">{supplier.email || "Not specified"}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Phone</Label>
                    <div className="mt-1 text-sm font-medium">{supplier.phone || "Not specified"}</div>
                  </div>
                  {supplier.address && (
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-500">Address</Label>
                      <div className="mt-1 text-sm font-medium">{supplier.address}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          {customerDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <div className="mt-1 text-sm font-medium">{customerDetails.name || customerDetails.companyName || "Not specified"}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Contact Person</Label>
                    <div className="mt-1 text-sm font-medium">{customerDetails.contactPerson || "Not specified"}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <div className="mt-1 text-sm font-medium">{customerDetails.email || "Not specified"}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Phone</Label>
                    <div className="mt-1 text-sm font-medium">{customerDetails.phone || "Not specified"}</div>
                  </div>
                  {customerDetails.address && (
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-500">Address</Label>
                      <div className="mt-1 text-sm font-medium">{customerDetails.address}</div>
                    </div>
                  )}
                  {customerDetails.vatNumber && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">VAT Number</Label>
                      <div className="mt-1 text-sm font-medium">{customerDetails.vatNumber}</div>
                    </div>
                  )}
                  {customerDetails.trnNumber && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">TRN Number</Label>
                      <div className="mt-1 text-sm font-medium">{customerDetails.trnNumber}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Source Quotes Information */}
          {sourceQuotes && sourceQuotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Source Quotes Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sourceQuotes.map((quote: any, index: number) => (
                    <div key={quote.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Quote Number</Label>
                          <div className="mt-1 text-sm font-medium">{quote.quoteNumber}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Status</Label>
                          <div className="mt-1">
                            <Badge variant="outline" className={statusColors[quote.status as keyof typeof statusColors] || "bg-gray-100"}>
                              {quote.status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Total Amount</Label>
                          <div className="mt-1 text-sm font-medium">
                            {quote.currency} {quote.totalAmount ? parseFloat(quote.totalAmount).toLocaleString() : '0'}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Valid Until</Label>
                          <div className="mt-1 text-sm font-medium">
                            {quote.validUntil ? format(new Date(quote.validUntil), 'MMM dd, yyyy') : 'N/A'}
                          </div>
                        </div>
                        {quote.paymentTerms && (
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Payment Terms</Label>
                            <div className="mt-1 text-sm font-medium">{quote.paymentTerms}</div>
                          </div>
                        )}
                        {quote.deliveryTerms && (
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Delivery Terms</Label>
                            <div className="mt-1 text-sm font-medium">{quote.deliveryTerms}</div>
                          </div>
                        )}
                        {quote.notes && (
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-gray-500">Notes</Label>
                            <div className="mt-1 text-sm font-medium">{quote.notes}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <Label className="text-sm font-medium text-gray-600">Subtotal (Before Tax)</Label>
                    <div className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(Number(lpoData.subtotal || 0), lpoData.currency)}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <Label className="text-sm font-medium text-gray-600">VAT Amount</Label>
                    <div className="text-2xl font-bold text-red-600 mt-2">
                      {formatCurrency(Number(lpoData.taxAmount || 0), lpoData.currency)}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 shadow-sm">
                    <Label className="text-sm font-medium text-blue-600">Total Amount (Including VAT)</Label>
                    <div className="text-2xl font-bold text-blue-600 mt-2">
                      {formatCurrency(Number(lpoData.totalAmount || 0), lpoData.currency)}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Tax Calculation Breakdown</p>
                    <p className="text-sm text-gray-700">
                      Subtotal: {formatCurrency(Number(lpoData.subtotal || 0), lpoData.currency)} + 
                      VAT: {formatCurrency(Number(lpoData.taxAmount || 0), lpoData.currency)} = 
                      Total: {formatCurrency(Number(lpoData.totalAmount || 0), lpoData.currency)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Currency: {lpoData.currency || "BHD"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms and Conditions */}
          {(lpoData.paymentTerms || lpoData.deliveryTerms || lpoData.termsAndConditions || lpoData.specialInstructions) && (
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lpoData.paymentTerms && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Payment Terms</Label>
                    <div className="mt-1 text-sm">{lpoData.paymentTerms}</div>
                  </div>
                )}
                {lpoData.deliveryTerms && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Delivery Terms</Label>
                    <div className="mt-1 text-sm">{lpoData.deliveryTerms}</div>
                  </div>
                )}
                {lpoData.termsAndConditions && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Terms and Conditions</Label>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{lpoData.termsAndConditions}</div>
                  </div>
                )}
                {lpoData.specialInstructions && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Special Instructions</Label>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{lpoData.specialInstructions}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

         
          

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  LPO Items ({itemsLoading ? "Loading..." : items.length})
                </CardTitle>
                {items.length > itemsPerPage && (
                  <div className="text-sm text-gray-500">
                    Showing {startIndex + 1}-{Math.min(endIndex, items.length)} of {items.length} items
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No items have been added to this LPO yet</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto max-w-full">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Disc %</TableHead>
                          <TableHead>Disc Amt</TableHead>
                          <TableHead>VAT %</TableHead>
                          <TableHead>VAT Amt</TableHead>
                          <TableHead>Totalamount</TableHead>
                          <TableHead>Supplier Code</TableHead>
                          <TableHead>Barcode</TableHead>
                          <TableHead>Urgency</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedItems.map((item: any, index: number) => {
                          // Find the original item from supplier quote if available
                          const originalQuoteItem = sourceQuoteItems?.find((qi: any) => 
                            qi.id === item.sourceQuoteItemId || 
                            (qi.itemDescription && qi.itemDescription === item.originalItemDescription) ||
                            (qi.supplierCode && item.supplierCode && qi.supplierCode === item.supplierCode) ||
                            (qi.barcode && item.barcode && qi.barcode === item.barcode)
                          );

                          // Find the original item from sales order if available
                          const originalSalesOrderItem = originalItems?.find((soi: any) => 
                            soi.id === item.sourceSalesOrderItemId || 
                            (soi.itemDescription && soi.itemDescription === item.originalItemDescription) ||
                            (soi.supplierCode && item.supplierCode && soi.supplierCode === item.supplierCode) ||
                            (soi.barcode && item.barcode && soi.barcode === item.barcode)
                          );

                          // Determine the best description to show - priority order
                          let displayDescription = "Item Description Not Available";
                          let descriptionSource = "";
                          
                          if (originalQuoteItem?.itemDescription) {
                            displayDescription = originalQuoteItem.itemDescription;
                            descriptionSource = "quote";
                          } else if (originalSalesOrderItem?.itemDescription) {
                            displayDescription = originalSalesOrderItem.itemDescription;
                            descriptionSource = "salesOrder";
                          } else if (item.originalItemDescription) {
                            displayDescription = item.originalItemDescription;
                            descriptionSource = "original";
                          } else if (item.itemDescription && 
                                     item.itemDescription !== "Auto-generated from Sales Order" && 
                                     item.itemDescription !== "N/A" &&
                                     item.itemDescription.trim() !== "") {
                            displayDescription = item.itemDescription;
                            descriptionSource = "current";
                          } else if (item.supplierCode || item.barcode) {
                            displayDescription = `${item.supplierCode || 'No Code'} - ${item.barcode || 'No Barcode'}`;
                            descriptionSource = "codes";
                          }
                          
                          // Calculate values for display
                          const qty = Number(item.quantity || 0);
                          const unitCost = Number(item.unitCost || 0);
                          const grossAmount = qty * unitCost;
                          const discountAmount = Number(item.discountAmount || 0);
                          const discountPercent = Number(item.discountPercent || 0);
                          const calculatedDiscount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
                          const netAmount = Math.max(0, grossAmount - calculatedDiscount);
                          const vatAmount = Number(item.vatAmount || 0);
                          const vatPercent = Number(item.vatPercent || 0);
                          const calculatedVat = vatAmount > 0 ? vatAmount : (netAmount * vatPercent / 100);
                          const totalAmount = netAmount + calculatedVat;
                          
                          return (
                            <TableRow key={item.id || (startIndex + index)}>
                              <TableCell className="max-w-xs">
                                <div className="font-medium">{displayDescription}</div>
                                {descriptionSource === "quote" && (
                                    <div className="text-xs text-blue-600 mt-1">
                                    ✓ From Supplier Quote
                                  </div>
                                )}
                                {descriptionSource === "salesOrder" && (
                                  <div className="text-xs text-green-600 mt-1">
                                    ✓ From Sales Order
                                  </div>
                                )}
                                {descriptionSource === "codes" && (
                                  <div className="text-xs text-amber-600 mt-1">
                                    ⚠ Description unavailable - showing codes
                                  </div>
                                )}
                                {item.specialInstructions && (
                                  <div className="text-xs text-gray-500 mt-1 border-t pt-1">
                                    <span className="font-medium">Instructions:</span> {item.specialInstructions}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">{qty}</TableCell>
                              <TableCell className="text-right">
                                {lpoData.currency} {unitCost.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-center">
                                {discountPercent.toFixed(0)}%
                              </TableCell>
                              <TableCell className="text-right">
                                {lpoData.currency} {calculatedDiscount.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-center">
                                {vatPercent.toFixed(0)}%
                              </TableCell>
                              <TableCell className="text-right">
                                {lpoData.currency} {calculatedVat.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {lpoData.currency} {totalAmount.toFixed(3)}
                              </TableCell>
                              <TableCell>{item.supplierCode || "N/A"}</TableCell>
                              <TableCell>{item.barcode || "N/A"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  item.urgency === 'Urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                                  item.urgency === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  item.urgency === 'Normal' ? 'bg-green-50 text-green-700 border-green-200' :
                                  'bg-gray-50 text-gray-700 border-gray-200'
                                }>
                                  {item.urgency || 'Normal'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[item.deliveryStatus as keyof typeof statusColors] || "text-white"}>
                                  {item.deliveryStatus || "Pending"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                          Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="dialog-page-size" className="text-sm text-gray-600">Show:</Label>
                          <Select
                            value={itemsPerPage.toString()}
                            onValueChange={(value) => {
                              setItemsPerPage(Number(value));
                              setCurrentPage(1); // Reset to first page when changing page size
                            }}
                          >
                            <SelectTrigger className="w-16 h-7">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-gray-500">per page</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="h-8 w-8 p-0"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </Button>
                        
                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="h-8 w-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="h-8 w-8 p-0"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Button>
                        
                        {/* Go to page input */}
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                          <Label htmlFor="dialog-goto-page" className="text-sm text-gray-600">Go to:</Label>
                          <Input
                            id="dialog-goto-page"
                            type="number"
                            min="1"
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                              const page = parseInt(e.target.value);
                              if (page >= 1 && page <= totalPages) {
                                setCurrentPage(page);
                              }
                            }}
                            className="w-12 h-7 text-center text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Timeline and Status History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline & Status History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <div className="font-medium">Created</div>
                    <div className="text-sm text-gray-500">
                      {lpoData.createdAt ? format(new Date(lpoData.createdAt), "MMM dd, yyyy 'at' h:mm a") : "Unknown"}
                    </div>
                  </div>
                </div>
                
                {lpoData.sentToSupplierAt && (
                  <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <div className="font-medium">Sent to Supplier</div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(lpoData.sentToSupplierAt), "MMM dd, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  </div>
                )}

                {lpoData.confirmedBySupplierAt && (
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-medium">Confirmed by Supplier</div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(lpoData.confirmedBySupplierAt), "MMM dd, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  </div>
                )}

                {lpoData.approvedAt && (
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-medium">Approved</div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(lpoData.approvedAt), "MMM dd, yyyy 'at' h:mm a")}
                        {lpoData.approvalNotes && (
                          <div className="text-xs text-gray-400 mt-1">
                            Notes: {lpoData.approvalNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div>
                    <div className="font-medium">Last Updated</div>
                    <div className="text-sm text-gray-500">
                      {lpoData.updatedAt ? format(new Date(lpoData.updatedAt), "MMM dd, yyyy 'at' h:mm a") : "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// Create LPO Form Component
function CreateLpoForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({
    supplierId: "",
    lpoDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: "",
    requestedDeliveryDate: "",
    paymentTerms: "",
    deliveryTerms: "",
    termsAndConditions: "",
    specialInstructions: "",
    requiresApproval: false,
    currency: "BHD",
    items: [] as Array<{
      itemId: string;
      supplierCode: string;
      barcode: string;
      itemDescription: string;
      quantity: number;
      unitCost: number;
      urgency: string;
      specialInstructions: string;
    }>
  });
  const [showAddItem, setShowAddItem] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers and items
  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const { data: items } = useQuery({
    queryKey: ["/api/items"],
  });

  // Create LPO mutation
  const createLpoMutation = useMutation({
    mutationFn: async () => {
      const lpoData = {
        ...formData,
        lpoNumber: `LPO-${Date.now()}`, // Generate LPO number
        createdBy: "current-user-id",
        subtotal: formData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0),
        taxAmount: 0, // Calculate tax if needed
        totalAmount: formData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0),
        sourceType: "Manual",
        version: 1,
      };

      const response = await apiRequest("POST", "/api/supplier-lpos", lpoData);
      return response;
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "LPO created successfully" 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
      onClose();
      if (onCreated) onCreated();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create LPO",
        variant: "destructive" 
      });
    },
  });

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        itemId: "",
        supplierCode: "",
        barcode: "",
        itemDescription: "",
        quantity: 1,
        unitCost: 0,
        urgency: "Normal",
        specialInstructions: ""
      }]
    }));
    setShowAddItem(true);
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the LPO",
        variant: "destructive"
      });
      return;
    }
    createLpoMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="supplier">Supplier *</Label>
          <Select
            value={formData.supplierId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(suppliers)
                ? suppliers.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))
                : []
              }
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="lpoDate">LPO Date *</Label>
          <Input
            id="lpoDate"
            type="date"
            value={formData.lpoDate}
            onChange={(e) => setFormData(prev => ({ ...prev, lpoDate: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
          <Input
            id="expectedDeliveryDate"
            type="date"
            value={formData.expectedDeliveryDate}
            onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="requestedDeliveryDate">Requested Delivery Date</Label>
          <Input
            id="requestedDeliveryDate"
            type="date"
            value={formData.requestedDeliveryDate}
            onChange={(e) => setFormData(prev => ({ ...prev, requestedDeliveryDate: e.target.value }))}
          />
        </div>
      </div>

      {/* Financial Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BHD">BHD</SelectItem>
              <SelectItem value="BHD">BHD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="QAR">QAR</SelectItem>
              <SelectItem value="AED">AED</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="requiresApproval"
            checked={formData.requiresApproval}
            onChange={(e) => setFormData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
          />
          <Label htmlFor="requiresApproval">Requires Approval</Label>
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentTerms">Payment Terms</Label>
          <Input
            id="paymentTerms"
            value={formData.paymentTerms}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
            placeholder="e.g., Net 30 days"
          />
        </div>
        <div>
          <Label htmlFor="deliveryTerms">Delivery Terms</Label>
          <Input
            id="deliveryTerms"
            value={formData.deliveryTerms}
            onChange={(e) => setFormData(prev => ({ ...prev, deliveryTerms: e.target.value }))}
            placeholder="e.g., FOB Destination"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
        <textarea
          id="termsAndConditions"
          className="w-full p-2 border rounded-md"
          rows={3}
          value={formData.termsAndConditions}
          onChange={(e) => setFormData(prev => ({ ...prev, termsAndConditions: e.target.value }))}
          placeholder="Enter terms and conditions..."
        />
      </div>

      <div>
        <Label htmlFor="specialInstructions">Special Instructions</Label>
        <textarea
          id="specialInstructions"
          className="w-full p-2 border rounded-md"
          rows={3}
          value={formData.specialInstructions}
          onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
          placeholder="Enter any special instructions..."
        />
      </div>

      {/* Items Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Label className="text-lg font-semibold">Items</Label>
          <Button type="button" onClick={addItem} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        {formData.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
            No items added yet. Click "Add Item" to start adding products to this LPO.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Item {index + 1}</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Item</Label>
                      <Select
                        value={item.itemId}
                        onValueChange={(value) => {
                          updateItem(index, "itemId", value);
                          const selectedItem = (Array.isArray(items) ? items : []).find((i: any) => i.id === value);
                          if (selectedItem) {
                            updateItem(index, "itemDescription", selectedItem.description);
                            updateItem(index, "barcode", selectedItem.barcode || "");
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Array.isArray(items) ? items : []).map((item: any) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.description} - {item.supplierCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Supplier Code</Label>
                      <Input
                        value={item.supplierCode}
                        onChange={(e) => updateItem(index, "supplierCode", e.target.value)}
                        placeholder="Enter supplier code"
                        required
                      />
                    </div>
                    <div>
                      <Label>Barcode</Label>
                      <Input
                        value={item.barcode}
                        onChange={(e) => updateItem(index, "barcode", e.target.value)}
                        placeholder="Enter barcode"
                        required
                      />
                    </div>
                    <div>
                      <Label>Urgency</Label>
                      <Select
                        value={item.urgency}
                        onValueChange={(value) => updateItem(index, "urgency", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitCost}
                        onChange={(e) => updateItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Item Description</Label>
                    <textarea
                      className="w-full p-2 border rounded-md"
                      rows={2}
                      value={item.itemDescription}
                      onChange={(e) => updateItem(index, "itemDescription", e.target.value)}
                      placeholder="Enter item description"
                      required
                    />
                  </div>
                  <div>
                    <Label>Special Instructions</Label>
                    <textarea
                      className="w-full p-2 border rounded-md"
                      rows={2}
                      value={item.specialInstructions}
                      onChange={(e) => updateItem(index, "specialInstructions", e.target.value)}
                      placeholder="Enter special instructions for this item"
                    />
                  </div>
                  <div className="text-right font-semibold">
                    Total: {formData.currency} {(item.quantity * item.unitCost).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {formData.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="text-lg font-semibold">
                  {formData.currency} {formData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tax</div>
                <div className="text-lg font-semibold">
                  {formData.currency} 0.00
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total</div>
                <div className="text-lg font-semibold text-blue-600">
                  {formData.currency} {formData.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="border-green-600 text-green-600 bg-green-50 hover:bg-green-100"
          disabled={createLpoMutation.isPending || formData.items.length === 0}
        >
          {createLpoMutation.isPending ? "Creating..." : "Create LPO"}
        </Button>
      </div>
    </form>
  );
}

function EditExpectedDeliveryDialog({ lpo, open, onClose, onSave }: {
  lpo: SupplierLpo;
  open: boolean;
  onClose: () => void;
  onSave: (date: string, status?: string) => void;
}) {
  const [date, setDate] = useState(
    lpo.expectedDeliveryDate
      ? (lpo.expectedDeliveryDate instanceof Date
          ? lpo.expectedDeliveryDate.toISOString().split('T')[0]
          : String(lpo.expectedDeliveryDate).split('T')[0])
      : ""
  );
  const [status, setStatus] = useState(lpo.status || "");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!date) return;
    setSaving(true);
    onSave(date, status);
  };

  // Reset saving state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSaving(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Expected Delivery Date & Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Expected Delivery Date</Label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border rounded px-2 py-1 w-full"
              min={new Date().toISOString().split('T')[0]}
              data-testid={`edit-calendar-expected-delivery-${lpo.id}`}
            />
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={status}
              onChange={e => setStatus(e.target.value)}
              data-testid={`edit-status-select-${lpo.id}`}
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!date || saving}
              className="border-green-600 text-green-600 bg-green-50 hover:bg-green-100"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}