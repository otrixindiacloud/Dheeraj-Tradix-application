import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { formatDate, format } from "date-fns";
import { 
  Plus, 
  Filter, 
  Search, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CalendarIcon,
  FileDown,
  ChevronDown,
  Truck,
  Package,
  MapPin,
  Navigation,
  Globe,
  Building2,
  User,
  ShoppingCart,
  CreditCard,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import DataTable from "@/components/tables/data-table";
import { useToast } from "@/hooks/use-toast";

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
  currency: "AED" | "SAR" | "QAR" | "KWD" | "BHD";
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
  items?: Array<{
    id?: string;
    itemDescription: string;
    quantity: number;
    unitCost?: string;
    totalCost?: string;
    unitOfMeasure?: string;
    specialInstructions?: string;
  }>;
  subtotal?: string;
  taxAmount?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
}

interface ShipmentTracking {
  id: string;
  shipmentId: string;
  timestamp: string;
  location: string;
  status: string;
  description: string;
  scanType: "Pickup" | "In Transit" | "Sorting" | "Out for Delivery" | "Delivered" | "Exception";
}

// Component for individual LPO item that can use hooks
interface LpoItemComponentProps {
  lpo: any;
  fetchLpoItems: (lpoId: string) => Promise<any[]>;
  onGenerate: (lpoData: any) => void;
}

