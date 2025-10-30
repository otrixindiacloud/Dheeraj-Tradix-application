import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Edit, Trash2, Truck, Filter, Search, CheckCircle } from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";

const carrierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  carrierCode: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  serviceType: z.string().optional(),
});

type CarrierFormData = z.infer<typeof carrierSchema>;

interface Carrier {
  id: string;
  name: string;
  carrierCode?: string;
  carrier_code?: string; // Backend may return snake_case
  contactPerson?: string;
  contact_person?: string; // Backend may return snake_case
  email: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  service_type?: string; // Backend may return snake_case
  isActive?: boolean;
  is_active?: boolean; // Backend may return snake_case
}

export default function Carriers() {
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const form = useForm<CarrierFormData>({
    resolver: zodResolver(carrierSchema),
    defaultValues: {
      name: "",
      carrierCode: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      serviceType: "",
    },
  });

  const createCarrier = useMutation({
    mutationFn: async (data: CarrierFormData) => {
      const response = await fetch("/api/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create carrier");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      toast({
        title: "Success",
        description: "Carrier created successfully",
      });
      setShowNewCarrier(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create carrier",
        variant: "destructive",
      });
    },
  });
  const { data: carriers = [], isLoading, error } = useQuery({
    queryKey: ["/api/carriers"],
    queryFn: async () => {
      const response = await fetch("/api/carriers");
      if (!response.ok) {
        throw new Error(`Failed to fetch carriers: ${response.statusText}`);
      }
      const data = await response.json();
      // Debug: Log the first carrier to see field names
      if (data.length > 0) {
        console.log("Carrier data structure:", data[0]);
      }
      return data;
    },
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [showNewCarrier, setShowNewCarrier] = useState(false);
  const [showEditCarrier, setShowEditCarrier] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [deletingCarrier, setDeletingCarrier] = useState<Carrier | null>(null);
  const [location, navigate] = useLocation();
  const [filters, setFilters] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
  });

  const updateCarrier = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CarrierFormData }) => {
      const response = await fetch(`/api/carriers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update carrier");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      toast({
        title: "Success",
        description: "Carrier updated successfully",
      });
      setShowEditCarrier(false);
      setEditingCarrier(null);
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

  const deleteCarrier = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/carriers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete carrier");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      toast({
        title: "Success",
        description: "Carrier deleted successfully",
      });
      setDeletingCarrier(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete carrier",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (carrier: Carrier) => {
    setEditingCarrier(carrier);
    form.reset({
      name: carrier.name,
      carrierCode: carrier.carrierCode || "",
      contactPerson: carrier.contactPerson || "",
      email: carrier.email,
      phone: carrier.phone || "",
      address: carrier.address || "",
      serviceType: carrier.serviceType || "",
    });
    setShowEditCarrier(true);
  };

  const handleDelete = (carrier: Carrier) => {
    setDeletingCarrier(carrier);
  };

  const onSubmit = (data: CarrierFormData) => {
    if (editingCarrier) {
      updateCarrier.mutate({ id: editingCarrier.id, data });
    } else {
      createCarrier.mutate(data);
    }
  };

  const columns: Column<Carrier>[] = [
    {
      key: "name",
      header: "Company Name",
      render: (value: string, carrier: Carrier) => (
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "carrierCode",
      header: "Carrier Code",
      render: (value: string, carrier: Carrier) => {
        // Handle both camelCase and snake_case field names
        const code = carrier.carrierCode || (carrier as any).carrier_code;
        return code || "-";
      },
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      render: (value: string) => value || "-",
    },
    {
      key: "email",
      header: "Email",
      render: (value: string) => (
        <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
          {value}
        </a>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (value: string) => value || "-",
    },
    {
      key: "serviceType",
      header: "Service Type",
      render: (value: string, carrier: Carrier) => {
        const serviceType = carrier.serviceType || (carrier as any).service_type;
        return serviceType || "-";
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, carrier: Carrier) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/carriers/${carrier.id}`);
            }}
            data-testid={`button-view-${carrier.id}`}
          >
              <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(carrier);
            }}
            data-testid={`button-edit-${carrier.id}`}
          >
              <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(carrier);
            }}
            data-testid={`button-delete-${carrier.id}`}
          >
              <Trash2 className="h-4 w-4" style={{ color: '#ef4444' }} />
          </Button>
        </div>
      ),
    },
  ];

  // Filter and pagination logic
  const filteredCarriers = carriers.filter((carrier: Carrier) => {
    const matchesCompanyName = !filters.companyName || carrier.name.toLowerCase().includes(filters.companyName.toLowerCase());
    const matchesContactPerson = !filters.contactPerson || (carrier.contactPerson && carrier.contactPerson.toLowerCase().includes(filters.contactPerson.toLowerCase()));
    const matchesEmail = !filters.email || carrier.email.toLowerCase().includes(filters.email.toLowerCase());
    const matchesPhone = !filters.phone || (carrier.phone && carrier.phone.toLowerCase().includes(filters.phone.toLowerCase()));
    return matchesCompanyName && matchesContactPerson && matchesEmail && matchesPhone;
  });

  const totalPages = Math.ceil(filteredCarriers.length / pageSize);
  const paginatedCarriers = filteredCarriers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      {/* Enhanced Card-style header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow-lg border border-gray-200 relative overflow-hidden mb-6">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-blue-50/50 to-transparent rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-48 h-24 bg-gradient-to-tr from-indigo-50/30 to-transparent rounded-tr-full"></div>
        
        <div className="relative px-8 py-6 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-200">
                <Truck className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1" data-testid="text-page-title">
                  Carriers
                </h2>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    <Truck className="h-3 w-3 mr-1" />
                    Shipping Services
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 text-sm font-medium">
                      Managing carrier relationships
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-base max-w-2xl leading-relaxed">
              Manage your carrier database and shipping service providers
            </p>
          </div>
          
          <div className="flex items-center gap-4 ml-8"> 
            <Dialog open={showNewCarrier} onOpenChange={setShowNewCarrier}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transform hover:-translate-y-0.5 border border-gray-200" 
                  data-testid="button-new-carrier"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Plus className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold">New Carrier</div>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Carrier</DialogTitle>
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
                      name="carrierCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Carrier Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter carrier code (optional)" {...field} />
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
                          <FormLabel>Email *</FormLabel>
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
                        disabled={createCarrier.isPending}
                        data-testid="button-submit"
                      >
                        {createCarrier.isPending ? "Creating..." : "Create Carrier"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowNewCarrier(false);
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
        </div>
      </div>

      {/* Stats Cards - Enhanced Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/30 rounded-bl-full blur-xl"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-indigo-200/20 rounded-tr-full blur-xl"></div>
          <CardContent className="p-7 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Total Carriers</p>
                <p className="text-3xl font-extrabold text-blue-700 drop-shadow-sm" data-testid="stat-total-carriers">
                  {carriers.length}
                </p>
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center shadow-md border border-blue-200">
                <Truck className="h-7 w-7 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-green-500 text-green-600 font-medium px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 bg-transparent shadow-none"
              >
                <CheckCircle className="h-3 w-3" />
                Active
              </Badge>
              <span className="text-gray-500 text-xs">Carrier records in system</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="shadow-lg border-gray-200 bg-white mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Filter className="h-4 w-4 text-gray-600" />
              </div>
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="shadow-sm flex items-center gap-1 px-2 py-0 h-6 min-h-0 text-xs"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="w-3 h-3 mr-1" />
                {showFilters ? "Hide" : "Show"} Filters
              </Button>
              {(filters.companyName || filters.contactPerson || filters.email || filters.phone) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ companyName: "", contactPerson: "", email: "", phone: "" })}
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
              <div className="text-sm font-medium text-black text-left">Company Name</div>
              <div className="text-sm font-medium text-black text-left">Contact Person</div>
              <div className="text-sm font-medium text-black text-left">Email</div>
              <div className="text-sm font-medium text-black text-left">Phone</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Company Name"
                  value={filters.companyName}
                  onChange={(e) => setFilters({ ...filters, companyName: e.target.value })}
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm transition-all duration-200"
                  data-testid="input-company-name-filter"
                />
              </div>
              <div>
                <Input
                  placeholder="Contact Person"
                  value={filters.contactPerson}
                  onChange={(e) => setFilters({ ...filters, contactPerson: e.target.value })}
                  className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm transition-all duration-200"
                  data-testid="input-contact-person-filter"
                />
              </div>
              <div>
                <Input
                  placeholder="Email"
                  value={filters.email}
                  onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                  className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm transition-all duration-200"
                  data-testid="input-email-filter"
                />
              </div>
              <div>
                <Input
                  type="tel"
                  placeholder="Phone"
                  value={filters.phone}
                  onChange={(e) => {
                    // Only allow numbers in phone filter
                    const numbersOnly = e.target.value.replace(/[^0-9]/g, '');
                    setFilters({ ...filters, phone: numbersOnly });
                  }}
                  onKeyPress={(e) => {
                    // Allow only numbers for phone number
                    const allowedChars = /[0-9]/;
                    if (!allowedChars.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm transition-all duration-200"
                  data-testid="input-phone-filter"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Carriers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Carriers</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <DataTable
              data={paginatedCarriers}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No carriers found. Add your first carrier to get started."
            />
            {/* Pagination Controls */}
            {filteredCarriers.length > pageSize && (
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

      {/* Edit Carrier Dialog */}
      <Dialog open={showEditCarrier} onOpenChange={setShowEditCarrier}>
        <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
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
                name="carrierCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter carrier code (optional)" {...field} />
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
                    <FormLabel>Email *</FormLabel>
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
                  data-testid="button-submit"
                >
                  {updateCarrier.isPending ? "Updating..." : "Update Carrier"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditCarrier(false);
                    setEditingCarrier(null);
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCarrier} onOpenChange={() => setDeletingCarrier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the carrier
              "{deletingCarrier?.name}" and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCarrier && deleteCarrier.mutate(deletingCarrier.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

