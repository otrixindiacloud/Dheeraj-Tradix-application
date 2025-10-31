import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  AlertTriangle,
  Plus, 
  Search, 
  Filter,
  Edit, 
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  User,
  Calendar,
  DollarSign,
  FileText,
  Truck,
  Package,
  AlertCircle,
  Activity,
  BarChart3,
  Trash,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Upload,
  Edit3,
  Loader2,
  Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/tables/data-table";
import { formatDate, formatCurrency } from "@/lib/utils";
import IssueReturnWizard from "@/components/IssueReturnWizard";
import DocumentAutomation from "@/components/DocumentAutomation";

// Helper: format a date (string from input or Date) to backend-required 'YYYY-MM-DD HH:mm:ss+00'
function toBackendTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  let d: Date | null = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string' && value.trim()) {
    // Accept ISO already
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return value;
    // Date-only -> midnight UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, day] = value.split('-').map(Number);
      d = new Date(Date.UTC(y, (m as number) - 1, day, 0, 0, 0));
    } else {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); // Trim ms for cleanliness
}

// Form schemas
const issueReturnSchema = z.object({
  returnNumber: z.string().optional(), // Will be generated automatically
  stockIssueId: z.string().min(1, "Stock issue is required"),
  returnType: z.string().min(1, "Return type is required"),
  priority: z.string().min(1, "Priority is required"),
  description: z.string().min(1, "Description is required"),
  returnedBy: z.string().min(1, "Returned by is required"),
  returnDate: z.string().min(1, "Return date is required").or(z.null()),
  status: z.string().optional(),
  resolution: z.string().optional(),
  assignedTo: z.string().optional(),
  estimatedResolution: z.string().optional(),
  notes: z.string().optional(),
});

type IssueReturnForm = z.infer<typeof issueReturnSchema>;

