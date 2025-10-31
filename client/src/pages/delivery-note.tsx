import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Search, Filter, FileText, Truck, Package, 
  AlertCircle, CheckCircle, Clock, Copy,
  Edit, Trash2, Eye, Download, Upload, FileCheck, ClipboardList,
  QrCode, MapPin, User, Calendar, RefreshCw, History, Printer
} from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import { SYSTEM_USER_ID } from "@shared/utils/uuid";
import { useUserId } from "@/hooks/useUserId";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SalesOrder, SalesOrderItem, Customer } from "@shared/schema";

interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  salesOrderId: string;
  salesOrder?: SalesOrder & { customer?: Customer };
  deliveryDate: string | null;
  status: "Pending" | "Partial" | "Complete" | "Cancelled";
  deliveryType: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  deliveryDocument: string | null;
  deliveryDocumentName: string | null;
  deliveryDocumentSize: number | null;
  pickingStartedBy: string | null;
  pickingStartedAt: string | null;
  pickingCompletedBy: string | null;
  pickingCompletedAt: string | null;
  pickingNotes: string | null;
  deliveryConfirmedBy: string | null;
  deliveryConfirmedAt: string | null;
  deliverySignature: string | null;
  trackingNumber: string | null;
  carrierName: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: DeliveryItem[];
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

