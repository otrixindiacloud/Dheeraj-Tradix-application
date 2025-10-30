import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Search, Edit, Trash2, Key, Shield, 
  CheckCircle, XCircle, AlertCircle, RefreshCw, 
  Filter, Eye, EyeOff, Lock, Unlock
} from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// Types
interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  resource: string;
  action: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  roles: string[];
}

interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  permissionCount: number;
}

const PERMISSION_CATEGORIES = [
  { 
    id: "sales", 
    name: "Sales Management", 
    description: "Sales orders, quotations, and customer management",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: "🛒",
    permissionCount: 0
  },
  { 
    id: "purchase", 
    name: "Purchase Management", 
    description: "Purchase orders, supplier quotes, and procurement",
    color: "bg-green-50 text-green-700 border-green-200",
    icon: "📦",
    permissionCount: 0
  },
  { 
    id: "inventory", 
    name: "Inventory Management", 
    description: "Stock levels, warehouse operations, and inventory tracking",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: "📊",
    permissionCount: 0
  },
  { 
    id: "finance", 
    name: "Finance & Accounting", 
    description: "Financial operations, invoicing, and accounting",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: "💰",
    permissionCount: 0
  },
  { 
    id: "admin", 
    name: "Administration", 
    description: "User management, roles, and system administration",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: "⚙️",
    permissionCount: 0
  },
  { 
    id: "reports", 
    name: "Reports & Analytics", 
    description: "Reports, analytics, and data export",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: "📈",
    permissionCount: 0
  },
  { 
    id: "system", 
    name: "System Settings", 
    description: "System configuration and settings",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    icon: "🔧",
    permissionCount: 0
  }
];

const ACTIONS = [
  { value: "read", label: "Read", description: "View and read data" },
  { value: "write", label: "Write", description: "Create and edit data" },
  { value: "delete", label: "Delete", description: "Delete data" },
  { value: "export", label: "Export", description: "Export data" },
  { value: "admin", label: "Admin", description: "Administrative access" }
];

const RESOURCES = [
  "sales_orders", "quotations", "customers", "suppliers", "purchase_orders", 
  "inventory", "warehouse", "invoices", "reports", "users", "roles", "system"
];

