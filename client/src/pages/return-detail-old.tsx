import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { formatDate } from "date-fns";
import { 
  ArrowLeft, 
  Download, 
  FileText,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Receipt,
  Package,
  AlertTriangle,
  Edit,
  Printer,
  Share2,
  Save,
  X,
  CheckCircle,
  Mail,
  Copy,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReturnItem {
  id: string;
  serialNo: number;
  itemId: string;
  itemDescription: string;
  quantityReturned: number;
  unitCost: number;
  totalCost: number;
  returnReason: string;
  conditionNotes: string;
}

interface ReturnReceipt {
  id: string;
  returnNumber: string;
  returnDate: string;
  goodsReceiptId: string;
  goodsReceiptNumber: string;
  supplierId: string;
  supplierName: string;
  supplierAddress: string;
  supplierContactPerson: string;
  returnReason: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Processed" | "Cancelled";
  notes: string;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export default function ReturnDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ReturnReceipt>>({});

  // Fetch return details
  const { data: returnData, isLoading, error, refetch } = useQuery({
    queryKey: ['return-receipt', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/receipt-returns/${id}`);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to fetch return details');
      }
      return json.data as ReturnReceipt;
    },
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ReturnReceipt>) => {
      const response = await apiRequest("PUT", `/api/receipt-returns/${id}`, data);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to update return');
      }
      return json.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Return updated successfully",
      });
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['return-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize edited data when returnData changes
  useEffect(() => {
    if (returnData && !isEditMode) {
      setEditedData({});
    }
  }, [returnData, isEditMode]);

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel editing
      setEditedData({});
      setIsEditMode(false);
    } else {
      // Enter edit mode
      setEditedData(returnData || {});
      setIsEditMode(true);
    }
  };

  // Handle save
  const handleSave = () => {
    if (Object.keys(editedData).length > 0) {
      updateMutation.mutate(editedData);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle copy link
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied",
        description: "Return detail link copied to clipboard",
      });
      setIsShareDialogOpen(false);
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    });
  };

  // Handle email share (placeholder - would integrate with your email service)
  const handleEmailShare = () => {
    const subject = `Return Receipt #${returnData?.returnNumber}`;
    const body = `View return details: ${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setIsShareDialogOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Pending Approval': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Processed': return 'bg-blue-100 text-blue-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft': return <FileText className="h-3 w-3" />;
      case 'Pending Approval': return <Clock className="h-3 w-3" />;
      case 'Approved': return <Receipt className="h-3 w-3" />;
      case 'Processed': return <Package className="h-3 w-3" />;
      case 'Cancelled': return <AlertTriangle className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading return details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !returnData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Return Not Found</h2>
          <p className="text-gray-600 mb-4">The return you're looking for doesn't exist or has been removed.</p>
          <Link href="/receipt-returns">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Returns
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = returnData.items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/receipt-returns">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Return Receipt
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Return Details</h1>
            <p className="text-gray-600">Return Number: {returnData.returnNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={`${getStatusColor(returnData.status)} flex items-center gap-1`}>
            {getStatusIcon(returnData.status)}
            {returnData.status}
          </Badge>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Return Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Return Number</Label>
                  <Input value={returnData.returnNumber} readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Return Date</Label>
                  <Input value={formatDate(new Date(returnData.returnDate), 'PPP')} readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Goods Receipt Number</Label>
                  <Input value={returnData.goodsReceiptNumber} readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Return Reason</Label>
                  <Input value={returnData.returnReason} readOnly className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Notes</Label>
                <Textarea 
                  value={returnData.notes || ''} 
                  readOnly 
                  className="mt-1 min-h-[80px]"
                  placeholder="No notes provided"
                />
              </div>
            </CardContent>
          </Card>

          {/* Return Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Return Items ({returnData.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {returnData.items.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {item.serialNo}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{item.itemDescription}</h4>
                          <p className="text-sm text-gray-500">Item ID: {item.itemId}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{item.returnReason}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-500">Quantity Returned</Label>
                        <p className="font-medium">{item.quantityReturned}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Unit Cost</Label>
                        <p className="font-medium">${Number(item.unitCost || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Total Cost</Label>
                        <p className="font-medium">${Number(item.totalCost || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Condition Notes</Label>
                        <p className="font-medium">{item.conditionNotes || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-700">Supplier Name</Label>
                <p className="text-sm text-gray-900 mt-1">{returnData.supplierName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Address</Label>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-line">{returnData.supplierAddress}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Contact Person</Label>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-line">{returnData.supplierContactPerson}</p>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Items</span>
                <span className="text-sm font-medium">{returnData.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Quantity</span>
                <span className="text-sm font-medium">
                  {returnData.items.reduce((sum, item) => sum + item.quantityReturned, 0)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-900">Total Amount</span>
                <span className="text-sm font-bold text-gray-900">${totalAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium">Return Created</p>
                  <p className="text-xs text-gray-500">{formatDate(new Date(returnData.createdAt), 'PPP p')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-xs text-gray-500">{formatDate(new Date(returnData.updatedAt), 'PPP p')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
