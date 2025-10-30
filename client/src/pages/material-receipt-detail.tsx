import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Package,
  Building2,
  User,
  Receipt,
  Printer,
  Download,
  Edit,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MaterialReceiptItem {
  id: string;
  serialNo?: number;
  itemCode?: string;
  supplierCode?: string;
  barcode?: string;
  itemDescription: string;
  quantity: string;
  unitCost: string;
  discountPercent: string;
  discountAmount: string;
  netTotal: string;
  vatPercent: string;
  vatAmount: string;
  totalPrice: string;
  itemName?: string;
  description?: string;
  unitPrice?: string;
  receivedQuantity?: string;
}

interface MaterialReceipt {
  id: string;
  receiptNumber: string;
  goodsReceiptId?: string;
  supplierLpoId?: string;
  supplierId?: string;
  receiptDate: string;
  receivedBy: string;
  status: string;
  notes?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  supplierName?: string;
  paymentTerms?: string;
  dueDate?: string;
  supplierAddress?: string;
  supplierContactPerson?: string;
  createdAt: string;
  updatedAt: string;
  items?: MaterialReceiptItem[];
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatCurrency(value?: string | number) {
  if (value === undefined || value === null) return "BHD 0.000";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `BHD ${num.toFixed(3)}`;
}

const headerFormSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  receiptDate: z.string().optional(),
  receivedBy: z.string().optional(),
  status: z.enum(["Pending", "Partial", "Completed", "Discrepancy"]),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  supplierName: z.string().optional(),
  paymentTerms: z.string().optional(),
  dueDate: z.string().optional(),
  supplierAddress: z.string().optional(),
  supplierContactPerson: z.string().optional(),
  notes: z.string().optional(),
});

const itemFormSchema = z.object({
  id: z.string().optional(),
  serialNo: z.coerce.number().optional(),
  itemCode: z.string().optional(),
  supplierCode: z.string().optional(),
  barcode: z.string().optional(),
  itemDescription: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(0, "Quantity must be zero or greater"),
  unitCost: z.coerce.number().min(0, "Unit cost must be zero or greater"),
  discountPercent: z.coerce.number().min(0, "Discount percent must be zero or greater"),
  discountAmount: z.coerce.number().min(0, "Discount amount must be zero or greater"),
  netTotal: z.coerce.number().min(0, "Net total must be zero or greater"),
  vatPercent: z.coerce.number().min(0, "VAT percent must be zero or greater"),
  vatAmount: z.coerce.number().min(0, "VAT amount must be zero or greater"),
  totalPrice: z.coerce.number().min(0, "Total must be zero or greater"),
  itemName: z.string().optional(),
  description: z.string().optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  receivedQuantity: z.coerce.number().min(0).optional(),
});

const itemsFormSchema = z.object({
  items: z.array(itemFormSchema).min(1, "At least one item is required"),
});

type HeaderFormValues = z.infer<typeof headerFormSchema>;
type ItemsFormValues = z.infer<typeof itemsFormSchema>;

