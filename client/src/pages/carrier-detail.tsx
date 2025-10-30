import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  ArrowLeft, 
  Truck, 
  Mail, 
  Phone, 
  MapPin, 
  TrendingUp, 
  Edit, 
  Package, 
  FileText, 
  BarChart3,
  Calendar,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const carrierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  serviceType: z.string().optional(),
});

type CarrierFormData = z.infer<typeof carrierSchema>;

interface Carrier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contactPerson: string | null;
  serviceType: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CarrierDetails {
  carrier: Carrier;
  stats: {
    totalShipments: number;
    pendingShipments: number;
    deliveredShipments: number;
    inTransitShipments: number;
    onTimeDeliveryRate: number;
    averageDeliveryDays: number;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    date: string;
    status?: string;
    amount?: string;
  }>;
}

interface PerformanceMetrics {
  deliveryPerformance: {
    onTimeDeliveries: number;
    totalDeliveries: number;
    onTimeRate: number;
    averageDelayDays: number;
  };
  serviceMetrics: {
    totalShipments: number;
    completedShipments: number;
    inProgressShipments: number;
    completionRate: number;
  };
  financialMetrics: {
    totalShippingCost: string;
    averageShippingCost: string;
    revenue: string;
  };
}

interface ShipmentData {
  shipments: Array<{
    id: string;
    shipmentNumber: string;
    trackingNumber: string;
    status: string;
    serviceType: string;
    priority: string;
    origin: string;
    destination: string;
    estimatedDelivery: string | null;
    actualDelivery: string | null;
    shippingCost: string | null;
  }>;
  total: number;
}

