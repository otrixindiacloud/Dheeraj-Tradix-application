import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Edit, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const enquiryItemSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  vatPercent: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type EnquiryItemFormData = z.infer<typeof enquiryItemSchema>;

interface EnquiryItemsManagerProps {
  enquiryId: string;
}

export default function EnquiryItemsManager({ enquiryId }: EnquiryItemsManagerProps) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: itemsResponse = [], isLoading } = useQuery({
    queryKey: ["/api/enquiries", enquiryId, "items"],
    queryFn: () => fetch(`/api/enquiries/${enquiryId}/items`).then(res => res.json()),
  });

  // Normalize API response to always be an array
  const items = Array.isArray(itemsResponse)
    ? itemsResponse
    : Array.isArray((itemsResponse as any)?.data)
      ? (itemsResponse as any).data
      : [];

  const { data: availableItems = [] } = useQuery({
    queryKey: ["/api/items"],
  });

  const form = useForm<EnquiryItemFormData>({
    resolver: zodResolver(enquiryItemSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  // Helper to recompute discount amount from %
  const recomputeDiscountAmount = () => {
    const qty = form.getValues("quantity");
    const unit = form.getValues("unitPrice");
    const pct = form.getValues("discountPercent");
    if (unit !== undefined && qty !== undefined && pct !== undefined) {
      const gross = Number(unit) * Number(qty);
      const amt = (gross * Number(pct)) / 100;
      if (!Number.isNaN(amt)) {
        form.setValue("discountAmount", Number(amt.toFixed(2)), { shouldDirty: true, shouldValidate: false });
      }
    }
  };

  // Helper to recompute VAT amount from %
  const recomputeVatAmount = () => {
    const qty = form.getValues("quantity");
    const unit = form.getValues("unitPrice");
    const discountPct = form.getValues("discountPercent");
    const discountAmt = form.getValues("discountAmount");
    const vatPct = form.getValues("vatPercent");
    
    if (unit !== undefined && qty !== undefined && vatPct !== undefined) {
      const gross = Number(unit) * Number(qty);
      
      // Calculate discount amount (use explicit amount if available, otherwise calculate from percentage)
      let appliedDiscount = 0;
      if (discountAmt !== undefined && discountAmt !== null) {
        appliedDiscount = Number(discountAmt);
      } else if (discountPct !== undefined && discountPct !== null) {
        appliedDiscount = (gross * Number(discountPct)) / 100;
      }
      
      // Calculate net amount after discount
      const netAmount = Math.max(gross - appliedDiscount, 0);
      
      // Calculate VAT amount on net amount
      const vatAmt = (netAmount * Number(vatPct)) / 100;
      if (!Number.isNaN(vatAmt)) {
        form.setValue("vatAmount", Number(vatAmt.toFixed(2)), { shouldDirty: true, shouldValidate: false });
      }
    }
  };

  // Auto-calc when the inputs change
  useEffect(() => {
    const subscription = form.watch((_value, { name }) => {
      if (name === "unitPrice" || name === "quantity" || name === "discountPercent") {
        recomputeDiscountAmount();
      }
      if (name === "unitPrice" || name === "quantity" || name === "discountPercent" || name === "discountAmount" || name === "vatPercent") {
        // Only recompute VAT if it's not the vatAmount field that changed
        if (name !== "vatAmount") {
          recomputeVatAmount();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const createItem = useMutation({
    mutationFn: async (data: EnquiryItemFormData) => {
      // Convert numeric fields to strings as expected by backend schema
      const processedData = {
        ...data,
        enquiryId,
        unitPrice: data.unitPrice !== undefined ? String(data.unitPrice) : undefined,
        discountPercent: data.discountPercent !== undefined ? String(data.discountPercent) : undefined,
        discountAmount: data.discountAmount !== undefined ? String(data.discountAmount) : undefined,
        vatPercent: data.vatPercent !== undefined ? String(data.vatPercent) : undefined,
        vatAmount: data.vatAmount !== undefined ? String(data.vatAmount) : undefined,
      };
      const response = await apiRequest("POST", "/api/enquiry-items", processedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "items"] });
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      setShowAddItem(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EnquiryItemFormData> }) => {
      // Convert numeric fields to strings as expected by backend schema
      const processedData = {
        ...data,
        unitPrice: data.unitPrice !== undefined ? String(data.unitPrice) : undefined,
        discountPercent: data.discountPercent !== undefined ? String(data.discountPercent) : undefined,
        discountAmount: data.discountAmount !== undefined ? String(data.discountAmount) : undefined,
        vatPercent: data.vatPercent !== undefined ? String(data.vatPercent) : undefined,
        vatAmount: data.vatAmount !== undefined ? String(data.vatAmount) : undefined,
      };
      const response = await apiRequest("PUT", `/api/enquiry-items/${id}`, processedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "items"] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      setEditingItem(null);
      setShowAddItem(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/enquiry-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries", enquiryId, "items"] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EnquiryItemFormData) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data });
    } else {
      createItem.mutate(data);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    form.reset({
      itemId: item.itemId || "",
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== ''
        ? parseFloat(item.unitPrice) : undefined,
      discountPercent: item.discountPercent !== undefined && item.discountPercent !== null && item.discountPercent !== ''
        ? parseFloat(item.discountPercent) : undefined,
      discountAmount: item.discountAmount !== undefined && item.discountAmount !== null && item.discountAmount !== ''
        ? parseFloat(item.discountAmount) : undefined,
      vatPercent: item.vatPercent !== undefined && item.vatPercent !== null && item.vatPercent !== ''
        ? parseFloat(item.vatPercent) : undefined,
      vatAmount: item.vatAmount !== undefined && item.vatAmount !== null && item.vatAmount !== ''
        ? parseFloat(item.vatAmount) : undefined,
      notes: item.notes || "",
    });
    setShowAddItem(true);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setShowAddItem(false);
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Enquiry Items
          </CardTitle>
          <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                onClick={() => setShowAddItem(true)}
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Item" : "Add New Item"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Item description..."
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
                          <FormLabel>Cost Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                                // Recompute when unit price changes
                                setTimeout(recomputeDiscountAmount, 0);
                              }}
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
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                                // When % changes, auto-fill amount
                                setTimeout(recomputeDiscountAmount, 0);
                              }}
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
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                              }}
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
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                                // When VAT % changes, auto-calculate VAT amount
                                setTimeout(recomputeVatAmount, 0);
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
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
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
                            placeholder="Additional notes..."
                            {...field}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createItem.isPending || updateItem.isPending}
                      data-testid="button-save-item"
                    >
                      {editingItem ? "Update" : "Add"} Item
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading items...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No items added yet. Click "Add Item" to get started.
          </div>
        ) : (
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-24">Cost Price</TableHead>
                <TableHead className="w-24">Disc %</TableHead>
                <TableHead className="w-24">Disc Amt</TableHead>
                <TableHead className="w-24">VAT %</TableHead>
                <TableHead className="w-24">VAT Amt</TableHead>
                <TableHead className="w-24">Total</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.description}</p>
                      {item.notes && (
                        <p className="text-sm text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-quantity-${item.id}`}>
                    {item.quantity}
                  </TableCell>
                  <TableCell data-testid={`text-unit-price-${item.id}`}>
                    {item.unitPrice !== undefined && item.unitPrice !== null && !Number.isNaN(parseFloat(item.unitPrice))
                      ? `BHD ${parseFloat(item.unitPrice).toFixed(2)}`
                      : `BHD 0.00`}
                  </TableCell>
                      <TableCell data-testid={`text-discount-percent-${item.id}`}>
                        {(() => {
                          const hasPct = item.discountPercent !== undefined && item.discountPercent !== null && !Number.isNaN(parseFloat(item.discountPercent));
                          if (hasPct) return `${parseFloat(item.discountPercent).toFixed(2)}%`;
                          // Derive percent from amount when percent is missing
                          const unit = item.unitPrice !== undefined && item.unitPrice !== null ? parseFloat(item.unitPrice) : NaN;
                          const qty = item.quantity || 0;
                          const gross = !Number.isNaN(unit) ? unit * qty : NaN;
                          const amt = item.discountAmount !== undefined && item.discountAmount !== null ? parseFloat(item.discountAmount) : NaN;
                          const derived = !Number.isNaN(gross) && gross > 0 && !Number.isNaN(amt) ? (amt / gross) * 100 : 0;
                          return `${derived.toFixed(2)}%`;
                        })()}
                      </TableCell>
                      <TableCell data-testid={`text-discount-amount-${item.id}`}>
                        {item.discountAmount !== undefined && item.discountAmount !== null && !Number.isNaN(parseFloat(item.discountAmount))
                          ? `BHD ${parseFloat(item.discountAmount).toFixed(2)}`
                          : `BHD 0.00`}
                      </TableCell>
                      <TableCell data-testid={`text-vat-percent-${item.id}`}>
                        {(() => {
                          const hasVatPct = item.vatPercent !== undefined && item.vatPercent !== null && !Number.isNaN(parseFloat(item.vatPercent));
                          if (hasVatPct) return `${parseFloat(item.vatPercent).toFixed(2)}%`;
                          // Derive percent from amount when percent is missing
                          const unit = item.unitPrice !== undefined && item.unitPrice !== null ? parseFloat(item.unitPrice) : NaN;
                          const qty = item.quantity || 0;
                          const gross = !Number.isNaN(unit) ? unit * qty : NaN;
                          const discAmt = item.discountAmount !== undefined && item.discountAmount !== null ? parseFloat(item.discountAmount) : 0;
                          const discPct = item.discountPercent !== undefined && item.discountPercent !== null ? parseFloat(item.discountPercent) : 0;
                          const appliedDiscount = discAmt > 0 ? discAmt : (discPct > 0 ? (gross * discPct) / 100 : 0);
                          const netAmount = Math.max(gross - appliedDiscount, 0);
                          const vatAmt = item.vatAmount !== undefined && item.vatAmount !== null ? parseFloat(item.vatAmount) : NaN;
                          const derived = !Number.isNaN(netAmount) && netAmount > 0 && !Number.isNaN(vatAmt) ? (vatAmt / netAmount) * 100 : 0;
                          return `${derived.toFixed(2)}%`;
                        })()}
                      </TableCell>
                      <TableCell data-testid={`text-vat-amount-${item.id}`}>
                        {item.vatAmount !== undefined && item.vatAmount !== null && !Number.isNaN(parseFloat(item.vatAmount))
                          ? `BHD ${parseFloat(item.vatAmount).toFixed(2)}`
                          : `BHD 0.00`}
                      </TableCell>
                  <TableCell data-testid={`text-total-${item.id}`}>
                    {item.unitPrice 
                      ? (() => {
                          const unit = parseFloat(item.unitPrice);
                          const qty = item.quantity || 0;
                          const gross = unit * qty;
                          
                          // Calculate discount
                          const hasExplicitDiscAmt = item.discountAmount !== undefined && item.discountAmount !== null && !Number.isNaN(parseFloat(item.discountAmount));
                          const discAmt = hasExplicitDiscAmt ? parseFloat(item.discountAmount) : 0;
                          const discPct = item.discountPercent ? parseFloat(item.discountPercent) : 0;
                          const pctAmt = !hasExplicitDiscAmt && discPct > 0 ? (gross * discPct) / 100 : 0;
                          const appliedDiscount = hasExplicitDiscAmt ? discAmt : pctAmt;
                          
                          // Calculate net amount after discount
                          const netAmount = Math.max(gross - appliedDiscount, 0);
                          
                          // Calculate VAT
                          const hasExplicitVatAmt = item.vatAmount !== undefined && item.vatAmount !== null && !Number.isNaN(parseFloat(item.vatAmount));
                          const vatAmt = hasExplicitVatAmt ? parseFloat(item.vatAmount) : 0;
                          const vatPct = item.vatPercent ? parseFloat(item.vatPercent) : 0;
                          const pctVatAmt = !hasExplicitVatAmt && vatPct > 0 ? (netAmount * vatPct) / 100 : 0;
                          const appliedVat = hasExplicitVatAmt ? vatAmt : pctVatAmt;
                          
                          // Calculate final total (net amount + VAT)
                          const total = netAmount + appliedVat;
                          return `BHD ${total.toFixed(2)}`;
                        })()
                      : "-"
                    }
                  </TableCell>
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
                        disabled={deleteItem.isPending}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}