function LpoItemComponent({ lpo, fetchLpoItems, onGenerate }: LpoItemComponentProps) {
  const [lpoItems, setLpoItems] = React.useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = React.useState(false);

  // Fetch items when component mounts
  React.useEffect(() => {
    const loadItems = async () => {
      setItemsLoading(true);
      const items = await fetchLpoItems(lpo.id);
      setLpoItems(items);
      setItemsLoading(false);
    };
    loadItems();
  }, [lpo.id, fetchLpoItems]);

  const handleGenerate = async () => {
    // Fetch items if not already loaded
    let items = lpoItems;
    if (items.length === 0) {
      items = await fetchLpoItems(lpo.id);
    }
    
    // Set the selected LPO data for the form
    onGenerate({
      lpoId: lpo.id,
      lpoNumber: lpo.lpoNumber,
      supplierName: lpo.supplier?.name || 'Unknown Supplier',
      supplierId: lpo.supplierId, // Add supplier ID
      customerName: lpo.customer?.name || 'Unknown Customer',
      expectedDeliveryDate: lpo.expectedDeliveryDate,
      totalAmount: lpo.totalAmount,
      currency: lpo.currency || 'BHD',
      items: items,
      createdAt: lpo.createdAt,
      status: 'Confirmed'
    });
  };

  return (
    <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-800 truncate">
                {lpo.lpoNumber}
              </h4>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs font-medium text-gray-600 truncate">
                {lpo.supplier?.name || 'Unknown Supplier'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-1">
              
              <div className="flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-gray-400" />
                <span className="font-medium">Value:</span> {lpo.currency || 'BHD'} {parseFloat(lpo.totalAmount || '0').toLocaleString()}
              </div>
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3 text-gray-400" />
                <span className="font-medium">Items:</span> {itemsLoading ? 'Loading...' : `${lpoItems.length} items`}
              </div>
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3 text-gray-400" />
                <span className="font-medium">Delivery:</span> {lpo.expectedDeliveryDate ? new Date(lpo.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
              </div>
            </div>
            {/* Items Preview */}
            {!itemsLoading && lpoItems && lpoItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Items:</div>
                <div className="space-y-1 max-h-16 overflow-y-auto">
                  {lpoItems.slice(0, 3).map((item: any, index: number) => (
                    <div key={index} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                      <span className="font-medium">{item.quantity || 1}x</span> {item.itemDescription || 'Item'}
                      {item.unitCost && (
                        <span className="ml-2 text-gray-500">
                          @ {lpo.currency || 'BHD'} {parseFloat(item.unitCost).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {lpoItems.length > 3 && (
                    <div className="text-xs text-gray-400 italic">
                      +{lpoItems.length - 3} more items
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-medium text-xs flex-shrink-0"
          onClick={handleGenerate}
        >
          + Generate
        </Button>
      </div>
    </div>
  );
}

// LPO Item Card Component
interface LpoItemCardProps {
  lpo: any;
  onSelect: (lpo: any, items: any[]) => void;
  fetchLpoItems: (lpoId: string) => Promise<any[]>;
}

function LpoItemCard({ lpo, onSelect, fetchLpoItems }: LpoItemCardProps) {
  const [lpoItems, setLpoItems] = React.useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = React.useState(false);

  // Fetch items when component mounts
  React.useEffect(() => {
    const loadItems = async () => {
      setItemsLoading(true);
      const items = await fetchLpoItems(lpo.id);
      setLpoItems(items);
      setItemsLoading(false);
    };
    loadItems();
  }, [lpo.id, fetchLpoItems]);

  return (
    <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-3 w-3 rounded-full bg-green-500 flex-shrink-0"></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-lg font-semibold text-gray-800 truncate">
                {lpo.lpoNumber}
              </h4>
              <span className="text-sm text-gray-500">•</span>
              <span className="text-sm font-medium text-gray-600 truncate">
                {lpo.supplier?.name || 'Unknown Supplier'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-2">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium">Customer:</span> {lpo.customer?.name || 'Unknown'}
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="font-medium">Value:</span> {lpo.currency || 'BHD'} {parseFloat(lpo.totalAmount || '0').toLocaleString()}
              </div>
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4 text-gray-400" />
                <span className="font-medium">Items:</span> {itemsLoading ? 'Loading...' : `${lpoItems.length} items`}
              </div>
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <span className="font-medium">Delivery:</span> {lpo.expectedDeliveryDate ? new Date(lpo.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
              </div>
            </div>
            {!itemsLoading && lpoItems && lpoItems.length > 0 && (
              <div className="text-sm text-gray-500 mt-2">
                <span className="font-medium">Items:</span> {lpoItems.slice(0, 3).map((item: any) => item.itemDescription).join(', ')}
                {lpoItems.length > 3 && ` +${lpoItems.length - 3} more`}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium text-sm flex-shrink-0"
          onClick={async () => {
            // Fetch items if not already loaded
            let items = lpoItems;
            if (items.length === 0) {
              items = await fetchLpoItems(lpo.id);
            }
            
            // Set the selected LPO data for the form
            onSelect(lpo, items);
          }}
        >
          Select
        </Button>
      </div>
    </div>
  );
}

export default function ShipmentTrackingPage() {
  // Show filters by default (show button first)
  const [showFilters, setShowFilters] = useState(false);
  const [, navigate] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    carrier: "",
    serviceType: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editShipmentForm, setEditShipmentForm] = useState<any | null>(null);
  // Detail dialog state
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [deletingShipment, setDeletingShipment] = useState<Shipment | null>(null);
  const [trackingShipment, setTrackingShipment] = useState<Shipment | null>(null);
  // Shipment generation form state
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showAllLposDialog, setShowAllLposDialog] = useState(false);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [statusChangeShipment, setStatusChangeShipment] = useState<Shipment | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [newLocation, setNewLocation] = useState<string>("");
  const [confirmedLpoData, setConfirmedLpoData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generateFormData, setGenerateFormData] = useState({
    lpoId: "",
    lpoNumber: "",
    supplierName: "",
    customerName: "",
    expectedDeliveryDate: "",
    totalAmount: "",
    currency: "BHD",
    carrierId: "",
    carrierName: "",
    serviceType: "Standard" as "Standard" | "Express" | "Overnight" | "Economy",
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    origin: "",
    destination: "",
    weight: "",
    dimensions: "",
    packageCount: 1,
    isInsured: false,
    requiresSignature: false,
    specialInstructions: "",
  });
  const [newShipment, setNewShipment] = useState({
    salesOrderId: "",
    salesOrderNumber: "",
    carrierId: "",
    carrierName: "",
    serviceType: "Standard" as "Standard" | "Express" | "Overnight" | "Economy",
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    origin: "",
    destination: "",
    estimatedDelivery: "",
    weight: "",
    dimensions: "",
    declaredValue: "",
    packageCount: 1,
    isInsured: false,
    requiresSignature: false,
    specialInstructions: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Note: Tracking events are now handled through the shipment creation payload
  // This eliminates the need for separate tracking event API calls

  // Fetch sales orders for dropdown
  const { data: salesOrders = [], isLoading: salesOrdersLoading } = useQuery({
    queryKey: ["/api/sales-orders"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/sales-orders?limit=100");
        if (!response.ok) {
          throw new Error('Failed to fetch sales orders');
        }
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Error fetching sales orders:', error);
        return [];
      }
    }
  });

  // Fetch confirmed LPOs from API
  const { data: confirmedLpos = [], isLoading: confirmedLposLoading } = useQuery({
    queryKey: ["/api/supplier-lpos", { status: "Confirmed" }],
    queryFn: async () => {
      try {
        const response = await fetch("/api/supplier-lpos?status=Confirmed&limit=50");
        if (!response.ok) {
          throw new Error('Failed to fetch confirmed LPOs');
        }
        const result = await response.json();
        return Array.isArray(result.data) ? result.data : result;
      } catch (error) {
        console.error('Error fetching confirmed LPOs:', error);
        return [];
      }
    },
  });

  // Fetch suppliers separately for enrichment
  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/suppliers");
        if (!response.ok) throw new Error('Failed to fetch suppliers');
        const result = await response.json();
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        return [];
      }
    },
  });

  // Fetch customers separately for enrichment
  const { data: customersData = { customers: [] } } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/customers");
        if (!response.ok) throw new Error('Failed to fetch customers');
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Error fetching customers:', error);
        return { customers: [] };
      }
    },
  });

  const customers = customersData.customers || [];

  // Function to fetch items for a specific LPO
  const fetchLpoItems = async (lpoId: string) => {
    try {
      const response = await fetch(`/api/supplier-lpos/${lpoId}/items`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Error fetching LPO items:', error);
      return [];
    }
  };

  // Enrich LPOs with supplier, customer data, and items
  const enrichedConfirmedLpos = confirmedLpos.map((lpo: any) => {
    const supplier = suppliers.find((s: any) => s.id === lpo.supplierId);
    // Use customer data from API response if available, otherwise fallback to lookup
    const customer = lpo.customerName ? 
      { id: lpo.customerId, name: lpo.customerName } : 
      customers.find((c: any) => c.id === lpo.customerId);
    return {
      ...lpo,
      supplier: supplier || { name: 'Unknown Supplier' },
      customer: customer || { name: 'Unknown Customer' },
      items: [] // Will be populated when needed
    };
  });

  // Check for confirmed LPO data on component mount (for immediate data from sessionStorage)
  useEffect(() => {
    const storedLpoData = sessionStorage.getItem('confirmedLpoData');
    console.log('Checking for stored LPO data:', storedLpoData);
    if (storedLpoData) {
      try {
        const lpoData = JSON.parse(storedLpoData);
        console.log('Parsed LPO data:', lpoData);
        setConfirmedLpoData(lpoData);
        // Pre-populate form data
        setGenerateFormData(prev => ({
          ...prev,
          lpoId: lpoData.lpoId,
          lpoNumber: lpoData.lpoNumber,
          supplierName: lpoData.supplierName,
          customerName: lpoData.customerName || "",
          expectedDeliveryDate: lpoData.expectedDeliveryDate,
          totalAmount: lpoData.totalAmount?.toString() || "",
          currency: lpoData.currency || "BHD",
        }));
        // Don't clear the stored data immediately - let it persist for the session
        // sessionStorage.removeItem('confirmedLpoData');
      } catch (error) {
        console.error('Error parsing stored LPO data:', error);
      }
    } else {
      console.log('No stored LPO data found');
    }
  }, []);

  // Update confirmedLpoData when new confirmed LPOs are available from API
  useEffect(() => {
    if (enrichedConfirmedLpos && enrichedConfirmedLpos.length > 0 && !confirmedLpoData) {
      // If we have confirmed LPOs from API but no confirmedLpoData, use the first one
      const firstLpo = enrichedConfirmedLpos[0];
      const lpoData = {
        lpoId: firstLpo.id,
        lpoNumber: firstLpo.lpoNumber,
        supplierName: firstLpo.supplier?.name || 'Unknown Supplier',
        supplierId: firstLpo.supplierId, // Add supplier ID
        customerName: firstLpo.customer?.name || 'Unknown Customer',
        expectedDeliveryDate: firstLpo.expectedDeliveryDate,
        totalAmount: firstLpo.totalAmount,
        currency: firstLpo.currency || 'BHD',
        items: firstLpo.items || [],
        createdAt: firstLpo.createdAt,
        status: 'Confirmed'
      };
      setConfirmedLpoData(lpoData);
    }
  }, [enrichedConfirmedLpos, confirmedLpoData]);

  // Auto-refresh confirmed LPOs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  // Mock data for development - replace with actual API call
  const mockShipments: Shipment[] = [
    {
      id: "ship-001",
      shipmentNumber: "SHP-2024-001",
      trackingNumber: "TRK123456789",
      salesOrderId: "so-001",
      salesOrderNumber: "SO-2024-001",
      carrierId: "car-001",
      carrierName: "Emirates Post",
      serviceType: "Standard",
      status: "In Transit",
      priority: "High",
      origin: "Dubai, UAE",
      destination: "Abu Dhabi, UAE",
      estimatedDelivery: "2024-01-20",
      weight: "5.2",
      dimensions: "30x20x15",
      declaredValue: "2500.00",
      currency: "AED",
      shippingCost: "45.00",
      customerReference: "CUST-REF-001",
      packageCount: 2,
      isInsured: true,
      requiresSignature: true,
      currentLocation: "Dubai Sorting Facility",
      lastUpdate: "2024-01-18T14:30:00Z",
      createdAt: "2024-01-18T09:00:00Z",
      updatedAt: "2024-01-18T14:30:00Z"
    },
    {
      id: "ship-002",
      shipmentNumber: "SHP-2024-002",
      trackingNumber: "TRK987654321",
      salesOrderId: "so-002",
      salesOrderNumber: "SO-2024-002",
      carrierId: "car-002",
      carrierName: "DHL Express",
      serviceType: "Express",
      status: "Delivered",
      priority: "Medium",
      origin: "Sharjah, UAE",
      destination: "Dubai, UAE",
      estimatedDelivery: "2024-01-17",
      actualDelivery: "2024-01-16",
      weight: "2.8",
      dimensions: "25x15x10",
      declaredValue: "1200.00",
      currency: "AED",
      shippingCost: "75.00",
      packageCount: 1,
      isInsured: false,
      requiresSignature: true,
      currentLocation: "Delivered - Reception",
      lastUpdate: "2024-01-16T16:45:00Z",
      createdAt: "2024-01-15T11:20:00Z",
      updatedAt: "2024-01-16T16:45:00Z"
    },
    {
      id: "ship-003",
      shipmentNumber: "SHP-2024-003",
      trackingNumber: "TRK456789123",
      carrierId: "car-003",
      carrierName: "Aramex",
      serviceType: "Overnight",
      status: "Pending",
      priority: "Urgent",
      origin: "Dubai, UAE",
      destination: "Riyadh, Saudi Arabia",
      estimatedDelivery: "2024-01-22",
      weight: "8.5",
      dimensions: "40x30x20",
      declaredValue: "3500.00",
      currency: "AED",
      shippingCost: "150.00",
      packageCount: 3,
      isInsured: true,
      requiresSignature: true,
      lastUpdate: "2024-01-19T10:00:00Z",
      createdAt: "2024-01-19T10:00:00Z",
      updatedAt: "2024-01-19T10:00:00Z"
    }
  ];

  // Mock carriers - kept for reference but not used anymore
  // const mockCarriers = [
  //   { id: "car-001", name: "Emirates Post" },
  //   { id: "car-002", name: "DHL Express" },
  //   { id: "car-003", name: "Aramex" },
  //   { id: "car-004", name: "FedEx" },
  //   { id: "car-005", name: "UPS" },
  // ];

  const { data: shipments = [], isLoading, error } = useQuery({
    queryKey: ["/api/shipments", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (filters.status) searchParams.append('status', filters.status);
      if (filters.priority) searchParams.append('priority', filters.priority);
      if (filters.carrier) searchParams.append('carrierId', filters.carrier);
      if (filters.serviceType) searchParams.append('serviceType', filters.serviceType);
      if (filters.search) searchParams.append('search', filters.search);
      if (filters.dateFrom) searchParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) searchParams.append('dateTo', filters.dateTo);
      
      const response = await fetch(`/api/shipments?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch shipments');
      }
      return response.json();
    },
  });

  // Enrich shipments with customer names from customers data
  const enrichedShipments = React.useMemo(() => {
    return shipments.map((shipment: any) => {
      // If customerName already exists, use it
      if (shipment.customerName) {
        return shipment;
      }
      
      // Try to find customer name from LPO data
      const matchingLpo = confirmedLpos.find((lpo: any) => 
        lpo.lpoNumber === shipment.lpoNumber || 
        lpo.lpoNumber === shipment.salesOrderNumber
      );
      
      if (matchingLpo) {
        return {
          ...shipment,
          customerName: matchingLpo.customer?.name || matchingLpo.customerName || 'Unknown Customer'
        };
      }
      
      return {
        ...shipment,
        customerName: 'Unknown Customer'
      };
    });
  }, [shipments, confirmedLpos]);

  // Filter out LPOs that already have shipments generated
  const availableLpos = enrichedConfirmedLpos.filter((lpo: any) => {
    // Check if any shipment has this LPO number as salesOrderNumber
    const hasShipment = enrichedShipments.some((shipment: any) => 
      shipment.salesOrderNumber === lpo.lpoNumber
    );
    
    // Debug logging
    if (hasShipment) {
      console.log(`LPO ${lpo.lpoNumber} already has shipment, filtering out`);
    }
    
    return !hasShipment;
  });

  // Fetch carriers
  const { data: carriers = [] } = useQuery({
    queryKey: ["/api/carriers"],
    queryFn: async () => {
      const response = await fetch('/api/carriers');
      if (!response.ok) {
        throw new Error('Failed to fetch carriers');
      }
      return response.json();
    },
  });

  // Create shipment mutation
  const createShipment = useMutation({
    mutationFn: async (data: typeof newShipment) => {
      // Omit empty string fields and convert estimatedDelivery to Date if present
      const payload: Record<string, any> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'estimatedDelivery') {
          if (typeof value === 'string' && value) {
            payload.estimatedDelivery = new Date(value);
          }
        } else if (value !== "") {
          payload[key] = value;
        }
      });
      // Temporary: add placeholder numbers if backend still complaining (server will ignore if already generates)
      if (!payload.shipmentNumber) payload.shipmentNumber = `SHP-TEMP-${Date.now()}`;
      if (!payload.trackingNumber) payload.trackingNumber = `TRK${Date.now().toString().slice(-9)}`;
      
      // Set initial status and location for tracking
      payload.status = 'Pending';
      payload.currentLocation = payload.origin || 'Origin';
      payload.lastUpdate = new Date().toISOString();
      
      // Log payload for debugging
      try { console.debug('Client createShipment payload:', payload); } catch {}
      
      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shipment creation failed:', response.status, errorText);
        console.error('Full response details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        let errorMessage = 'Failed to create shipment';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Shipment created successfully:', result);

      // Note: Tracking events will be handled separately if needed
      // The shipment is created successfully with initial status and location
      console.log('Shipment created with initial tracking data:', {
        status: payload.status,
        currentLocation: payload.currentLocation,
        lastUpdate: payload.lastUpdate
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      toast({
        title: "Success",
        description: "Shipment created successfully with initial tracking data",
      });
      setShowNewDialog(false);
      setNewShipment({
        salesOrderId: "",
        salesOrderNumber: "",
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
        packageCount: 1,
        isInsured: false,
        requiresSignature: false,
        specialInstructions: "",
      });
    },
    onError: (error: any) => {
      console.error('Shipment creation error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create shipment",
        variant: "destructive",
      });
    },
  });

  // Delete shipment mutation
  const deleteShipment = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete shipment');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "Success",
        description: "Shipment deleted successfully",
      });
      setDeletingShipment(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete shipment",
        variant: "destructive",
      });
    },
  });

  // Update shipment mutation
  const updateShipment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload: Record<string, any> = {};
      const dateFields = ['estimatedDelivery', 'actualDelivery', 'createdAt', 'updatedAt', 'lastUpdate'];
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== "" && value !== undefined) {
          if (dateFields.includes(key) && typeof value === 'string' && value) {
            // Convert string dates to ISO string for proper serialization
            payload[key] = new Date(value).toISOString();
          } else {
            payload[key] = value;
          }
        }
      });
      
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update shipment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({ title: 'Success', description: 'Shipment updated successfully' });
      setShowEditDialog(false);
      setEditingShipment(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to update shipment', variant: 'destructive' });
    }
  });

  // Update shipment status mutation
  const updateShipmentStatus = useMutation({
    mutationFn: async ({ id, status, currentLocation }: { id: string; status: string; currentLocation?: string }) => {
      const payload = {
        status,
        currentLocation: currentLocation || 'Status Updated',
        lastUpdate: new Date().toISOString()
      };
      
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update shipment status');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      
      // If status is changed to "Delivered", send data to goods receipt
      if (variables.status === "Delivered") {
        // Find the shipment data to send to goods receipt
        const shipment = shipments?.find((s: Shipment) => s.id === variables.id);
        if (shipment) {
          // Prepare goods receipt data
          const goodsReceiptData = {
            shipmentId: shipment.id,
            shipmentNumber: shipment.shipmentNumber,
            trackingNumber: shipment.trackingNumber,
            carrierName: shipment.carrierName,
            supplierName: shipment.supplierName,
            customerName: shipment.customerName,
            origin: shipment.origin,
            destination: shipment.destination,
            actualDelivery: new Date().toISOString(),
            declaredValue: shipment.declaredValue,
            currency: shipment.currency,
            items: shipment.items || [],
            subtotal: shipment.subtotal,
            taxAmount: shipment.taxAmount,
            paymentTerms: shipment.paymentTerms,
            deliveryTerms: shipment.deliveryTerms,
            specialInstructions: shipment.specialInstructions,
            weight: shipment.weight,
            dimensions: shipment.dimensions,
            packageCount: shipment.packageCount,
            isInsured: shipment.isInsured,
            requiresSignature: shipment.requiresSignature,
            // LPO related data
            lpoId: shipment.lpoId,
            lpoNumber: shipment.lpoNumber || shipment.salesOrderNumber, // Use lpoNumber if available, fallback to salesOrderNumber
            status: "Ready for Goods Receipt"
          };
          
          // Store in sessionStorage for goods receipt page
          console.log('Storing delivered shipment data for goods receipt:', goodsReceiptData);
          sessionStorage.setItem('deliveredShipmentData', JSON.stringify(goodsReceiptData));
          
          // Show notification about goods receipt availability
          toast({
            title: "Shipment Delivered",
            description: "Shipment is ready for goods receipt generation",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = '/goods-receipt';
                }}
              >
                Go to Goods Receipt
              </Button>
            ),
          });
        }
      }
      
      toast({ title: 'Success', description: 'Shipment status updated successfully' });
      setShowStatusChangeDialog(false);
      setStatusChangeShipment(null);
      setNewStatus("");
      setNewLocation("");
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to update shipment status', variant: 'destructive' });
    }
  });

  // Handle edit shipment
  const handleEdit = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setEditShipmentForm({
      salesOrderNumber: shipment.salesOrderNumber || "",
      carrierId: shipment.carrierId || "",
      carrierName: shipment.carrierName || "",
      serviceType: shipment.serviceType,
      priority: shipment.priority,
      origin: shipment.origin,
      destination: shipment.destination,
      estimatedDelivery: shipment.estimatedDelivery ? shipment.estimatedDelivery.split('T')[0] : "",
      weight: shipment.weight || "",
      dimensions: shipment.dimensions || "",
      declaredValue: shipment.declaredValue || "",
      packageCount: shipment.packageCount || 1,
      isInsured: shipment.isInsured || false,
      requiresSignature: shipment.requiresSignature || false,
      specialInstructions: shipment.specialInstructions || "",
      shippingCost: shipment.shippingCost || "",
      customerReference: shipment.customerReference || "",
    });
    setShowEditDialog(true);
  };

  // Handle delete shipment
  const handleDelete = (shipment: Shipment) => {
    setDeletingShipment(shipment);
  };

  // Handle track shipment
  const handleTrack = (shipment: Shipment) => {
    setTrackingShipment(shipment);
    setShowTrackingDialog(true);
  };

  // Handle date range change
  const handleDateRangeChange = (from: Date | undefined, to: Date | undefined) => {
    setDateRange({ from, to });
    setFilters(prev => ({
      ...prev,
      dateFrom: from ? format(from, "yyyy-MM-dd") : "",
      dateTo: to ? format(to, "yyyy-MM-dd") : ""
    }));
  };

  // Export shipments function
  const exportShipments = (format: 'csv' | 'excel') => {
    if (!enrichedShipments || enrichedShipments.length === 0) {
      toast({
        title: "No Data",
        description: "No shipments to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const exportData = enrichedShipments.map((shipment: Shipment) => ({
        'Shipment Number': shipment.shipmentNumber,
        'Tracking Number': shipment.trackingNumber,
        'Sales Order': shipment.salesOrderNumber || '',
        'Carrier': shipment.carrierName,
        'Service Type': shipment.serviceType,
        'Status': shipment.status,
        'Priority': shipment.priority,
        'Origin': shipment.origin,
        'Destination': shipment.destination,
        'Estimated Delivery': shipment.estimatedDelivery ? formatDate(new Date(shipment.estimatedDelivery), "yyyy-MM-dd") : '',
        'Actual Delivery': shipment.actualDelivery ? formatDate(new Date(shipment.actualDelivery), "yyyy-MM-dd") : '',
        'Weight (kg)': parseFloat(shipment.weight || '0'),
        'Dimensions': shipment.dimensions,
        'Declared Value': parseFloat(shipment.declaredValue || '0'),
        'Currency': shipment.currency,
        'Shipping Cost': parseFloat(shipment.shippingCost || '0'),
        'Package Count': shipment.packageCount,
        'Insured': shipment.isInsured ? 'Yes' : 'No',
        'Signature Required': shipment.requiresSignature ? 'Yes' : 'No',
        'Current Location': shipment.currentLocation || '',
        'Customer Reference': shipment.customerReference || '',
        'Special Instructions': shipment.specialInstructions || '',
        'Last Update': shipment.lastUpdate ? formatDate(new Date(shipment.lastUpdate), "yyyy-MM-dd HH:mm") : '',
        'Created At': shipment.createdAt ? formatDate(new Date(shipment.createdAt), "yyyy-MM-dd") : ''
      }));

      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(format === 'csv' ? ',' : '\t'),
        ...exportData.map((row: any) => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            if (format === 'csv' && typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(format === 'csv' ? ',' : '\t')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { 
        type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shipments-export-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xls'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Shipments exported as ${format.toUpperCase()} successfully`,
      });
    } catch (error) {
      console.error("Error exporting shipments:", error);
      toast({
        title: "Error",
        description: "Failed to export shipments",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending": return <Clock className="h-4 w-4" />;
      case "Picked Up": return <Package className="h-4 w-4" />;
      case "In Transit": return <Truck className="h-4 w-4" />;
      case "Out for Delivery": return <Navigation className="h-4 w-4" />;
      case "Delivered": return <CheckCircle className="h-4 w-4" />;
      case "Delayed": return <AlertTriangle className="h-4 w-4" />;
      case "Cancelled": return <XCircle className="h-4 w-4" />;
      case "Lost": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Low": return "text-green-600";
      case "Medium": return "text-amber-600";
      case "High": return "text-orange-600";
      case "Urgent": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getServiceTypeColor = (serviceType: string) => {
    switch (serviceType) {
      case "Economy": return "text-gray-600";
      case "Standard": return "text-blue-600";
      case "Express": return "text-purple-600";
      case "Overnight": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const columns = [
    {
      key: "shipmentNumber",
      header: "Shipment Number",
      render: (value: string, shipment: Shipment) => (
        <div className="flex items-center gap-2">
          <Link href={`/shipment-tracking/${shipment.id}`} className="font-medium text-gray-600 hover:text-gray-800">
            {value}
          </Link>
          {shipment.isInsured && (
            <Badge variant="outline" className="text-xs">
              Insured
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "trackingNumber",
      header: "Tracking",
      render: (value: string, shipment: Shipment) => (
        <div>
          <div className="font-medium font-mono text-sm">{value}</div>
          <div className="text-sm text-gray-500">{shipment.carrierName}</div>
        </div>
      ),
    },
    {
      key: "serviceType",
      header: "Service",
      render: (value: string, shipment: Shipment) => (
        <div className="flex flex-col">
          <span className={`text-xs font-semibold tracking-wide flex items-center gap-1 ${getServiceTypeColor(value)}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              value === 'Economy' ? 'bg-gray-400' :
              value === 'Standard' ? 'bg-blue-500' :
              value === 'Express' ? 'bg-purple-500' :
              value === 'Overnight' ? 'bg-red-500' : 'bg-gray-400'
            }`}></span>
            {value}
          </span>
          <span className="text-[11px] text-gray-500 mt-0.5">{shipment.packageCount} pkg(s)</span>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (value: string) => (
        <span className={`text-xs font-semibold flex items-center gap-1 ${getPriorityColor(value)}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            value === 'Low' ? 'bg-green-500' :
            value === 'Medium' ? 'bg-amber-500' :
            value === 'High' ? 'bg-orange-500' :
            value === 'Urgent' ? 'bg-red-600' : 'bg-gray-400'
          }`}></span>
          {value}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => (
        <StatusPill status={value.toLowerCase().replace(' ', '-')} />
      ),
    },
    {
      key: "route",
      header: "Route",
      render: (_: any, shipment: Shipment) => (
        <div className="text-sm">
          <div className="font-medium">{shipment.origin}</div>
          <div className="text-gray-500">↓</div>
          <div className="font-medium">{shipment.destination}</div>
        </div>
      ),
    },
    {
      key: "estimatedDelivery",
      header: "Est. Delivery",
      className: "text-right",
      render: (value: string, shipment: Shipment) => {
        const date = new Date(value);
        const isOverdue = date < new Date() && shipment.status !== "Delivered";
        return (
          <div className={`text-right ${isOverdue ? 'text-red-600' : ''}`}>
            {formatDate(date, "MMM dd, yyyy")}
            {isOverdue && (
              <div className="text-xs text-red-500">Overdue</div>
            )}
            {shipment.actualDelivery && (
              <div className="text-xs text-green-600">
                Delivered: {formatDate(new Date(shipment.actualDelivery), "MMM dd")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, shipment: Shipment) => (
        <div className="flex gap-1">
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDetailShipment(shipment);
              setShowDetailDialog(true);
            }}
            data-testid={`button-view-${shipment.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(shipment);
            }}
            data-testid={`button-edit-${shipment.id}`}
          >
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
          {shipment.status !== "Delivered" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setStatusChangeShipment(shipment);
                setShowStatusChangeDialog(true);
              }}
              data-testid={`button-status-${shipment.id}`}
              title="Change Status"
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(shipment);
            }}
            data-testid={`button-delete-${shipment.id}`}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  // Pagination logic
  const totalPages = Math.ceil(enrichedShipments.length / pageSize);
  const paginatedShipments = enrichedShipments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Enhanced Card-style header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center shadow-xl">
              <Truck className="h-10 w-10 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-4xl font-bold tracking-tight text-black">
                  Shipment Tracking
                </h2>
                <div className="flex items-center gap-1 text-sm text-blue-600 bg-white border border-blue-200 px-3 py-1 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="font-semibold">Live Tracking</span>
                </div>
              </div>
              <p className="text-muted-foreground text-xl mb-3">
                Real-time tracking and logistics management
              </p>
                <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Total Shipments: <span className="text-blue-700 font-bold">{enrichedShipments.length}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Active: <span className="text-blue-700 font-bold">{shipments?.filter((s: Shipment) => s.status !== "Delivered" && s.status !== "Cancelled").length || 0}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Package className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Ready for Tracking: <span className="text-green-700 font-bold">{availableLpos?.length || 0}</span></span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {(availableLpos && availableLpos.length > 0) && (
              <Button 
                className="font-semibold px-8 py-3 flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white" 
                onClick={() => setShowAllLposDialog(true)}
                data-testid="button-generate-shipment"
              >
                <Package className="h-5 w-5" />
                Generate Shipment Tracking ({availableLpos.length})
              </Button>
            )}
            <Link href="/shipment-create-lpo">
              <Button 
                className="font-semibold px-8 py-3 flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white" 
                data-testid="button-create-from-lpo"
              >
                <FileText className="h-5 w-5" />
                Create from LPO
              </Button>
            </Link>
            <Button 
              className="font-semibold px-8 py-3 flex items-center gap-3" 
              onClick={() => setShowNewDialog(true)}
              data-testid="button-new-shipment"
            >
              <Plus className="h-5 w-5" />
              New Shipment
            </Button>
           
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 my-8">
  <Card className="relative overflow-hidden border-gray-200 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 rounded-full -mr-10 -mt-10 opacity-30"></div>
          <div className="flex flex-row items-start gap-4 p-6 relative z-10">
            <div className="rounded-xl bg-orange-500 p-3 shadow-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700 mb-1">Pending</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {enrichedShipments?.filter((s: Shipment) => s.status === "Pending").length || 0}
              </div>
              <div className="text-xs text-gray-600">Awaiting pickup</div>
            </div>
          </div>
        </Card>
        
  <Card className="relative overflow-hidden border-gray-200 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 rounded-full -mr-10 -mt-10 opacity-30"></div>
          <div className="flex flex-row items-start gap-4 p-6 relative z-10">
            <div className="rounded-xl bg-blue-500 p-3 shadow-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700 mb-1">In Transit</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {enrichedShipments?.filter((s: Shipment) => s.status === "In Transit").length || 0}
              </div>
              <div className="text-xs text-gray-600">On the way</div>
            </div>
          </div>
        </Card>
        
  <Card className="relative overflow-hidden border-gray-200 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 rounded-full -mr-10 -mt-10 opacity-30"></div>
          <div className="flex flex-row items-start gap-4 p-6 relative z-10">
            <div className="rounded-xl bg-yellow-500 p-3 shadow-lg">
              <Navigation className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700 mb-1">Out for Delivery</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {enrichedShipments?.filter((s: Shipment) => s.status === "Out for Delivery").length || 0}
              </div>
              <div className="text-xs text-gray-600">Final mile</div>
            </div>
          </div>
        </Card>
        
  <Card className="relative overflow-hidden border-gray-200 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 rounded-full -mr-10 -mt-10 opacity-30"></div>
          <div className="flex flex-row items-start gap-4 p-6 relative z-10">
            <div className="rounded-xl bg-green-500 p-3 shadow-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700 mb-1">Delivered</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {enrichedShipments?.filter((s: Shipment) => s.status === "Delivered").length || 0}
              </div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Deliveries Ready for Shipment Tracking */}
      <Card id="deliveries-ready-section" className="bg-gradient-to-br from-green-50 via-white to-green-50 border-green-200 shadow-lg">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Deliveries Ready for Shipment Tracking</h3>
                <p className="text-gray-600 mt-1">Generate shipment tracking for confirmed LPOs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsRefreshing(true);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos", { status: "Confirmed" }] }),
                    queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] })
                  ]);
                  // Clear current confirmedLpoData to allow fresh data to load
                  setConfirmedLpoData(null);
                  toast({
                    title: "Data Refreshed",
                    description: "LPO data has been refreshed successfully",
                  });
                  setTimeout(() => setIsRefreshing(false), 1000); // Show loading for 1 second
                }}
                disabled={isRefreshing}
                className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              {confirmedLpoData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmedLpoData(null);
                    sessionStorage.removeItem('confirmedLpoData');
                    toast({
                      title: "Section Cleared",
                      description: "Deliveries Ready for Shipment Tracking section has been cleared",
                    });
                  }}
                  className="flex items-center gap-2 text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  <XCircle className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {confirmedLposLoading ? (
              /* Loading state */
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-600">Loading confirmed LPOs...</p>
                </div>
              </div>
            ) : availableLpos && availableLpos.length > 0 ? (
              /* Display top 3 available LPOs with compact UI */
              <>
                {availableLpos.slice(0, 3).map((lpo: any) => (
                  <LpoItemComponent
                    key={lpo.id}
                    lpo={lpo}
                    fetchLpoItems={fetchLpoItems}
                    onGenerate={(lpoData) => {
                      setConfirmedLpoData(lpoData);
                      setShowGenerateForm(true);
                    }}
                  />
                ))}
                {availableLpos.length > 3 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-blue-700">
                      <Package className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {availableLpos.length - 3} more LPOs available for shipment tracking
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllLposDialog(true)}
                        className="ml-2 text-blue-600 border-blue-300 hover:bg-blue-100"
                      >
                        View All
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : confirmedLpoData ? (
              /* Fallback to sessionStorage data if API fails */
              <div className="bg-white border border-green-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-800">
                          {confirmedLpoData.lpoNumber} - {confirmedLpoData.supplierName}
                        </h4>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">LPO:</span> {confirmedLpoData.lpoNumber} | 
                        <span className="font-medium ml-2">Value:</span> {confirmedLpoData.currency} {parseFloat(confirmedLpoData.totalAmount || '0').toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Expected Delivery: {confirmedLpoData.expectedDeliveryDate ? new Date(confirmedLpoData.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
                      </div>
                    </div>
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                    onClick={() => setShowGenerateForm(true)}
                  >
                    + Generate Shipment Tracking
                  </Button>
                </div>
              </div>
            ) : (
              /* Empty state when no confirmed LPO data */
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-600 mb-2">No Confirmed LPOs Available</h4>
                    <p className="text-gray-500 mb-4">
                      Confirm LPOs in the Supplier LPO page to generate shipment tracking
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = '/supplier-lpo'}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      Go to Supplier LPOs
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Filters Section with show/hide button */}
      <Card className="p-6 shadow-lg border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-6 justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <Filter className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Filter Shipments</h3>
          </div>
          <Button
            variant="outline"
            className="shadow-sm flex items-center gap-1 px-2 py-0 h-6 min-h-0 text-xs"
            onClick={() => setShowFilters((prev) => !prev)}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-3 h-3 mr-1" />
            <span>{showFilters ? "Hide Filters" : "Show Filters"}</span>
          </Button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <div className="mb-1 text-sm text-black font-normal">Search</div>
              <Search className="absolute left-2 inset-y-10 my-auto h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search shipments..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm transition-all duration-200"
                data-testid="input-search"
              />
            </div>
            <div>
              <div className="mb-1 text-sm text-black font-normal">Status</div>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg" data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Picked Up">Picked Up</SelectItem>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Delayed">Delayed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-sm text-black font-normal">Priority</div>
              <Select
                value={filters.priority}
                onValueChange={(value) => setFilters({ ...filters, priority: value })}
              >
                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg" data-testid="select-priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-sm text-black font-normal">Service Type</div>
              <Select
                value={filters.serviceType}
                onValueChange={(value) => setFilters({ ...filters, serviceType: value })}
              >
                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg" data-testid="select-service-type">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="Economy">Economy</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Express">Express</SelectItem>
                  <SelectItem value="Overnight">Overnight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-sm text-black font-normal">Carrier</div>
              <Input
                placeholder="Filter by carrier..."
                value={filters.carrier}
                onChange={(e) => setFilters({ ...filters, carrier: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm transition-all duration-200"
              />
            </div>
            <div>
              <div className="mb-1 text-sm text-black font-normal">Date Range</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg",
                      !dateRange.from && "text-muted-foreground",
                      dateRange.from && "border-blue-300 bg-blue-50"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => handleDateRangeChange(range?.from, range?.to)}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </Card>

      {/* Enhanced Shipments Table */}
      <Card className="shadow-lg border-gray-200 bg-white">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Shipments</h3>
          </div>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-export-table">
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportShipments('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportShipments('excel')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div>
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Error loading shipments</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/shipments"] })}>
                Retry
              </Button>
            </div>
          ) : (
            <div>
              <DataTable
                data={paginatedShipments || []}
                columns={columns}
                isLoading={isLoading}
                emptyMessage="No shipments found. Create your first shipment to get started."
                onRowClick={(shipment: any) => {
                  navigate(`/shipment-tracking/${shipment.id}`);
                }}
              />
              {/* Pagination Controls */}
              {enrichedShipments.length > pageSize && (
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
          )}
        </div>
      </Card>

      {/* Enhanced New Shipment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="new-shipment-description">
          <p id="new-shipment-description" className="sr-only">Fill in the form to create a new shipment record.</p>
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold text-gray-800">Create New Shipment</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="salesOrderId" className="text-sm font-medium text-gray-700">Sales Order (Optional)</Label>
                  <Select
                    value={newShipment.salesOrderId}
                    onValueChange={(value) => {
                      const selectedOrder = salesOrders.find((order: any) => order.id === value);
                      setNewShipment({
                        ...newShipment,
                        salesOrderId: value,
                        salesOrderNumber: selectedOrder ? selectedOrder.orderNumber : ""
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg">
                      <SelectValue placeholder="Select sales order" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesOrders.map((order: any) => (
                        <SelectItem key={order.id} value={order.id}>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-gray-500" />
                            <span>{order.orderNumber}</span>
                            {order.customer && (
                              <span className="text-gray-500">- {order.customer.name}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="carrierId" className="text-sm font-medium text-gray-700">Carrier *</Label>
                  <Select
                    value={newShipment.carrierId}
                    onValueChange={(value) => {
                      const selectedCarrier = carriers.find((c: any) => c.id === value);
                      setNewShipment({
                        ...newShipment,
                        carrierId: value,
                        carrierName: selectedCarrier ? selectedCarrier.name : ""
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg">
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((carrier: any) => (
                        <SelectItem key={carrier.id} value={carrier.id}>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-gray-500" />
                            {carrier.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Service Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Navigation className="h-5 w-5 text-purple-600" />
                Service Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serviceType" className="text-sm font-medium text-gray-700">Service Type</Label>
                  <Select
                    value={newShipment.serviceType}
                    onValueChange={(value: "Standard" | "Express" | "Overnight" | "Economy") => 
                      setNewShipment({ ...newShipment, serviceType: value })}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Economy">Economy</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Express">Express</SelectItem>
                      <SelectItem value="Overnight">Overnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority" className="text-sm font-medium text-gray-700">Priority</Label>
                  <Select
                    value={newShipment.priority}
                    onValueChange={(value: "Low" | "Medium" | "High" | "Urgent") => 
                      setNewShipment({ ...newShipment, priority: value })}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg">
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
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                Location Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin" className="text-sm font-medium text-gray-700">Origin *</Label>
                  <Input
                    id="origin"
                    value={newShipment.origin}
                    onChange={(e) => setNewShipment({ ...newShipment, origin: e.target.value })}
                    placeholder="Origin address"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="destination" className="text-sm font-medium text-gray-700">Destination *</Label>
                  <Input
                    id="destination"
                    value={newShipment.destination}
                    onChange={(e) => setNewShipment({ ...newShipment, destination: e.target.value })}
                    placeholder="Destination address"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Package Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Package Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="weight" className="text-sm font-medium text-gray-700">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={newShipment.weight}
                    onChange={(e) => setNewShipment({ ...newShipment, weight: e.target.value })}
                    placeholder="0.0"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="dimensions" className="text-sm font-medium text-gray-700">Dimensions (LxWxH cm)</Label>
                  <Input
                    id="dimensions"
                    value={newShipment.dimensions}
                    onChange={(e) => setNewShipment({ ...newShipment, dimensions: e.target.value })}
                    placeholder="30x20x15"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="packageCount" className="text-sm font-medium text-gray-700">Package Count</Label>
                  <Input
                    id="packageCount"
                    type="number"
                    min="1"
                    value={newShipment.packageCount}
                    onChange={(e) => setNewShipment({ ...newShipment, packageCount: parseInt(e.target.value) || 1 })}
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Value & Delivery */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-red-600" />
                Value & Delivery
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="declaredValue" className="text-sm font-medium text-gray-700">Declared Value (AED)</Label>
                  <Input
                    id="declaredValue"
                    type="number"
                    step="0.01"
                    value={newShipment.declaredValue}
                    onChange={(e) => setNewShipment({ ...newShipment, declaredValue: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedDelivery" className="text-sm font-medium text-gray-700">Estimated Delivery</Label>
                  <Input
                    id="estimatedDelivery"
                    type="date"
                    value={newShipment.estimatedDelivery}
                    onChange={(e) => setNewShipment({ ...newShipment, estimatedDelivery: e.target.value })}
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    id="isInsured"
                    type="checkbox"
                    checked={newShipment.isInsured}
                    onChange={(e) => setNewShipment({ ...newShipment, isInsured: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="isInsured" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Insurance Required
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    id="requiresSignature"
                    type="checkbox"
                    checked={newShipment.requiresSignature}
                    onChange={(e) => setNewShipment({ ...newShipment, requiresSignature: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="requiresSignature" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Signature Required
                  </Label>
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <Label htmlFor="specialInstructions" className="text-sm font-medium text-gray-700">Special Instructions (Optional)</Label>
                <Textarea
                  id="specialInstructions"
                  value={newShipment.specialInstructions}
                  onChange={(e) => setNewShipment({ ...newShipment, specialInstructions: e.target.value })}
                  placeholder="Special handling or delivery instructions"
                  rows={3}
                  className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowNewDialog(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => createShipment.mutate(newShipment)}
                disabled={createShipment.isPending || !newShipment.carrierId || !newShipment.origin || !newShipment.destination}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8"
              >
                {createShipment.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Shipment
                  </div>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Shipment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-shipment-description">
          <p id="edit-shipment-description" className="sr-only">Modify existing shipment information and save changes.</p>
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Edit className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold text-gray-800">Edit Shipment {editingShipment?.shipmentNumber && (<span className="text-blue-600">#{editingShipment.shipmentNumber}</span>)}</DialogTitle>
            </div>
          </DialogHeader>
          {editingShipment && editShipmentForm && (
            <div className="space-y-6 pt-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Carrier *</Label>
                    <Select
                      value={editShipmentForm.carrierId}
                      onValueChange={(value) => {
                        const selectedCarrier = carriers.find((c: any) => c.id === value);
                        setEditShipmentForm({
                          ...editShipmentForm,
                          carrierId: value,
                          carrierName: selectedCarrier ? selectedCarrier.name : ''
                        });
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers.map((carrier: any) => (
                          <SelectItem key={carrier.id} value={carrier.id}>
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-gray-500" />
                              {carrier.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-purple-600" />
                  Service Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Service Type</Label>
                    <Select
                      value={editShipmentForm.serviceType}
                      onValueChange={(value: any) => setEditShipmentForm({ ...editShipmentForm, serviceType: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Economy">Economy</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Express">Express</SelectItem>
                        <SelectItem value="Overnight">Overnight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Priority</Label>
                    <Select
                      value={editShipmentForm.priority}
                      onValueChange={(value: any) => setEditShipmentForm({ ...editShipmentForm, priority: value })}
                    >
                      <SelectTrigger className="mt-1">
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
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Location Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Origin *</Label>
                    <Input
                      value={editShipmentForm.origin}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, origin: e.target.value })}
                      placeholder="Origin address"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Destination *</Label>
                    <Input
                      value={editShipmentForm.destination}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, destination: e.target.value })}
                      placeholder="Destination address"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Package Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  Package Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editShipmentForm.weight}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, weight: e.target.value })}
                      placeholder="0.0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Dimensions (LxWxH cm)</Label>
                    <Input
                      value={editShipmentForm.dimensions}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, dimensions: e.target.value })}
                      placeholder="30x20x15"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Package Count</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editShipmentForm.packageCount}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, packageCount: parseInt(e.target.value) || 1 })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Value & Delivery */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-red-600" />
                  Value & Delivery
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Declared Value (AED)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editShipmentForm.declaredValue}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, declaredValue: e.target.value })}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Estimated Delivery</Label>
                    <Input
                      type="date"
                      value={editShipmentForm.estimatedDelivery}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, estimatedDelivery: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={editShipmentForm.isInsured}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, isInsured: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label className="text-sm font-medium text-gray-700 cursor-pointer">
                      Insurance Required
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={editShipmentForm.requiresSignature}
                      onChange={(e) => setEditShipmentForm({ ...editShipmentForm, requiresSignature: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label className="text-sm font-medium text-gray-700 cursor-pointer">
                      Signature Required
                    </Label>
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <Label className="text-sm font-medium text-gray-700">Special Instructions (Optional)</Label>
                  <Textarea
                    value={editShipmentForm.specialInstructions}
                    onChange={(e) => setEditShipmentForm({ ...editShipmentForm, specialInstructions: e.target.value })}
                    placeholder="Special handling or delivery instructions"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingShipment(null);
                  }}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => editingShipment && updateShipment.mutate({ id: editingShipment.id, data: editShipmentForm })}
                  disabled={updateShipment.isPending || !editShipmentForm.carrierId || !editShipmentForm.origin || !editShipmentForm.destination}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
                  data-testid="button-save-edit-shipment"
                >
                  {updateShipment.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Save Changes
                    </div>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Track Shipment Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="track-shipment-description">
          <p id="track-shipment-description" className="sr-only">Track the status and location of your shipment in real time.</p>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-gray-800">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              Track Shipment: {trackingShipment?.shipmentNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Key Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <Label className="text-sm font-medium text-gray-600">Tracking Number</Label>
                <div className="font-mono text-lg font-semibold text-blue-700 mt-1">
                  {trackingShipment?.trackingNumber}
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <Label className="text-sm font-medium text-gray-600">Current Status</Label>
                <div className="mt-2">
                  <StatusPill status={trackingShipment?.status.toLowerCase().replace(' ', '-') || 'pending'} />
                </div>
              </div>
            </div>

            {/* Location and Time Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
                <Label className="text-sm font-medium text-gray-600">Current Location</Label>
                <div className="text-lg font-medium text-orange-700 mt-1">
                  {trackingShipment?.currentLocation || "Location updating..."}
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <Label className="text-sm font-medium text-gray-600">Last Update</Label>
                <div className="text-lg font-medium text-purple-700 mt-1">
                  {trackingShipment?.lastUpdate ? formatDate(new Date(trackingShipment.lastUpdate), "MMM dd, yyyy HH:mm") : "Updating..."}
                </div>
              </div>
            </div>
            {/* Tracking Timeline */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Tracking History
              </h3>
              <div className="space-y-4">
                {/* Enhanced tracking history with better design */}
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <div className="h-4 w-4 rounded-full bg-green-500 mt-1 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-green-800">📦 Package Delivered</div>
                    <div className="text-sm text-green-700 mt-1">Successfully delivered to reception desk - Signature obtained</div>
                    <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Today, 4:30 PM • {trackingShipment?.destination}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <div className="h-4 w-4 rounded-full bg-blue-500 mt-1 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-blue-800">🚚 Out for Delivery</div>
                    <div className="text-sm text-blue-700 mt-1">Package loaded on delivery vehicle - Driver: Ahmed Khan</div>
                    <div className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Today, 9:15 AM • Local Distribution Center
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
                  <div className="h-4 w-4 rounded-full bg-orange-500 mt-1 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-orange-800">🏭 Arrived at Facility</div>
                    <div className="text-sm text-orange-700 mt-1">Package arrived at distribution center - Ready for delivery</div>
                    <div className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Yesterday, 11:30 PM • Distribution Center - Dubai
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                  <div className="h-4 w-4 rounded-full bg-purple-500 mt-1 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-purple-800">🚛 In Transit</div>
                    <div className="text-sm text-purple-700 mt-1">Package in transit between facilities</div>
                    <div className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Yesterday, 2:15 PM • Highway Hub - Sharjah
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
                  <div className="h-4 w-4 rounded-full bg-gray-500 mt-1 flex-shrink-0 shadow-lg"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">📋 Package Picked Up</div>
                    <div className="text-sm text-gray-700 mt-1">Package collected from origin address</div>
                    <div className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      2 days ago, 3:45 PM • {trackingShipment?.origin}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowTrackingDialog(false)}
                className="px-6"
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  window.open(`https://track.carrier.com/${trackingShipment?.trackingNumber}`, '_blank');
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6"
              >
                <Globe className="h-4 w-4 mr-2" />
                Track on Carrier Website
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shipment Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" aria-describedby="shipment-detail-description">
          <p id="shipment-detail-description" className="sr-only">Detailed shipment information, status, route, and logistics metadata.</p>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Eye className="h-5 w-5 text-white" />
              </div>
              Shipment Details {detailShipment ? `– ${detailShipment.shipmentNumber}` : ''}
            </DialogTitle>
          </DialogHeader>
          {detailShipment && (
            <div className="space-y-8 pt-2">
              {/* Top Summary Badges */}
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  {getStatusIcon(detailShipment.status)} <span>{detailShipment.status}</span>
                </Badge>
                <Badge
                  variant="outline"
                  className={`shadow-none ${getPriorityColor(detailShipment.priority)}`}
                >
                  {detailShipment.priority} Priority
                </Badge>
                <Badge
                  variant="outline"
                  className={`shadow-none ${getServiceTypeColor(detailShipment.serviceType)}`}
                >
                  {detailShipment.serviceType} Service
                </Badge>
                {detailShipment.isInsured && <Badge variant="outline" className="text-xs">Insured</Badge>}
                {detailShipment.requiresSignature && <Badge variant="outline" className="text-xs">Signature Required</Badge>}
              </div>

              {/* Identification & Carrier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Shipment Number</Label>
                    <p className="text-sm font-semibold text-gray-800 font-mono">{detailShipment.shipmentNumber}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Tracking Number</Label>
                    <p className="text-sm font-semibold text-blue-700 font-mono">{detailShipment.trackingNumber}</p>
                  </div>
                  {detailShipment.salesOrderNumber && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Sales Order</Label>
                      <p className="text-sm font-medium">{detailShipment.salesOrderNumber}</p>
                    </div>
                  )}
                  
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Carrier</Label>
                    <p className="text-sm font-medium flex items-center gap-2"><Truck className="h-4 w-4 text-gray-500" /> {detailShipment.carrierName}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Current Location</Label>
                    <p className="text-sm font-medium">{detailShipment.currentLocation || 'Updating...'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Last Update</Label>
                    <p className="text-sm font-medium">{detailShipment.lastUpdate ? formatDate(new Date(detailShipment.lastUpdate), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Status</Label>
                    <div className="mt-1"><StatusPill status={detailShipment.status.toLowerCase().replace(' ', '-')} /></div>
                  </div>
                </div>
              </div>

              {/* Route & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 rounded-lg p-5 border border-gray-200">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Origin</Label>
                  <p className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-green-600" /> {detailShipment.origin}</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center text-gray-500 text-xs font-medium">
                    <Navigation className="h-5 w-5 mb-1 text-blue-500" />
                    Route
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Destination</Label>
                  <p className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-red-600" /> {detailShipment.destination}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Estimated Delivery</Label>
                  <p className="text-sm font-medium">{detailShipment.estimatedDelivery ? formatDate(new Date(detailShipment.estimatedDelivery), 'MMM dd, yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Actual Delivery</Label>
                  <p className="text-sm font-medium">{detailShipment.actualDelivery ? formatDate(new Date(detailShipment.actualDelivery), 'MMM dd, yyyy') : '—'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Service Type</Label>
                  <p className="text-sm font-medium">{detailShipment.serviceType}</p>
                </div>
              </div>

              {/* Package & Financial Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3 p-4 border rounded-lg bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Package className="h-4 w-4 text-orange-600" /> Package</h4>
                  <div className="text-xs text-gray-500 grid grid-cols-2 gap-y-2">
                    <span className="font-medium text-gray-500">Weight</span><span className="font-semibold text-gray-800">{detailShipment.weight || '—'} kg</span>
                    <span className="font-medium text-gray-500">Dimensions</span><span className="font-semibold text-gray-800">{detailShipment.dimensions || '—'}</span>
                    <span className="font-medium text-gray-500">Packages</span><span className="font-semibold text-gray-800">{detailShipment.packageCount}</span>
                    <span className="font-medium text-gray-500">Signature</span><span className="font-semibold text-gray-800">{detailShipment.requiresSignature ? 'Required' : 'No'}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4 border rounded-lg bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" /> Value</h4>
                  <div className="text-xs text-gray-500 grid grid-cols-2 gap-y-2">
                    <span className="font-medium text-gray-500">Declared</span><span className="font-semibold text-gray-800">{detailShipment.declaredValue || '0.00'} {detailShipment.currency}</span>
                    <span className="font-medium text-gray-500">Shipping Cost</span><span className="font-semibold text-gray-800">{detailShipment.shippingCost || '0.00'} {detailShipment.currency}</span>
                    <span className="font-medium text-gray-500">Insured</span><span className="font-semibold text-gray-800">{detailShipment.isInsured ? 'Yes' : 'No'}</span>
                    <span className="font-medium text-gray-500">Priority</span><span className="font-semibold text-gray-800">{detailShipment.priority}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4 border rounded-lg bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock className="h-4 w-4 text-green-600" /> Timestamps</h4>
                  <div className="text-xs text-gray-500 grid grid-cols-2 gap-y-2">
                    <span className="font-medium text-gray-500">Created</span><span className="font-semibold text-gray-800">{detailShipment.createdAt ? formatDate(new Date(detailShipment.createdAt), 'MMM dd, yyyy') : '—'}</span>
                    <span className="font-medium text-gray-500">Updated</span><span className="font-semibold text-gray-800">{detailShipment.updatedAt ? formatDate(new Date(detailShipment.updatedAt), 'MMM dd, yyyy HH:mm') : '—'}</span>
                    <span className="font-medium text-gray-500">Last Update</span><span className="font-semibold text-gray-800">{detailShipment.lastUpdate ? formatDate(new Date(detailShipment.lastUpdate), 'MMM dd, yyyy HH:mm') : '—'}</span>
                    <span className="font-medium text-gray-500">Est Days</span><span className="font-semibold text-gray-800">{detailShipment.estimatedDelivery ? Math.max(0, Math.round((new Date(detailShipment.estimatedDelivery).getTime() - new Date(detailShipment.createdAt).getTime()) / (1000*60*60*24))) : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              

              {/* Items Information */}
              {(detailShipment as any).items && (detailShipment as any).items.length > 0 && (
                <div className="space-y-3 p-4 border rounded-lg bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-green-600" /> Items in Shipment</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(detailShipment as any).items.map((item: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded p-3 border border-gray-200">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <h5 className="text-xs font-medium text-gray-800">{item.itemDescription}</h5>
                            {item.specialInstructions && (
                              <p className="text-xs text-gray-600 mt-1">{item.specialInstructions}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-gray-800">
                              {item.quantity} {item.unitOfMeasure || 'pcs'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {item.unitCost && (
                            <div>
                              <span className="text-gray-500">Unit:</span>
                              <span className="ml-1 font-medium">{detailShipment.currency || 'BHD'} {parseFloat(item.unitCost).toLocaleString()}</span>
                            </div>
                          )}
                          {item.totalCost && (
                            <div>
                              <span className="text-gray-500">Total:</span>
                              <span className="ml-1 font-semibold text-green-700">{detailShipment.currency || 'BHD'} {parseFloat(item.totalCost).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Items Summary */}
                  <div className="bg-blue-50 rounded p-3 border border-blue-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-blue-800">Total Items:</span>
                      <span className="font-semibold text-blue-900">
                        {(detailShipment as any).items.reduce((sum: number, item: any) => sum + (parseInt(item.quantity) || 0), 0)} items
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="font-medium text-blue-800">Subtotal:</span>
                      <span className="font-semibold text-blue-900">
                        {detailShipment.currency || 'BHD'} {
                          (detailShipment as any).items
                            .reduce((sum: number, item: any) => sum + (parseFloat(item.totalCost) || 0), 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              {detailShipment.specialInstructions && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500">Special Instructions</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200 whitespace-pre-wrap">
                    {detailShipment.specialInstructions}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailDialog(false);
                    setDetailShipment(null);
                  }}
                  data-testid="button-close-shipment-detail"
                >
                  Close
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDetailDialog(false);
                    setShowTrackingDialog(true);
                    setTrackingShipment(detailShipment);
                  }}
                  data-testid="button-track-from-detail"
                  className=""
                >
                  <Navigation className="h-4 w-4 mr-2" /> Track Shipment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingShipment} onOpenChange={() => setDeletingShipment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the shipment
              "{deletingShipment?.shipmentNumber}" and all associated tracking data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingShipment && deleteShipment.mutate(deletingShipment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteShipment.isPending}
            >
              {deleteShipment.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Shipment Tracking Form Dialog */}
      <Dialog open={showGenerateForm} onOpenChange={setShowGenerateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="generate-shipment-description">
          <p id="generate-shipment-description" className="sr-only">Fill in the form to generate shipment tracking from confirmed LPO.</p>
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold text-gray-800">Generate Shipment Tracking</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {/* LPO Information Display */}
            {confirmedLpoData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  LPO Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="font-medium text-green-700">LPO Number:</span>
                    <p className="text-green-800 font-semibold">{confirmedLpoData.lpoNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Supplier:</span>
                    <p className="text-green-800 font-semibold">{confirmedLpoData.supplierName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Total Value:</span>
                    <p className="text-green-800 font-semibold">{confirmedLpoData.currency} {parseFloat(confirmedLpoData.totalAmount || '0').toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Expected Delivery:</span>
                    <p className="text-green-800 font-semibold">
                      {confirmedLpoData.expectedDeliveryDate ? new Date(confirmedLpoData.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Items Count:</span>
                    <p className="text-green-800 font-semibold">{confirmedLpoData.items?.length || 0} items</p>
                  </div>
                </div>
                {/* Items Details */}
                {confirmedLpoData.items && confirmedLpoData.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <h4 className="text-sm font-semibold text-green-700 mb-2">Items in this LPO:</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {confirmedLpoData.items.map((item: any, index: number) => (
                        <div key={index} className="text-xs text-green-700 bg-green-100 rounded px-2 py-1">
                          <span className="font-medium">{item.quantity || 1}x</span> {item.itemDescription || 'Item'} 
                          {item.unitCost && (
                            <span className="ml-2 text-green-600">
                              @ {confirmedLpoData.currency} {parseFloat(item.unitCost).toLocaleString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Shipment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="generate-carrierId" className="text-sm font-medium text-gray-700">Carrier *</Label>
                  <Select
                    value={generateFormData.carrierId}
                    onValueChange={(value) => {
                      const selectedCarrier = carriers.find((c: any) => c.id === value);
                      setGenerateFormData({
                        ...generateFormData,
                        carrierId: value,
                        carrierName: selectedCarrier ? selectedCarrier.name : ""
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg">
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((carrier: any) => (
                        <SelectItem key={carrier.id} value={carrier.id}>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-gray-500" />
                            {carrier.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="generate-serviceType" className="text-sm font-medium text-gray-700">Service Type</Label>
                  <Select
                    value={generateFormData.serviceType}
                    onValueChange={(value: "Standard" | "Express" | "Overnight" | "Economy") => 
                      setGenerateFormData({ ...generateFormData, serviceType: value })}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Economy">Economy</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Express">Express</SelectItem>
                      <SelectItem value="Overnight">Overnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                Location Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="generate-origin" className="text-sm font-medium text-gray-700">Origin *</Label>
                  <Input
                    id="generate-origin"
                    value={generateFormData.origin}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, origin: e.target.value })}
                    placeholder="Origin address"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="generate-destination" className="text-sm font-medium text-gray-700">Destination *</Label>
                  <Input
                    id="generate-destination"
                    value={generateFormData.destination}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, destination: e.target.value })}
                    placeholder="Destination address"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Package Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Package Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="generate-weight" className="text-sm font-medium text-gray-700">Weight (kg)</Label>
                  <Input
                    id="generate-weight"
                    type="number"
                    step="0.1"
                    value={generateFormData.weight}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, weight: e.target.value })}
                    placeholder="0.0"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="generate-dimensions" className="text-sm font-medium text-gray-700">Dimensions (LxWxH cm)</Label>
                  <Input
                    id="generate-dimensions"
                    value={generateFormData.dimensions}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, dimensions: e.target.value })}
                    placeholder="30x20x15"
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="generate-packageCount" className="text-sm font-medium text-gray-700">Package Count</Label>
                  <Input
                    id="generate-packageCount"
                    type="number"
                    min="1"
                    value={generateFormData.packageCount}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, packageCount: parseInt(e.target.value) || 1 })}
                    className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                Additional Options
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    id="generate-isInsured"
                    type="checkbox"
                    checked={generateFormData.isInsured}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, isInsured: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="generate-isInsured" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Insurance Required
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    id="generate-requiresSignature"
                    type="checkbox"
                    checked={generateFormData.requiresSignature}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, requiresSignature: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="generate-requiresSignature" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Signature Required
                  </Label>
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <Label htmlFor="generate-specialInstructions" className="text-sm font-medium text-gray-700">Special Instructions (Optional)</Label>
              <Textarea
                id="generate-specialInstructions"
                value={generateFormData.specialInstructions}
                onChange={(e) => setGenerateFormData({ ...generateFormData, specialInstructions: e.target.value })}
                placeholder="Special handling or delivery instructions"
                rows={3}
                className="mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowGenerateForm(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // Create shipment from LPO data
                  const shipmentData = {
                    ...generateFormData,
                    salesOrderNumber: confirmedLpoData?.lpoNumber || "",
                    estimatedDelivery: confirmedLpoData?.expectedDeliveryDate || "",
                    declaredValue: confirmedLpoData?.totalAmount || "0",
                    currency: confirmedLpoData?.currency || "BHD",
                    // Include customer and items information
                    customerName: confirmedLpoData?.customerName || "",
                    customerReference: confirmedLpoData?.customerName || "",
                    supplierName: confirmedLpoData?.supplierName || "",
                    supplierId: confirmedLpoData?.supplierId, // Add supplier ID from confirmed LPO data
                    items: confirmedLpoData?.items || [],
                    // Additional LPO details
                    subtotal: confirmedLpoData?.subtotal || "0",
                    taxAmount: confirmedLpoData?.taxAmount || "0",
                    paymentTerms: confirmedLpoData?.paymentTerms || "",
                    deliveryTerms: confirmedLpoData?.deliveryTerms || "",
                    specialInstructions: confirmedLpoData?.specialInstructions || generateFormData.specialInstructions || "",
                    // LPO reference information
                    lpoId: confirmedLpoData?.lpoId || null,
                    lpoNumber: confirmedLpoData?.lpoNumber || "",
                  };
                  
                  console.log('Generating shipment from LPO data:', {
                    shipmentData,
                    confirmedLpoData
                  });
                  
                  createShipment.mutate(shipmentData, {
                    onSuccess: () => {
                      setShowGenerateForm(false);
                      // Don't immediately clear confirmedLpoData - let it persist for the session
                      // setConfirmedLpoData(null);
                      // Reset form data
                      setGenerateFormData({
                        lpoId: "",
                        lpoNumber: "",
                        supplierName: "",
                        customerName: "",
                        expectedDeliveryDate: "",
                        totalAmount: "",
                        currency: "BHD",
                        carrierId: "",
                        carrierName: "",
                        serviceType: "Standard",
                        priority: "Medium",
                        origin: "",
                        destination: "",
                        weight: "",
                        dimensions: "",
                        packageCount: 1,
                        isInsured: false,
                        requiresSignature: false,
                        specialInstructions: "",
                      });
                      // Clear sessionStorage after successful generation
                      sessionStorage.removeItem('confirmedLpoData');
                    },
                    onError: (error) => {
                      console.error('Failed to generate shipment from LPO:', error);
                    }
                  });
                }}
                disabled={createShipment.isPending || !generateFormData.carrierId || !generateFormData.origin || !generateFormData.destination}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8"
              >
                {createShipment.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Generate Shipment Tracking
                  </div>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* All Available LPOs Dialog */}
      <Dialog open={showAllLposDialog} onOpenChange={setShowAllLposDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="all-lpos-description">
          <p id="all-lpos-description" className="sr-only">Select an LPO to generate shipment tracking from.</p>
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold text-gray-800">
                Available LPOs for Shipment Tracking ({availableLpos?.length || 0})
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {availableLpos && availableLpos.length > 0 ? (
              <div className="space-y-3">
                {availableLpos.map((lpo: any) => (
                  <LpoItemCard
                    key={lpo.id}
                    lpo={lpo}
                    onSelect={(selectedLpo, items) => {
                      // Set the selected LPO data for the form
                      setConfirmedLpoData({
                        lpoId: selectedLpo.id,
                        lpoNumber: selectedLpo.lpoNumber,
                        supplierName: selectedLpo.supplier?.name || 'Unknown Supplier',
                        supplierId: selectedLpo.supplierId, // Add supplier ID
                        customerName: selectedLpo.customer?.name || 'Unknown Customer',
                        expectedDeliveryDate: selectedLpo.expectedDeliveryDate,
                        totalAmount: selectedLpo.totalAmount,
                        currency: selectedLpo.currency || 'BHD',
                        items: items,
                        createdAt: selectedLpo.createdAt,
                        status: 'Confirmed'
                      });
                      setShowAllLposDialog(false);
                      setShowGenerateForm(true);
                    }}
                    fetchLpoItems={fetchLpoItems}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-600 mb-2">No Available LPOs</h4>
                    <p className="text-gray-500 mb-4">
                      All confirmed LPOs have already been used for shipment tracking
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <DialogContent className="max-w-md" aria-describedby="status-change-description">
          <p id="status-change-description" className="sr-only">Change the status of the selected shipment.</p>
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-800">
                Change Shipment Status
              </DialogTitle>
            </div>
          </DialogHeader>
          {statusChangeShipment && (
            <div className="space-y-6 pt-4">
              {/* Current Status Display */}
              <div className={`rounded-lg p-4 ${statusChangeShipment.status === "Delivered" ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Shipment Number</Label>
                    <p className="text-lg font-semibold text-gray-800">{statusChangeShipment.shipmentNumber}</p>
                  </div>
                  <div className="text-right">
                    <Label className="text-sm font-medium text-gray-600">Current Status</Label>
                    <div className="mt-1">
                      <StatusPill status={statusChangeShipment.status.toLowerCase().replace(' ', '-')} />
                    </div>
                    {statusChangeShipment.status === "Delivered" && (
                      <p className="text-xs text-green-600 mt-1 font-medium">✓ Final Status - No Changes Allowed</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Selection */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-status" className="text-sm font-medium text-gray-700">New Status *</Label>
                  <Select
                    value={newStatus}
                    onValueChange={(value) => setNewStatus(value)}
                    disabled={statusChangeShipment.status === "Delivered"}
                  >
                    <SelectTrigger className={`mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg ${statusChangeShipment.status === "Delivered" ? "bg-gray-100 cursor-not-allowed" : ""}`}>
                      <SelectValue placeholder={statusChangeShipment.status === "Delivered" ? "Status cannot be changed" : "Select new status"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          Pending
                        </div>
                      </SelectItem>
                      <SelectItem value="Picked Up">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-500" />
                          Picked Up
                        </div>
                      </SelectItem>
                      <SelectItem value="In Transit">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-600" />
                          In Transit
                        </div>
                      </SelectItem>
                      <SelectItem value="Out for Delivery">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-orange-500" />
                          Out for Delivery
                        </div>
                      </SelectItem>
                      {statusChangeShipment?.status !== "Delivered" && (
                        <SelectItem value="Delivered">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Delivered
                          </div>
                        </SelectItem>
                      )}
                      <SelectItem value="Delayed">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Delayed
                        </div>
                      </SelectItem>
                      <SelectItem value="Cancelled">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Cancelled
                        </div>
                      </SelectItem>
                      <SelectItem value="Lost">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Lost
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Location Update */}
                <div>
                  <Label htmlFor="current-location" className="text-sm font-medium text-gray-700">Current Location (Optional)</Label>
                  <Input
                    id="current-location"
                    placeholder={statusChangeShipment.status === "Delivered" ? "Location cannot be updated" : "Enter current location"}
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    disabled={statusChangeShipment.status === "Delivered"}
                    className={`mt-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg ${statusChangeShipment.status === "Delivered" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusChangeDialog(false);
                    setStatusChangeShipment(null);
                    setNewStatus("");
                    setNewLocation("");
                  }}
                  className="px-6"
                >
                  {statusChangeShipment.status === "Delivered" ? "Close" : "Cancel"}
                </Button>
                {statusChangeShipment.status !== "Delivered" && (
                  <Button
                    onClick={() => {
                      if (newStatus) {
                        updateShipmentStatus.mutate({
                          id: statusChangeShipment.id,
                          status: newStatus,
                          currentLocation: newLocation || statusChangeShipment.currentLocation
                        });
                      }
                    }}
                    disabled={updateShipmentStatus.isPending || !newStatus}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6"
                  >
                    {updateShipmentStatus.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Updating...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Update Status
                      </div>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}