export default function DeliveryNote() {
  // Print handler for delivery note
  // ...existing code...
  const [, navigate] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  
  // Utility function to calculate delivery completion percentage
  const calculateDeliveryCompletion = (items: any[]) => {
    // Prefer cumulative remaining if available; derive delivered as ordered - remaining
    const totals = items.reduce(
      (acc, item) => {
        const ordered = Number(item.orderedQuantity || 0);
        const hasRemaining = item.remainingQuantity !== undefined && item.remainingQuantity !== null;
        const remaining = hasRemaining ? Math.max(0, Number(item.remainingQuantity)) : Math.max(0, ordered - Number(item.deliveredQuantity || 0));
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
  // Page size is now dynamic to allow a "Show All" toggle (sets a large size)
  const [pageSize, setPageSize] = useState(15);
  // Separate search term for delivery notes table
  const [deliverySearchTerm, setDeliverySearchTerm] = useState("");
  // Independent search term for sales order selection inside the create dialog
  const [salesOrderSearchTerm, setSalesOrderSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNote | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // When true, after selecting from quick action we will prefill full remaining quantities
  const [prefillAllRemaining, setPrefillAllRemaining] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPickingDialog, setShowPickingDialog] = useState(false);
  const [showConfirmDeliveryDialog, setShowConfirmDeliveryDialog] = useState(false);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [showDeliveryHistoryDialog, setShowDeliveryHistoryDialog] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState<any[]>([]);
  const [deliveryItemsLoading, setDeliveryItemsLoading] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedDeliveryQtyByItem, setEditedDeliveryQtyByItem] = useState<Record<string, number>>({});
  const [isSavingItemChanges, setIsSavingItemChanges] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState<any[]>([]);
  const [deliveryHistoryLoading, setDeliveryHistoryLoading] = useState(false);
  // Function to refresh selected delivery note data
  const refreshSelectedDeliveryNote = async (deliveryId: string) => {
    try {
      const response = await fetch(`/api/delivery-notes/${deliveryId}`);
      if (response.ok) {
        const updatedDelivery = await response.json();
        setSelectedDeliveryNote(updatedDelivery);
        return updatedDelivery;
      }
    } catch (error) {
      console.error('Error refreshing delivery note:', error);
    }
    return null;
  };

  // Auto-open create dialog if redirected from detail page
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("createDeliveryFromDetail");
      if (raw) {
        localStorage.removeItem("createDeliveryFromDetail");
        const payload = JSON.parse(raw);
        if (payload && payload.salesOrderId) {
          setSelectedSalesOrderId(payload.salesOrderId as string);
          setPrefillAllRemaining(true);
          setShowCreateDialog(true);
        }
      }
    } catch {}
  }, []);

  // Function to fetch delivery history
  const fetchDeliveryHistory = async (deliveryId: string) => {
    setDeliveryHistoryLoading(true);
    try {
      const response = await fetch(`/api/deliveries/${deliveryId}/history?scope=customer`);
      if (response.ok) {
        const data = await response.json();
        setDeliveryHistory(data);
      } else {
        // If no history endpoint exists, create mock data based on current delivery
        const mockHistory = deliveryItems.map((item, index) => ({
          id: `history-${index}`,
          deliveryId: deliveryId,
          salesOrderItemId: item.salesOrderItemId,
          itemId: item.itemId,
          deliveryNumber: selectedDeliveryNote?.deliveryNumber || 'N/A',
          itemDescription: item.description,
          orderedQuantity: item.orderedQuantity || 0,
          deliveredQuantity: item.deliveredQuantity || 0,
          remainingQuantity: item.remainingQuantity || ((item.orderedQuantity || 0) - (item.deliveredQuantity || 0)),
          deliveryType: selectedDeliveryNote?.deliveryType || 'Full',
          deliveryStatus: selectedDeliveryNote?.status || 'Pending',
          deliveryDate: selectedDeliveryNote?.deliveryDate,
          deliveredBy: selectedDeliveryNote?.deliveryConfirmedBy,
          notes: `Delivery item ${index + 1}`,
          createdAt: selectedDeliveryNote?.createdAt || new Date().toISOString()
        }));
        setDeliveryHistory(mockHistory);
      }
    } catch (error) {
      console.error('Error fetching delivery history:', error);
      setDeliveryHistory([]);
    } finally {
      setDeliveryHistoryLoading(false);
    }
  };

  // Fetch DELIVERY ITEMS when details dialog opens and selectedDeliveryNote changes
  useEffect(() => {
    const fetchDeliveryItems = async () => {
      setDeliveryItems([]);
      setDeliveryItemsLoading(true);
      try {
        if (selectedDeliveryNote?.id) {
          console.log('Fetching delivery items for delivery ID:', selectedDeliveryNote.id);
          const response = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`);
          if (response.ok) {
            const data = await response.json();
            console.log('Delivery items fetched:', data);
            console.log('Number of items:', data.length);
            setDeliveryItems(data);
            const init: Record<string, number> = {};
            for (const it of data) init[it.id] = Number(it.deliveredQuantity || it.pickedQuantity || it.orderedQuantity || 0);
            setEditedDeliveryQtyByItem(init);
          } else {
            console.error('Failed to fetch delivery items:', response.status, response.statusText);
          }
        }
      } catch (err) {
        console.error('Error fetching delivery items:', err);
      }
      setDeliveryItemsLoading(false);
    };
    if (showDetailsDialog && selectedDeliveryNote?.id) {
      fetchDeliveryItems();
    } else {
      setDeliveryItems([]);
    }
  }, [showDetailsDialog, selectedDeliveryNote]);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [deliveryConfirmationName, setDeliveryConfirmationName] = useState("");
  const [newStatus, setNewStatus] = useState<"Pending" | "Partial" | "Complete" | "Cancelled">("Pending");
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<DeliveryNote | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const [isCreating, setIsCreating] = useState(false);
  // Sales order items to support partial delivery during creation
  const [soItemsForCreate, setSoItemsForCreate] = useState<SalesOrderItem[]>([]);
  const [soItemsLoading, setSoItemsLoading] = useState(false);
  // Map of salesOrderItemId -> quantity to deliver now
  const [deliverQtyBySoItem, setDeliverQtyBySoItem] = useState<Record<string, number>>({});
  // Map of salesOrderItemId -> remaining quantity (ordered - already delivered across all previous deliveries)
  const [remainingBySoItem, setRemainingBySoItem] = useState<Record<string, number>>({});
  // Delivery type selector to guide UX (prefill quantities); actual type is derived from entered quantities
  const [deliveryTypeSelection, setDeliveryTypeSelection] = useState<'Full' | 'Partial'>('Partial');
  // Whether the selected SO already has at least one previous delivery (disables Full delivery creation)
  const [hasPreviousDeliveriesForSelectedSO, setHasPreviousDeliveriesForSelectedSO] = useState(false);

  // Helper to format ISO or date string for datetime-local input (strip seconds & timezone)
  // Download PDF from server
  const handleDownloadPDF = async (deliveryNote: DeliveryNote) => {
    try {
      const response = await fetch(`/api/delivery-notes/${deliveryNote.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery-note-${deliveryNote.deliveryNumber || 'unknown'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download delivery note PDF",
        variant: "destructive",
      });
    }
  };

  // Print PDF in new tab
  const handlePrintPDF = async (deliveryNote: DeliveryNote) => {
    try {
      const response = await fetch(`/api/delivery-notes/${deliveryNote.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      setTimeout(() => {
        try { printWindow.focus(); printWindow.print(); } catch {}
      }, 500);
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 10000);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open print dialog. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatForDateTimeLocal = (value: string | null): string => {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  // Fetch delivery notes
  const { data: deliveryNotesData = [], isLoading, error, refetch } = useQuery({
  queryKey: ["delivery-notes", currentPage, deliverySearchTerm, statusFilter, customerFilter, pageSize],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.set('page', currentPage.toString());
        params.set('pageSize', pageSize.toString());
        if (deliverySearchTerm) params.set('search', deliverySearchTerm);
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (customerFilter) params.set('customerId', customerFilter);
        
        // Try relative URL first (for production), then absolute URL (for development)
        const url = `/api/delivery-notes?${params}`;
        console.log('Fetching delivery notes from URL:', url);
        let response;
        try {
          response = await fetch(url, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          console.log('Relative URL response status:', response.status);
        } catch (relativeError) {
          console.log('Relative URL failed, trying absolute URL...', relativeError);
          const absoluteUrl = `http://localhost:5000/api/delivery-notes?${params}`;
          console.log('Trying absolute URL:', absoluteUrl);
          response = await fetch(absoluteUrl, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          console.log('Absolute URL response status:', response.status);
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Delivery notes fetched successfully:', data.length, 'records');
        return data as DeliveryNote[];
      } catch (error) {
        console.error('Error fetching delivery notes:', error);
        throw new Error(`Failed to fetch delivery notes: ${error instanceof Error ? error.message : 'Network error - please ensure the server is running on port 5000'}`);
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch available sales orders for delivery note creation
  // Fetch all sales orders for order number selection
  const { data: availableSalesOrders = [] } = useQuery({
    queryKey: ["sales-orders-list"],
    queryFn: async () => {
      try {
        let response;
        try {
          response = await fetch("/api/sales-orders", {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
        } catch (relativeError) {
          response = await fetch("/api/sales-orders", {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
        }
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Sales orders fetch failed: HTTP ${response.status}: ${errorText}`);
          return [];
        }
        const data = await response.json();
        // Only return orderNumber, id, and customer for selection
        return (Array.isArray(data) ? data : []).map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer
        }));
      } catch (error) {
        console.error('Error fetching sales orders:', error);
        return [];
      }
    }
  });

  // Fetch sales orders with status and LPO validation for readiness card
  const { data: allSalesOrdersForReady = [] } = useQuery({
    queryKey: ["sales-orders-for-delivery-ready"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/sales-orders", {
          credentials: "include",
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    }
  });

  // Derive ready list: Confirmed/Processing and LPO Approved
  const readySalesOrders = useMemo(() => {
    return (allSalesOrdersForReady as any[]).filter((o) =>
      (o?.status === "Confirmed" || o?.status === "Processing") && o?.customerLpoValidationStatus === "Approved"
    );
  }, [allSalesOrdersForReady]);

  // When a sales order is selected in the create dialog, fetch its items
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedSalesOrderId || !showCreateDialog) {
        setSoItemsForCreate([]);
        setDeliverQtyBySoItem({});
        setRemainingBySoItem({});
        setDeliveryTypeSelection('Partial');
        return;
      }
      try {
        setSoItemsLoading(true);
        const res = await fetch(`/api/sales-orders/${selectedSalesOrderId}/items`);
        if (res.ok) {
          const items: SalesOrderItem[] = await res.json();
          setSoItemsForCreate(items);
          // Initialize deliver quantities
          const init: Record<string, number> = {};
          // Helper: compute already delivered quantities per salesOrderItemId
          const computeDeliveredMap = async (): Promise<Record<string, number>> => {
            try {
              const dnRes = await fetch(`/api/delivery-notes?salesOrderId=${encodeURIComponent(selectedSalesOrderId)}&limit=100`);
              if (!dnRes.ok) return {};
              const notes = await dnRes.json();
              if (!Array.isArray(notes) || notes.length === 0) return {};
              const itemLists = await Promise.all(
                notes.map((n: any) => fetch(`/api/deliveries/${n.id}/items`).then(r => (r.ok ? r.json() : [])))
              );
              const deliveredBySoItem: Record<string, number> = {};
              for (const list of itemLists) {
                for (const di of (Array.isArray(list) ? list : [])) {
                  const soItemId = (di as any).salesOrderItemId as string;
                  const qty = Number((di as any).deliveredQuantity ?? 0);
                  if (!soItemId) continue;
                  deliveredBySoItem[soItemId] = (deliveredBySoItem[soItemId] || 0) + (Number.isFinite(qty) ? qty : 0);
                }
              }
              return deliveredBySoItem;
            } catch {
              return {};
            }
          };

          // Always compute aggregated delivered quantities from all previous delivery notes
          const deliveredMap = await computeDeliveredMap();
          const hasPreviousDeliveries = Object.keys(deliveredMap).length > 0;
          setHasPreviousDeliveriesForSelectedSO(hasPreviousDeliveries);

          // Calculate remaining quantities for each item (store in state for max validation)
          const remainingMap: Record<string, number> = {};
          for (const it of items) {
            const soItemId = (it as any).id as string;
            const ordered = Number((it as any).orderedQuantity ?? (it as any).quantity ?? 0);
            // Use aggregated delivered from all previous delivery notes, not just SO item's deliveredQuantity
            const deliveredSoFar = Number(deliveredMap[soItemId] || 0);
            const remaining = Math.max(0, ordered - deliveredSoFar);
            remainingMap[soItemId] = remaining;
          }
          setRemainingBySoItem(remainingMap);

          let usedAutoPrefill = false;
          if (prefillAllRemaining) {
            // Use aggregated delivered quantities from all previous deliveries
            for (const it of items) {
              const soItemId = (it as any).id as string;
              init[soItemId] = remainingMap[soItemId] || 0;
            }
            setDeliveryTypeSelection(hasPreviousDeliveries ? 'Partial' : 'Full');
            setPrefillAllRemaining(false);
            usedAutoPrefill = true;
          } else {
            // If there are previous delivery notes for this SO, prefill remaining automatically
            if (hasPreviousDeliveries) {
              for (const it of items) {
                const soItemId = (it as any).id as string;
                init[soItemId] = remainingMap[soItemId] || 0;
              }
              usedAutoPrefill = true;
            } else {
              for (const it of items) init[(it as any).id] = 0;
            }
            setDeliveryTypeSelection('Partial');
          }
          setDeliverQtyBySoItem(init);
        } else {
          setSoItemsForCreate([]);
        }
      } catch {
        setSoItemsForCreate([]);
      } finally {
        setSoItemsLoading(false);
      }
    };
    fetchItems();
  }, [selectedSalesOrderId, showCreateDialog, prefillAllRemaining]);

  // Create delivery note mutation
  const createDeliveryNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/delivery-notes", data);
    },
    onSuccess: () => {
      // Invalidate and refetch all delivery-related queries
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders-list"] });
      
      // Reset pagination and filters
      setCurrentPage(1);
      setDeliverySearchTerm("");
      setStatusFilter("all");
      setCustomerFilter("");
      
      // Refetch the main data
      refetch();
      
      toast({
        title: "Success",
        description: "Delivery note created successfully"
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create delivery note",
        variant: "destructive"
      });
    }
  });

  // Update delivery note status mutation
  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/delivery-notes/${id}`, data);
      return await response.json();
    },
    onSuccess: (updatedDelivery) => {
      // Invalidate and refetch all delivery-related queries
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      
      // Update the selected delivery note if it's the one being updated
      if (selectedDeliveryNote && selectedDeliveryNote.id === updatedDelivery.id) {
        setSelectedDeliveryNote(updatedDelivery);
      }
      
      // Reset pagination and filters
      setCurrentPage(1);
      setDeliverySearchTerm("");
      setStatusFilter("all");
      setCustomerFilter("");
      
      // Refetch the main data
      refetch();
      
      toast({
        title: "Success",
        description: "Delivery note updated successfully"
      });
      
      // Close all dialogs
      setShowPickingDialog(false);
      setShowConfirmDeliveryDialog(false);
      setShowEditDialog(false);
      setShowStatusChangeDialog(false);
      setShowDetailsDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update delivery note",
        variant: "destructive"
      });
    }
  });

  // Delete delivery note mutation
  const deleteDeliveryNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/delivery-notes/${id}`);
    },
    onSuccess: () => {
      // Invalidate and refetch all delivery-related queries
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      
      // Reset pagination and filters
      setCurrentPage(1);
      setDeliverySearchTerm("");
      setStatusFilter("all");
      setCustomerFilter("");
      
      // Refetch the main data
      refetch();
      
      toast({
        title: "Success",
        description: "Delivery note deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete delivery note",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setSelectedSalesOrderId("");
    setDeliveryDate("");
    setDeliveryAddress("");
    setDeliveryNotes("");
    setTrackingNumber("");
    setCarrierName("");
    setDeliveryConfirmationName("");
    setSelectedDeliveryNote(null);
    setSalesOrderSearchTerm("");
    setNewStatus("Pending");
    setStatusChangeReason("");
  };

  const handleCreateDeliveryNote = async () => {
    setIsCreating(true);
    if (!selectedSalesOrderId) {
      toast({
        title: "Error",
        description: "Please select a sales order",
        variant: "destructive"
      });
      setIsCreating(false);
      return;
    }

    // Find selected sales order to get orderNumber
    const selectedOrder = availableSalesOrders.find(order => order.id === selectedSalesOrderId);
    if (!selectedOrder || !selectedOrder.orderNumber) {
      toast({
        title: "Error",
        description: "Selected sales order is invalid or missing order number",
        variant: "destructive"
      });
      setIsCreating(false);
      return;
    }

    // Compute totals from entered quantities to determine Partial vs Full
    const totals = soItemsForCreate.reduce(
      (acc: { ordered: number; deliver: number }, it: any) => {
        const ordered = Number(it.quantity) || 0;
        const deliver = Number(deliverQtyBySoItem[it.id] || 0);
        acc.ordered += ordered;
        acc.deliver += deliver;
        return acc;
      },
      { ordered: 0, deliver: 0 }
    );
    if (totals.deliver <= 0) {
      toast({ title: "Error", description: "Please enter quantities > 0 for at least one item.", variant: "destructive" });
      setIsCreating(false);
      return;
    }
    const computedIsFull = totals.deliver === totals.ordered && totals.ordered > 0;
    // Once any partial delivery exists for this SO, force new deliveries to be Partial
    const isFull = hasPreviousDeliveriesForSelectedSO ? false : computedIsFull;
    const deliveryType = isFull ? "Full" : "Partial";
    const headerPayload = {
      salesOrderId: selectedSalesOrderId,
      deliveryDate: deliveryDate || null,
      deliveryAddress,
      deliveryNotes,
      trackingNumber,
      carrierName,
      status: isFull ? "Pending" : "Partial",
      deliveryType,
      createdBy: userId || SYSTEM_USER_ID
    };

    try {
      const headerRes = await apiRequest("POST", "/api/delivery-notes", headerPayload);
      if (!headerRes.ok) throw new Error(await headerRes.text());
      const createdDelivery: DeliveryNote = await headerRes.json();

      // Create delivery items for lines where qty > 0
      const itemsToCreate = soItemsForCreate
        .map((it: any, idx) => ({ it, qty: Number(deliverQtyBySoItem[it.id] || 0), idx }))
        .filter(x => x.qty > 0)
        .map(x => ({
          deliveryId: createdDelivery.id,
          salesOrderItemId: x.it.id,
          itemId: x.it.itemId, // Include itemId for better server processing
          // Server will enrich the rest (pricing, barcode, etc.)
          orderedQuantity: x.it.quantity,
          pickedQuantity: x.qty,
          deliveredQuantity: x.qty,
        }));

      console.log("Creating delivery items:", itemsToCreate);

      if (itemsToCreate.length === 0) {
        throw new Error("No items selected for delivery. Please enter quantities > 0 for at least one item.");
      }

      if (itemsToCreate.length > 0) {
        // Use bulk endpoint when available; fallback to per-item
        try {
          const bulkRes = await apiRequest("POST", "/api/delivery-items/bulk", itemsToCreate);
          if (!bulkRes.ok) throw new Error(await bulkRes.text());
        } catch (bulkError) {
          console.log("Bulk create failed, trying individual creates:", bulkError);
          // Fallback to individual creates
          for (const payload of itemsToCreate) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const itemRes = await apiRequest("POST", `/api/deliveries/${createdDelivery.id}/items`, payload);
              if (!itemRes.ok) {
                console.error("Failed to create delivery item:", await itemRes.text());
              }
            } catch (itemError) {
              console.error("Error creating delivery item:", itemError);
            }
          }
        }
      }

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      setCurrentPage(1);

      // Close create dialog and avoid opening details dialog
      setSelectedDeliveryNote(createdDelivery);
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Success", description: deliveryType === 'Partial' ? "Partial delivery saved" : "Delivery note created" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to create delivery note", variant: "destructive" });
    }
    setIsCreating(false);
  };

  const handleStartPicking = () => {
    if (!selectedDeliveryNote) return;
    
    const updateData = {
      pickingStartedBy: userId || SYSTEM_USER_ID,
      pickingStartedAt: new Date().toISOString(),
      status: "Partial"
    };
    updateDeliveryStatusMutation.mutate({
      id: selectedDeliveryNote.id,
      data: updateData
    });
  };

  const handleCompletePicking = () => {
    if (!selectedDeliveryNote) return;
    
    const updateData = {
      pickingCompletedBy: userId || SYSTEM_USER_ID,
      pickingCompletedAt: new Date().toISOString(),
      pickingNotes: deliveryNotes,
      status: "Complete"
    };
    updateDeliveryStatusMutation.mutate({
      id: selectedDeliveryNote.id,
      data: updateData
    });
  };

  const handleConfirmDelivery = async () => {
    if (!selectedDeliveryNote) return;
    
    const updateData = {
      deliveryConfirmedBy: deliveryConfirmationName,
      deliveryConfirmedAt: new Date().toISOString(),
      actualDeliveryDate: new Date().toISOString(),
      status: "Complete"
    };
    
    try {
      const response = await fetch(`/api/delivery-notes/${selectedDeliveryNote.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        const updatedDelivery = await response.json();
        
        // Update the selected delivery note immediately
        setSelectedDeliveryNote(updatedDelivery);
        
        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
        queryClient.invalidateQueries({ queryKey: ["deliveries"] });
        refetch();
        
        toast({
          title: "Success",
          description: "Delivery confirmed successfully"
        });
        
        setShowConfirmDeliveryDialog(false);
        resetForm();
      } else {
        throw new Error('Failed to confirm delivery');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm delivery",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async () => {
    if (!selectedDeliveryNote) return;
    
    // Calculate delivery type based on current quantities
    const totalOrdered = deliveryItems.reduce((sum, item) => sum + (item.orderedQuantity || 0), 0);
    const totalDelivered = deliveryItems.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
    const isPartialDelivery = totalDelivered > 0 && totalDelivered < totalOrdered;
    const isCompleteDelivery = totalDelivered >= totalOrdered;
    
    const updateData: any = {
      status: newStatus,
      deliveryType: isCompleteDelivery ? 'Full' : isPartialDelivery ? 'Partial' : 'Full',
      updatedAt: new Date().toISOString()
    };

    // Add specific fields based on status
    switch (newStatus) {
      case "Partial":
        if (!selectedDeliveryNote.pickingStartedBy) {
          updateData.pickingStartedBy = userId || SYSTEM_USER_ID;
          updateData.pickingStartedAt = new Date().toISOString();
        }
        // Ensure delivery type is set to Partial if quantities indicate partial delivery
        if (isPartialDelivery) {
          updateData.deliveryType = 'Partial';
        }
        break;
      case "Complete":
        if (!selectedDeliveryNote.pickingCompletedBy) {
          updateData.pickingCompletedBy = userId || SYSTEM_USER_ID;
          updateData.pickingCompletedAt = new Date().toISOString();
        }
        if (!selectedDeliveryNote.deliveryConfirmedBy) {
          updateData.deliveryConfirmedBy = userId || SYSTEM_USER_ID;
          updateData.deliveryConfirmedAt = new Date().toISOString();
          updateData.actualDeliveryDate = new Date().toISOString();
        }
        // Ensure delivery type is set to Full for complete deliveries
        updateData.deliveryType = 'Full';
        break;
      case "Cancelled":
        updateData.deliveryNotes = `${selectedDeliveryNote.deliveryNotes || ''}\n[Cancelled: ${statusChangeReason || 'No reason provided'}]`.trim();
        break;
    }

    // Add reason to delivery notes if provided
    if (statusChangeReason) {
      updateData.deliveryNotes = `${selectedDeliveryNote.deliveryNotes || ''}\n[Status changed to ${newStatus}: ${statusChangeReason}]`.trim();
    }

    try {
      const response = await fetch(`/api/delivery-notes/${selectedDeliveryNote.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        const updatedDelivery = await response.json();
        
        // Update the selected delivery note immediately
        setSelectedDeliveryNote(updatedDelivery);
        
        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
        queryClient.invalidateQueries({ queryKey: ["deliveries"] });
        refetch();
        
        toast({
          title: "Success",
          description: "Delivery status updated successfully"
        });
        
        setShowStatusChangeDialog(false);
        resetForm();
      } else {
        throw new Error('Failed to update delivery status');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update delivery status",
        variant: "destructive"
      });
    }
  };

  // Function to fetch delivery items for editing
  const fetchDeliveryItemsForEdit = async () => {
    if (!selectedDeliveryNote?.id) return;
    
    setDeliveryItemsLoading(true);
    try {
      const response = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`);
      if (response.ok) {
        const data = await response.json();
        setDeliveryItems(data);
        const init: Record<string, number> = {};
        for (const it of data) {
          init[it.id] = Number(it.deliveredQuantity || it.pickedQuantity || it.orderedQuantity || 0);
        }
        setEditedDeliveryQtyByItem(init);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to fetch delivery items",
        variant: "destructive"
      });
    }
    setDeliveryItemsLoading(false);
  };

  // Function to save item changes with partial delivery tracking
  const handleSaveItemChanges = async () => {
    if (!selectedDeliveryNote?.id) return;

    setIsSavingItemChanges(true);
    try {
      // Prepare the update data for each item with remaining quantity calculation
      const itemUpdates = Object.entries(editedDeliveryQtyByItem).map(([itemId, quantity]) => {
        const originalItem = deliveryItems.find(item => item.id === itemId);
        const orderedQuantity = originalItem?.orderedQuantity || 0;
        const remainingQuantity = Math.max(0, orderedQuantity - quantity);
        
        return {
          id: itemId,
          deliveredQuantity: quantity,
          remainingQuantity: remainingQuantity
        };
      });

      // Check if this is a partial delivery
      const hasPartialDelivery = itemUpdates.some(item => {
        const originalItem = deliveryItems.find(di => di.id === item.id);
        const orderedQuantity = originalItem?.orderedQuantity || 0;
        return item.deliveredQuantity > 0 && item.deliveredQuantity < orderedQuantity;
      });

      const isCompleteDelivery = itemUpdates.every(item => {
        const originalItem = deliveryItems.find(di => di.id === item.id);
        const orderedQuantity = originalItem?.orderedQuantity || 0;
        return item.deliveredQuantity >= orderedQuantity;
      });

      const response = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          items: itemUpdates,
          updateDeliveryType: true,
          deliveryType: isCompleteDelivery ? 'Full' : hasPartialDelivery ? 'Partial' : 'Full'
        })
      });

      if (response.ok) {
        // Update delivery status based on delivery type
        const newStatus = isCompleteDelivery ? 'Complete' : hasPartialDelivery ? 'Partial' : selectedDeliveryNote.status;
        
        if (newStatus !== selectedDeliveryNote.status) {
          await fetch(`/api/deliveries/${selectedDeliveryNote.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              status: newStatus,
              deliveryType: isCompleteDelivery ? 'Full' : hasPartialDelivery ? 'Partial' : 'Full'
            })
          });
        }

        // Refresh the selected delivery note
        await refreshSelectedDeliveryNote(selectedDeliveryNote.id);
        
        // Refresh the delivery items
        await fetchDeliveryItemsForEdit();
        
        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
        queryClient.invalidateQueries({ queryKey: ["deliveries"] });
        refetch();
        
        const deliveryTypeText = isCompleteDelivery ? 'Complete' : hasPartialDelivery ? 'Partial' : 'Full';
        toast({
          title: "Success",
          description: `Delivery item quantities updated successfully. Delivery type: ${deliveryTypeText}`
        });
        setIsEditingItems(false);
      } else {
        throw new Error('Failed to update delivery items');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save item changes",
        variant: "destructive"
      });
    } finally {
      setIsSavingItemChanges(false);
    }
  };

  // Print handler for delivery note
  // Print handler for delivery note using deliveryItems
  // ...existing code...

  const columns: Column<DeliveryNote>[] = [
    {
      key: "deliveryNumber",
      header: "Delivery Number",
      render: (_value, item) => (
        <div className="font-medium text-blue-600">
          {item?.deliveryNumber || 'N/A'}
        </div>
      )
    },
    {
      key: "salesOrder.customer.name",
      header: "Customer",
      render: (_value, item) => (
        <div>
          <div className="font-medium">{item.salesOrder?.customer?.name || 'N/A'}</div>
          <div className="text-sm text-gray-500">{item.salesOrder?.customer?.email || ''}</div>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (_value, item) => (
        <div className="flex items-center gap-2">
          <StatusPill status={item?.status || 'Unknown'} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Change Status"
            aria-label="Change Status"
            onClick={() => {
              setSelectedDeliveryNote(item);
              setNewStatus(item?.status || 'Pending');
              setShowStatusChangeDialog(true);
            }}
          >
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      )
    },
    {
      key: "deliveryType",
      header: "Type",
      render: (_value, item) => (
        <Badge variant="outline">{item?.deliveryType || 'Unknown'}</Badge>
      )
    },
    {
      key: "deliveryDate",
      header: "Delivery Date",
      render: (_value, item) => (
        <div>
          {item?.deliveryDate ? formatDate(item.deliveryDate) : "Not scheduled"}
        </div>
      )
    },
    {
      key: "trackingNumber",
      header: "Tracking",
      render: (_value, item) => (
        <div>
          {item?.trackingNumber ? (
            <div>
              <div className="font-medium">{item.trackingNumber}</div>
              <div className="text-sm text-gray-500">{item.carrierName || ''}</div>
            </div>
          ) : (
            <span className="text-gray-400">No tracking</span>
          )}
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Created",
      render: (_value, item) => formatDate(item?.createdAt)
    },
    {
      key: "actions",
      header: "Actions",
      render: (_value, item) => (
        <div className="flex items-center gap-1">
          {/* View */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View Details"
            aria-label="View Details"
            onClick={() => {
              navigate(`/delivery-note/${item.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>


          {/* Download PDF */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Download PDF"
            aria-label="Download PDF"
            onClick={() => handleDownloadPDF(item)}
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Print PDF */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Print"
            aria-label="Print"
            onClick={() => handlePrintPDF(item)}
          >
            <Printer className="h-4 w-4" />
          </Button>

          {/* Edit */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Edit"
            aria-label="Edit"
            onClick={() => {
              setSelectedDeliveryNote(item);
              // Pre-fill edit form values
              setDeliveryDate(formatForDateTimeLocal(item.deliveryDate));
              setDeliveryAddress(item.deliveryAddress || "");
              setCarrierName(item.carrierName || "");
              setTrackingNumber(item.trackingNumber || "");
              setDeliveryNotes(item.deliveryNotes || "");
              // Automatically start editing items mode and fetch items
              setIsEditingItems(true);
              setShowEditDialog(true);
              // Fetch delivery items immediately
              setTimeout(() => {
                if (item.id) {
                  fetchDeliveryItemsForEdit();
                }
              }, 100);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:text-red-700"
            title="Delete"
            aria-label="Delete"
            onClick={() => {
              setDeliveryToDelete(item);
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {/* Start Picking (only Pending) */}
          {item.status === "Pending" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Start Picking"
              aria-label="Start Picking"
              onClick={() => {
                setSelectedDeliveryNote(item);
                setShowPickingDialog(true);
              }}
            >
              <Package className="h-4 w-4" />
            </Button>
          )}
          {/* Confirm Delivery (Partial or Complete but not yet confirmed) */}
          {(item.status === "Partial" || item.status === "Complete") && !item.deliveryConfirmedBy && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700"
              title="Confirm Delivery"
              aria-label="Confirm Delivery"
              onClick={() => {
                setSelectedDeliveryNote(item);
                setShowConfirmDeliveryDialog(true);
              }}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
  // Print handler for delivery note
  // ...existing code...
      )
    }
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Delivery Notes</h3>
          <p className="text-gray-600 mb-4">
            {error.message || "There was a problem loading the delivery notes."}
          </p>
          <div className="space-y-2">
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <p className="text-sm text-gray-500">
              If the problem persists, please ensure the server is running on port 5000
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card-style header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Delivery Notes
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Step 8: Manage delivery notes generated from sales orders with barcode picking and delivery confirmation
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-sm text-blue-600">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="font-medium">Delivery Management</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Deliveries: {deliveryNotesData.filter((d: DeliveryNote) => d.status !== "Complete" && d.status !== "Cancelled").length}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
                queryClient.invalidateQueries({ queryKey: ["deliveries"] });
                refetch();
              }}
              variant="outline"
              className="font-semibold px-6 py-2 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              variant="outline"
              className="font-semibold px-6 py-2 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Delivery Note
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {readySalesOrders.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-green-600" />
              Ready for Delivery Note Creation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {readySalesOrders.slice(0, 3).map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {order.orderNumber} - {order.customer?.name || 'Unknown Customer'}
                      </p>
                      <p className="text-xs text-gray-600">
                        Value: {formatCurrency(Number(order.totalAmount) || 0)} | PO: {order.customerPoNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedSalesOrderId(order.id);
                      setPrefillAllRemaining(true);
                      setShowCreateDialog(true);
                    }}
                    data-testid={`button-create-dn-${order.id}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Delivery Note
                  </Button>
                </div>
              ))}
              {readySalesOrders.length > 3 && (
                <p className="text-sm text-gray-600 text-center">
                  +{readySalesOrders.length - 3} more sales orders ready for delivery note creation
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search by delivery number, customer, or tracking..."
                value={deliverySearchTerm}
                onChange={(e) => {
                  setDeliverySearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="max-w-md"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                if (showAll) {
                  // revert
                  setPageSize(15);
                  setShowAll(false);
                  setCurrentPage(1);
                } else {
                  setPageSize(500); // large number to effectively show all
                  setShowAll(true);
                  setCurrentPage(1);
                }
              }}
            >
              {showAll ? (
                <>
                  <Filter className="h-4 w-4 mr-2" /> Paginate
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4 mr-2" /> Show All
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="flex flex-row items-start gap-4 p-4 shadow-sm border border-gray-200 bg-white">
          <div className="rounded-full bg-gray-100 p-2 mt-1">
            <Edit className="h-6 w-6 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-700">Draft Deliveries</div>
            <div className="text-2xl font-bold text-gray-900">
              {deliveryNotesData.filter(note => note.status === "Pending").length}
            </div>
          </div>
        </Card>

        <Card className="flex flex-row items-start gap-4 p-4 shadow-sm border border-gray-200 bg-white">
          <div className="rounded-full bg-blue-100 p-2 mt-1">
            <Truck className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-700">Ready for Picking</div>
            <div className="text-2xl font-bold text-blue-600">
              {deliveryNotesData.filter(note => note.status === "Pending" && !note.pickingStartedAt).length}
            </div>
          </div>
        </Card>

        <Card className="flex flex-row items-start gap-4 p-4 shadow-sm border border-gray-200 bg-white">
          <div className="rounded-full bg-yellow-100 p-2 mt-1">
            <Package className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-700">Partial Complete Delivery</div>
            <div className="text-2xl font-bold text-yellow-600">
              {deliveryNotesData.filter(note => note.status === "Partial").length}
            </div>
          </div>
        </Card>

        <Card className="flex flex-row items-start gap-4 p-4 shadow-sm border border-gray-200 bg-white">
          <div className="rounded-full bg-green-100 p-2 mt-1">
            <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-700">Complete Deliveries</div>
            <div className="text-2xl font-bold text-green-600">
              {deliveryNotesData.filter(note => note.status === "Complete").length}
            </div>
          </div>
        </Card>

        <Card className="flex flex-row items-start gap-4 p-4 shadow-sm border border-gray-200 bg-white">
          <div className="rounded-full bg-red-100 p-2 mt-1">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-700">Cancelled</div>
            <div className="text-2xl font-bold text-red-600">
              {deliveryNotesData.filter(note => note.status === "Cancelled").length}
            </div>
          </div>
        </Card>
      </div>

      {/* Delivery Notes Table with empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : deliveryNotesData.length > 0 ? (
            <>
              <DataTable
                data={deliveryNotesData}
                columns={[...columns]}
                className="w-full"
              />
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">Page {currentPage}</span>
                <Button
                  variant="outline"
                  disabled={deliveryNotesData.length < pageSize}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-sm text-gray-500 space-y-4">
              <p>No delivery notes found. Create a new delivery note to get started.</p>
              <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Delivery Note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Delivery Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Delivery Note</DialogTitle>
            <DialogDescription>
              Generate a delivery note from an existing sales order for picking and delivery management.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="salesOrder">Sales Order *</Label>
              {/* Single field: search and select sales order */}
              <Select value={selectedSalesOrderId} onValueChange={setSelectedSalesOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Type or select sales order..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-2">
                    <Input
                      id="salesOrderSearch"
                      placeholder="Search sales order number or customer..."
                      value={salesOrderSearchTerm}
                      onChange={e => setSalesOrderSearchTerm(e.target.value)}
                      className="mb-2"
                      autoFocus
                    />
                  </div>
                  {availableSalesOrders
                    .filter(order => {
                      const term = salesOrderSearchTerm.trim().toLowerCase();
                      if (!term) return true;
                      return (
                        order.orderNumber?.toLowerCase().includes(term) ||
                        order.customer?.name?.toLowerCase().includes(term)
                      );
                    })
                    .map(order => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.orderNumber} - {order.customer?.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Partial quantities table */}
            {selectedSalesOrderId && (
              <div className="mt-2">
                <h4 className="font-semibold mb-2">Select Items and Quantities</h4>
              {/* Delivery Type helper */
              }
              <div className="grid grid-cols-12 gap-3 items-end mb-3">
                <div className="col-span-4">
                  <Label className="text-xs">Delivery Type</Label>
                  <Select value={deliveryTypeSelection} onValueChange={(v: any) => {
                    const requested = (v === 'Full' ? 'Full' : 'Partial') as 'Full' | 'Partial';
                    if (requested === 'Full' && hasPreviousDeliveriesForSelectedSO) {
                      // Ignore selecting Full when a partial delivery already exists
                      return;
                    }
                    setDeliveryTypeSelection(requested);
                    if (requested === 'Full') {
                      // Prefill all deliver quantities to ordered quantities
                      const next: Record<string, number> = {};
                      for (const it of soItemsForCreate as any[]) {
                        next[it.id] = Number(it.quantity) || 0;
                      }
                      setDeliverQtyBySoItem(next);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Full" disabled={hasPreviousDeliveriesForSelectedSO}>Full</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasPreviousDeliveriesForSelectedSO && (
                    <div className="mt-1 text-xs text-orange-600">Full delivery is disabled because a partial delivery already exists.</div>
                  )}
                </div>
              </div>
                {soItemsLoading ? (
                  <div className="text-sm text-gray-500">Loading sales order items...</div>
                ) : soItemsForCreate.length === 0 ? (
                  <div className="text-sm text-gray-400">No items found for this sales order.</div>
                ) : (
                  <div className="space-y-2">
                    {soItemsForCreate.map((it: any) => (
                      <div key={it.id} className="grid grid-cols-12 gap-3 items-center bg-gray-50 rounded p-2">
                        <div className="col-span-6">
                          <div className="font-medium truncate" title={it.description || ''}>{it.description || 'Item'}</div>
                          <div className="text-xs text-gray-500">
                            Ordered: {it.quantity}
                            {remainingBySoItem[it.id] !== undefined && (
                              <span className="ml-2 text-orange-600">
                                | Remaining: {remainingBySoItem[it.id]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Deliver Qty</Label>
                          <Input
                            type="number"
                            min={0}
                            max={(remainingBySoItem[it.id] ?? Number(it.quantity)) || undefined}
                            value={deliverQtyBySoItem[it.id] ?? 0}
                            onChange={e => {
                              const maxAllowed = (remainingBySoItem[it.id] ?? Number(it.quantity)) || 0;
                              const v = Math.max(0, Math.min(Number(e.target.value || 0), maxAllowed));
                              setDeliverQtyBySoItem(prev => ({ ...prev, [it.id]: v }));
                            }}
                          />
                        </div>
                        <div className="col-span-3 text-right text-sm text-gray-600">
                          Unit: {it.unitPrice}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="deliveryDate">Scheduled Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="deliveryAddress">Delivery Address</Label>
              <Textarea
                id="deliveryAddress"
                placeholder="Enter delivery address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="carrierName">Carrier/Transporter</Label>
              <Input
                id="carrierName"
                placeholder="Enter carrier or transporter name"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                placeholder="Enter tracking number (if available)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="deliveryNotes">Delivery Notes</Label>
              <Textarea
                id="deliveryNotes"
                placeholder="Enter any special delivery instructions..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateDeliveryNote}
              disabled={isCreating}
            >
              {isCreating && <LoadingSpinner className="mr-2" />}
              Create Delivery Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Details Dialog (disabled) */}
      <Dialog open={false} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-5xl max-h-[75vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg">Delivery Note Details</DialogTitle>
                <DialogDescription>
                  {selectedDeliveryNote?.deliveryNumber}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedDeliveryNote?.id) {
                    refreshSelectedDeliveryNote(selectedDeliveryNote.id);
                  }
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </DialogHeader>
          {selectedDeliveryNote && (
            <div className="space-y-6 text-sm">
              {/* ...existing details rendering... */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-base mb-3">Delivery Information</h3>
                  <div className="space-y-2">
                    <div><strong>Customer:</strong> {selectedDeliveryNote.salesOrder?.customer?.name}</div>
                    <div><strong>Status:</strong> <StatusPill status={selectedDeliveryNote.status} /></div>
                    <div><strong>Type:</strong> {selectedDeliveryNote.deliveryType}</div>
                    <div><strong>Delivery Date:</strong> {selectedDeliveryNote.deliveryDate ? formatDate(selectedDeliveryNote.deliveryDate) : "Not scheduled"}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-3">Tracking Information</h3>
                  <div className="space-y-2">
                    <div><strong>Tracking Number:</strong> {selectedDeliveryNote.trackingNumber || "N/A"}</div>
                    <div><strong>Carrier:</strong> {selectedDeliveryNote.carrierName || "N/A"}</div>
                    <div><strong>Estimated Delivery:</strong> {selectedDeliveryNote.estimatedDeliveryDate ? formatDate(selectedDeliveryNote.estimatedDeliveryDate) : "N/A"}</div>
                    <div><strong>Actual Delivery:</strong> {selectedDeliveryNote.actualDeliveryDate ? formatDate(selectedDeliveryNote.actualDeliveryDate) : "Pending"}</div>
                  </div>
                </div>
              </div>
              {/* Enquiry Items Section */}
              <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-base">Delivery Items</h3>
              </div>
                {deliveryItemsLoading ? (
                  <div className="text-sm text-gray-500">Loading items...</div>
                ) : deliveryItems.length > 0 ? (
                  <div className="space-y-3">
                {deliveryItems.map((item, idx) => {
                  const orderedQty = item.orderedQuantity || 0;
                  const deliveredQty = item.deliveredQuantity || 0;
                  const remainingQty = item.remainingQuantity || (orderedQty - deliveredQty);
                  const isPartialDelivery = deliveredQty > 0 && deliveredQty < orderedQty;
                  const isCompleteDelivery = deliveredQty >= orderedQty;
                  const deliveryPercentage = orderedQty > 0 ? Math.round((deliveredQty / orderedQty) * 100) : 0;
                  
                  return (
                    <div key={item.id || idx} className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{item.description}</span>
                          <div className="text-xs text-gray-500 mt-1">
                            Supplier Code: {item.supplierCode || 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          {isEditingItems ? (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Delivered Qty</Label>
                              <Input
                                type="number"
                                min={0}
                                max={orderedQty}
                                value={editedDeliveryQtyByItem[item.id] ?? deliveredQty}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.min(orderedQty, Number(e.target.value || 0)));
                                  setEditedDeliveryQtyByItem(prev => ({ ...prev, [item.id]: v }));
                                }}
                                className="w-20 h-8"
                              />
                            </div>
                          ) : (
                            <div className="text-right">
                              <div className="text-sm font-mono">
                                {deliveredQty} / {orderedQty}
                              </div>
                              <div className="text-xs text-gray-500">
                                {deliveryPercentage}% delivered
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Quantity tracking bars */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Ordered: {orderedQty}</span>
                          <span>Delivered: {deliveredQty}</span>
                          <span>Remaining: {remainingQty}</span>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isCompleteDelivery ? 'bg-green-500' : 
                              isPartialDelivery ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(100, deliveryPercentage)}%` }}
                          ></div>
                        </div>
                        
                        {/* Status indicators */}
                        <div className="flex items-center gap-2 text-xs">
                          {isCompleteDelivery && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800">
                              ✓ Complete
                            </span>
                          )}
                          {isPartialDelivery && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                              ⚠ Partial
                            </span>
                          )}
                          {deliveredQty === 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                              ⏳ Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No items found for this delivery.</div>
                )}
              </div>
              
              {/* Delivery History Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base">Delivery History</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedDeliveryNote?.id) {
                        fetchDeliveryHistory(selectedDeliveryNote.id);
                        setShowDeliveryHistoryDialog(true);
                      }
                    }}
                  >
                    View Full History
                  </Button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    {/* Overall delivery summary */}
                    {(() => {
                      const completion = calculateDeliveryCompletion(deliveryItems);
                      return (
                        <>
                          <div className="grid grid-cols-3 gap-4 text-center">
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
                          
                          {/* Delivery completion percentage */}
                          <div className="bg-white rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">Overall Progress</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                  {completion.completionPercentage}%
                                </span>
                                {completion.isComplete && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                                    ✓ Complete
                                  </span>
                                )}
                                {completion.isPartial && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs">
                                    ⚠ Partial
                                  </span>
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
                        </>
                      );
                    })()}
                    
                    {/* Recent delivery activities */}
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-medium text-sm mb-3">Recent Activities</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span>Delivery created</span>
                          <span className="text-gray-500">{selectedDeliveryNote.createdAt ? formatDate(selectedDeliveryNote.createdAt) : 'N/A'}</span>
                        </div>
                        {selectedDeliveryNote.pickingStartedAt && (
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span>Picking started</span>
                            <span className="text-gray-500">{formatDate(selectedDeliveryNote.pickingStartedAt)}</span>
                          </div>
                        )}
                        {selectedDeliveryNote.pickingCompletedAt && (
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span>Picking completed</span>
                            <span className="text-gray-500">{formatDate(selectedDeliveryNote.pickingCompletedAt)}</span>
                          </div>
                        )}
                        {selectedDeliveryNote.deliveryConfirmedAt && (
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span>Delivery confirmed</span>
                            <span className="text-gray-500">{formatDate(selectedDeliveryNote.deliveryConfirmedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedDeliveryNote.deliveryAddress && (
                <div>
                  <h3 className="font-semibold text-base mb-2">Delivery Address</h3>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedDeliveryNote.deliveryAddress}
                  </p>
                </div>
              )}
              {selectedDeliveryNote.deliveryNotes && (
                <div>
                  <h3 className="font-semibold text-base mb-2">Delivery Notes</h3>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedDeliveryNote.deliveryNotes}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-base mb-2">Picking Information</h3>
                  <div className="space-y-1">
                    <div><strong>Started:</strong> {selectedDeliveryNote.pickingStartedAt ? formatDate(selectedDeliveryNote.pickingStartedAt) : "Not started"}</div>
                    <div><strong>Completed:</strong> {selectedDeliveryNote.pickingCompletedAt ? formatDate(selectedDeliveryNote.pickingCompletedAt) : "Not completed"}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-2">Delivery Confirmation</h3>
                  <div className="space-y-1">
                    <div><strong>Confirmed By:</strong> {selectedDeliveryNote.deliveryConfirmedBy || "Not confirmed"}</div>
                    <div><strong>Confirmed At:</strong> {selectedDeliveryNote.deliveryConfirmedAt ? formatDate(selectedDeliveryNote.deliveryConfirmedAt) : "Not confirmed"}</div>
                  </div>
                </div>
              </div>

              {/* Status History */}
              <div>
                <h3 className="font-semibold text-base mb-3">Status History</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <StatusPill status={selectedDeliveryNote.status} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Current Status</div>
                      <div className="text-xs text-gray-500">
                        Last updated: {formatDate(selectedDeliveryNote.updatedAt)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Show status progression */}
                  {selectedDeliveryNote.pickingStartedAt && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <StatusPill status="Partial" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Picking Started</div>
                        <div className="text-xs text-gray-500">
                          Started: {formatDate(selectedDeliveryNote.pickingStartedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedDeliveryNote.pickingCompletedAt && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <StatusPill status="Complete" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Picking Completed</div>
                        <div className="text-xs text-gray-500">
                          Completed: {formatDate(selectedDeliveryNote.pickingCompletedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedDeliveryNote.deliveryConfirmedAt && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <StatusPill status="Complete" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Delivery Confirmed</div>
                        <div className="text-xs text-gray-500">
                          Confirmed: {formatDate(selectedDeliveryNote.deliveryConfirmedAt)} by {selectedDeliveryNote.deliveryConfirmedBy}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Delivery Note Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          // Reset editing state when dialog closes
          setIsEditingItems(false);
          setDeliveryItems([]);
          setEditedDeliveryQtyByItem({});
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Edit Delivery Note</DialogTitle>
                <DialogDescription>
                  {selectedDeliveryNote?.deliveryNumber} - Items are automatically loaded for editing
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedDeliveryNote?.id) {
                    refreshSelectedDeliveryNote(selectedDeliveryNote.id);
                    fetchDeliveryItemsForEdit();
                  }
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </DialogHeader>
          {selectedDeliveryNote && (
            <div className="space-y-6">
              {/* Delivery Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editDeliveryDate">Scheduled Delivery Date</Label>
                    <Input
                      id="editDeliveryDate"
                      type="datetime-local"
                      value={deliveryDate || selectedDeliveryNote.deliveryDate || ""}
                      onChange={e => setDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editCarrierName">Carrier/Transporter</Label>
                    <Input
                      id="editCarrierName"
                      placeholder="Enter carrier or transporter name"
                      value={carrierName || selectedDeliveryNote.carrierName || ""}
                      onChange={e => setCarrierName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editDeliveryAddress">Delivery Address</Label>
                  <Textarea
                    id="editDeliveryAddress"
                    placeholder="Enter delivery address..."
                    value={deliveryAddress || selectedDeliveryNote.deliveryAddress || ""}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editTrackingNumber">Tracking Number</Label>
                    <Input
                      id="editTrackingNumber"
                      placeholder="Enter tracking number (if available)"
                      value={trackingNumber || selectedDeliveryNote.trackingNumber || ""}
                      onChange={e => setTrackingNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDeliveryNotes">Delivery Notes</Label>
                    <Textarea
                      id="editDeliveryNotes"
                      placeholder="Enter any special delivery instructions..."
                      value={deliveryNotes || selectedDeliveryNote.deliveryNotes || ""}
                      onChange={e => setDeliveryNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Items</h3>
                  {/* Show status of editing mode */}
                  {isEditingItems && (
                    <Badge variant="secondary" className="text-xs">
                      Editing Mode - Modify quantities below
                    </Badge>
                  )}
                </div>

                {deliveryItemsLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : deliveryItems.length > 0 ? (
                  <div className="space-y-3">
                    {deliveryItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                          <div className="md:col-span-2">
                            <p className="font-medium text-sm text-gray-900">{item.description}</p>
                            <p className="text-xs text-gray-500">SKU: {item.barcode}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Ordered</Label>
                            <p className="text-sm font-medium">{item.orderedQuantity}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Picked</Label>
                            <p className="text-sm font-medium">{item.pickedQuantity || 0}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Delivered</Label>
                            {isEditingItems ? (
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const currentQty = editedDeliveryQtyByItem[item.id] || 0;
                                    if (currentQty > 0) {
                                      setEditedDeliveryQtyByItem(prev => ({
                                        ...prev,
                                        [item.id]: currentQty - 1
                                      }));
                                    }
                                  }}
                                  disabled={!isEditingItems}
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.pickedQuantity || item.orderedQuantity}
                                  value={editedDeliveryQtyByItem[item.id] || 0}
                                  onChange={(e) => {
                                    const value = Math.max(0, Math.min(parseInt(e.target.value) || 0, item.pickedQuantity || item.orderedQuantity));
                                    setEditedDeliveryQtyByItem(prev => ({
                                      ...prev,
                                      [item.id]: value
                                    }));
                                  }}
                                  className="w-16 h-8 text-center"
                                  disabled={!isEditingItems}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const currentQty = editedDeliveryQtyByItem[item.id] || 0;
                                    const maxQty = item.pickedQuantity || item.orderedQuantity;
                                    if (currentQty < maxQty) {
                                      setEditedDeliveryQtyByItem(prev => ({
                                        ...prev,
                                        [item.id]: currentQty + 1
                                      }));
                                    }
                                  }}
                                  disabled={!isEditingItems}
                                >
                                  +
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm font-medium">{item.deliveredQuantity || 0}</p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Unit Price</Label>
                            <p className="text-sm font-medium">{formatCurrency(item.unitPrice)}</p>
                          </div>
                        </div>
                        {isEditingItems && (
                          <div className="mt-2 text-xs text-gray-500">
                            Max deliverable: {item.pickedQuantity || item.orderedQuantity} units
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>No delivery items found</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditDialog(false);
                setIsEditingItems(false);
                setEditedDeliveryQtyByItem({});
                setDeliveryItems([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedDeliveryNote) return;
                
                // First save item changes if in editing mode
                if (isEditingItems && deliveryItems.length > 0) {
                  try {
                    setIsSavingItemChanges(true);
                    const itemUpdates = Object.entries(editedDeliveryQtyByItem).map(([itemId, quantity]) => ({
                      id: itemId,
                      deliveredQuantity: quantity
                    }));

                    const itemResponse = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ items: itemUpdates })
                    });

                    if (!itemResponse.ok) {
                      throw new Error('Failed to update item quantities');
                    }
                    setIsSavingItemChanges(false);
                  } catch (error) {
                    setIsSavingItemChanges(false);
                    toast({
                      title: "Error",
                      description: "Failed to update delivery item quantities",
                      variant: "destructive"
                    });
                    return;
                  }
                }

                // Then save delivery note changes
                const updateData = {
                  deliveryDate: deliveryDate || selectedDeliveryNote.deliveryDate,
                  deliveryAddress: deliveryAddress || selectedDeliveryNote.deliveryAddress,
                  deliveryNotes: deliveryNotes || selectedDeliveryNote.deliveryNotes,
                  trackingNumber: trackingNumber || selectedDeliveryNote.trackingNumber,
                  carrierName: carrierName || selectedDeliveryNote.carrierName
                };
                
                updateDeliveryStatusMutation.mutate({
                  id: selectedDeliveryNote.id,
                  data: updateData
                });
                setShowEditDialog(false);
                setIsEditingItems(false);
                setEditedDeliveryQtyByItem({});
                setDeliveryItems([]);
              }}
              disabled={updateDeliveryStatusMutation.isPending || isSavingItemChanges}
            >
              {(updateDeliveryStatusMutation.isPending || isSavingItemChanges) && <LoadingSpinner className="mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Picking Dialog */}
      <Dialog open={showPickingDialog} onOpenChange={setShowPickingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Picking Process</DialogTitle>
            <DialogDescription>
              Begin the picking process for delivery {selectedDeliveryNote?.deliveryNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <QrCode className="h-4 w-4" />
              Use barcode scanner to pick items efficiently
            </div>
            <Button onClick={handleStartPicking} className="w-full">
              Start Picking Process
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delivery Dialog */}
      <Dialog open={showConfirmDeliveryDialog} onOpenChange={setShowConfirmDeliveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>
              Confirm delivery completion for {selectedDeliveryNote?.deliveryNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="confirmationName">Receiver Name *</Label>
              <Input
                id="confirmationName"
                placeholder="Name of person who received the delivery"
                value={deliveryConfirmationName}
                onChange={(e) => setDeliveryConfirmationName(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDeliveryDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmDelivery}
              disabled={!deliveryConfirmationName.trim() || updateDeliveryStatusMutation.isPending}
            >
              {updateDeliveryStatusMutation.isPending && <LoadingSpinner className="mr-2" />}
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Change Delivery Status</DialogTitle>
                <DialogDescription>
                  Update the status for delivery {selectedDeliveryNote?.deliveryNumber}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedDeliveryNote?.id) {
                    refreshSelectedDeliveryNote(selectedDeliveryNote.id);
                  }
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentStatus">Current Status</Label>
              <div className="mt-1">
                <StatusPill status={selectedDeliveryNote?.status || 'Unknown'} />
              </div>
            </div>
            
            <div>
              <Label htmlFor="newStatus">New Status *</Label>
              <Select value={newStatus} onValueChange={(value: "Pending" | "Partial" | "Complete" | "Cancelled") => setNewStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
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
              <Label htmlFor="statusReason">Reason for Change (Optional)</Label>
              <Textarea
                id="statusReason"
                placeholder="Enter reason for status change..."
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                rows={3}
              />
            </div>

            {newStatus === "Complete" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Complete Status</span>
                </div>
                <p className="text-green-700 text-xs mt-1">
                  This will mark the delivery as complete and set confirmation details if not already set.
                </p>
              </div>
            )}

            {newStatus === "Cancelled" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Cancel Delivery</span>
                </div>
                <p className="text-red-700 text-xs mt-1">
                  This will cancel the delivery. Please provide a reason for cancellation.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusChangeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChange}
              disabled={updateDeliveryStatusMutation.isPending || (newStatus === selectedDeliveryNote?.status)}
              className={newStatus === "Cancelled" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {updateDeliveryStatusMutation.isPending && <LoadingSpinner className="mr-2" />}
              {newStatus === "Cancelled" ? "Cancel Delivery" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Delivery Note
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete delivery note <strong>{deliveryToDelete?.deliveryNumber}</strong>? 
              This action cannot be undone and will permanently remove the delivery note from the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (deliveryToDelete) {
                  deleteDeliveryNoteMutation.mutate(deliveryToDelete.id);
                  setShowDeleteDialog(false);
                  setDeliveryToDelete(null);
                }
              }}
              disabled={deleteDeliveryNoteMutation.isPending}
            >
              {deleteDeliveryNoteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery History Dialog */}
      <Dialog open={showDeliveryHistoryDialog} onOpenChange={setShowDeliveryHistoryDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Delivery History - {selectedDeliveryNote?.deliveryNumber}
            </DialogTitle>
            <DialogDescription>
              Complete history of partial deliveries and quantity tracking for this delivery note.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {deliveryHistoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner className="mr-2" />
                Loading delivery history...
              </div>
            ) : deliveryHistory.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Cards */}
                {(() => {
                  const completion = calculateDeliveryCompletion(deliveryHistory);
                  return (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{completion.totalOrdered}</div>
                        <div className="text-sm text-blue-600">Total Ordered</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{completion.totalDelivered}</div>
                        <div className="text-sm text-green-600">Total Delivered</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{completion.totalRemaining}</div>
                        <div className="text-sm text-orange-600">Remaining</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">{completion.completionPercentage}%</div>
                        <div className="text-sm text-purple-600">Complete</div>
                      </div>
                    </div>
                  );
                })()}

                {/* History Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deliveryHistory.map((item, index) => {
                        const isComplete = (item.deliveredQuantity || 0) >= (item.orderedQuantity || 0);
                        const isPartial = (item.deliveredQuantity || 0) > 0 && (item.deliveredQuantity || 0) < (item.orderedQuantity || 0);
                        const percentage = (item.orderedQuantity || 0) > 0 ? 
                          Math.round(((item.deliveredQuantity || 0) / (item.orderedQuantity || 0)) * 100) : 0;
                        
                        return (
                          <tr key={item.id || index} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm text-gray-900">{item.deliveryNumber || '—'}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.customerName || '—'}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.deliveryStatus || '—'}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.deliveryType || '—'}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.deliveryDate ? formatDate(item.deliveryDate) : '—'}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.trackingNumber || '—'}</td>
                            <td className="px-4 py-4 text-xs text-gray-500">{item.createdAt ? formatDate(item.createdAt) : '—'}</td>
                            <td className="px-4 py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{item.itemDescription}</div>
                                <div className="text-xs text-gray-500">ID: {item.itemId}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.orderedQuantity || 0}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.deliveredQuantity || 0}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{item.remainingQuantity || 0}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  isComplete ? 'bg-green-100 text-green-800' :
                                  isPartial ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {isComplete ? '✓ Complete' : isPartial ? '⚠ Partial' : '⏳ Pending'}
                                </span>
                                <span className="text-xs text-gray-500">{percentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500">{item.deliveryDate ? formatDate(item.deliveryDate) : 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No delivery history found for this delivery note.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}