export default function PermissionManagementPage() {
  const [activeTab, setActiveTab] = useState("permissions");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null);

  const [permissionForm, setPermissionForm] = useState({
    name: "",
    description: "",
    category: "",
    resource: "",
    action: "",
    isActive: true
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock data - replace with actual API calls
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
    queryFn: async () => {
      const response = await fetch("/api/permissions");
      if (!response.ok) throw new Error("Failed to fetch permissions");
      return response.json();
    }
  });

  const { data: categories = [] } = useQuery<PermissionCategory[]>({
    queryKey: ["/api/permissions/categories"],
    queryFn: async () => {
      const response = await fetch("/api/permissions/categories");
      if (!response.ok) throw new Error("Failed to fetch permission categories");
      return response.json();
    }
  });

  // Filter permissions
  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission?.resource?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || permission?.category === categoryFilter;
    const matchesAction = actionFilter === "all" || permission?.action === actionFilter;
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && permission?.isActive === true) ||
                         (statusFilter === "inactive" && permission?.isActive !== true);
    return matchesSearch && matchesCategory && matchesAction && matchesStatus;
  });

  // Permission columns
  const permissionColumns: Column<Permission>[] = [
    {
      key: "name",
      header: "Permission",
      render: (permission) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <Key className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {permission?.name || "No name"}
              {permission?.isActive !== true && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">{permission?.description || "No description"}</div>
          </div>
        </div>
      )
    },
    {
      key: "category",
      header: "Category",
      render: (permission) => {
        const category = categories.find(c => c.id === permission?.category);
        return (
          <div className="flex items-center gap-2">
            <span className="text-lg">{category?.icon}</span>
            <Badge variant="outline" className={category?.color}>
              {category?.name || permission?.category || "No category"}
            </Badge>
          </div>
        );
      }
    },
    {
      key: "resource",
      header: "Resource",
      render: (permission) => (
        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
          {permission?.resource || "No resource"}
        </code>
      )
    },
    {
      key: "action",
      header: "Action",
      render: (permission) => {
        const action = ACTIONS.find(a => a.value === permission?.action);
        return (
          <Badge variant="secondary">
            {action?.label || permission?.action || "No action"}
          </Badge>
        );
      }
    },
    {
      key: "usage",
      header: "Usage",
      render: (permission) => (
        <div className="text-center">
          <div className="font-medium">{permission?.usageCount || 0}</div>
          <div className="text-xs text-gray-500">roles</div>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (permission) => (
        <div className="flex items-center gap-2">
          {permission?.isActive === true ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span className={permission?.isActive === true ? "text-green-600" : "text-red-600"}>
            {permission?.isActive === true ? "Active" : "Inactive"}
          </span>
        </div>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (permission) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditPermission(permission)}
            title="Edit Permission"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTogglePermission(permission)}
            title={permission?.isActive === true ? "Deactivate" : "Activate"}
          >
            {permission?.isActive === true ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeletingPermission(permission)}
            title="Delete Permission"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Handlers
  const handleEditPermission = (permission: Permission) => {
    if (!permission) {
      console.error('Permission is undefined or null');
      return;
    }
    
    setEditingPermission(permission);
    setPermissionForm({
      name: permission.name || "",
      description: permission.description || "",
      category: permission.category || "",
      resource: permission.resource || "",
      action: permission.action || "",
      isActive: permission.isActive === true
    });
    setShowEditDialog(true);
  };

  const handleCreatePermission = () => {
    setPermissionForm({
      name: "",
      description: "",
      category: "",
      resource: "",
      action: "",
      isActive: true
    });
    setShowCreateDialog(true);
  };

  const handleTogglePermission = async (permission: Permission) => {
    try {
      const response = await fetch(`/api/permissions/${permission.id}/toggle`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error('Failed to toggle permission status');
      }

      toast({
        title: "Permission Updated",
        description: `Permission "${permission?.name || 'Unknown'}" has been ${permission?.isActive === true ? 'deactivated' : 'activated'}.`
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
    } catch (error) {
      console.error('Error toggling permission:', error);
      toast({
        title: "Error",
        description: "Failed to toggle permission status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSavePermission = async () => {
    if (!permissionForm.name.trim() || !permissionForm.category || !permissionForm.resource || !permissionForm.action) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingPermission) {
        // Update existing permission
        const response = await fetch(`/api/permissions/${editingPermission.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: permissionForm.name,
            description: permissionForm.description,
            category: permissionForm.category,
            resource: permissionForm.resource,
            action: permissionForm.action,
            isActive: permissionForm.isActive
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update permission');
        }

        toast({
          title: "Permission Updated",
          description: `Permission "${permissionForm.name}" has been updated successfully.`
        });
      } else {
        // Create new permission
        const response = await fetch('/api/permissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: permissionForm.name,
            description: permissionForm.description,
            category: permissionForm.category,
            resource: permissionForm.resource,
            action: permissionForm.action,
            isActive: permissionForm.isActive
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create permission');
        }

        toast({
          title: "Permission Created",
          description: `Permission "${permissionForm.name}" has been created successfully.`
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      setShowCreateDialog(false);
      setShowEditDialog(false);
      setEditingPermission(null);
    } catch (error) {
      console.error('Error saving permission:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save permission. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeletePermission = async (permission: Permission) => {
    try {
      const response = await fetch(`/api/permissions/${permission.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete permission');
      }

      toast({
        title: "Permission Deleted",
        description: `Permission "${permission.name}" has been deleted successfully.`
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      setDeletingPermission(null);
    } catch (error) {
      console.error('Error deleting permission:', error);
      toast({
        title: "Error",
        description: "Failed to delete permission. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-gray-600 mt-1">Create and manage system permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
              queryClient.invalidateQueries({ queryKey: ["/api/permissions/categories"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreatePermission}>
            <Plus className="h-4 w-4 mr-2" />
            Create Permission
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Permissions ({permissions.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Categories ({categories.length})
          </TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTIONS.map(action => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <DataTable
              data={filteredPermissions}
              columns={permissionColumns}
              loading={permissionsLoading}
              emptyMessage="No permissions found"
            />
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(category => (
              <Card key={category.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <p className="text-sm text-gray-500">{category.permissionCount} permissions</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={category.color}>
                      {category.permissionCount} permissions
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Permission Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setEditingPermission(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPermission ? "Edit Permission" : "Create New Permission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="permissionName">Permission Name</Label>
              <Input
                id="permissionName"
                value={permissionForm.name}
                onChange={(e) => setPermissionForm({...permissionForm, name: e.target.value})}
                placeholder="Enter permission name"
              />
            </div>
            
            <div>
              <Label htmlFor="permissionDescription">Description</Label>
              <Textarea
                id="permissionDescription"
                value={permissionForm.description}
                onChange={(e) => setPermissionForm({...permissionForm, description: e.target.value})}
                placeholder="Enter permission description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={permissionForm.category} onValueChange={(value) => setPermissionForm({...permissionForm, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="action">Action</Label>
                <Select value={permissionForm.action} onValueChange={(value) => setPermissionForm({...permissionForm, action: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map(action => (
                      <SelectItem key={action.value} value={action.value}>
                        <div>
                          <div className="font-medium">{action.label}</div>
                          <div className="text-xs text-gray-500">{action.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="resource">Resource</Label>
              <Select value={permissionForm.resource} onValueChange={(value) => setPermissionForm({...permissionForm, resource: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCES.map(resource => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={permissionForm.isActive}
                onChange={(e) => setPermissionForm({...permissionForm, isActive: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="isActive">Active Permission</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setShowEditDialog(false);
              setEditingPermission(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSavePermission}>
              {editingPermission ? "Update Permission" : "Create Permission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={!!deletingPermission}
        onOpenChange={() => setDeletingPermission(null)}
        title="Delete Permission"
        description={`Are you sure you want to delete the permission "${deletingPermission?.name}"? This action cannot be undone and will affect all roles using this permission.`}
        onConfirm={() => deletingPermission && handleDeletePermission(deletingPermission)}
        variant="destructive"
      />
    </div>
  );
}
