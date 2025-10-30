import { useState } from "react";
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

const quotationItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  costPrice: z.number().min(0, "Cost price must be positive"),
  markup: z.number().min(0, "Markup must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  // Optional discount fields (one or both can be provided)
  discountPercentage: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  // Optional VAT fields
  vatPercent: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type QuotationItemFormData = z.infer<typeof quotationItemSchema>;

interface QuotationItemsManagerProps {
  quotationId: string;
  customerType: "Retail" | "Wholesale";
  editable?: boolean;
}

interface QuotationItem {
  id: string;
  quotationId: string;
  description: string;
  quantity: number;
  costPrice: string;
  markup: string;
  unitPrice: string;
  lineTotal: string;
  // Optional financial fields
  discountPercentage?: string | number;
  discountAmount?: string | number;
  vatPercent?: string | number;
  vatAmount?: string | number;
  notes?: string;
  isAccepted: boolean;
  rejectionReason?: string;
}

export default function QuotationItemsManager({ 
  quotationId, 
  customerType, 
  editable = true 
}: QuotationItemsManagerProps) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<QuotationItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Role-based permission: client user (id: 'client') is view-only
  const authUser = (window as any).authUser || null;
  const isClientViewOnly = authUser?.id === "client";

  const { data: itemsResponse, isLoading } = useQuery({
    queryKey: ["/api/quotations", quotationId, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/quotations/${quotationId}/items`);
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
  });

  // Ensure items is always an array
  const items = Array.isArray(itemsResponse) ? itemsResponse : [];

  const form = useForm<QuotationItemFormData>({
    resolver: zodResolver(quotationItemSchema),
    defaultValues: {
      quantity: 1,
      costPrice: 0,
      markup: customerType === "Retail" ? 70 : 40,
      unitPrice: 0,
    },
  });

  // Watch cost price and markup to calculate unit price
  const costPrice = form.watch("costPrice") || 0;
  const markup = form.watch("markup") || 0;
  const quantity = form.watch("quantity") || 1;
  const unitPriceInput = form.watch("unitPrice");
  const discountPct = form.watch("discountPercentage") || 0;
  const discountAmt = form.watch("discountAmount") || 0;
  const vatPct = form.watch("vatPercent") || 0;
  const vatAmt = form.watch("vatAmount") || 0;
  
  // Calculate unit price based on cost and markup
  const calculatedUnitPrice = costPrice * (1 + markup / 100);
  const effectiveUnitPrice = typeof unitPriceInput === 'number' && unitPriceInput > 0 ? unitPriceInput : calculatedUnitPrice;
  const previewSubtotal = effectiveUnitPrice * quantity;
  const previewDiscount = discountPct > 0
    ? (previewSubtotal * Math.max(0, Math.min(100, discountPct)) / 100)
    : Math.min(previewSubtotal, Math.max(0, discountAmt || 0));
  const previewAfterDiscount = Math.max(0, previewSubtotal - previewDiscount);
  const previewVat = vatPct > 0
    ? (previewAfterDiscount * Math.max(0, vatPct) / 100)
    : Math.max(0, vatAmt || 0);
  const lineTotal = previewAfterDiscount + previewVat;

  // Helpers for rounding to avoid HTML step validation errors
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  // Update unit price when cost or markup changes
  const handleCostOrMarkupChange = () => {
    form.setValue("unitPrice", round2(calculatedUnitPrice));
  };

  const createItem = useMutation({
    mutationFn: async (data: QuotationItemFormData) => {
  if (isClientViewOnly) throw new Error("Client user cannot perform any changes");
      const response = await fetch(`/api/quotations/${quotationId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          lineTotal: (function () {
            const subtotal = (data.unitPrice * data.quantity);
            const dPct = typeof (data as any).discountPercentage === 'number' ? Math.min(Math.max((data as any).discountPercentage, 0), 100) : 0;
            const dAmt = typeof (data as any).discountAmount === 'number' ? Math.max((data as any).discountAmount, 0) : 0;
            const appliedDiscount = dPct > 0 ? (subtotal * dPct / 100) : Math.min(subtotal, dAmt);
            const afterDiscount = Math.max(0, subtotal - appliedDiscount);
            const vPct = typeof (data as any).vatPercent === 'number' ? Math.max((data as any).vatPercent, 0) : 0;
            const vAmt = typeof (data as any).vatAmount === 'number' ? Math.max((data as any).vatAmount, 0) : 0;
            const appliedVat = vPct > 0 ? (afterDiscount * vPct / 100) : vAmt;
            return (afterDiscount + appliedVat).toFixed(2);
          })(),
        }),
      });
      if (!response.ok) throw new Error("Failed to create item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotationId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotationId] });
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      setShowAddItem(false);
      form.reset({
        quantity: 1,
        costPrice: 0,
        markup: customerType === "Retail" ? 70 : 40,
        unitPrice: 0,
        discountPercentage: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
      });
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuotationItemFormData> }) => {
  if (isClientViewOnly) throw new Error("Client user cannot perform any changes");
      const response = await fetch(`/api/quotation-items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          lineTotal: (function () {
            if (typeof data.unitPrice === 'number' && typeof data.quantity === 'number') {
              const subtotal = data.unitPrice * data.quantity;
              const dPct = typeof (data as any).discountPercentage === 'number' ? Math.min(Math.max((data as any).discountPercentage, 0), 100) : 0;
              const dAmt = typeof (data as any).discountAmount === 'number' ? Math.max((data as any).discountAmount, 0) : 0;
              const appliedDiscount = dPct > 0 ? (subtotal * dPct / 100) : Math.min(subtotal, dAmt);
              const afterDiscount = Math.max(0, subtotal - appliedDiscount);
              const vPct = typeof (data as any).vatPercent === 'number' ? Math.max((data as any).vatPercent, 0) : 0;
              const vAmt = typeof (data as any).vatAmount === 'number' ? Math.max((data as any).vatAmount, 0) : 0;
              const appliedVat = vPct > 0 ? (afterDiscount * vPct / 100) : vAmt;
              return (afterDiscount + appliedVat).toFixed(2);
            }
            return undefined;
          })(),
        }),
      });
      if (!response.ok) throw new Error("Failed to update item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotationId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotationId] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      setEditingItem(null);
      form.reset({
        quantity: 1,
        costPrice: 0,
        markup: customerType === "Retail" ? 70 : 40,
        unitPrice: 0,
        discountPercentage: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
      });
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
      if (isClientViewOnly) throw new Error("You do not have permission to delete this");
      const response = await fetch(`/api/quotation-items/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotationId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", quotationId] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message === "You do not have permission to delete this"
          ? "You do not have permission to delete this"
          : "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuotationItemFormData) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data });
    } else {
      createItem.mutate(data);
    }
  };

  const handleEdit = (item: QuotationItem) => {
    setEditingItem(item);
    form.reset({
      description: item.description,
      quantity: item.quantity,
      costPrice: parseFloat(item.costPrice),
      markup: parseFloat(item.markup),
      unitPrice: parseFloat(item.unitPrice),
      discountPercentage: item.discountPercentage != null ? Number(item.discountPercentage) : 0,
      discountAmount: item.discountAmount != null ? Number(item.discountAmount) : 0,
      vatPercent: item.vatPercent != null ? Number(item.vatPercent) : 0,
      vatAmount: item.vatAmount != null ? Number(item.vatAmount) : 0,
      notes: item.notes || "",
    });
    setShowAddItem(true);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setShowAddItem(false);
    form.reset({
      quantity: 1,
      costPrice: 0,
      markup: customerType === "Retail" ? 70 : 40,
      unitPrice: 0,
    });
  };

  // Calculate total amount with safety check - use computed values, not stored lineTotal
  // Formula: Unit Price = Cost Price * (1 + Markup %), Subtotal = Unit Price × Qty,
  // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount,
  // After Discount = Subtotal - Discount Amount,
  // VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount,
  // Line Total = After Discount + VAT Amount
  const totalAmount = Array.isArray(items) && items.length > 0 
    ? items.reduce((sum: number, item: QuotationItem) => {
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.costPrice) || 0;
        const markupPct = Number(item.markup) || 0;
        // Unit Price = Cost Price * (1 + Markup % / 100)
        const computedUnitFromMarkup = cost > 0 ? cost * (1 + Math.max(0, markupPct) / 100) : 0;
        const unit = computedUnitFromMarkup > 0 ? computedUnitFromMarkup : (Number(item.unitPrice) || 0);
        // Subtotal = Unit Price × Quantity
        const subtotal = qty * unit;
        const dPctRaw = item.discountPercentage != null ? Number(item.discountPercentage) : 0;
        const dPct = Math.max(0, Math.min(100, dPctRaw));
        const dAmtRaw = item.discountAmount != null ? Number(item.discountAmount) : 0;
        // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount if no percentage
        let dApplied = 0;
        if (dPct > 0) {
          // Prioritize discount percentage calculation
          dApplied = (subtotal * dPct) / 100;
        } else if (dAmtRaw !== 0) {
          // Use explicit discount amount only if no percentage is provided
          dApplied = Math.min(subtotal, Math.abs(dAmtRaw));
        }
        // After Discount = Subtotal - Discount Amount
        const afterDiscount = Math.max(0, subtotal - dApplied);
        const vPct = Math.max(0, item.vatPercent != null ? Number(item.vatPercent) : 0);
        const vAmtAbs = Math.abs(item.vatAmount != null ? Number(item.vatAmount) : 0);
        // VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount if no percentage
        let vApplied = 0;
        if (vPct > 0) {
          // Prioritize VAT percentage calculation
          vApplied = (afterDiscount * vPct) / 100;
        } else if (vAmtAbs > 0) {
          // Use explicit VAT amount only if no percentage is provided
          vApplied = vAmtAbs;
        }
        // Line Total = After Discount + VAT Amount
        const itemLineTotal = afterDiscount + vApplied;
        return sum + itemLineTotal;
      }, 0)
    : 0;

  return (
    <Card className="shadow-none border border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Quotation Items
          </CardTitle>
          {editable && !isClientViewOnly && (
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
              <DialogContent className="max-w-5xl w-[900px] max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Item" : "Add New Item"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description *</FormLabel>
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
                            <FormLabel>Quantity *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseInt(e.target.value) || 1);
                                }}
                                data-testid="input-quantity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="costPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost Price *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  handleCostOrMarkupChange();
                                }}
                                data-testid="input-cost-price"
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
                        name="markup"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Markup % *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    handleCostOrMarkupChange();
                                  }}
                                  data-testid="input-markup"
                                />
                                <span className="absolute right-3 top-3 text-gray-500">%</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                            <div className="text-xs text-gray-600">
                              Default: {customerType} markup ({customerType === "Retail" ? "70" : "40"}%)
                            </div>
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
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-unit-price"
                              />
                            </FormControl>
                            <FormMessage />
                            <div className="text-xs text-gray-600">
                              Calculated: ${calculatedUnitPrice.toFixed(2)}
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Pricing Calculation</span>
                      </div>
                      <div className="text-sm text-blue-700 space-y-1">
                        <div>Cost Price: ${costPrice.toFixed(2)}</div>
                        <div>Markup: {markup}% = ${(costPrice * markup / 100).toFixed(2)}</div>
                        <div className="font-medium border-t border-blue-200 pt-1">
                          Unit Price: ${calculatedUnitPrice.toFixed(2)}
                        </div>
                        <div>Subtotal ({quantity} × ${calculatedUnitPrice.toFixed(2)}): ${previewSubtotal.toFixed(2)}</div>
                        <div>Discount: {discountPct ? `${discountPct}%` : ''} {discountAmt ? `(+ ${discountAmt})` : ''} = -${previewDiscount.toFixed(2)}</div>
                        <div>After Discount: ${previewAfterDiscount.toFixed(2)}</div>
                        <div>VAT: {vatPct ? `${vatPct}%` : ''} {vatAmt ? `(override ${vatAmt})` : ''} = +${previewVat.toFixed(2)}</div>
                        <div className="font-medium">
                          Line Total: ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="discountPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  // Auto-calc discount amount from percentage
                                  const subtotal = (form.getValues("unitPrice") || calculatedUnitPrice) * (form.getValues("quantity") || 1);
                                  const computedDiscount = Math.max(0, Math.min(100, value)) * subtotal / 100;
                                  form.setValue("discountAmount", Number.isFinite(computedDiscount) ? round2(computedDiscount) : 0);
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
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  // Keep percent in sync if possible
                                  const subtotal = (form.getValues("unitPrice") || calculatedUnitPrice) * (form.getValues("quantity") || 1);
                                  const pct = subtotal > 0 ? (Math.max(0, value) / subtotal) * 100 : 0;
                                  form.setValue("discountPercentage", Number.isFinite(pct) ? round2(pct) : 0);
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
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  // Auto-calc VAT amount from percentage based on after-discount
                                  const subtotal = (form.getValues("unitPrice") || calculatedUnitPrice) * (form.getValues("quantity") || 1);
                                  const dPct = form.getValues("discountPercentage") || 0;
                                  const dAmt = form.getValues("discountAmount") || 0;
                                  const appliedDiscount = dPct > 0 ? (subtotal * Math.max(0, Math.min(100, dPct)) / 100) : Math.min(subtotal, Math.max(0, dAmt));
                                  const afterDiscount = Math.max(0, subtotal - appliedDiscount);
                                  const computedVat = afterDiscount * Math.max(0, value) / 100;
                                  form.setValue("vatAmount", Number.isFinite(computedVat) ? round2(computedVat) : 0);
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
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                  // Keep VAT percent in sync when amount edited
                                  const subtotal = (form.getValues("unitPrice") || calculatedUnitPrice) * (form.getValues("quantity") || 1);
                                  const dPct = form.getValues("discountPercentage") || 0;
                                  const dAmt = form.getValues("discountAmount") || 0;
                                  const appliedDiscount = dPct > 0 ? (subtotal * Math.max(0, Math.min(100, dPct)) / 100) : Math.min(subtotal, Math.max(0, dAmt));
                                  const afterDiscount = Math.max(0, subtotal - appliedDiscount);
                                  const pct = afterDiscount > 0 ? (Math.max(0, value) / afterDiscount) * 100 : 0;
                                  form.setValue("vatPercent", Number.isFinite(pct) ? round2(pct) : 0);
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
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading items...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {editable ? (
              <>
                No items added yet. Click "Add Item" to get started.
                <div className="mt-4">
                  <Button 
                    onClick={() => setShowAddItem(true)}
                    variant="outline"
                    data-testid="button-add-first-item"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Item
                  </Button>
                </div>
              </>
            ) : (
              "No items found for this quotation."
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto ml-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                    <TableHead className="w-20 text-center">Qty</TableHead>
                    <TableHead className="w-28 text-right">Cost Price</TableHead>
                    <TableHead className="w-24 text-center">Markup %</TableHead>
                    <TableHead className="w-28 text-right">Unit Price</TableHead>
                    <TableHead className="w-28 text-center">Discount %</TableHead>
                    <TableHead className="w-32 text-right">Discount Amount</TableHead>
                    <TableHead className="w-24 text-center">VAT %</TableHead>
                    <TableHead className="w-28 text-right">VAT Amount</TableHead>
                    <TableHead className="w-28 text-right">Line Total</TableHead>
                    <TableHead className="w-24 text-center">Status</TableHead>
                    {editable && <TableHead className="w-24 text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: QuotationItem) => {
                    const qty = Number(item.quantity) || 0;
                    const cost = Number(item.costPrice) || 0;
                    const markupPct = Number(item.markup) || 0;
                    // Unit Price = Cost Price * (1 + Markup % / 100)
                    const computedUnitFromMarkup = cost > 0 ? cost * (1 + Math.max(0, markupPct) / 100) : 0;
                    const unit = computedUnitFromMarkup > 0 ? computedUnitFromMarkup : (Number(item.unitPrice) || 0);
                    // Subtotal = Unit Price × Quantity
                    const subtotal = qty * unit;
                    // Normalize discount inputs
                    const discountPctRaw = item.discountPercentage != null ? Number(item.discountPercentage) : 0;
                    const discountPct = Math.max(0, Math.min(100, discountPctRaw));
                    const discountAmtRaw = item.discountAmount != null ? Number(item.discountAmount) : 0;
                    // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount if no percentage
                    let appliedDiscount = 0;
                    if (discountPct > 0) {
                      // Prioritize discount percentage calculation: Discount Amount = Subtotal * (Discount % / 100)
                      appliedDiscount = (subtotal * discountPct) / 100;
                    } else if (discountAmtRaw !== 0) {
                      // Use explicit discount amount only if no percentage is provided
                      appliedDiscount = Math.min(subtotal, Math.abs(discountAmtRaw));
                    }
                    // After Discount = Subtotal - Discount Amount
                    const afterDiscount = Math.max(0, subtotal - appliedDiscount);
                    // VAT Amount - calculate from After Discount * (VAT % / 100) or use explicit VAT amount if no percentage
                    const vatPctRaw = item.vatPercent != null ? Number(item.vatPercent) : 0;
                    const vatPct = Math.max(0, vatPctRaw);
                    const vatAmtRaw = item.vatAmount != null ? Number(item.vatAmount) : 0;
                    const vatAmtAbs = Math.abs(vatAmtRaw);
                    // VAT is calculated on After Discount amount (net amount after discount)
                    let appliedVat = 0;
                    if (vatPct > 0) {
                      // Prioritize VAT percentage calculation: VAT Amount = After Discount * (VAT % / 100)
                      appliedVat = (afterDiscount * vatPct) / 100;
                    } else if (vatAmtAbs > 0) {
                      // Use explicit VAT amount only if no percentage is provided
                      appliedVat = vatAmtAbs;
                    }
                    // Line Total = After Discount + VAT Amount
                    const computedLineTotal = Math.round((afterDiscount + appliedVat) * 100) / 100;
                    return (
                      <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                        <TableCell className="max-w-[200px]">
                          <div className="space-y-1">
                            <p className="font-medium text-sm leading-tight">{item.description}</p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground leading-tight">{item.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-quantity-${item.id}`}>
                          <span className="font-mono text-sm">{qty}</span>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-cost-${item.id}`}>
                          <span className="font-mono text-sm">BHD {Number(item.costPrice).toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-markup-${item.id}`}>
                          <span className="font-mono text-sm">{Number(item.markup).toFixed(1)}%</span>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-unit-price-${item.id}`}>
                          <span className="font-mono text-sm font-medium">BHD {unit.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-discount-percent-${item.id}`}>
                          <span className="font-mono text-sm">{discountPct.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-discount-amount-${item.id}`}>
                          <span className="font-mono text-sm text-red-600">- BHD {appliedDiscount.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-vat-percent-${item.id}`}>
                          <span className="font-mono text-sm">{vatPct.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-vat-amount-${item.id}`}>
                          <span className="font-mono text-sm">BHD {appliedVat.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-line-total-${item.id}`}>
                          <span className="font-mono text-sm font-bold">BHD {computedLineTotal.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={item.isAccepted ? "default" : "destructive"}
                            className="text-xs px-2 py-1"
                          >
                            {item.isAccepted ? "Accepted" : "Rejected"}
                          </Badge>
                        </TableCell>
                        {editable && (
                          <TableCell className="text-center">
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                data-testid={`button-edit-${item.id}`}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteItem.mutate(item.id)}
                                disabled={deleteItem.isPending}
                                data-testid={`button-delete-${item.id}`}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
            </div>
            
            {items.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Amount:</span>
                  <span className="text-xl font-bold text-green-600">
                    BHD {totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
