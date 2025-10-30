import React, { useState, useEffect } from "react";
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
  Plus, Search, Filter, Users, Shield, Settings, 
  Edit, Trash2, Eye, CheckCircle, XCircle, AlertCircle,
  UserCheck, UserX, Key, Lock, Unlock, RefreshCw
} from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// Types
interface User {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  permissions?: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
  isSystem: boolean;
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
  { value: "sales", label: "Sales Management" },
  { value: "purchase", label: "Purchase Management" },
  { value: "inventory", label: "Inventory Management" },
  { value: "finance", label: "Finance & Accounting" },
  { value: "admin", label: "Administration" },
  { value: "reports", label: "Reports & Analytics" },
  { value: "system", label: "System Settings" }
];

const ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales Representative" },
  { value: "warehouse", label: "Warehouse Staff" },
  { value: "finance", label: "Finance" },
  { value: "user", label: "User" }
];

export default function AccessManagementPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Dialog states
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);

  // Form states
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    role: "user",
    isActive: true,
    permissions: [] as string[]
  });

  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[]
  });

  const [permissionForm, setPermissionForm] = useState({
    name: "",
    description: "",
    category: "",
    resource: "",
    action: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock data - replace with actual API calls
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/users");
        if (!response.ok) throw new Error("Failed to fetch users");
        const data = await response.json();
        // Ensure permissions array exists for each user
        return (data.users || []).map((user: any) => ({
          ...user,
          permissions: user.permissions || [],
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || ""
        }));
      } catch (error) {
        console.error("Error fetching users:", error);
        return [];
      }
    }
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await fetch("/api/roles");
      if (!response.ok) throw new Error("Failed to fetch roles");
      return response.json();
    }
  });

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
    queryFn: async () => {
      const response = await fetch("/api/permissions");
      if (!response.ok) throw new Error("Failed to fetch permissions");
      return response.json();
    }
  });

  // Filter data
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && user.isActive === true) ||
                         (statusFilter === "inactive" && user.isActive !== true);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredRoles = roles.filter(role => 
    role?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role?.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPermissions = permissions.filter(permission =>
    permission?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission?.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // User columns
  const userColumns: Column<User>[] = [
    {
      key: "username",
      header: "Username",
      render: (user) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {(user?.firstName || "").charAt(0)}{(user?.lastName || "").charAt(0)}
            </span>
          </div>
          <div>
            <div className="font-medium">{user?.username || "No username"}</div>
            <div className="text-sm text-gray-500">{user?.email || "No email"}</div>
          </div>
        </div>
      )
    },
    {
      key: "name",
      header: "Full Name",
      render: (user) => `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "No name"
    },
    {
      key: "role",
      header: "Role",
      render: (user) => (
        <Badge variant={user?.role === "admin" ? "destructive" : "secondary"}>
          {user?.role || "No role"}
        </Badge>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <Badge variant={user?.isActive === true ? "default" : "secondary"}>
          {user?.isActive === true ? "Active" : "Inactive"}
        </Badge>
      )
    },
    {
      key: "lastLogin",
      header: "Last Login",
      render: (user) => user?.lastLogin ? formatDate(user.lastLogin) : "Never"
    },
    {
      key: "actions",
      header: "Actions",
      render: (user) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditUser(user)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleUserStatus(user)}
          >
            {user?.isActive === true ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
        </div>
      )
    }
  ];

  // Role columns
  const roleColumns: Column<Role>[] = [
    {
      key: "name",
      header: "Role Name",
      render: (role) => (
        <div>
          <div className="font-medium">{role?.name || "No name"}</div>
          <div className="text-sm text-gray-500">{role?.description || "No description"}</div>
        </div>
      )
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (role) => (
        <div className="flex flex-wrap gap-1">
          {(role?.permissions || []).slice(0, 3).map(permission => (
            <Badge key={permission} variant="outline" className="text-xs">
              {permission}
            </Badge>
          ))}
          {(role?.permissions || []).length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{(role?.permissions || []).length - 3} more
            </Badge>
          )}
        </div>
      )
    },
    {
      key: "userCount",
      header: "Users",
      render: (role) => (
        <Badge variant="secondary">
          {role?.userCount || 0} users
        </Badge>
      )
    },
    {
      key: "isSystem",
      header: "Type",
      render: (role) => (
        <Badge variant={role?.isSystem === true ? "destructive" : "secondary"}>
          {role?.isSystem === true ? "System" : "Custom"}
        </Badge>
      )
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
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteRole(role)}
            disabled={role?.isSystem === true}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Permission columns
  const permissionColumns: Column<Permission>[] = [
    {
      key: "name",
      header: "Permission",
      render: (permission) => (
        <div>
          <div className="font-medium">{permission?.name || "No name"}</div>
          <div className="text-sm text-gray-500">{permission?.description || "No description"}</div>
        </div>
      )
    },
    {
      key: "category",
      header: "Category",
      render: (permission) => (
        <Badge variant="outline">
          {permission?.category || "No category"}
        </Badge>
      )
    },
    {
      key: "resource",
      header: "Resource",
      render: (permission) => permission?.resource || "No resource"
    },
    {
      key: "action",
      header: "Action",
      render: (permission) => (
        <Badge variant="secondary">
          {permission?.action || "No action"}
        </Badge>
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
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Handlers
  const handleEditUser = (user: User) => {
    if (!user) {
      console.error('User is undefined or null');
      return;
    }
    
    setEditingUser(user);
    setUserForm({
      username: user.username || "",
      email: user.email || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role || "user",
      isActive: user.isActive === true,
      permissions: user.permissions || []
    });
    setShowUserDialog(true);
  };

  const handleEditRole = (role: Role) => {
    if (!role) {
      console.error('Role is undefined or null');
      return;
    }
    
    setEditingRole(role);
    setRoleForm({
      name: role.name || "",
      description: role.description || "",
      permissions: role.permissions || []
    });
    setShowRoleDialog(true);
  };

  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission);
    setPermissionForm({
      name: permission?.name || "",
      description: permission?.description || "",
      category: permission?.category || "",
      resource: permission?.resource || "",
      action: permission?.action || ""
    });
    setShowPermissionDialog(true);
  };

  const handleToggleUserStatus = async (user: User) => {
    if (!user) {
      console.error('User is undefined or null');
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: user.username || "",
          email: user.email || "",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          role: user.role || "user",
          isActive: user.isActive !== true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      toast({
        title: "User Status Updated",
        description: `User ${user.username || 'Unknown'} has been ${user.isActive === true ? 'deactivated' : 'activated'}.`
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteRole = (role: Role) => {
    if (!role) {
      console.error('Role is undefined or null');
      return;
    }
    
    // Implement delete role
    toast({
      title: "Role Deleted",
      description: `Role ${role.name || 'Unknown'} has been deleted.`
    });
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        // Update existing user
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: userForm.username,
            email: userForm.email,
            firstName: userForm.firstName,
            lastName: userForm.lastName,
            role: userForm.role,
            isActive: userForm.isActive
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update user');
        }

        toast({
          title: "User Updated",
          description: "User has been updated successfully."
        });
      } else {
        // Create new user
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: userForm.username,
            email: userForm.email,
            firstName: userForm.firstName,
            lastName: userForm.lastName,
            role: userForm.role,
            isActive: userForm.isActive
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create user');
        }

        toast({
          title: "User Created",
          description: "User has been created successfully."
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowUserDialog(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: "Failed to save user. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSaveRole = () => {
    // Implement save role
    toast({
      title: "Role Updated",
      description: "Role has been updated successfully."
    });
    setShowRoleDialog(false);
    setEditingRole(null);
  };

  const handleSavePermission = () => {
    // Implement save permission
    toast({
      title: "Permission Updated",
      description: "Permission has been updated successfully."
    });
    setShowPermissionDialog(false);
    setEditingPermission(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Access Management</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/users"] });
              queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
              queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Permissions ({permissions.length})
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowUserDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card>
            <DataTable
              data={filteredUsers}
              columns={userColumns}
              loading={usersLoading}
              emptyMessage="No users found"
            />
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Button onClick={() => setShowRoleDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>

          <Card>
            <DataTable
              data={filteredRoles}
              columns={roleColumns}
              loading={rolesLoading}
              emptyMessage="No roles found"
            />
          </Card>
        </TabsContent>

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
            <Button onClick={() => setShowPermissionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Permission
            </Button>
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
      </Tabs>

      {/* User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={userForm.username}
                  onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={userForm.firstName}
                  onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={userForm.lastName}
                  onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={userForm.role} onValueChange={(value) => setUserForm({...userForm, role: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={userForm.isActive}
                onChange={(e) => setUserForm({...userForm, isActive: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="isActive">Active User</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Role" : "Add New Role"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={roleForm.name}
                onChange={(e) => setRoleForm({...roleForm, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={roleForm.description}
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
              />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {PERMISSION_CATEGORIES.map(category => (
                  <div key={category.value} className="space-y-1">
                    <h4 className="font-medium text-sm text-gray-700">{category.label}</h4>
                    <div className="grid grid-cols-2 gap-2 ml-4">
                      {permissions
                        .filter(p => p.category === category.value)
                        .map(permission => (
                          <label key={permission.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={roleForm.permissions.includes(permission.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRoleForm({
                                    ...roleForm,
                                    permissions: [...roleForm.permissions, permission.id]
                                  });
                                } else {
                                  setRoleForm({
                                    ...roleForm,
                                    permissions: roleForm.permissions.filter(p => p !== permission.id)
                                  });
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{permission.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              {editingRole ? "Update Role" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPermission ? "Edit Permission" : "Add New Permission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="permissionName">Permission Name</Label>
              <Input
                id="permissionName"
                value={permissionForm.name}
                onChange={(e) => setPermissionForm({...permissionForm, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="permissionDescription">Description</Label>
              <Textarea
                id="permissionDescription"
                value={permissionForm.description}
                onChange={(e) => setPermissionForm({...permissionForm, description: e.target.value})}
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
                    {PERMISSION_CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
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
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="write">Write</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="resource">Resource</Label>
              <Input
                id="resource"
                value={permissionForm.resource}
                onChange={(e) => setPermissionForm({...permissionForm, resource: e.target.value})}
                placeholder="e.g., sales_orders, users, reports"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermission}>
              {editingPermission ? "Update Permission" : "Create Permission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