export default function CarrierDetail() {
  const { id } = useParams();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const form = useForm<CarrierFormData>({
    resolver: zodResolver(carrierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      serviceType: "",
    },
  });

  // Fetch carrier details
  const { data: carrierDetails, isLoading, error } = useQuery<CarrierDetails>({
    queryKey: [`/api/carriers/${id}/details`],
    queryFn: async () => {
      const response = await fetch(`/api/carriers/${id}/details`);
      if (!response.ok) {
        throw new Error(`Failed to fetch carrier details: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch performance metrics
  const { data: performanceMetrics } = useQuery<PerformanceMetrics>({
    queryKey: [`/api/carriers/${id}/performance`],
    queryFn: async () => {
      const response = await fetch(`/api/carriers/${id}/performance`);
      if (!response.ok) {
        throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch carrier shipments
  const { data: shipmentData } = useQuery<ShipmentData>({
    queryKey: [`/api/carriers/${id}/shipments`],
    queryFn: async () => {
      const response = await fetch(`/api/carriers/${id}/shipments?page=1&limit=20`);
      if (!response.ok) {
        throw new Error(`Failed to fetch carrier shipments: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Update carrier mutation
  const updateCarrier = useMutation({
    mutationFn: async (data: CarrierFormData) => {
      const response = await fetch(`/api/carriers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update carrier");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/carriers/${id}/details`] });
      toast({
        title: "Success",
        description: "Carrier updated successfully",
      });
      setShowEditDialog(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update carrier",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (carrierDetails?.carrier) {
      const carrier = carrierDetails.carrier;
      form.reset({
        name: carrier.name,
        contactPerson: carrier.contactPerson || "",
        email: carrier.email || "",
        phone: carrier.phone || "",
        address: carrier.address || "",
        serviceType: carrier.serviceType || "",
      });
      setShowEditDialog(true);
    }
  };

  const onSubmit = (data: CarrierFormData) => {
    updateCarrier.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading carrier details...</div>
        </div>
      </div>
    );
  }

  if (error || !carrierDetails) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Failed to load carrier details</div>
        </div>
      </div>
    );
  }

  const { carrier, stats, recentActivities } = carrierDetails;

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'completed':
      case 'delivered':
      case 'approved':
        return 'default';
      case 'pending':
      case 'draft':
      case 'in transit':
        return 'secondary';
      case 'rejected':
      case 'cancelled':
      case 'lost':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatCurrency = (amount: string | null | number) => {
    if (!amount) return 'AED 0.00';
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
    }).format(value);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/carriers")}
            className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-all duration-200 transform hover:-translate-y-0.5 border border-gray-200"
          >
            <div className="rounded-lg flex items-center justify-center transition-colors">
              <ArrowLeft className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">Back to Carriers</div>
            </div>
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{carrier.name}</h1>
            <p className="text-muted-foreground">
              Carrier ID: {carrier.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={carrier.isActive ? "default" : "secondary"}>
            {carrier.isActive ? "Active" : "Inactive"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition-colors"
          >
            <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
              <Edit className="h-3 w-3 text-blue-600" />
            </div>
            Edit Carrier
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-base font-bold">Total Shipments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShipments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingShipments} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <CardTitle className="text-base font-bold">Delivered</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveredShipments}</div>
            <p className="text-xs text-muted-foreground">
              Completed shipments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-orange-600" />
              <CardTitle className="text-base font-bold">In Transit</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inTransitShipments}</div>
            <p className="text-xs text-muted-foreground">
              Active shipments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-purple-600" />
              <CardTitle className="text-base font-bold">On-Time Delivery</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.onTimeDeliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Delivery performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="shipments" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Shipments
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activities
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Carrier Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Carrier Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                    <p className="text-sm">{carrier.contactPerson || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Service Type</label>
                    <p className="text-sm">{carrier.serviceType || 'Not specified'}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{carrier.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{carrier.phone || 'No phone provided'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm">{carrier.address || 'No address provided'}</span>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <label>Created</label>
                    <p>{format(new Date(carrier.createdAt), 'PPP')}</p>
                  </div>
                  <div>
                    <label>Last Updated</label>
                    <p>{format(new Date(carrier.updatedAt), 'PPP')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Overview */}
            {performanceMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Delivery Performance</span>
                      <Badge variant={performanceMetrics.deliveryPerformance.onTimeRate > 80 ? "default" : "secondary"}>
                        {performanceMetrics.deliveryPerformance.onTimeRate.toFixed(1)}%
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Completion Rate</span>
                      <Badge variant={performanceMetrics.serviceMetrics.completionRate > 95 ? "default" : "secondary"}>
                        {performanceMetrics.serviceMetrics.completionRate.toFixed(1)}%
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Shipping Cost</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(performanceMetrics.financialMetrics.totalShippingCost)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average Shipping Cost</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(performanceMetrics.financialMetrics.averageShippingCost)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Shipments Tab */}
        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Shipments
              </CardTitle>
              <CardDescription>
                All shipments handled by this carrier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shipmentData && shipmentData.shipments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment Number</TableHead>
                      <TableHead>Tracking Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Estimated Delivery</TableHead>
                      <TableHead className="text-right">Shipping Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipmentData.shipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.shipmentNumber}</TableCell>
                        <TableCell>{shipment.trackingNumber}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(shipment.status)}>
                            {shipment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{shipment.serviceType}</TableCell>
                        <TableCell>{shipment.origin}</TableCell>
                        <TableCell>{shipment.destination}</TableCell>
                        <TableCell>
                          {shipment.estimatedDelivery ? format(new Date(shipment.estimatedDelivery), 'PP') : 'Not set'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(shipment.shippingCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No shipments found for this carrier
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {performanceMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Delivery Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">On-Time Deliveries</span>
                      <span className="text-sm font-medium">
                        {performanceMetrics.deliveryPerformance.onTimeDeliveries} / {performanceMetrics.deliveryPerformance.totalDeliveries}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${performanceMetrics.deliveryPerformance.onTimeRate}%` }}
                      />
                    </div>
                    <div className="text-2xl font-bold text-center">
                      {performanceMetrics.deliveryPerformance.onTimeRate.toFixed(1)}%
                    </div>
                  </div>
                  <Separator />
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Average Delay</div>
                    <div className="text-lg font-semibold">
                      {performanceMetrics.deliveryPerformance.averageDelayDays.toFixed(1)} days
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Service Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completed Shipments</span>
                      <span className="text-sm font-medium">
                        {performanceMetrics.serviceMetrics.completedShipments} / {performanceMetrics.serviceMetrics.totalShipments}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${performanceMetrics.serviceMetrics.completionRate}%` }}
                      />
                    </div>
                    <div className="text-2xl font-bold text-center">
                      {performanceMetrics.serviceMetrics.completionRate.toFixed(1)}%
                    </div>
                  </div>
                  <Separator />
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">In Progress</div>
                    <div className="text-lg font-semibold">
                      {performanceMetrics.serviceMetrics.inProgressShipments}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Financial Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Total Shipping Cost</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(performanceMetrics.financialMetrics.totalShippingCost)}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Average Shipping Cost</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(performanceMetrics.financialMetrics.averageShippingCost)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activities
              </CardTitle>
              <CardDescription>
                Recent shipments and interactions with this carrier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities && recentActivities.length > 0 ? (
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {activity.type === 'Shipment' && <Package className="h-4 w-4 text-primary" />}
                        {activity.type === 'Delivery' && <Truck className="h-4 w-4 text-primary" />}
                        {activity.type === 'Payment' && <DollarSign className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <div className="flex items-center gap-2">
                            {activity.status && (
                              <Badge variant={getStatusBadgeVariant(activity.status)} className="text-xs">
                                {activity.status}
                              </Badge>
                            )}
                            {activity.amount && (
                              <span className="text-sm font-medium">{formatCurrency(activity.amount)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.date), 'PPp')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {activity.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activities found for this carrier
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Carrier Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Carrier</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel"
                        placeholder="Enter phone number" 
                        {...field}
                        onChange={(e) => {
                          // Only allow numbers in phone input
                          const numbersOnly = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(numbersOnly);
                        }}
                        onKeyPress={(e) => {
                          // Allow only numbers for phone number
                          const allowedChars = /[0-9]/;
                          if (!allowedChars.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                            e.preventDefault();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter service type (e.g., Standard, Express)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter full address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={updateCarrier.isPending}
                >
                  {updateCarrier.isPending ? "Updating..." : "Update Carrier"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