const toNullableString = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const toNullableDate = (value?: string | null) => {
  if (!value || value.trim() === "") return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const toNumber = (value?: string | number | null) => {
  if (value === undefined || value === null) return 0;
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const toDecimalString = (value?: number | string | null) => {
  if (value === undefined || value === null) return "0";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? "0" : trimmed;
  }
  return Number.isFinite(value) ? value.toString() : "0";
};

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const getHeaderFormValues = (receipt: MaterialReceipt): HeaderFormValues => {
  const allowedStatuses: HeaderFormValues["status"][] = ["Pending", "Partial", "Completed", "Discrepancy"];
  const status = allowedStatuses.includes(receipt.status as HeaderFormValues["status"])
    ? (receipt.status as HeaderFormValues["status"])
    : "Pending";

  return {
    receiptNumber: receipt.receiptNumber || "",
    receiptDate: toDateInputValue(receipt.receiptDate),
    receivedBy: receipt.receivedBy || "",
    status,
    invoiceNumber: receipt.invoiceNumber || "",
    invoiceDate: toDateInputValue(receipt.invoiceDate),
    supplierName: receipt.supplierName || "",
    paymentTerms: receipt.paymentTerms || "",
    dueDate: toDateInputValue(receipt.dueDate),
    supplierAddress: receipt.supplierAddress || "",
    supplierContactPerson: receipt.supplierContactPerson || "",
    notes: receipt.notes || "",
  };
};

const getItemsFormValues = (items: MaterialReceiptItem[]): ItemsFormValues => {
  if (!items || items.length === 0) {
    return { items: [] };
  }

  return {
    items: items.map((item, index) => ({
      id: item.id,
      serialNo: item.serialNo ?? index + 1,
      itemCode: item.itemCode || "",
      supplierCode: item.supplierCode || "",
      barcode: item.barcode || "",
      itemDescription: item.itemDescription || "",
      quantity: toNumber(item.quantity),
      unitCost: toNumber(item.unitCost),
      discountPercent: toNumber(item.discountPercent),
      discountAmount: toNumber(item.discountAmount),
      netTotal: toNumber(item.netTotal),
      vatPercent: toNumber(item.vatPercent),
      vatAmount: toNumber(item.vatAmount),
      totalPrice: toNumber(item.totalPrice),
      itemName: item.itemName || "",
      description: item.description || "",
      unitPrice: toNumber(item.unitPrice),
      receivedQuantity: toNumber(item.receivedQuantity),
    })),
  };
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { color: string; label: string }> = {
    Pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Pending" },
    Partial: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Partial" },
    Completed: { color: "bg-green-100 text-green-800 border-green-200", label: "Completed" },
    Discrepancy: { color: "bg-red-100 text-red-800 border-red-200", label: "Discrepancy" },
  };

  const config = statusConfig[status] || statusConfig.Pending;
  return (
    <Badge variant="outline" className={`${config.color} border`}>
      {config.label}
    </Badge>
  );
};

export default function MaterialReceiptDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isHeaderDialogOpen, setHeaderDialogOpen] = useState(false);
  const [isItemsDialogOpen, setItemsDialogOpen] = useState(false);

  const headerForm = useForm<HeaderFormValues>({
    resolver: zodResolver(headerFormSchema),
    defaultValues: {
      receiptNumber: "",
      receiptDate: "",
      receivedBy: "",
      status: "Pending",
      invoiceNumber: "",
      invoiceDate: "",
      supplierName: "",
      paymentTerms: "",
      dueDate: "",
      supplierAddress: "",
      supplierContactPerson: "",
      notes: "",
    },
  });

  const itemsForm = useForm<ItemsFormValues>({
    resolver: zodResolver(itemsFormSchema),
    defaultValues: {
      items: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: itemsForm.control,
    name: "items",
  });

  // Fetch customers list for the "Received By" dropdown
  const { data: customersData = { customers: [] } } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?isActive=true&limit=1000");
      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const customers = customersData.customers || [];

  const updateReceiptMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!id) {
        throw new Error("Material receipt id is missing");
      }
      const response = await apiRequest("PUT", `/api/material-receipts/${id}`, payload);
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to update material receipt");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-receipt", id] });
      toast({
        title: "Success",
        description: "Material receipt updated successfully",
      });
    },
    onError: (err: any) => {
      const message = err instanceof Error ? err.message : "Failed to update material receipt";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Fetch material receipt data
  const { data: receiptResponse, isLoading, error } = useQuery({
    queryKey: ["material-receipt", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/material-receipts/${id}`);
      return response.json();
    },
    enabled: !!id,
  });

  const receipt: MaterialReceipt | undefined = receiptResponse?.success ? receiptResponse.data : undefined;
  const items: MaterialReceiptItem[] = receipt?.items ?? [];

  useEffect(() => {
    if (!receipt) {
      return;
    }

    const headerDefaults = getHeaderFormValues(receipt);
    headerForm.reset(headerDefaults);

    // Ensure items array exists
    const receiptItems = receipt.items && Array.isArray(receipt.items) ? receipt.items : [];
    const itemsDefaults = getItemsFormValues(receiptItems);
    itemsForm.reset(itemsDefaults);
    replace(itemsDefaults.items);
  }, [receipt, headerForm, itemsForm, replace]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading material receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receiptResponse?.success) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Material Receipt Not Found</h3>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "The material receipt you're looking for doesn't exist."}
          </p>
          <Link href="/receipts">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Receipts
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return null;
  }

  const totalAmount = items.reduce((sum, item) => {
    const price = item.totalPrice ? parseFloat(item.totalPrice) : 0;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const totalVAT = items.reduce((sum, item) => {
    const vat = item.vatAmount ? parseFloat(item.vatAmount) : 0;
    return sum + (isNaN(vat) ? 0 : vat);
  }, 0);

  const totalDiscount = items.reduce((sum, item) => {
    const discount = item.discountAmount ? parseFloat(item.discountAmount) : 0;
    return sum + (isNaN(discount) ? 0 : discount);
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleOpenHeaderDialog = () => {
    headerForm.reset(getHeaderFormValues(receipt));
    setHeaderDialogOpen(true);
  };

  const handleOpenItemsDialog = () => {
    const defaults = getItemsFormValues(items);
    itemsForm.reset(defaults);
    replace(defaults.items);
    setItemsDialogOpen(true);
  };

  const buildHeaderUpdatePayload = (values: HeaderFormValues) => {
    const payload: Record<string, any> = {
      receiptNumber: values.receiptNumber.trim(),
      status: values.status,
    };

    payload.receivedBy = toNullableString(values.receivedBy);
    payload.invoiceNumber = toNullableString(values.invoiceNumber);
    payload.supplierName = toNullableString(values.supplierName);
    payload.paymentTerms = toNullableString(values.paymentTerms);
    payload.supplierAddress = toNullableString(values.supplierAddress);
    payload.supplierContactPerson = toNullableString(values.supplierContactPerson);
    payload.notes = toNullableString(values.notes);

    payload.receiptDate = values.receiptDate ? toNullableDate(values.receiptDate) : null;
    payload.invoiceDate = values.invoiceDate ? toNullableDate(values.invoiceDate) : null;
    payload.dueDate = values.dueDate ? toNullableDate(values.dueDate) : null;

    return payload;
  };

  const buildItemsUpdatePayload = (values: ItemsFormValues) => {
    return {
      items: values.items.map((item, index) => ({
        id: item.id,
        serialNo: item.serialNo ?? index + 1,
        itemCode: toNullableString(item.itemCode) ?? "",
        supplierCode: toNullableString(item.supplierCode) ?? "",
        barcode: toNullableString(item.barcode) ?? "",
        itemDescription: item.itemDescription,
        quantity: toDecimalString(item.quantity),
        unitCost: toDecimalString(item.unitCost),
        discountPercent: toDecimalString(item.discountPercent),
        discountAmount: toDecimalString(item.discountAmount),
        netTotal: toDecimalString(item.netTotal),
        vatPercent: toDecimalString(item.vatPercent),
        vatAmount: toDecimalString(item.vatAmount),
        totalPrice: toDecimalString(item.totalPrice),
        itemName: toNullableString(item.itemName) ?? "",
        description: toNullableString(item.description) ?? "",
        unitPrice: toDecimalString(item.unitPrice ?? 0),
        receivedQuantity: toDecimalString(item.receivedQuantity ?? 0),
      })),
    };
  };

  const handleHeaderSubmit = async (values: HeaderFormValues) => {
    const payload = buildHeaderUpdatePayload(values);
    try {
      await updateReceiptMutation.mutateAsync(payload);
      setHeaderDialogOpen(false);
    } catch (error) {
      /* Mutation error handled via onError toast */
    }
  };

  const handleItemsSubmit = async (values: ItemsFormValues) => {
    const payload = buildItemsUpdatePayload(values);
    try {
      await updateReceiptMutation.mutateAsync(payload);
      setItemsDialogOpen(false);
    } catch (error) {
      /* Mutation error handled via onError toast */
    }
  };

  return (
    <>
      <Dialog
        open={isHeaderDialogOpen}
        onOpenChange={(open) => {
          setHeaderDialogOpen(open);
          if (!open) {
            headerForm.reset(getHeaderFormValues(receipt));
          }
        }}
      >
  <DialogContent className="max-w-screen-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Receipt Header</DialogTitle>
            <DialogDescription>Update the header information for this material receipt.</DialogDescription>
          </DialogHeader>
          <Form {...headerForm}>
            <form onSubmit={headerForm.handleSubmit(handleHeaderSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={headerForm.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter receipt number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="receiptDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="receivedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received By</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer: any) => (
                            <SelectItem key={customer.id} value={customer.name}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Discrepancy">Discrepancy</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter invoice number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="supplierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter supplier name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter payment terms" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={headerForm.control}
                  name="supplierContactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter contact person" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={headerForm.control}
                name="supplierAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Address</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Enter supplier address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={headerForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Add any notes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setHeaderDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateReceiptMutation.isPending}>
                  {updateReceiptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isItemsDialogOpen}
        onOpenChange={(open) => {
          setItemsDialogOpen(open);
          if (!open) {
            const defaults = getItemsFormValues(items);
            itemsForm.reset(defaults);
            replace(defaults.items);
          }
        }}
      >
  <DialogContent className="max-w-screen-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Receipt Items</DialogTitle>
            <DialogDescription>Update the line items for this material receipt.</DialogDescription>
          </DialogHeader>
          <Form {...itemsForm}>
            <form onSubmit={itemsForm.handleSubmit(handleItemsSubmit)} className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Manage the items included with this receipt.</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    append({
                      id: undefined,
                      serialNo: fields.length + 1,
                      itemCode: "",
                      supplierCode: "",
                      barcode: "",
                      itemDescription: "",
                      quantity: 0,
                      unitCost: 0,
                      discountPercent: 0,
                      discountAmount: 0,
                      netTotal: 0,
                      vatPercent: 0,
                      vatAmount: 0,
                      totalPrice: 0,
                      itemName: "",
                      description: "",
                      unitPrice: 0,
                      receivedQuantity: 0,
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {fields.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  No items available. Click "Add Item" to create a new line item.
                </div>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-gray-200 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-800">Item {index + 1}</div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.serialNo` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial No</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.itemCode` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter item code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.supplierCode` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter supplier code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.barcode` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Barcode</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter barcode" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={itemsForm.control}
                    name={`items.${index}.itemDescription` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Enter item description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.quantity` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.unitCost` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Cost</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.unitPrice` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.discountPercent` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount %</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.discountAmount` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.netTotal` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Net Total</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.vatPercent` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT %</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.vatAmount` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.totalPrice` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.receivedQuantity` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Received Quantity</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.itemName` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter item name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={itemsForm.control}
                      name={`items.${index}.description` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Description</FormLabel>
                          <FormControl>
                            <Textarea rows={2} placeholder="Enter additional details" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setItemsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateReceiptMutation.isPending}>
                  {updateReceiptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Items
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background-color: #f8f9fa;
            font-weight: bold;
          }
        }
      `}</style>

      <div className="container mx-auto p-4 lg:p-6 max-w-screen-2xl">
        <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/receipts")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Material Receipt Details</h1>
              <p className="text-sm text-muted-foreground mt-1">Receipt #{receipt.receiptNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleOpenHeaderDialog}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="print-content">
          <div className="print-header hidden print:block mb-6">
            <h1 className="text-3xl font-bold">Material Receipt</h1>
            <p className="text-lg">#{receipt.receiptNumber}</p>
            <p className="text-sm text-gray-600">Date: {formatDate(receipt.receiptDate)}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      Receipt Information
                    </CardTitle>
                    {getStatusBadge(receipt.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Receipt Number</Label>
                      <Input value={receipt.receiptNumber} disabled className="font-medium bg-muted" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Receipt Date</Label>
                      <Input value={formatDate(receipt.receiptDate)} disabled className="font-medium bg-muted" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Received By</Label>
                      <Input value={receipt.receivedBy || "N/A"} disabled className="font-medium bg-muted" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Input value={receipt.status} disabled className="font-medium bg-muted" />
                    </div>
                  </div>

                  {(receipt.invoiceNumber || receipt.invoiceDate) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {receipt.invoiceNumber && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                          <Input value={receipt.invoiceNumber} disabled className="font-medium bg-muted" />
                        </div>
                      )}
                      {receipt.invoiceDate && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                          <Input value={formatDate(receipt.invoiceDate)} disabled className="font-medium bg-muted" />
                        </div>
                      )}
                    </div>
                  )}

                  {(receipt.notes || receipt.dueDate) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {receipt.dueDate && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Due Date</Label>
                          <Input value={formatDate(receipt.dueDate)} disabled className="font-medium bg-muted" />
                        </div>
                      )}
                      {receipt.notes && (
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <Textarea value={receipt.notes} disabled className="min-h-[60px] bg-muted" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="no-print">
                    <Button onClick={handleOpenHeaderDialog} size="sm" className="gap-2">
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {(receipt.supplierName || receipt.supplierAddress || receipt.supplierContactPerson) && (
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Supplier Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {receipt.supplierName && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Supplier Name</Label>
                          <Input value={receipt.supplierName} disabled className="font-medium bg-muted" />
                        </div>
                      )}
                      {receipt.paymentTerms && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Payment Terms</Label>
                          <Input value={receipt.paymentTerms} disabled className="font-medium bg-muted" />
                        </div>
                      )}
                    </div>
                    {receipt.supplierAddress && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Supplier Address</Label>
                        <Textarea value={receipt.supplierAddress} disabled className="min-h-[60px] bg-muted" />
                      </div>
                    )}
                    {receipt.supplierContactPerson && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Contact Person</Label>
                        <Input value={receipt.supplierContactPerson} disabled className="font-medium bg-muted" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Receipt Items ({items.length})
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleOpenItemsDialog} className="gap-2 no-print">
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full print-table">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">S.No</th>
                          <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Description</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Qty</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Unit Cost</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Discount</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Net</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">VAT</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-muted-foreground">
                              No items found in this receipt
                            </td>
                          </tr>
                        ) : (
                          items.map((item, index) => (
                          <tr key={item.id || index} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-sm font-medium">{item.serialNo || index + 1}</td>
                            <td className="p-3">
                              <div className="space-y-1">
                                <p className="font-medium text-sm">{item.itemDescription}</p>
                                {(item.itemCode || item.barcode) && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.itemCode && <span>Code: {item.itemCode}</span>}
                                    {item.itemCode && item.barcode && <span className="mx-1">•</span>}
                                    {item.barcode && <span>Barcode: {item.barcode}</span>}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-medium text-sm">
                              {item.quantity ? parseFloat(item.quantity).toFixed(2) : '0.00'}
                            </td>
                            <td className="p-3 text-right font-mono text-sm">
                              {item.unitCost ? formatCurrency(item.unitCost) : formatCurrency(0)}
                            </td>
                            <td className="p-3 text-right text-xs text-muted-foreground">
                              {item.discountPercent ? parseFloat(item.discountPercent).toFixed(2) + '%' : '0.00%'}
                              <br />
                              {formatCurrency(item.discountAmount)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm">
                              {item.netTotal ? formatCurrency(item.netTotal) : formatCurrency(0)}
                            </td>
                            <td className="p-3 text-right text-xs text-muted-foreground">
                              {item.vatPercent ? parseFloat(item.vatPercent).toFixed(2) + '%' : '0.00%'}
                              <br />
                              {formatCurrency(item.vatAmount)}
                            </td>
                            <td className="p-3 text-right font-semibold font-mono text-sm">
                              {item.totalPrice ? formatCurrency(item.totalPrice) : formatCurrency(0)}
                            </td>
                          </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="shadow-sm hover:shadow-md transition-shadow border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{formatCurrency((totalAmount - totalVAT) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Total Discount</span>
                    <span className="font-semibold text-destructive">- {formatCurrency(totalDiscount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Total VAT</span>
                    <span className="font-semibold">{formatCurrency(totalVAT || 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="font-medium">Grand Total</span>
                    <span className="text-xl font-bold text-primary font-mono">{formatCurrency(totalAmount || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Items</span>
                    <span className="font-semibold">{items.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Quantity</span>
                    <span className="font-semibold">
                      {items.reduce((sum, item) => {
                        const qty = item.quantity ? parseFloat(item.quantity) : 0;
                        return sum + (isNaN(qty) ? 0 : qty);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Created</Label>
                    <p className="text-sm font-medium">{formatDate(receipt.createdAt)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Last Updated</Label>
                    <p className="text-sm font-medium">{formatDate(receipt.updatedAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {receipt.goodsReceiptId && (
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Related Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/receipts/${receipt.goodsReceiptId}`}>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                        <FileText className="h-4 w-4" />
                        View Source Goods Receipt
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
  </>
  );
}
