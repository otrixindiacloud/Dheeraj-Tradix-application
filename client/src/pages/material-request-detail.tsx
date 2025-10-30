import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft,
  Edit,
  Package2,
  User,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp
} from "lucide-react";
import { StatusChangeDropdown, getStatusBadge } from "@/components/ui/status-change-dropdown";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Requisition } from "@shared/schema";

interface RequisitionItem {
  id: string;
  requisitionId: string;
  itemDescription: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedCost: number;
  specification?: string;
  preferredSupplier?: string;
  urgency?: string;
}

interface MaterialRequestDetail extends Requisition {
  items?: RequisitionItem[];
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "Low":
      return "bg-transparent text-blue-700 border-blue-300";
    case "Medium":
      return "bg-transparent text-amber-700 border-amber-300";
    case "High":
      return "bg-transparent text-orange-600 border-orange-300";
    case "Urgent":
      return "bg-transparent text-red-600 border-red-300";
    default:
      return "bg-transparent text-slate-600 border-slate-300";
  }
};

export default function MaterialRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: request, isLoading } = useQuery<MaterialRequestDetail>({
    queryKey: ["/api/material-requests", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/material-requests/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch material request");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest("PUT", `/api/material-requests/${id}`, { status: newStatus });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/material-requests", id] });
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading material request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Material Request Not Found</h2>
          <p className="text-gray-600 mb-4">The material request you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/material-requests")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Material Requests
          </Button>
        </div>
      </div>
    );
  }

  const items = request.items || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/material-requests")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Material Request #{request.requisitionNumber}
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(request.createdAt || request.requestDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(request.status || "Draft")}
          <Button
            variant="outline"
            onClick={() => navigate(`/material-requests`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Request
          </Button>
        </div>
      </div>

      {/* Status and Priority Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChangeDropdown
              currentStatus={request.status || "Draft"}
              onStatusChange={(newStatus) => updateStatusMutation.mutate(newStatus)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={`shadow-none ${getPriorityColor(request.priority || "Medium")} px-2 py-0.5 text-xs font-medium`}>
              {request.priority}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Number(request.totalEstimatedCost || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Items Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {items.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package2 className="h-4 w-4 mr-2" />
            Items ({items.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      Requested By
                    </label>
                    <p className="text-base font-medium text-gray-900">{request.requestedBy}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4" />
                      Department
                    </label>
                    <p className="text-base font-medium text-gray-900">{request.department}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4" />
                      Request Date
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(request.requestDate || request.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      Required Date
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(request.requiredDate)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">Justification</label>
                <p className="text-base text-gray-700 bg-gray-50 p-4 rounded-md whitespace-pre-wrap">
                  {request.justification}
                </p>
              </div>

              {request.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Additional Notes</label>
                    <p className="text-base text-gray-700 bg-gray-50 p-4 rounded-md whitespace-pre-wrap">
                      {request.notes}
                    </p>
                  </div>
                </>
              )}

              {request.approvedBy && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Approved By</label>
                      <p className="text-base font-medium text-gray-900">{request.approvedBy}</p>
                    </div>
                    {request.approvedDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Approved Date</label>
                        <p className="text-base font-medium text-gray-900">
                          {formatDate(request.approvedDate)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Items</CardTitle>
              <CardDescription>
                {items.length} {items.length === 1 ? "item" : "items"} in this request
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No items found in this request</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-center">Unit</TableHead>
                        <TableHead className="text-center">Unit Cost</TableHead>
                        <TableHead className="text-center">Total Cost</TableHead>
                        <TableHead>Specifications</TableHead>
                        {items.some(item => item.preferredSupplier || item.urgency) && (
                          <>
                            <TableHead>Preferred Supplier</TableHead>
                            <TableHead>Urgency</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.itemDescription}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.unitOfMeasure}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(item.estimatedCost || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {Number((item.quantity || 0) * (item.estimatedCost || 0)).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {item.specification ? (
                              <p className="text-sm text-gray-600 max-w-xs truncate" title={item.specification}>
                                {item.specification}
                              </p>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          {items.some(i => i.preferredSupplier || i.urgency) && (
                            <>
                              <TableCell>
                                {item.preferredSupplier ? (
                                  <span className="text-sm">{item.preferredSupplier}</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.urgency ? (
                                  <Badge variant={item.urgency === "Urgent" ? "destructive" : "outline"}>
                                    {item.urgency}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

