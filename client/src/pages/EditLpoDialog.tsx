import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SupplierLpo } from "@shared/schema";

export default function EditLpoDialog({ lpo, open, onClose, onSave }: {
  lpo: SupplierLpo;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<SupplierLpo>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<SupplierLpo>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (open && lpo) {
      setForm({ ...lpo });
    }
  }, [open, lpo]);

  const handleChange = (field: keyof SupplierLpo, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Supplier LPO</DialogTitle>
          <DialogDescription>Update LPO information and details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="dates">Dates</TabsTrigger>
              <TabsTrigger value="terms">Terms</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="lpoNumber">LPO Number</Label>
                      <Input
                        id="lpoNumber"
                        value={form.lpoNumber || ""}
                        onChange={e => handleChange("lpoNumber", e.target.value)}
                        disabled={saving}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={form.status || ""}
                        onValueChange={(value) => handleChange("status", value)}
                        disabled={saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Sent">Sent</SelectItem>
                          <SelectItem value="Confirmed">Confirmed</SelectItem>
                          <SelectItem value="Received">Received</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sourceType">Source Type</Label>
                    <Select
                      value={form.sourceType || "Manual"}
                      onValueChange={(value) => handleChange("sourceType", value)}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Manual">Manual</SelectItem>
                        <SelectItem value="Auto">Auto</SelectItem>
                        <SelectItem value="SupplierQuote">Supplier Quote</SelectItem>
                        <SelectItem value="SalesOrder">Sales Order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Supplier Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplierContactPerson">Contact Person</Label>
                      <Input
                        id="supplierContactPerson"
                        value={form.supplierContactPerson || ""}
                        onChange={e => handleChange("supplierContactPerson", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierEmail">Email</Label>
                      <Input
                        id="supplierEmail"
                        type="email"
                        value={form.supplierEmail || ""}
                        onChange={e => handleChange("supplierEmail", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierPhone">Phone</Label>
                      <Input
                        id="supplierPhone"
                        value={form.supplierPhone || ""}
                        onChange={e => handleChange("supplierPhone", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Dates Tab */}
            <TabsContent value="dates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Important Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="lpoDate">LPO Date</Label>
                      <Input
                        id="lpoDate"
                        type="date"
                        value={
                          form.lpoDate
                            ? typeof form.lpoDate === "string"
                              ? (form.lpoDate as string).slice(0, 10)
                              : new Date(form.lpoDate as Date).toISOString().slice(0, 10)
                            : ""
                        }
                        onChange={e => handleChange("lpoDate", e.target.value ? new Date(e.target.value) : null)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
                      <Input
                        id="expectedDeliveryDate"
                        type="date"
                        value={
                          form.expectedDeliveryDate
                            ? typeof form.expectedDeliveryDate === "string"
                              ? (form.expectedDeliveryDate as string).slice(0, 10)
                              : new Date(form.expectedDeliveryDate as Date).toISOString().slice(0, 10)
                            : ""
                        }
                        onChange={e => handleChange("expectedDeliveryDate", e.target.value ? new Date(e.target.value) : null)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="requestedDeliveryDate">Requested Delivery Date</Label>
                      <Input
                        id="requestedDeliveryDate"
                        type="date"
                        value={
                          form.requestedDeliveryDate
                            ? typeof form.requestedDeliveryDate === "string"
                              ? (form.requestedDeliveryDate as string).slice(0, 10)
                              : new Date(form.requestedDeliveryDate as Date).toISOString().slice(0, 10)
                            : ""
                        }
                        onChange={e => handleChange("requestedDeliveryDate", e.target.value ? new Date(e.target.value) : null)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Terms Tab */}
            <TabsContent value="terms" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Input
                        id="paymentTerms"
                        value={form.paymentTerms || ""}
                        onChange={e => handleChange("paymentTerms", e.target.value)}
                        disabled={saving}
                        placeholder="e.g., 30 Days, Net 15"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deliveryTerms">Delivery Terms</Label>
                      <Input
                        id="deliveryTerms"
                        value={form.deliveryTerms || ""}
                        onChange={e => handleChange("deliveryTerms", e.target.value)}
                        disabled={saving}
                        placeholder="e.g., FOB, CIF"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
                    <Textarea
                      id="termsAndConditions"
                      value={form.termsAndConditions || ""}
                      onChange={e => handleChange("termsAndConditions", e.target.value)}
                      disabled={saving}
                      rows={4}
                      placeholder="Enter terms and conditions..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialInstructions">Special Instructions</Label>
                    <Textarea
                      id="specialInstructions"
                      value={form.specialInstructions || ""}
                      onChange={e => handleChange("specialInstructions", e.target.value)}
                      disabled={saving}
                      rows={4}
                      placeholder="Enter special instructions..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={form.currency || "BHD"}
                        onValueChange={(value) => handleChange("currency", value)}
                        disabled={saving}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BHD">BHD - Bahraini Dinar</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="subtotal">Subtotal</Label>
                      <Input
                        id="subtotal"
                        type="number"
                        step="0.01"
                        value={form.subtotal || ""}
                        onChange={e => handleChange("subtotal", e.target.value ? parseFloat(e.target.value) : null)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxAmount">Tax Amount</Label>
                      <Input
                        id="taxAmount"
                        type="number"
                        step="0.01"
                        value={form.taxAmount || ""}
                        onChange={e => handleChange("taxAmount", e.target.value ? parseFloat(e.target.value) : null)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="totalAmount">Total Amount</Label>
                      <Input
                        id="totalAmount"
                        type="number"
                        step="0.01"
                        value={form.totalAmount || ""}
                        onChange={e => handleChange("totalAmount", e.target.value ? parseFloat(e.target.value) : null)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}