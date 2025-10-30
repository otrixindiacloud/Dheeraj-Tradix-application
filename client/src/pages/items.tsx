
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Form schema for creating items
const createItemSchema = z.object({
  supplierCode: z.string().min(1, "Supplier code is required"),
  barcode: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  category: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  costPrice: z.number().min(0, "Cost price must be non-negative").optional(),
  retailMarkup: z.number().min(0, "Retail markup must be non-negative").optional(),
  wholesaleMarkup: z.number().min(0, "Wholesale markup must be non-negative").optional(),
  supplierId: z.string().uuid().optional(),
  variants: z.any().optional(),
  isActive: z.boolean().default(true),
});

type CreateItemForm = z.infer<typeof createItemSchema>;

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form setup
  const form = useForm<CreateItemForm>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      supplierCode: "",
      barcode: "",
      description: "",
      category: "",
      unitOfMeasure: "",
      costPrice: 0,
      retailMarkup: 70,
      wholesaleMarkup: 40,
      isActive: true,
    },
  });

  // Mock data for now - replace with actual API call
  const mockItems = [
    { id: 1, description: "Item A", supplierCode: "SKU001", category: "Category 1", isActive: true },
    { id: 2, description: "Item B", supplierCode: "SKU002", category: "Category 2", isActive: false },
    { id: 3, description: "Item C", supplierCode: "SKU003", category: "Category 1", isActive: true },
  ];

  const filteredItems = mockItems.filter(
    (item) =>
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(search.toLowerCase()))
  );

  // Status counts
  const total = mockItems.length;
  const active = mockItems.filter(i => i.isActive).length;
  const inactive = mockItems.filter(i => !i.isActive).length;

  // Create item mutation
  const createItem = useMutation({
    mutationFn: async (data: CreateItemForm) => {
      const response = await apiRequest("POST", "/api/items", data);
      if (!response.ok) {
        throw new Error("Failed to create item");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "Success",
        description: `Item "${data.description}" created successfully`,
      });
    },
    onError: (error: any) => {
      console.error("Create item error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  // Handle create item form submission
  const handleCreateItem = async (data: CreateItemForm) => {
    try {
      await createItem.mutateAsync(data);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Error creating item:', error);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-3xl font-bold">Inventory Items</h1>
          <p className="text-gray-600 mt-1">View, edit, and manage all inventory items</p>
        </div>
        <Button variant="success" className="flex items-center gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="bg-blue-50">
          <CardContent className="flex flex-col items-center py-6">
            <span className="text-2xl font-bold text-blue-900">{total}</span>
            <span className="text-blue-700 mt-1">Total Items</span>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="flex flex-col items-center py-6">
            <span className="text-2xl font-bold text-green-900">{active}</span>
            <span className="text-green-700 mt-1">Active</span>
          </CardContent>
        </Card>
        <Card className="bg-gray-50">
          <CardContent className="flex flex-col items-center py-6">
            <span className="text-2xl font-bold text-gray-900">{inactive}</span>
            <span className="text-gray-700 mt-1">Inactive</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Items List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Input
              placeholder="Search by description, supplier code, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Total: {filteredItems.length}
              </Badge>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Supplier Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No items found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell>{item.id}</TableCell>
                    <TableCell className="font-medium text-blue-900">{item.description}</TableCell>
                    <TableCell>{item.supplierCode}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "success" : "outline"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="secondary" title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Fill in the details to add a new inventory item.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleCreateItem)} className="space-y-4">
            <div>
              <Label htmlFor="supplierCode">Supplier Code *</Label>
              <Input 
                id="supplierCode" 
                placeholder="Supplier Code" 
                {...form.register("supplierCode")}
                className={form.formState.errors.supplierCode ? "border-red-500" : ""}
              />
              {form.formState.errors.supplierCode && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.supplierCode.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Input 
                id="description" 
                placeholder="Item Description" 
                {...form.register("description")}
                className={form.formState.errors.description ? "border-red-500" : ""}
              />
              {form.formState.errors.description && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input 
                id="barcode" 
                placeholder="Barcode (optional)" 
                {...form.register("barcode")}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input 
                id="category" 
                placeholder="Category" 
                {...form.register("category")}
              />
            </div>
            <div>
              <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
              <Input 
                id="unitOfMeasure" 
                placeholder="e.g., PCS, KG, L" 
                {...form.register("unitOfMeasure")}
              />
            </div>
            <div>
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input 
                id="costPrice" 
                type="number" 
                step="0.01"
                placeholder="0.00" 
                {...form.register("costPrice", { valueAsNumber: true })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" disabled={createItem.isPending}>
                {createItem.isPending ? "Creating..." : "Add Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}