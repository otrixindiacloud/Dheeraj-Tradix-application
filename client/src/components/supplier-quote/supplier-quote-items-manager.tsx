import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Package, Calculator } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const supplierQuoteItemSchema = z.object({
  itemDescription: z.string().min(1, "Item description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  vatPercent: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).optional(),
  warranty: z.string().optional(),
  leadTime: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierQuoteItemFormData = z.infer<typeof supplierQuoteItemSchema>;

interface SupplierQuoteItemsManagerProps {
  supplierQuoteId: string;
  editable?: boolean;
}

interface SupplierQuoteItem {
  id: string;
  supplierQuoteId: string;
  itemDescription: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  discountPercent?: string;
  discountAmount?: string;
  vatPercent?: string;
  vatAmount?: string;
  specification?: string;
  brand?: string;
  model?: string;
  warranty?: string;
  leadTime?: string;
  notes?: string;
}

export default function SupplierQuoteItemsManager({ 
  supplierQuoteId, 
  editable = true 
}: SupplierQuoteItemsManagerProps) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplierQuoteItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: itemsResponse, isLoading } = useQuery({
    queryKey: ["/api/supplier-quotes", supplierQuoteId, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-quotes/${supplierQuoteId}/items`);
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
  });

  // Ensure items is always an array
  const items = Array.isArray(itemsResponse) ? itemsResponse : [];

  const form = useForm<SupplierQuoteItemFormData>({
    resolver: zodResolver(supplierQuoteItemSchema),
    defaultValues: {
      itemDescription: "",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      vatPercent: 0,
      vatAmount: 0,
      warranty: "",
      leadTime: "",
      notes: "",
    },
  });

  // Watch form values for calculations
  const quantity = form.watch("quantity") || 1;
  const unitPrice = form.watch("unitPrice") || 0;
  const discountPercent = form.watch("discountPercent") || 0;
  const discountAmount = form.watch("discountAmount") || 0;
  const vatPercent = form.watch("vatPercent") || 0;
  const vatAmount = form.watch("vatAmount") || 0;

  // Calculate totals
  const grossAmount = quantity * unitPrice;
  const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
  const netAmount = Math.max(0, grossAmount - calculatedDiscountAmount);
  const calculatedVatAmount = vatAmount > 0 ? vatAmount : (netAmount * vatPercent / 100);
  const lineTotal = netAmount + calculatedVatAmount;

  // Update calculated values when dependencies change
  React.useEffect(() => {
    if (editingItem) return; // Don't auto-update when editing
    
    const newDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
    const newNetAmount = Math.max(0, grossAmount - newDiscountAmount);
    const newVatAmount = vatAmount > 0 ? vatAmount : (newNetAmount * vatPercent / 100);
    
    // Only update if values have changed to avoid infinite loops
    const currentDiscAmt = form.getValues("discountAmount") || 0;
    const currentVatAmt = form.getValues("vatAmount") || 0;
    
    if (Math.abs(currentDiscAmt - newDiscountAmount) > 0.01) {
      form.setValue("discountAmount", newDiscountAmount);
    }
    if (Math.abs(currentVatAmt - newVatAmount) > 0.01) {
      form.setValue("vatAmount", newVatAmount);
    }
  }, [quantity, unitPrice, discountPercent, vatPercent, discountAmount, vatAmount, editingItem, form]);

  const createItem = useMutation({
    mutationFn: async (data: SupplierQuoteItemFormData) => {
      // Calculate the final values
      const finalGrossAmount = data.quantity * data.unitPrice;
      const finalDiscAmount = data.discountAmount > 0 ? data.discountAmount : (finalGrossAmount * (data.discountPercent || 0) / 100);
      const finalNetAmount = Math.max(0, finalGrossAmount - finalDiscAmount);
      const finalVatAmount = data.vatAmount > 0 ? data.vatAmount : (finalNetAmount * (data.vatPercent || 0) / 100);
      const finalLineTotal = finalNetAmount + finalVatAmount;
      
      const response = await fetch(`/api/supplier-quotes/${supplierQuoteId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemDescription: data.itemDescription,
          quantity: data.quantity,
          unitPrice: data.unitPrice.toString(),
          lineTotal: finalLineTotal.toFixed(2),
          discountPercent: (data.discountPercent || 0).toString(),
          discountAmount: finalDiscAmount.toFixed(2),
          vatPercent: (data.vatPercent || 0).toString(),
          vatAmount: finalVatAmount.toFixed(2),
          warranty: data.warranty || "",
          leadTime: data.leadTime || "",
          notes: data.notes || "",
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to create item" }));
        throw new Error(errorData.message || "Failed to create item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", supplierQuoteId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", supplierQuoteId] });
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      setShowAddItem(false);
      setEditingItem(null);
      form.reset({
        itemDescription: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
        warranty: "",
        leadTime: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SupplierQuoteItemFormData }) => {
      // Calculate the final values
      const finalGrossAmount = data.quantity * data.unitPrice;
      const finalDiscAmount = data.discountAmount > 0 ? data.discountAmount : (finalGrossAmount * (data.discountPercent || 0) / 100);
      const finalNetAmount = Math.max(0, finalGrossAmount - finalDiscAmount);
      const finalVatAmount = data.vatAmount > 0 ? data.vatAmount : (finalNetAmount * (data.vatPercent || 0) / 100);
      const finalLineTotal = finalNetAmount + finalVatAmount;
      
      const response = await fetch(`/api/supplier-quotes/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemDescription: data.itemDescription,
          quantity: data.quantity,
          unitPrice: data.unitPrice.toString(),
          lineTotal: finalLineTotal.toFixed(2),
          discountPercent: (data.discountPercent || 0).toString(),
          discountAmount: finalDiscAmount.toFixed(2),
          vatPercent: (data.vatPercent || 0).toString(),
          vatAmount: finalVatAmount.toFixed(2),
          warranty: data.warranty || "",
          leadTime: data.leadTime || "",
          notes: data.notes || "",
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update item" }));
        throw new Error(errorData.message || "Failed to update item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", supplierQuoteId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", supplierQuoteId] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      setShowAddItem(false);
      setEditingItem(null);
      form.reset({
        itemDescription: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
        warranty: "",
        leadTime: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/supplier-quotes/items/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", supplierQuoteId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-quotes", supplierQuoteId] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SupplierQuoteItemFormData) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data });
    } else {
      createItem.mutate(data);
    }
  };

  const handleEdit = (item: SupplierQuoteItem) => {
    setEditingItem(item);
    form.reset({
      itemDescription: item.itemDescription,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      discountPercent: parseFloat(item.discountPercent || "0"),
      discountAmount: parseFloat(item.discountAmount || "0"),
      vatPercent: parseFloat(item.vatPercent || "0"),
      vatAmount: parseFloat(item.vatAmount || "0"),
      warranty: item.warranty || "",
      leadTime: item.leadTime || "",
      notes: item.notes || "",
    });
    setShowAddItem(true);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setShowAddItem(false);
    form.reset({
      itemDescription: "",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      vatPercent: 0,
      vatAmount: 0,
      warranty: "",
      leadTime: "",
      notes: "",
    });
  };

  // Calculate total amount
  const totalAmount = Array.isArray(items) && items.length > 0 
    ? items.reduce((sum: number, item: SupplierQuoteItem) => 
        sum + parseFloat(item.lineTotal || "0"), 0
      )
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Quote Items
          </CardTitle>
          {editable && (
            <Dialog 
              open={showAddItem} 
              onOpenChange={(open) => {
                setShowAddItem(open);
                if (!open) {
                  // Reset form when dialog closes
                  setEditingItem(null);
                  form.reset({
                    itemDescription: "",
                    quantity: 1,
                    unitPrice: 0,
                    discountPercent: 0,
                    discountAmount: 0,
                    vatPercent: 0,
                    vatAmount: 0,
                    warranty: "",
                    leadTime: "",
                    notes: "",
                  });
                } else if (!editingItem) {
                  // Reset form when dialog opens for new item
                  form.reset({
                    itemDescription: "",
                    quantity: 1,
                    unitPrice: 0,
                    discountPercent: 0,
                    discountAmount: 0,
                    vatPercent: 0,
                    vatAmount: 0,
                    warranty: "",
                    leadTime: "",
                    notes: "",
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setShowAddItem(true);
                    form.reset({
                      quantity: 1,
                      unitPrice: 0,
                      discountPercent: 0,
                      discountAmount: 0,
                      vatPercent: 0,
                      vatAmount: 0,
                      itemDescription: "",
                      warranty: "",
                      leadTime: "",
                      notes: "",
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Item" : "Add New Item"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="itemDescription"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Item Description *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter item description"
                                {...field}
                                data-testid="input-item-description"
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
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={field.value !== undefined ? field.value : ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
                                    field.onChange(1);
                                  } else {
                                    const numValue = parseInt(value, 10);
                                    if (!isNaN(numValue) && numValue >= 1) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                                onBlur={field.onBlur}
                                data-testid="input-quantity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="unitPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={field.value !== undefined ? field.value : ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
                                    field.onChange(0);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue >= 0) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                                onBlur={field.onBlur}
                                data-testid="input-unit-price"
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
                        name="discountPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="0"
                                value={field.value !== undefined ? field.value : ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
                                    field.onChange(0);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                                onBlur={field.onBlur}
                                data-testid="input-discount-percent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="discountAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={field.value !== undefined ? field.value : ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
                                    field.onChange(0);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue >= 0) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                                onBlur={field.onBlur}
                                data-testid="input-discount-amount"
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
                        name="vatPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VAT %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                placeholder="0"
                                value={field.value !== undefined ? field.value : ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
                                    field.onChange(0);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  field.onBlur();
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
                                    field.onChange(rounded);
                                  }
                                }}
                                data-testid="input-vat-percent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vatAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VAT Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0.00"
                                value={field.value !== undefined ? field.value : ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
                                    field.onChange(0);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue >= 0) {
                                      field.onChange(numValue);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  field.onBlur();
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
                                    field.onChange(rounded);
                                  }
                                }}
                                data-testid="input-vat-amount"
                              />
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
                            <Textarea
                              placeholder="Enter additional notes"
                              {...field}
                              data-testid="input-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Calculation Summary */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Calculation Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Gross Amount: {grossAmount.toFixed(2)}</div>
                        <div>Discount: {calculatedDiscountAmount.toFixed(2)}</div>
                        <div>Net Amount: {netAmount.toFixed(2)}</div>
                        <div>VAT: {calculatedVatAmount.toFixed(2)}</div>
                        <div className="col-span-2 font-medium border-t pt-2">
                          Line Total: {lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createItem.isPending || updateItem.isPending}
                      >
                        {createItem.isPending || updateItem.isPending
                          ? "Saving..."
                          : editingItem
                          ? "Update Item"
                          : "Add Item"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No items added yet</p>
            {editable && (
              <p className="text-sm">Click "Add Item" to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Description & Specifications</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Disc %</TableHead>
                  <TableHead>Disc Amt</TableHead>
                  <TableHead>VAT %</TableHead>
                  <TableHead>VAT Amt</TableHead>
                  <TableHead>Total Amount</TableHead>
                  
                  {editable && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: SupplierQuoteItem) => {
                  const gross = item.quantity * parseFloat(item.unitPrice);
                  const discPct = parseFloat(item.discountPercent || "0");
                  const discAmt = parseFloat(item.discountAmount || "0");
                  const calculatedDisc = discAmt > 0 ? discAmt : (gross * discPct / 100);
                  const net = Math.max(0, gross - calculatedDisc);
                  const vatPct = parseFloat(item.vatPercent || "0");
                  const vatAmt = parseFloat(item.vatAmount || "0");
                  const calculatedVat = vatAmt > 0 ? vatAmt : (net * vatPct / 100);
                  const total = net + calculatedVat;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-xs">
                        <div className="font-medium">{item.itemDescription}</div>
                        {item.specification && (
                          <div className="text-xs text-gray-500 mt-1">
                            {item.specification}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unitOfMeasure || 'N/A'}</TableCell>
                      <TableCell>{parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell>{discPct.toFixed(2)}%</TableCell>
                      <TableCell>{calculatedDisc.toFixed(2)}</TableCell>
                      <TableCell>{vatPct.toFixed(2)}%</TableCell>
                      <TableCell>{calculatedVat.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">{total.toFixed(2)}</TableCell>
                      
                      {editable && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteItem.mutate(item.id)}
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Total Summary */}
            <div className="flex justify-end">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-lg font-semibold">
                  Total Amount: {totalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
