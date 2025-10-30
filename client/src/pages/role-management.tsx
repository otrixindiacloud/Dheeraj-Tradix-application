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
import { 
  Plus, Search, Edit, Trash2, Shield, Users, 
  CheckCircle, XCircle, AlertCircle, RefreshCw, Copy
} from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// Types
interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
  isSystem: boolean;
  color?: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  resource: string;
  action: string;
}

const PERMISSION_CATEGORIES = [
  { value: "sales", label: "Sales Management", color: "bg-blue-50 text-blue-700" },
  { value: "purchase", label: "Purchase Management", color: "bg-green-50 text-green-700" },
  { value: "inventory", label: "Inventory Management", color: "bg-purple-50 text-purple-700" },
  { value: "finance", label: "Finance & Accounting", color: "bg-yellow-50 text-yellow-700" },
  { value: "admin", label: "Administration", color: "bg-red-50 text-red-700" },
  { value: "reports", label: "Reports & Analytics", color: "bg-indigo-50 text-indigo-700" },
  { value: "system", label: "System Settings", color: "bg-gray-50 text-gray-700" }
];

const ROLE_COLORS = [
  { value: "blue", label: "Blue", class: "bg-blue-100 text-blue-800" },
  { value: "green", label: "Green", class: "bg-green-100 text-green-800" },
  { value: "purple", label: "Purple", class: "bg-purple-100 text-purple-800" },
  { value: "orange", label: "Orange", class: "bg-orange-100 text-orange-800" },
  { value: "red", label: "Red", class: "bg-red-100 text-red-800" },
  { value: "indigo", label: "Indigo", class: "bg-indigo-100 text-indigo-800" }
];

