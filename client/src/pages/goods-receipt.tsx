import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash, Package, Scan, AlertTriangle, Check, Clock, CheckCircle, Truck, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Link } from "wouter";
import DataTable, { Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState as ReactState, useEffect as ReactEffect } from "react";

// Component for displaying delivered shipments ready for goods receipt
function DeliveredShipmentsSection({ createGoodsReceipt }: { createGoodsReceipt: any }) {
  const [deliveredShipments, setDeliveredShipments] = ReactState<any[]>([]);
  const [isLoading, setIsLoading] = ReactState(false);
  const [expandedShipment, setExpandedShipment] = ReactState<string | null>(null);
  const [supplierDetails, setSupplierDetails] = ReactState<Record<string, any>>({});
  const [customerDetails, setCustomerDetails] = ReactState<Record<string, any>>({});
  const [processingShipments, setProcessingShipments] = ReactState<Set<string>>(new Set());
  const [processedShipments, setProcessedShipments] = ReactState<Set<string>>(new Set());
  const { toast } = useToast();

  // Load processed shipments from localStorage on component mount
  ReactEffect(() => {
    const savedProcessed = localStorage.getItem('processedShipments');
    if (savedProcessed) {
      try {
        const processedArray = JSON.parse(savedProcessed);
        setProcessedShipments(new Set(processedArray));
      } catch (error) {
        console.error('Error loading processed shipments from localStorage:', error);
      }
    }
  }, []);

  // Fetch delivered shipments from API
  ReactEffect(() => {
    const fetchDeliveredShipments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/shipments?status=Delivered&limit=50');
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched delivered shipments:', data);
          setDeliveredShipments(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching delivered shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeliveredShipments();
  }, []);

  // Check for delivered shipment data from sessionStorage (from shipment tracking page)
  ReactEffect(() => {
    const storedData = sessionStorage.getItem('deliveredShipmentData');
    if (storedData) {
      try {
        const shipmentData = JSON.parse(storedData);
        console.log('Received delivered shipment data:', shipmentData);
        
        // Add to the list if not already present
        setDeliveredShipments(prev => {
          const exists = prev.some(s => s.id === shipmentData.shipmentId);
          if (!exists) {
            return [shipmentData, ...prev];
          }
          return prev;
        });
        
        // Clear the stored data
        sessionStorage.removeItem('deliveredShipmentData');
      } catch (error) {
        console.error('Error parsing delivered shipment data:', error);
      }
    }
  }, []);

  // Fetch supplier/carrier details
  const fetchSupplierDetails = async (supplierId: string) => {
    if (supplierDetails[supplierId]) return supplierDetails[supplierId];
    
    try {
      // Try suppliers endpoint first, then carriers if not found
      let response = await fetch(`/api/suppliers/${supplierId}`);
      if (!response.ok) {
        response = await fetch(`/api/carriers/${supplierId}`);
      }
      
      if (response.ok) {
        const supplier = await response.json();
        setSupplierDetails(prev => ({ ...prev, [supplierId]: supplier }));
        return supplier;
      }
    } catch (error) {
      console.error('Error fetching supplier/carrier details:', error);
    }
    return null;
  };

  // Fetch customer details
  const fetchCustomerDetails = async (customerName: string) => {
    if (customerDetails[customerName]) return customerDetails[customerName];
    
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(customerName)}`);
      if (response.ok) {
        const customers = await response.json();
        const customer = customers.find((c: any) => c.name === customerName);
        if (customer) {
          setCustomerDetails(prev => ({ ...prev, [customerName]: customer }));
          return customer;
        }
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
    return null;
  };

  // Test function for debugging - can be called from browser console
  const testGoodsReceiptCreation = async () => {
    try {
      console.log('Testing goods receipt creation...');
      
      // First, get a real supplier ID
      const suppliersResponse = await apiRequest("GET", "/api/suppliers?limit=1");
      const suppliers = await suppliersResponse.json();
      
      if (!suppliers || suppliers.length === 0) {
        console.error('No suppliers found. Cannot test goods receipt creation.');
        return;
      }
      
      const supplierId = suppliers[0].id;
      console.log('Using supplier ID:', supplierId);
      
      const testData = {
        header: {
          // receiptNumber will be auto-generated by the backend
          supplierId: supplierId,
          receiptDate: new Date().toISOString().split('T')[0],
          status: 'Draft',
          receivedBy: 'test-user',
          totalItems: 1,
          totalQuantityExpected: 1,
          totalQuantityReceived: 1,
          discrepancyFlag: false
        },
        items: [{
          itemDescription: 'Test Item',
          quantityExpected: 1,
          quantityReceived: 1,
          unitCost: '10.00',
          totalCost: '10.00',
          condition: 'Good',
          storageLocation: 'MAIN'
        }]
      };
      
      console.log('Sending test data:', testData);
      const response = await apiRequest("POST", "/api/goods-receipts", testData);
      console.log('Test response:', response);
    } catch (error) {
      console.error('Test error:', error);
      console.error('Error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        response: (error as any)?.response?.data
      });
    }
  };

  // Make test function available globally for debugging
  (window as any).testGoodsReceiptCreation = testGoodsReceiptCreation;

  const handleGenerateGoodsReceipt = async (shipment: any) => {
    const shipmentId = shipment.shipmentId || shipment.id || shipment.trackingNumber;
    
    // Prevent multiple clicks on the same shipment
    if (processingShipments.has(shipmentId)) {
      console.log('Goods receipt generation already in progress for shipment:', shipmentId);
      return;
    }

    // Add shipment to processing set
    setProcessingShipments(prev => {
      const newSet = new Set(prev);
      newSet.add(shipmentId);
      return newSet;
    });

    try {
      // Check if supplier ID is available, or use carrier as supplier
      let supplierId = shipment.supplierId || shipment.supplier?.id;
      let supplierName = shipment.supplierName || shipment.supplier?.name;
      
      // If no supplier ID, try to use carrier as supplier
      if (!supplierId && shipment.carrierId) {
        supplierId = shipment.carrierId;
        supplierName = shipment.carrierName || shipment.carrier?.name;
      }
      
      // If still no supplier ID, create a default supplier or show error
      if (!supplierId) {
        // Try to find or create a default supplier
        try {
          const defaultSupplierResponse = await apiRequest("GET", "/api/suppliers?search=Default&limit=1");
          const defaultSuppliers = await defaultSupplierResponse.json();
          
          if (defaultSuppliers && defaultSuppliers.length > 0) {
            supplierId = defaultSuppliers[0].id;
            supplierName = defaultSuppliers[0].name;
          } else {
            // Create a default supplier for this carrier
            const newSupplier = {
              name: shipment.carrierName || 'Unknown Carrier',
              contactPerson: 'System Generated',
              email: 'system@default.com',
              phone: 'N/A',
              address: 'System Generated Address',
              status: 'Active'
            };
            
            const createSupplierResponse = await apiRequest("POST", "/api/suppliers", newSupplier);
            const createdSupplier = await createSupplierResponse.json();
            supplierId = createdSupplier.id;
            supplierName = createdSupplier.name;
          }
        } catch (supplierError) {
          console.error('Error creating/finding supplier:', supplierError);
          toast({
            title: "Missing Supplier Information",
            description: "This shipment doesn't have supplier or carrier information. Cannot create goods receipt.",
            variant: "destructive",
          });
          return;
        }
      }

      // Validate supplier exists before proceeding
      try {
        const supplierResponse = await apiRequest("GET", `/api/suppliers/${supplierId}`);
        const supplier = await supplierResponse.json();
        if (!supplier) {
          throw new Error('Supplier not found');
        }
      } catch (supplierValidationError) {
        console.error('Supplier validation failed:', supplierValidationError);
        toast({
          title: "Invalid Supplier",
          description: "The supplier for this shipment could not be validated. Cannot create goods receipt.",
          variant: "destructive",
        });
        return;
      }

      // Generate receipt number with better uniqueness
      const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).slice(2,7).toUpperCase();
      const receiptNumber = `GRN-${timestamp}-${randomSuffix}`;
      
      // Calculate totals properly
      const items = shipment.items || [];
      const totalItems = items.length;
      const totalQuantityExpected = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
      const totalQuantityReceived = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
      
      // Prepare goods receipt header data with proper data types
      const goodsReceiptHeader = {
        receiptNumber: receiptNumber,
        supplierLpoId: shipment.lpoId || null,
        supplierId: supplierId,
        receiptDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        actualDeliveryDate: shipment.actualDelivery ? new Date(shipment.actualDelivery).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        receivedBy: 'system',
        status: 'Draft',
        notes: `Generated from shipment ${shipment.shipmentNumber || shipment.trackingNumber}. ${supplierName ? `Supplier: ${supplierName}` : 'Carrier: ' + (shipment.carrierName || 'Unknown')}. Customer: ${shipment.customerName || 'Unknown'}.${shipment.lpoNumber ? ` LPO: ${shipment.lpoNumber}` : ''}${shipment.declaredValue ? ` Value: ${formatCurrency(parseFloat(shipment.declaredValue), shipment.currency || 'BHD')}` : ''}.`,
        lpoNumber: shipment.lpoNumber || null,
        lpoValue: shipment.declaredValue ? parseFloat(shipment.declaredValue).toString() : null,
        lpoCurrency: shipment.currency || 'BHD',
        totalItems: totalItems,
        totalQuantityExpected: totalQuantityExpected,
        totalQuantityReceived: totalQuantityReceived,
        discrepancyFlag: false
      };

      // Prepare goods receipt items from shipment items with proper data types
      let goodsReceiptItems = items.map((item: any, index: number) => {
        const quantity = Number(item.quantity) || 0;
        const unitCost = parseFloat(item.unitCost || item.unitPrice || "0");
        const totalCost = quantity * unitCost;
        
        // Use actual discount and VAT data from LPO item if available
        const discountPercent = parseFloat(item.discountPercent || item.discountPercentage || "0");
        const discountAmount = parseFloat(item.discountAmount || "0");
        const vatPercent = parseFloat(item.vatPercent || item.vatPercentage || "0");
        const vatAmount = parseFloat(item.vatAmount || "0");
        
        // Calculate discount and VAT amounts if not provided
        const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (totalCost * discountPercent / 100);
        const calculatedVatAmount = vatAmount > 0 ? vatAmount : (totalCost * vatPercent / 100);
        
        return {
          itemDescription: item.itemDescription || item.description || `Item ${index + 1}`,
          quantityExpected: quantity,
          quantityReceived: quantity,
          unitCost: unitCost.toFixed(2),
          totalCost: totalCost.toFixed(2),
          // Use actual discount and VAT data from LPO item
          taxRate: vatPercent.toFixed(2),
          taxAmount: calculatedVatAmount.toFixed(2),
          discountRate: discountPercent.toFixed(2),
          discountAmount: calculatedDiscountAmount.toFixed(2),
          supplierCode: item.supplierCode || item.supplier_code || "",
          barcode: item.barcode || "",
          itemId: item.itemId || null,
          lpoItemId: item.lpoItemId || null,
          storageLocation: "MAIN",
          condition: "Good",
          notes: item.notes || ""
        };
      });

      // If no items in shipment, create a placeholder item
      if (goodsReceiptItems.length === 0) {
        const declaredValue = parseFloat(shipment.declaredValue || "0");
        goodsReceiptItems = [{
          itemDescription: `Shipment from ${shipment.carrierName || 'Unknown Carrier'}`,
          quantityExpected: 1,
          quantityReceived: 1,
          unitCost: declaredValue.toFixed(2),
          totalCost: declaredValue.toFixed(2),
          supplierCode: "",
          barcode: "",
          itemId: null,
          lpoItemId: null,
          storageLocation: "MAIN",
          condition: "Good",
          notes: `Generated from shipment ${shipment.shipmentNumber || shipment.trackingNumber}`
        }];
      }

      console.log('Creating goods receipt with items:', { header: goodsReceiptHeader, items: goodsReceiptItems });

      // Validate data before sending
      if (!goodsReceiptHeader.supplierId) {
        throw new Error('Supplier ID is required');
      }
      if (!goodsReceiptHeader.receiptNumber) {
        throw new Error('Receipt number is required');
      }
      if (!goodsReceiptHeader.receiptDate) {
        throw new Error('Receipt date is required');
      }

      // Call the batch create mutation with header and items
      await createGoodsReceipt.mutateAsync({
        header: goodsReceiptHeader,
        items: goodsReceiptItems
      });

      // Show success notification
      toast({
        title: "Goods Receipt Generated",
        description: `Goods receipt created successfully for shipment ${shipment.shipmentNumber || shipment.trackingNumber}`,
      });

      // Mark the shipment as processed instead of removing it
      const shipmentId = shipment.shipmentId || shipment.id || shipment.trackingNumber;
      setProcessedShipments(prev => {
        const newSet = new Set([...prev, shipmentId]);
        // Save to localStorage for persistence
        localStorage.setItem('processedShipments', JSON.stringify([...newSet]));
        return newSet;
      });

    } catch (error) {
      console.error('Error generating goods receipt:', error);
      const errorMessage = (error as any)?.message || "Failed to generate goods receipt. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      // Remove shipment from processing set
      setProcessingShipments(prev => {
        const newSet = new Set(prev);
        newSet.delete(shipmentId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading delivered shipments...</p>
      </div>
    );
  }

  if (!deliveredShipments || deliveredShipments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Truck className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">No Delivered Shipments</h4>
            <p className="text-gray-600">There are no delivered shipments ready for goods receipt generation.</p>
          </div>
          <button
            onClick={testGoodsReceiptCreation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Test Goods Receipt Creation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliveredShipments.slice(0, 3).map((shipment: any) => {
        const isExpanded = expandedShipment === (shipment.shipmentId || shipment.id);
        const supplier = supplierDetails[shipment.supplierId] || null;
        const customer = customerDetails[shipment.customerName] || null;
        const shipmentId = shipment.shipmentId || shipment.id || shipment.trackingNumber;
        const isProcessed = processedShipments.has(shipmentId);
        
        return (
          <div key={shipment.shipmentId || shipment.id} className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
            isProcessed ? 'border-blue-200 bg-blue-50' : 'border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  isProcessed ? 'bg-blue-500' : 'bg-green-500'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1">
                      {isProcessed ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-700">Goods Receipt Generated</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-medium text-green-700">Delivered</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">•</span>
                    <h4 className="text-sm font-semibold text-gray-800 truncate">
                      {shipment.shipmentNumber || shipment.trackingNumber}
                    </h4>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs font-medium text-gray-600 truncate">
                      {shipment.supplierName || shipment.carrierName || 'Unknown Supplier'}
                    </span>
                    {shipment.trackingNumber && shipment.trackingNumber !== shipment.shipmentNumber && (
                      <>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-blue-600 font-mono">
                          {shipment.trackingNumber}
                        </span>
                      </>
                    )}
                  </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-1">
                            
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">LPO Value:</span> {formatCurrency(parseFloat(shipment.declaredValue || '0'), shipment.currency || 'BHD')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">Delivered:</span> {shipment.actualDelivery ? new Date(shipment.actualDelivery).toLocaleDateString() : 'Not set'}
                            </div>
                            {shipment.lpoNumber && (
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3 text-gray-400" />
                                <span className="font-medium">LPO:</span> {shipment.lpoNumber}
                              </div>
                            )}
                    {shipment.carrierName && (
                      <div className="flex items-center gap-1">
                        <Truck className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">Carrier:</span> {shipment.carrierName}
                      </div>
                    )}
                    {shipment.origin && shipment.destination && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">Route:</span> {shipment.origin} → {shipment.destination}
                      </div>
                    )}
                  </div>
                  

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                              {/* Supplier/Carrier Details */}
                              {(shipment.supplierId || shipment.carrierId) && (
                                <div className="bg-blue-50 rounded-lg p-3">
                                  <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    {shipment.supplierId ? 'Supplier' : 'Carrier'} Information
                                  </h5>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium text-blue-700">Name:</span> {supplier?.name || shipment.supplierName || shipment.carrierName || 'Unknown'}
                                    </div>
                                    <div>
                                      <span className="font-medium text-blue-700">Email:</span> {supplier?.email || 'N/A'}
                                    </div>
                                    <div>
                                      <span className="font-medium text-blue-700">Phone:</span> {supplier?.phone || 'N/A'}
                                    </div>
                                    <div>
                                      <span className="font-medium text-blue-700">Address:</span> {supplier?.address || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              )}

                      {/* Customer Details */}
                      

                              {/* LPO Information */}
                              {shipment.lpoNumber && (
                                <div className="bg-green-50 rounded-lg p-3">
                                  <h5 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    LPO Information
                                  </h5>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium text-green-700">LPO Number:</span> {shipment.lpoNumber}
                                    </div>
                                    <div>
                                      <span className="font-medium text-green-700">LPO Value:</span> {formatCurrency(parseFloat(shipment.declaredValue || '0'), shipment.currency || 'BHD')}
                                    </div>
                                    {shipment.lpoId && (
                                      <div className="col-span-2">
                                        <span className="font-medium text-green-700">LPO ID:</span> {shipment.lpoId}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs px-2 py-1"
                  onClick={() => {
                    const shipmentId = shipment.shipmentId || shipment.id;
                    if (isExpanded) {
                      setExpandedShipment(null);
                            } else {
                              setExpandedShipment(shipmentId);
                              // Fetch additional details when expanding
                              if (shipment.supplierId || shipment.carrierId) {
                                fetchSupplierDetails(shipment.supplierId || shipment.carrierId);
                              }
                              if (shipment.customerName) {
                                fetchCustomerDetails(shipment.customerName);
                              }
                            }
                  }}
                >
                  {isExpanded ? 'Less' : 'More'} Details
                </Button>
                <Button
                  size="sm"
                  className={`px-4 py-1.5 rounded-md font-medium text-xs flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isProcessed 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  onClick={() => handleGenerateGoodsReceipt(shipment)}
                  disabled={isProcessed || processingShipments.has(shipmentId)}
                  title={
                    isProcessed 
                      ? "Goods receipt already generated for this shipment" 
                      : processingShipments.has(shipmentId) 
                        ? "Generating goods receipt..." 
                        : "Generate goods receipt for this shipment"
                  }
                >
                  {processingShipments.has(shipmentId) ? (
                    <>
                      <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Generating...
                    </>
                  ) : isProcessed ? (
                    "✓ Generated"
                  ) : (
                    "+ Generate Goods Receipt"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      
      {deliveredShipments.length > 3 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-700">
            <Package className="h-4 w-4" />
            <span className="text-sm font-medium">
              {deliveredShipments.length - 3} more delivered shipments available
              {processedShipments.size > 0 && (
                <span className="ml-2 text-xs text-blue-600">
                  ({processedShipments.size} processed)
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoodsReceipt() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLpo, setSelectedLpo] = useState<any>(null);
  const [receiptData, setReceiptData] = useState({
    storageLocation: "",
    notes: "",
    items: [] as any[],
  });
  // Dialog state for view/delete/status change actions on Goods Receipt Header
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: supplierLpos, isLoading } = useQuery({
    queryKey: ["/api/supplier-lpos"],
  });

  const { data: goodsReceipts } = useQuery({
    queryKey: ["/api/goods-receipt-headers"],
  });

  // Removed view dialog and associated items query

  // Mutation for deleting a goods receipt header
  const deleteGoodsReceipt = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/goods-receipt-headers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      setDeleteDialogOpen(false);
      setSelectedReceipt(null);
      toast({ title: "Deleted", description: "Goods receipt deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete goods receipt", variant: "destructive" });
    },
  });

  const createGoodsReceipt = useMutation({
    mutationFn: async (data: any) => {
      // If data has header and items, use the batch endpoint
      if (data.header && data.items) {
        return await apiRequest("POST", "/api/goods-receipts", data);
      }
      // Otherwise use the header-only endpoint
      return await apiRequest("POST", "/api/goods-receipt-headers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Success",
        description: "Goods receipt created successfully",
      });
      setSelectedLpo(null);
      setReceiptData({ storageLocation: "", notes: "", items: [] });
    },
    onError: (error: any) => {
      console.error("Error creating goods receipt:", error);
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        response: error?.response,
        data: error?.data
      });
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create goods receipt";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });


  // Mutation for approving goods receipt
  const approveGoodsReceipt = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/goods-receipt-headers/${id}/approve`, { approvedBy: "current_user" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      toast({ title: "Success", description: "Goods receipt approved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve goods receipt", variant: "destructive" });
    },
  });

  // Mutation for updating goods receipt status
  const updateGoodsReceiptStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/goods-receipt-headers/${id}/status`, { status });
    },
    onSuccess: async (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      
      // If status is "Approved", create a purchase invoice
      if (status === "Approved") {
        try {
          // Get the goods receipt details to create purchase invoice
          const response = await apiRequest("GET", `/api/goods-receipt-headers/${id}`);
          const goodsReceipt = await response.json();
          
          if (goodsReceipt) {
            // Generate invoice number
            const invoiceNumber = `PI-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
            
            // Generate supplier invoice number
            const supplierInvoiceNumber = `SUP-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
            
            // Get goods receipt items to create purchase invoice items
            const grItemsResponse = await apiRequest("GET", `/api/goods-receipt-headers/${id}/items`);
            const grItems = await grItemsResponse.json();
            
            // Calculate totals from goods receipt items
            let subtotal = 0;
            let taxAmount = 0;
            let discountAmount = 0;
            
            const purchaseInvoiceItems = grItems.map((grItem: any) => {
              const qty = Number(grItem.quantityReceived || grItem.quantityExpected || 0);
              const unitPrice = Number(grItem.unitCost || 0);
              // Use actual tax and discount values from goods receipt items, with fallback to defaults
              const taxRate = Number(grItem.taxRate || grItem.tax_rate || 0.00); // Default to 0% if not set
              const discountRate = Number(grItem.discountRate || grItem.discount_rate || 5.00); // Default to 5% if not set
              
              const gross = qty * unitPrice;
              const discountAmt = gross * discountRate / 100;
              const net = gross - discountAmt;
              const taxAmt = net * taxRate / 100;
              const total = net + taxAmt;
              
              subtotal += gross;
              taxAmount += taxAmt;
              discountAmount += discountAmt;
              
              return {
                goodsReceiptItemId: grItem.id,
                itemId: grItem.itemId,
                barcode: grItem.barcode,
                supplierCode: grItem.supplierCode,
                itemDescription: grItem.itemDescription,
                quantity: qty,
                unitPrice: unitPrice.toString(),
                totalPrice: total.toString(),
                taxRate: taxRate.toString(),
                taxAmount: taxAmt.toString(),
                discountRate: discountRate.toString(),
                discountAmount: discountAmt.toString(),
                unitOfMeasure: grItem.unitOfMeasure || 'PCS',
                storageLocation: grItem.storageLocation,
                batchNumber: grItem.batchNumber,
                expiryDate: grItem.expiryDate ? new Date(grItem.expiryDate).toISOString().split('T')[0] : undefined,
                condition: grItem.condition || 'Good',
                notes: grItem.notes
              };
            });
            
            const totalAmount = subtotal - discountAmount + taxAmount;
            
            // Prepare purchase invoice data
            const purchaseInvoiceData = {
              invoiceNumber: invoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              supplierId: goodsReceipt.supplierId,
              goodsReceiptId: goodsReceipt.id,
              lpoId: goodsReceipt.supplierLpoId || undefined,
              status: "Draft",
              paymentStatus: "Unpaid",
              invoiceDate: new Date().toISOString().split('T')[0],
              dueDate: goodsReceipt.expectedDeliveryDate || new Date().toISOString().split('T')[0],
              receivedDate: goodsReceipt.actualDeliveryDate || new Date().toISOString().split('T')[0],
              subtotal: subtotal.toString(),
              taxAmount: taxAmount.toString(),
              discountAmount: discountAmount.toString(),
              totalAmount: totalAmount.toString(),
              paidAmount: "0.00",
              remainingAmount: totalAmount.toString(),
              currency: "BHD",
              paymentTerms: goodsReceipt.notes || "",
              notes: `Generated from completed goods receipt ${goodsReceipt.receiptNumber}. LPO: ${goodsReceipt.lpoNumber || 'N/A'}`,
              attachments: [],
              isRecurring: false
            };

            // Create purchase invoice with items
            console.log('Creating purchase invoice with items:', purchaseInvoiceItems.length);
            const createResponse = await apiRequest("POST", "/api/purchase-invoices", {
              invoice: purchaseInvoiceData,
              items: purchaseInvoiceItems
            });
            
            if (!createResponse.ok) {
              throw new Error(`Failed to create purchase invoice: ${createResponse.status} ${createResponse.statusText}`);
            }
            
            const purchaseInvoice = await createResponse.json();
            console.log('Created purchase invoice:', purchaseInvoice);
            
            // Show success message
            toast({
              title: "Purchase Invoice Created",
              description: `Purchase invoice ${purchaseInvoice.invoiceNumber} has been automatically created and is now available in the Purchase Invoices table.`,
            });
            
            // Invalidate purchase invoices query to refresh the data
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
            queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
            queryClient.invalidateQueries({ 
              predicate: (query) => query.queryKey[0] === "/api/purchase-invoices" 
            });
            queryClient.refetchQueries({ 
              queryKey: ["/api/purchase-invoices"] 
            });
            
            toast({ 
              title: "Success", 
              description: `Goods receipt completed and purchase invoice ${invoiceNumber} created successfully` 
            });
          }
        } catch (error) {
          console.error("Error creating purchase invoice:", error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          toast({ 
            title: "Warning", 
            description: `Goods receipt completed but failed to create purchase invoice: ${errorMessage}`, 
            variant: "destructive" 
          });
        }
      } else {
        toast({ title: "Success", description: "Goods receipt status updated successfully" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update goods receipt status", variant: "destructive" });
    },
  });


  // Filter for confirmed supplier LPOs ready for goods receipt
  const lposArray =
    supplierLpos && typeof supplierLpos === "object" && "data" in supplierLpos && Array.isArray((supplierLpos as any).data)
      ? (supplierLpos as any).data
      : Array.isArray(supplierLpos)
      ? supplierLpos
      : [];
  const confirmedLpos = lposArray.filter((lpo: any) => lpo.status === "Confirmed");
  
  const filteredLpos = confirmedLpos?.filter((lpo: any) =>
    lpo.lpoNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lpo.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<any>[] = [
    {
      key: "lpoNumber",
      header: "LPO Number",
      render: (value: string) => (
        <span className="font-mono text-sm text-blue-600 font-medium">{value}</span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (supplier: any) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {supplier?.name || "Unknown Supplier"}
          </p>
          <p className="text-xs text-gray-600">
            {supplier?.contactPerson || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "totalAmount",
      header: "LPO Value",
      render: (value: number) => value ? formatCurrency(value) : "-",
      className: "text-right",
    },
    {
      key: "expectedDeliveryDate",
      header: "Expected Delivery",
      render: (value: string) => {
        const isOverdue = value && new Date(value) < new Date();
        return (
          <div className={isOverdue ? "text-red-600" : ""}>
            {value ? formatDate(value) : "-"}
            {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
          </div>
        );
      },
    },
    {
      key: "receiptStatus",
      header: "Receipt Status",
      render: (_, lpo: any) => {
        const receipt = (Array.isArray(goodsReceipts) ? goodsReceipts : []).find((gr: any) => gr.supplierLpoId === lpo.id);
        if (!receipt) {
          return (
            <Badge variant="outline" className="text-orange-600">
              <Package className="h-3 w-3 mr-1" />
              Pending Receipt
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className={getStatusColor(receipt.status)}>
            {receipt.status}
          </Badge>
        );
      },
    },
    {
      key: "lpoDate",
      header: "LPO Date",
      render: (value: string) => formatDate(value),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, lpo: any) => {
        const receipt = (Array.isArray(goodsReceipts) ? goodsReceipts : []).find((gr: any) => gr.supplierLpoId === lpo.id);
        return (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLpo(lpo);
                // Initialize receipt data with LPO items
                setReceiptData({
                  storageLocation: "",
                  notes: "",
                  items: lpo.items?.map((item: any) => {
                    const quantity = item.quantity || 0;
                    const unitCost = parseFloat(item.unitCost || "0");
                    const totalCost = quantity * unitCost;
                    
                    // Use actual discount and VAT data from LPO item
                    const discountPercent = parseFloat(item.discountPercent || "0");
                    const discountAmount = parseFloat(item.discountAmount || "0");
                    const vatPercent = parseFloat(item.vatPercent || "0");
                    const vatAmount = parseFloat(item.vatAmount || "0");
                    
                    // Calculate discount and VAT amounts if not provided
                    const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (totalCost * discountPercent / 100);
                    const calculatedVatAmount = vatAmount > 0 ? vatAmount : (totalCost * vatPercent / 100);
                    
                    return {
                      ...item,
                      receivedQuantity: item.quantity,
                      damagedQuantity: 0,
                      // Use actual discount and VAT data from LPO item
                      taxRate: vatPercent.toFixed(2),
                      taxAmount: calculatedVatAmount.toFixed(2),
                      discountRate: discountPercent.toFixed(2),
                      discountAmount: calculatedDiscountAmount.toFixed(2),
                    };
                  }) || [],
                });
              }}
              data-testid={`button-receive-${lpo.id}`}
            >
              <Package className="h-4 w-4 mr-1" />
              {receipt ? "Create Another" : "Receive Goods"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                console.log("View LPO details:", lpo);
              }}
              data-testid={`button-view-${lpo.id}`}
            >
              <Scan className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const receiptStats = {
    pending: confirmedLpos?.filter((lpo: any) => 
      !(Array.isArray(goodsReceipts) ? goodsReceipts : [])?.some((gr: any) => gr.supplierLpoId === lpo.id)
    ).length || 0,
    partial: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Partial").length || 0,
    completed: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Complete").length || 0,
    approved: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Approved").length || 0,
    discrepancy: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Discrepancy").length || 0,
  };

  const handleItemQuantityChange = (index: number, field: string, value: number) => {
    const updatedItems = [...receiptData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setReceiptData({ ...receiptData, items: updatedItems });
  };

  const processGoodsReceipt = () => {
    if (!selectedLpo || !receiptData.storageLocation.trim()) {
      toast({
        title: "Error",
        description: "Please provide storage location",
        variant: "destructive",
      });
      return;
    }

    const hasDiscrepancy = receiptData.items.some(item => 
      item.receivedQuantity !== item.quantity || item.damagedQuantity > 0
    );

    const status = hasDiscrepancy ? "Discrepancy" : "Complete";

    createGoodsReceipt.mutate({
      supplierLpoId: selectedLpo.id,
      storageLocation: receiptData.storageLocation,
      notes: receiptData.notes,
      status,
      items: receiptData.items,
    });
  };

  return (
    <div>
      {/* Enhanced Card-style header with orange theme */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden mb-6">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-orange-50/50 to-transparent rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-48 h-24 bg-gradient-to-tr from-orange-100/30 to-transparent rounded-tr-full"></div>
        <div className="relative px-8 py-6 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg border border-orange-100">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-black mb-1" data-testid="text-page-title">
                  Goods Receipt
                </h2>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                    <Package className="h-3 w-3 mr-1" />
                    Step 7
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 text-sm font-medium">
                      Processing incoming shipments
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-base max-w-2xl leading-relaxed">
              Receive and validate goods against supplier LPOs with barcode scanning and quality control
            </p>
          </div>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mt-1">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Pending Receipt</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-pending-receipt">
                  {receiptStats.pending}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Confirmed LPOs awaiting receipt
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Partial Receipt</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-partial-receipt">
                  {receiptStats.partial}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Partially received shipments
                </div>
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
                <p className="text-sm font-bold text-gray-900">Complete Receipt</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-complete-receipt">
                  {receiptStats.completed}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Fully received shipments
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mt-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Approved</p>
                <p className="text-2xl font-bold text-emerald-600" data-testid="stat-approved-receipt">
                  {receiptStats.approved}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Approved receipts
                </div>
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
                <p className="text-sm font-bold text-gray-900">Discrepancies</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-discrepancy-receipt">
                  {receiptStats.discrepancy}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Receipts with issues
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deliveries Ready for Goods Receipt */}
      <Card className="bg-gradient-to-br from-green-50 via-white to-green-50 border-green-200 shadow-lg mb-6">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Deliveries Ready for Goods Receipt</h3>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DeliveredShipmentsSection createGoodsReceipt={createGoodsReceipt} />
        </CardContent>
      </Card>

      {/* Goods Receipt Table - Goods Receipt Headers (single table only) */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Goods Receipt Headers</CardTitle>
            <div className="relative w-64">
              <Input
                type="text"
                placeholder="Search receipts..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="pl-10 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md shadow-none"
                data-testid="input-search-receipts"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Filter goods receipts based on search term
            const allReceipts = Array.isArray(goodsReceipts) ? goodsReceipts : [];
            const filteredReceipts = allReceipts.filter((receipt: any) => {
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              return (
                receipt.receiptNumber?.toLowerCase().includes(term) ||
                receipt.supplierName?.toLowerCase().includes(term) ||
                receipt.lpoNumber?.toLowerCase().includes(term) ||
                receipt.storageLocation?.toLowerCase().includes(term) ||
                receipt.status?.toLowerCase().includes(term)
              );
            });

            // Pagination logic
            const totalPages = Math.ceil(filteredReceipts.length / pageSize);
            const paginatedReceipts = filteredReceipts.slice(
              (currentPage - 1) * pageSize,
              currentPage * pageSize
            );

            return (
              <>
                <DataTable
                  data={paginatedReceipts}
                  columns={[
              {
                key: "receiptNumber",
                header: "Receipt Number",
                render: (v: any, row: any) => <span className="font-mono text-xs">{v || row.id}</span>
              },
              {
                key: "supplierName",
                header: "Supplier Name",
                render: (v: any, row: any) => {
                  return (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {row.supplierName || "Unknown Supplier"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.supplierId ? `ID: ${row.supplierId.slice(0, 8)}...` : ""}
                      </div>
                    </div>
                  );
                }
              },
              {
                key: "lpoNumber",
                header: "LPO Number",
                render: (v: any, row: any) => {
                  return (
                    <div className="text-sm">
                      <div className="font-mono text-blue-600 font-medium">
                        {row.lpoNumber || row.lpoNumberFromLpo || v || row.supplierLpoId || "N/A"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.lpoDate ? formatDate(row.lpoDate) : ""}
                      </div>
                    </div>
                  );
                }
              }, 
              {
                key: "lpoValue",
                header: "LPO Value",
                render: (v: any, row: any) => {
                  // Use lpoValue from goods receipt header first, then fallback to lpoTotalAmount from joined LPO
                  const lpoValue = row.lpoValue || row.lpoTotalAmount;
                  const lpoCurrency = row.lpoCurrency || row.lpoCurrencyFromLpo || "BHD";
                  
                  return (
                    <div className="text-sm text-left">
                      <div className="font-medium text-gray-900">
                        {lpoValue ? formatCurrency(parseFloat(lpoValue)) : "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {lpoCurrency}
                      </div>
                    </div>
                  );
                }
              },
              { key: "status", header: "Status", render: (v: any) => {
           let color = "bg-gray-100 text-gray-700 border-gray-300";
           if (v === "Draft") color = "bg-yellow-100 text-yellow-700 border-yellow-300";
           else if (v === "Pending") color = "bg-gray-100 text-gray-700 border-gray-300";
           else if (v === "Partial") color = "bg-blue-100 text-blue-700 border-blue-300";
           else if (v === "Complete" || v === "Completed") color = "bg-green-100 text-green-700 border-green-300";
           else if (v === "Approved") color = "bg-emerald-100 text-emerald-700 border-emerald-300";
           else if (v === "Discrepancy") color = "bg-red-100 text-red-700 border-red-300";
           return <Badge variant="outline" className={color}>{v}</Badge>;
              } },
              { key: "createdAt", header: "Created At", render: (v: any) => v ? formatDate(v) : "-" },
              {
                key: "actions",
                header: "Actions",
                render: (_: any, row: any) => (
                  <div className="flex items-center gap-2">
                    <Link href={`/receipts/${row.id}`}>
                      <a title="Open Detail Page">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          data-testid={`button-open-detail-${row.id}`}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </a>
                    </Link>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedReceipt(row); setStatusChangeDialogOpen(true); }} title="Change Status">
                      <Clock className="h-4 w-4 text-purple-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedReceipt(row); setDeleteDialogOpen(true); }} title="Delete">
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ),
              },
            ]}
            isLoading={isLoading}
            emptyMessage="No goods receipt headers found."
          />
          
          {/* Pagination Controls */}
          {filteredReceipts.length > pageSize && (
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
        </>
      );
    })()}
        </CardContent>
      </Card>
      {/* View dialog removed */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setSelectedReceipt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Trash className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-red-700">Delete Goods Receipt</DialogTitle>
            </div>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4 p-2">
              <div className="bg-red-50 rounded p-2 text-sm text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Are you sure you want to delete this goods receipt?
              </div>
              <div className="text-xs text-gray-500">Receipt ID: <span className="font-mono">{selectedReceipt.id}</span></div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" type="button" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => deleteGoodsReceipt.mutate(selectedReceipt.id)}
                  disabled={deleteGoodsReceipt.isPending}
                >
                  {deleteGoodsReceipt.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialogOpen} onOpenChange={(open) => { setStatusChangeDialogOpen(open); if (!open) setSelectedReceipt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <DialogTitle className="text-purple-700">Change Status</DialogTitle>
            </div>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="bg-purple-50 rounded p-3 mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Receipt Number:</span> {selectedReceipt.receiptNumber || selectedReceipt.id}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Current Status:</span> 
                  {(() => {
                    let colorClasses = "bg-gray-100 text-gray-700 border-gray-300";
                    const v = selectedReceipt.status;
                    if (v === "Draft") colorClasses = "bg-yellow-100 text-yellow-700 border-yellow-300";
                    else if (v === "Pending") colorClasses = "bg-gray-100 text-gray-700 border-gray-300";
                    else if (v === "Partial") colorClasses = "bg-blue-100 text-blue-700 border-blue-300";
                    else if (v === "Complete" || v === "Completed") colorClasses = "bg-green-100 text-green-700 border-green-300";
                    else if (v === "Approved") colorClasses = "bg-emerald-100 text-emerald-700 border-emerald-300";
                    else if (v === "Discrepancy") colorClasses = "bg-red-100 text-red-700 border-red-300";
                    return <Badge variant="outline" className={`ml-2 ${colorClasses} border`}>
                      {selectedReceipt.status}
                    </Badge>;
                  })()}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={selectedReceipt.status || ""}
                  onChange={e => setSelectedReceipt({ ...selectedReceipt, status: e.target.value })}
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Complete">Complete</option>
                  <option value="Approved">Approved</option>
                  <option value="Discrepancy">Discrepancy</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setStatusChangeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    updateGoodsReceiptStatus.mutate({ 
                      id: selectedReceipt.id, 
                      status: selectedReceipt.status 
                    });
                    setStatusChangeDialogOpen(false);
                  }}
                  disabled={updateGoodsReceiptStatus.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {updateGoodsReceiptStatus.isPending ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Goods Receipt Dialog */}
      <Dialog open={!!selectedLpo} onOpenChange={() => setSelectedLpo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Goods Receipt</DialogTitle>
          </DialogHeader>
          {selectedLpo && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">LPO Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">LPO Number:</span> {selectedLpo.lpoNumber}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Supplier:</span> {selectedLpo.supplier?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Expected Delivery:</span> {selectedLpo.expectedDeliveryDate ? formatDate(selectedLpo.expectedDeliveryDate) : "N/A"}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">LPO Value:</span> {formatCurrency(selectedLpo.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Storage Location <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter storage location..."
                    value={receiptData.storageLocation}
                    onChange={(e) => setReceiptData({ ...receiptData, storageLocation: e.target.value })}
                    data-testid="input-storage-location"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Receipt Notes
                  </label>
                  <Input
                    type="text"
                    placeholder="Additional notes..."
                    value={receiptData.notes}
                    onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                    data-testid="input-receipt-notes"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Items Receipt Verification</h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-6 gap-4 p-3 bg-gray-50 border-b text-sm font-medium text-gray-700">
                    <div>Item</div>
                    <div>Barcode</div>
                    <div>Ordered Qty</div>
                    <div>Received Qty</div>
                    <div>Damaged Qty</div>
                    <div>Status</div>
                  </div>
                  {receiptData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 p-3 border-b items-center">
                      <div className="text-sm">{item.description || item.itemId}</div>
                      <div className="text-xs font-mono">{item.barcode || "N/A"}</div>
                      <div className="text-sm font-medium">{item.quantity}</div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={item.receivedQuantity}
                          onChange={(e) => handleItemQuantityChange(index, "receivedQuantity", parseInt(e.target.value) || 0)}
                          className="w-20"
                          data-testid={`input-received-qty-${index}`}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max={item.receivedQuantity}
                          value={item.damagedQuantity}
                          onChange={(e) => handleItemQuantityChange(index, "damagedQuantity", parseInt(e.target.value) || 0)}
                          className="w-20"
                          data-testid={`input-damaged-qty-${index}`}
                        />
                      </div>
                      <div>
                        {item.receivedQuantity === item.quantity && item.damagedQuantity === 0 ? (
                          <Badge className="underline decoration-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge className="underline decoration-orange-500 text-orange-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Discrepancy
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedLpo(null)}
                  data-testid="button-cancel-receipt"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processGoodsReceipt}
                  disabled={!receiptData.storageLocation.trim() || createGoodsReceipt.isPending}
                  data-testid="button-process-receipt"
                >
                  {createGoodsReceipt.isPending ? "Processing..." : "Process Receipt"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