// Status icon helper
const getStatusIcon = (status: string | undefined) => {
  switch (status) {
    case "Open":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "In Progress":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "Resolved":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Closed":
      return <XCircle className="h-4 w-4 text-gray-600" />;
    case "Escalated":
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

// Status classes for bordered pill
const getStatusClasses = (status: string | undefined) => {
  switch (status) {
    case "Open":
      return "border-red-300 text-red-700 bg-red-50";
    case "In Progress":
      return "border-blue-300 text-blue-700 bg-blue-50";
    case "Resolved":
      return "border-green-300 text-green-700 bg-green-50";
    case "Closed":
      return "border-gray-300 text-gray-700 bg-gray-50";
    case "Escalated":
      return "border-orange-300 text-orange-700 bg-orange-50";
    default:
      return "border-gray-300 text-gray-700 bg-gray-50";
  }
};

// Priority classes
const getPriorityClasses = (priority: string | undefined) => {
  switch (priority) {
    case "Critical":
      return "border-red-500 text-red-700 bg-red-100";
    case "High":
      return "border-orange-500 text-orange-700 bg-orange-100";
    case "Medium":
      return "border-yellow-500 text-yellow-700 bg-yellow-100";
    case "Low":
      return "border-green-500 text-green-700 bg-green-100";
    default:
      return "border-gray-300 text-gray-700 bg-gray-50";
  }
};

export default function IssueReturnPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showIssueWizard, setShowIssueWizard] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Handle automation data extraction
  const handleAutomationData = (data: any) => {
    console.log('Automation data received:', data);
    
    // Pre-fill the form with extracted data
    if (data.documentNumber) {
      // You can pre-fill return number
    }
    if (data.documentDate) {
      // You can pre-fill return date
    }
    if (data.customerName) {
      // You can try to find matching customer
    }
    if (data.notes) {
      // You can pre-fill notes
    }
    
    // Show the wizard with pre-filled data
    setShowIssueWizard(true);
    setShowAutomation(false);
    
    toast({
      title: 'Data extracted successfully',
      description: `Found ${data.items?.length || 0} items. Please review and complete the form.`,
    });
  };

  // Fetch issue returns from API
  const { data: issueReturns = [], isLoading, error } = useQuery({
    queryKey: ["issue-returns"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/issue-returns");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch issue returns:", error);
        return [];
      }
    },
  });

  // Fetch stock issues for the wizard
  const { data: stockIssues = [] } = useQuery({
    queryKey: ["stock-issues"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/stock-issues");
        const data = await response.json();
        // Handle both array and object response formats
        if (Array.isArray(data)) {
          return data;
        } else if (data.stockIssues && Array.isArray(data.stockIssues)) {
          return data.stockIssues;
        } else {
          console.warn("Unexpected stock issues response format:", data);
          return [];
        }
      } catch (error) {
        console.error("Failed to fetch stock issues:", error);
        return [];
      }
    },
  });

  // Fetch customers for the wizard
  const { data: customers = [], isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      try {
        console.log("Fetching customers for issue return wizard...");
        const response = await apiRequest("GET", "/api/customers");
        const data = await response.json();
        console.log("Raw customers response:", data);
        
        // Handle both array and object response formats
        let customersData = [];
        if (Array.isArray(data)) {
          customersData = data;
        } else if (data.customers && Array.isArray(data.customers)) {
          customersData = data.customers;
        } else {
          console.warn("Unexpected customers response format:", data);
          return [];
        }
        
        console.log("Processed customers data:", customersData.length, "customers");
        return customersData;
      } catch (error) {
        console.error("Failed to fetch customers:", error);
        return [];
      }
    },
  });

  // Fetch suppliers for the wizard
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/suppliers");
        const data = await response.json();
        // Handle both array and object response formats
        if (Array.isArray(data)) {
          return data;
        } else if (data.suppliers && Array.isArray(data.suppliers)) {
          return data.suppliers;
        } else {
          console.warn("Unexpected suppliers response format:", data);
          return [];
        }
      } catch (error) {
        console.error("Failed to fetch suppliers:", error);
        return [];
      }
    },
  });

  // Fetch items for the wizard
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/items");
        const data = await response.json();
        // Handle both array and object response formats
        if (Array.isArray(data)) {
          return data;
        } else if (data.items && Array.isArray(data.items)) {
          return data.items;
        } else {
          console.warn("Unexpected items response format:", data);
          return [];
        }
      } catch (error) {
        console.error("Failed to fetch items:", error);
        return [];
      }
    },
  });

  // Create issue return mutation
  const createIssueReturnMutation = useMutation({
    mutationFn: async (data: IssueReturnForm) => {
      const response = await apiRequest("POST", "/api/issue-returns", {
        ...data,
        returnDate: toBackendTimestamp(data.returnDate),
        estimatedResolution: toBackendTimestamp(data.estimatedResolution),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-returns"] });
      toast({
        title: "Success",
        description: "Issue return created successfully",
      });
      setShowCreateDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create issue return",
        variant: "destructive",
      });
    },
  });

  // Update issue return mutation
  const updateIssueReturnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IssueReturnForm> }) => {
      const response = await apiRequest("PUT", `/api/issue-returns/${id}`, {
        ...data,
        returnDate: toBackendTimestamp(data.returnDate),
        estimatedResolution: toBackendTimestamp(data.estimatedResolution),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-returns"] });
      toast({
        title: "Success",
        description: "Issue return updated successfully",
      });
      setShowEditDialog(false);
      setSelectedIssue(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update issue return",
        variant: "destructive",
      });
    },
  });

  // Delete issue return mutation
  const deleteIssueReturnMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/issue-returns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-returns"] });
      toast({
        title: "Success",
        description: "Issue return deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete issue return",
        variant: "destructive",
      });
    },
  });

  // Form for creating/editing issue returns
  const form = useForm<IssueReturnForm>({
    resolver: zodResolver(issueReturnSchema),
    defaultValues: {
      stockIssueId: "",
      returnType: "",
      priority: "",
      description: "",
      returnedBy: "",
      returnDate: new Date().toISOString().split('T')[0],
      status: "Open",
      resolution: "",
      assignedTo: "",
      estimatedResolution: "",
      notes: "",
    },
  });

  // Filter data based on search and filters
  const filteredData = issueReturns.filter((issueReturn: any) => {
    const matchesSearch = 
      issueReturn.returnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issueReturn.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issueReturn.returnedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issueReturn.stockIssueId?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || issueReturn.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || issueReturn.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Handle form submission
  const onSubmit = (data: IssueReturnForm) => {
    if (selectedIssue) {
      updateIssueReturnMutation.mutate({ id: selectedIssue.id, data });
    } else {
      createIssueReturnMutation.mutate(data);
    }
  };

  // Handle edit
  const handleEdit = (issueReturn: any) => {
    setSelectedIssue(issueReturn);
    form.reset({
      returnNumber: issueReturn.returnNumber || "",
      stockIssueId: issueReturn.stockIssueId || "",
      returnType: issueReturn.returnType || "",
      priority: issueReturn.priority || "",
      description: issueReturn.description || "",
      returnedBy: issueReturn.returnedBy || "",
      returnDate: issueReturn.returnDate ? new Date(issueReturn.returnDate).toISOString().split('T')[0] : "",
      status: issueReturn.status || "Open",
      resolution: issueReturn.resolution || "",
      assignedTo: issueReturn.assignedTo || "",
      estimatedResolution: issueReturn.estimatedResolution ? new Date(issueReturn.estimatedResolution).toISOString().split('T')[0] : "",
      notes: issueReturn.notes || "",
    });
    setShowEditDialog(true);
  };

  // Handle delete
  const handleDelete = (issueReturn: any) => {
    if (window.confirm("Are you sure you want to delete this issue return?")) {
      deleteIssueReturnMutation.mutate(issueReturn.id);
    }
  };

  // Handle view details
  const handleViewDetails = (issueReturn: any) => {
    navigate(`/issue-return/${issueReturn.id}`);
  };

  // Table columns
  const columns = [
    {
      key: "returnNumber",
      header: "Return Number",
      render: (_: any, issueReturn: any) => (
        <div className="font-medium">{issueReturn.returnNumber}</div>
      ),
    },
    {
      key: "stockIssueNumber",
      header: "Stock Issue",
      render: (_: any, issueReturn: any) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <span className="text-sm">{issueReturn.stockIssueNumber || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "returnType",
      header: "Return Type",
      render: (_: any, issueReturn: any) => (
        <div className="text-sm">{issueReturn.returnType}</div>
      ),
    },
    {
      key: "returnedBy",
      header: "Returned By",
      render: (_: any, issueReturn: any) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          <span className="text-sm">{issueReturn.returnedBy}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_: any, issueReturn: any) => {
        const status = issueReturn.status;
        return (
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusClasses(status)}`}>
              {status}
            </span>
          </div>
        );
      },
    },
    {
      key: "returnDate",
      header: "Return Date",
      render: (_: any, issueReturn: any) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm">{formatDate(issueReturn.returnDate)}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: any, issueReturn: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewDetails(issueReturn)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(issueReturn)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(issueReturn)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading issue returns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-600">Failed to load issue returns</p>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const totalReturns = issueReturns.length;
  const openReturns = issueReturns.filter((r: any) => r.status === "Open").length;
  const inProgressReturns = issueReturns.filter((r: any) => r.status === "In Progress").length;
  const resolvedReturns = issueReturns.filter((r: any) => r.status === "Resolved").length;
  const closedReturns = issueReturns.filter((r: any) => r.status === "Closed").length;
  const cancelledReturns = issueReturns.filter((r: any) => r.status === "Cancelled").length;
  const totalValue = issueReturns.reduce((sum: number, r: any) => sum + (r.totalValue || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-white via-slate-50 to-white rounded-2xl p-8 shadow-xl border border-slate-200/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2 tracking-tight">Issue Returns</h1>
              <p className="text-lg text-slate-600 mb-4 font-medium">
                Manage returns of issued stock items when mistakes occur
              </p>
              <div className="flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Return Management</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Last updated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <DocumentAutomation
              documentType="issue-return"
              onDataExtracted={handleAutomationData}
              onClose={() => setShowAutomation(false)}
              trigger={
                <Button
                  variant="outline"
                  className="px-8 py-4 font-semibold border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Bot className="h-5 w-5 mr-3" />
                  Upload Issue Return Document
                </Button>
              }
            />
            <Button
              onClick={() => setShowIssueWizard(true)}
              className="px-8 py-4 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-3" />
              Return Issue 
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <Card className="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border-slate-200/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl group-hover:from-blue-100 group-hover:to-blue-200 transition-all duration-300">
                <BarChart3 className="h-6 w-6 text-slate-600 group-hover:text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-800">{totalReturns}</p>
                <p className="text-xs text-slate-500 font-medium">Total Returns</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 font-medium">All issue returns</p>
          </CardContent>
        </Card>
        
        <Card className="group relative overflow-hidden bg-gradient-to-br from-white to-red-50 border-red-200/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl group-hover:from-red-200 group-hover:to-red-300 transition-all duration-300">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-red-600">{openReturns}</p>
                <p className="text-xs text-red-500 font-medium">Open</p>
              </div>
            </div>
            <p className="text-sm text-red-600 font-medium">Pending resolution</p>
          </CardContent>
        </Card>
        
        <Card className="group relative overflow-hidden bg-gradient-to-br from-white to-blue-50 border-blue-200/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-300">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-600">{inProgressReturns}</p>
                <p className="text-xs text-blue-500 font-medium">In Progress</p>
              </div>
            </div>
            <p className="text-sm text-blue-600 font-medium">Being processed</p>
          </CardContent>
        </Card>
        
        <Card className="group relative overflow-hidden bg-gradient-to-br from-white to-green-50 border-green-200/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl group-hover:from-green-200 group-hover:to-green-300 transition-all duration-300">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-green-600">{resolvedReturns}</p>
                <p className="text-xs text-green-500 font-medium">Resolved</p>
              </div>
            </div>
            <p className="text-sm text-green-600 font-medium">Successfully resolved</p>
          </CardContent>
        </Card>
        
        <Card className="group relative overflow-hidden bg-gradient-to-br from-white to-gray-50 border-gray-200/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl group-hover:from-gray-200 group-hover:to-gray-300 transition-all duration-300">
                <XCircle className="h-6 w-6 text-gray-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-600">{closedReturns}</p>
                <p className="text-xs text-gray-500 font-medium">Closed</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium">Closed returns</p>
          </CardContent>
        </Card>
        
        <Card className="group relative overflow-hidden bg-gradient-to-br from-white to-emerald-50 border-emerald-200/60 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl group-hover:from-emerald-200 group-hover:to-emerald-300 transition-all duration-300">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">${totalValue.toFixed(2)}</p>
                <p className="text-xs text-emerald-500 font-medium">Total Value</p>
              </div>
            </div>
            <p className="text-sm text-emerald-600 font-medium">Return value</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search & Filters */}
      <Card className="bg-gradient-to-r from-white to-slate-50 border-slate-200/60 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
              <Search className="h-5 w-5 text-blue-600" />
            </div>
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5 group-hover:text-blue-500 transition-colors" />
                <Input
                  placeholder="Search issue returns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl bg-white/80 backdrop-blur-sm"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48 h-12 pl-10 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl bg-white/80 backdrop-blur-sm">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-48 h-12 pl-10 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl bg-white/80 backdrop-blur-sm">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Data Table */}
      <Card className="bg-gradient-to-r from-white to-slate-50 border-slate-200/60 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
                  <Activity className="h-5 w-5 text-indigo-600" />
                </div>
                Issue Returns
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium mt-2">
                {filteredData.length} of {issueReturns.length} issue returns
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["issue-returns"] })}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-white/80 backdrop-blur-sm">
            <DataTable
              columns={columns}
              data={filteredData}
              isLoading={isLoading}
              emptyMessage="No issue returns found. Create your first issue return to get started."
            />
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setSelectedIssue(null);
          form.reset();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50 border-slate-200/60 shadow-2xl">
          <DialogHeader className="pb-6 border-b border-slate-200/60">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-800">
                  {selectedIssue ? "Edit Issue Return" : "Create Issue Return"}
                </DialogTitle>
                <DialogDescription className="text-slate-600 font-medium mt-1">
                  {selectedIssue ? "Update the issue return details" : "Create a new issue return for issued stock items"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="returnNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Return Number</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder={selectedIssue ? "Return Number" : "Auto-generated"} 
                          disabled={!selectedIssue}
                          className={`h-11 border-slate-200 rounded-xl ${!selectedIssue ? 'bg-slate-50 text-slate-500' : 'focus:border-blue-300 focus:ring-blue-200'}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stockIssueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Stock Issue ID</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="STK-001" 
                          className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="returnType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select return type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                          <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                          <SelectItem value="Damaged Item">Damaged Item</SelectItem>
                          <SelectItem value="Over Issued">Over Issued</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Critical">Critical</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe the issue..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="returnedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Returned By</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Return Date</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date" 
                          value={field.value || ""}
                          className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                          <SelectItem value="Escalated">Escalated</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Assignee name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-4 pt-6 border-t border-slate-200/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setShowEditDialog(false);
                    setSelectedIssue(null);
                    form.reset();
                  }}
                  className="px-8 py-3 border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createIssueReturnMutation.isPending || updateIssueReturnMutation.isPending}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {createIssueReturnMutation.isPending || updateIssueReturnMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {selectedIssue ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    selectedIssue ? "Update Issue Return" : "Create Issue Return"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Details moved to dedicated page: /issue-return/:id */}

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 border-0"
        >
          <Plus className="h-8 w-8 text-white" />
        </Button>
      </div>

      {/* Issue Return Wizard */}
      <IssueReturnWizard
        open={showIssueWizard}
        onOpenChange={setShowIssueWizard}
        stockIssues={stockIssues}
        customers={customers}
        suppliers={suppliers}
        items={items}
        customersLoading={customersLoading}
        customersError={customersError}
      />
    </div>
  );
}