export default function RoleManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [duplicatingRole, setDuplicatingRole] = useState<Role | null>(null);

  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
    color: "blue"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock data - replace with actual API calls
  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await fetch("/api/roles");
      if (!response.ok) throw new Error("Failed to fetch roles");
      return response.json();
    }
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
    queryFn: async () => {
      const response = await fetch("/api/permissions");
      if (!response.ok) throw new Error("Failed to fetch permissions");
      return response.json();
    }
  });

  // Filter roles
  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Role columns
  const roleColumns: Column<Role>[] = [
    {
      key: "name",
      header: "Role Name",
      render: (role) => (
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${ROLE_COLORS.find(c => c.value === role?.color)?.class || 'bg-gray-100'}`} />
          <div>
            <div className="font-medium flex items-center gap-2">
              {role?.name || "No name"}
              {role?.isSystem === true && (
                <Badge variant="destructive" className="text-xs">
                  System
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">{role?.description || "No description"}</div>
          </div>
        </div>
      )
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (role) => (
        <div className="flex flex-wrap gap-1">
          {role?.permissions && role.permissions.includes("*") ? (
            <Badge variant="destructive" className="text-xs">
              All Permissions
            </Badge>
          ) : (
            <>
              {(role?.permissions || []).slice(0, 3).map(permission => {
                const perm = permissions.find(p => p.id === permission);
                return (
                  <Badge key={permission} variant="outline" className="text-xs">
                    {perm?.name || permission}
                  </Badge>
                );
              })}
              {(role?.permissions || []).length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{(role?.permissions || []).length - 3} more
                </Badge>
              )}
            </>
          )}
        </div>
      )
    },
    {
      key: "userCount",
      header: "Users",
      render: (role) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{role?.userCount || 0}</span>
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Created",
      render: (role) => formatDate(role?.createdAt)
    },
    {
      key: "actions",
      header: "Actions",
      render: (role) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditRole(role)}
            disabled={role?.isSystem === true}
            title="Edit Role"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDuplicateRole(role)}
            title="Duplicate Role"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeletingRole(role)}
            disabled={role?.isSystem === true}
            title="Delete Role"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Handlers
  const handleEditRole = (role: Role) => {
    if (!role) {
      console.error('Role is undefined or null');
      return;
    }
    
    setEditingRole(role);
    setRoleForm({
      name: role.name || "",
      description: role.description || "",
      permissions: role.permissions || [],
      color: role.color || "blue"
    });
    setShowEditDialog(true);
  };

  const handleDuplicateRole = (role: Role) => {
    if (!role) {
      console.error('Role is undefined or null');
      return;
    }
    
    setDuplicatingRole(role);
    setRoleForm({
      name: `${role.name || "Unknown"} (Copy)`,
      description: role.description || "",
      permissions: role.permissions || [],
      color: role.color || "blue"
    });
    setShowCreateDialog(true);
  };

  const handleCreateRole = () => {
    setRoleForm({
      name: "",
      description: "",
      permissions: [],
      color: "blue"
    });
    setShowCreateDialog(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingRole) {
        // Update existing role
        const response = await fetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: roleForm.name,
            description: roleForm.description,
            permissions: roleForm.permissions,
            color: roleForm.color
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update role');
        }

        toast({
          title: "Role Updated",
          description: `Role "${roleForm.name}" has been updated successfully.`
        });
      } else {
        // Create new role
        const response = await fetch('/api/roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: roleForm.name,
            description: roleForm.description,
            permissions: roleForm.permissions,
            color: roleForm.color
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create role');
        }

        toast({
          title: "Role Created",
          description: `Role "${roleForm.name}" has been created successfully.`
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowCreateDialog(false);
      setShowEditDialog(false);
      setEditingRole(null);
      setDuplicatingRole(null);
    } catch (error) {
      console.error('Error saving role:', error);
      toast({
        title: "Error",
        description: "Failed to save role. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!role) {
      console.error('Role is undefined or null');
      return;
    }
    
    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete role');
      }

      toast({
        title: "Role Deleted",
        description: `Role "${role.name || 'Unknown'}" has been deleted successfully.`
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeletingRole(null);
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: "Error",
        description: "Failed to delete role. Please try again.",
        variant: "destructive"
      });
    }
  };

  const togglePermission = (permissionId: string) => {
    const currentPermissions = roleForm.permissions || [];
    if (currentPermissions.includes(permissionId)) {
      setRoleForm({
        ...roleForm,
        permissions: currentPermissions.filter(p => p !== permissionId)
      });
    } else {
      setRoleForm({
        ...roleForm,
        permissions: [...currentPermissions, permissionId]
      });
    }
  };

  const selectAllPermissions = () => {
    setRoleForm({
      ...roleForm,
      permissions: permissions.map(p => p.id)
    });
  };

  const clearAllPermissions = () => {
    setRoleForm({
      ...roleForm,
      permissions: []
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600 mt-1">Create and manage user roles and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
              queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateRole}>
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <Card>
        <DataTable
          data={filteredRoles}
          columns={roleColumns}
          loading={rolesLoading}
          emptyMessage="No roles found"
        />
      </Card>

      {/* Create/Edit Role Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setEditingRole(null);
          setDuplicatingRole(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Role" : duplicatingRole ? "Duplicate Role" : "Create New Role"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({...roleForm, name: e.target.value})}
                  placeholder="Enter role name"
                />
              </div>
              <div>
                <Label htmlFor="roleColor">Role Color</Label>
                <Select value={roleForm.color} onValueChange={(value) => setRoleForm({...roleForm, color: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_COLORS.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={roleForm.description}
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                placeholder="Enter role description"
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label>Permissions</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllPermissions}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllPermissions}>
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto border rounded-md p-4">
                {PERMISSION_CATEGORIES.map(category => (
                  <div key={category.value} className="space-y-2">
                    <h4 className={`font-medium text-sm px-2 py-1 rounded ${category.color}`}>
                      {category.label}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 ml-4">
                      {permissions
                        .filter(p => p.category === category.value)
                        .map(permission => (
                          <label key={permission.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={(roleForm.permissions || []).includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{permission.name}</div>
                              <div className="text-xs text-gray-500">{permission.description}</div>
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setShowEditDialog(false);
              setEditingRole(null);
              setDuplicatingRole(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              {editingRole ? "Update Role" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={!!deletingRole}
        onOpenChange={() => setDeletingRole(null)}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${deletingRole?.name}"? This action cannot be undone and will affect all users assigned to this role.`}
        onConfirm={() => deletingRole && handleDeleteRole(deletingRole)}
        variant="destructive"
      />
    </div>
  );
}
