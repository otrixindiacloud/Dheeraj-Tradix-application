import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDate } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {  
  ArrowLeft, 
  Edit, 
  Download, 
  Send, 
  Check, 
  X, 
  Clock,
  AlertTriangle,
  DollarSign,
  Calculator,
  FileText,
  User,
  Calendar,
  MessageSquare,
  Copy,
  Plus,
  Trash2
} from "lucide-react";
import { EmailSendButton } from "@/components/email/EmailSendButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // retained for other uses
import StatusPill from "@/components/status/status-pill";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SYSTEM_USER_ID } from "@shared/utils/uuid";
import { useUserId } from "@/hooks/useUserId";
import { Link } from "wouter";
import QuotationItemsManager from "@/components/quotation/quotation-items-manager";
import { useAuth } from "@/components/auth/auth-context";
import type { Request, Response, NextFunction } from "express";

interface Quotation {
  id: string;
  quoteNumber: string;
  revision: number;
  enquiryId: string;
  customerId: string;
  customerType: "Retail" | "Wholesale";
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
  quoteDate: string;
  validUntil: string;
  subtotal: string;
  discountPercentage: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  terms: string;
  notes: string;
  approvalStatus: string;
  requiredApprovalLevel: string;
  createdAt: string;
}

interface QuotationItem {
  id: string;
  quotationId: string;
  supplierCode: string;
  barcode: string;
  description: string;
  quantity: number;
  costPrice: string;
  markup: string;
  unitPrice: string;
  lineTotal: string;
  isAccepted: boolean;
  rejectionReason: string;
  notes: string;
}

import { useParams, useLocation } from "wouter";

// Helper function to compute unit price from cost+markup or use stored unitPrice
function computeUnitPrice(item: any): number {
  const cost = Number(item.costPrice) || 0;
  const markupPct = Number(item.markup) || 0;
  // Prefer computed unit from cost+markup; fallback to stored unitPrice
  const computedUnitFromMarkup = cost > 0 ? cost * (1 + Math.max(0, markupPct) / 100) : 0;
  return computedUnitFromMarkup > 0 ? computedUnitFromMarkup : (Number(item.unitPrice) || 0);
}

// Helper function to calculate quotation totals
// Formula: Unit Price = Cost Price * (1 + Markup %), Subtotal = Unit Price × Qty,
// Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount,
// After Discount = Subtotal - Discount Amount,
// VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount,
// Line Total = After Discount + VAT Amount
function calculateQuotationTotals(items: any[], quotation: any) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      grossSubtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      subtotal: 0,
      totalAmount: 0
    };
  }

  let grossSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  items.forEach((it: any) => {
    const qty = Number(it.quantity) || 0;
    const unitPrice = computeUnitPrice(it);
    // Subtotal = Unit Price × Quantity
    const subtotal = qty * unitPrice;
    
    // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount if no percentage
    const discountPercent = Number(it.discountPercentage) || Number(quotation?.discountPercentage) || 0;
    const discountAmount = Number(it.discountAmount) || 0;
    let appliedDiscount = 0;
    if (discountPercent > 0) {
      // Prioritize discount percentage calculation
      appliedDiscount = (subtotal * discountPercent) / 100;
    } else if (discountAmount > 0) {
      // Use explicit discount amount only if no percentage is provided
      appliedDiscount = Math.min(subtotal, Math.abs(discountAmount));
    }
    
    // After Discount = Subtotal - Discount Amount
    const afterDiscount = Math.max(0, subtotal - appliedDiscount);
    
    // VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount if no percentage
    const taxPercent = Number(it.vatPercent) || Number(quotation?.vatPercent) || 0;
    const taxAmount = Number(it.vatAmount) || 0;
    let appliedTax = 0;
    if (taxPercent > 0) {
      // Prioritize VAT percentage calculation
      appliedTax = (afterDiscount * taxPercent) / 100;
    } else if (taxAmount > 0) {
      // Use explicit VAT amount only if no percentage is provided
      appliedTax = taxAmount;
    }

    grossSubtotal += subtotal;
    totalDiscount += appliedDiscount;
    totalTax += appliedTax;
  });

  const subtotal = Math.round((grossSubtotal - totalDiscount) * 100) / 100;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

  return {
    grossSubtotal,
    totalDiscount,
    subtotal,
    totalTax,
    totalAmount
  };
}

export default function QuotationDetailPage() {
  // Filter states
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomerType, setFilterCustomerType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const userId = useUserId();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [selectedRevisions, setSelectedRevisions] = useState<{from: any, to: any} | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const { user } = useAuth();

  // Role-based permission: client user (id: 'client') is fully view-only
  const isClientViewOnly = user?.id === "client";

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["/api/quotations", id],
    queryFn: async () => {
      const response = await fetch(`/api/quotations/${id}`);
      if (!response.ok) throw new Error("Failed to fetch quotation");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: quotationItems } = useQuery({
    queryKey: ["/api/quotations", id, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/quotations/${id}/items`);
      if (!response.ok) throw new Error("Failed to fetch quotation items");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: quotationRevisions } = useQuery({
    queryKey: ["/api/quotations", id, "revisions"],
    queryFn: async () => {
      const response = await fetch(`/api/quotations/${id}/revisions`);
      if (!response.ok) throw new Error("Failed to fetch quotation revisions");
      return response.json();
    },
    enabled: !!id,
  });

  // Get all quotations with the same parent ID or this quotation's ID to show complete revision history
  const { data: allRevisions } = useQuery({
    queryKey: ["/api/quotations", id, "all-revisions"],
    queryFn: async () => {
      // First get the current quotation to find its parent
      const currentQuotation = quotation;
      if (!currentQuotation) return [];
      
      // Determine the root quotation ID - this is the original quotation
      const rootQuotationId = currentQuotation.parentQuotationId || currentQuotation.id;
      
      // Get all revisions of the root quotation
      const response = await fetch(`/api/quotations/${rootQuotationId}/revisions`);
      if (!response.ok) throw new Error("Failed to fetch all revisions");
      const revisions = await response.json();
      
      // Always include the original quotation (root) in the list
      const originalResponse = await fetch(`/api/quotations/${rootQuotationId}`);
      if (originalResponse.ok) {
        const original = await originalResponse.json();
        // Combine original with revisions and sort by revision number
        const allVersions = [original, ...revisions];
        return allVersions.sort((a: any, b: any) => (a.revision || 0) - (b.revision || 0));
      }
      
      return revisions.sort((a: any, b: any) => (a.revision || 0) - (b.revision || 0));
    },
    enabled: !!quotation,
  });

  const { data: quotationHistory } = useQuery({
    queryKey: ["/api/quotations", id, "history"],
    queryFn: async () => {
      const response = await fetch(`/api/quotations/${id}/history`);
      if (!response.ok) throw new Error("Failed to fetch quotation history");
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch customers data to get customer names
  const { data: customersData = { customers: [] } } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const customers = customersData.customers || [];
  
  // Get customer name from customer ID
  const customerName = quotation?.customerId 
    ? customers.find((c: any) => c.id === quotation.customerId)?.name || 'No Customer'
    : 'No Customer';

  // Handles both status and approvalStatus updates
  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { status?: string; approvalStatus?: string }) => {
      if (isClientViewOnly) throw new Error("Client user cannot perform any changes");
      // Always send user id and role headers for backend admin check
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(user?.id ? { "x-user-id": user.id } : {}),
        ...(user?.role ? { "x-user-role": user.role } : {}),
      };
      const response = await fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      let result;
      try {
        result = await response.json();
      } catch (e) {
        result = {};
      }
      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update quotation");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Quotation updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", id, "history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update quotation",
        variant: "destructive",
      });
    },
  });

  const createRevisionMutation = useMutation({
    mutationFn: async (revisionData: { revisionReason: string }) => {
      if (isClientViewOnly) throw new Error("Client user cannot perform any changes");
      const response = await fetch(`/api/quotations/${id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...revisionData, userId }),
      });
      if (!response.ok) throw new Error("Failed to create quotation revision");
      return response.json();
    },
    onSuccess: (newRevision) => {
      toast({
        title: "Success",
        description: `Revision ${newRevision.revision} created successfully`,
      });
      setShowRevisionDialog(false);
      setRevisionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      // Navigate to the new revision
      navigate(`/quotations/${newRevision.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quotation revision",
        variant: "destructive",
      });
    },
  });

  const handleCreateRevision = () => {
    if (isClientViewOnly) {
      toast({
        title: "Error",
        description: "Client user cannot perform any changes",
        variant: "destructive",
      });
      return;
    }
    if (!revisionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for creating this revision",
        variant: "destructive",
      });
      return;
    }
    createRevisionMutation.mutate({ revisionReason });
  };

  if (isLoading || !quotation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading quotation details...</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Draft": return <Clock className="h-4 w-4" />;
      case "Sent": return <FileText className="h-4 w-4" />;
      case "Accepted": return <Check className="h-4 w-4" />;
      case "Rejected": return <X className="h-4 w-4" />;
      case "Expired": return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft": return "text-gray-700";
      case "Sent": return "text-blue-700";
      case "Accepted": return "text-green-700";
      case "Rejected": return "text-red-700";
      case "Expired": return "text-orange-700";
      default: return "text-gray-700";
    }
  };

  // Returns Tailwind classes for badge background and text color
  const getApprovalStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Approved": return "border border-teal-200 text-teal-700";
      case "Pending": return "border border-orange-500 text-orange-600";
      case "Rejected": return "border border-red-200 text-red-700";
      default: return "border border-gray-300 text-gray-800";
    }
  };

  // Returns Tailwind classes for status badge background and text color
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft": return "border border-gray-400 text-gray-700";
      case "sent": return "border border-blue-400 text-blue-700";
      case "accepted": return "border border-green-400 text-green-700";
      case "rejected": return "border border-red-400 text-red-700";
      case "expired": return "border border-orange-400 text-orange-700";
      default: return "border border-gray-300 text-gray-800";
    }
  };

  const canUpdateStatus = (newStatus: string) => {
    if (quotation.approvalStatus === "Pending" && newStatus === "Sent") {
      return false; // Cannot send quote pending approval
    }
    return true;
  };

  const downloadPDF = async () => {
    try {
      // First try the API endpoint
      const response = await fetch(`/api/quotations/${id}/pdf`);
      
      if (!response.ok) {
        // If API fails, generate PDF using client-side jsPDF
        console.warn('API PDF generation failed, falling back to client-side generation');
        generateClientSidePDF();
        return;
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation-${quotation.quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Quotation PDF downloaded successfully",
      });
    } catch (error) {
      console.error("Error with API PDF generation:", error);
      // Fallback to client-side PDF generation
      generateClientSidePDF();
    }
  };

  const generateClientSidePDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Company Header - Left Side (Golden Tag)
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(218, 165, 32); // Gold color
      doc.text('GOLDEN TAG', 20, 20);
      
      // Company Details - Left Side
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('Trading & Supply Company', 20, 27);
      doc.text('Kingdom of Bahrain', 20, 32);
      doc.text('Mobile: +973 XXXX XXXX', 20, 37);
      doc.text('Email: info@goldentag.com', 20, 42);
      
      // Document Type and Date - Right Side
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('QUOTATION', pageWidth - 20, 20, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`Date: ${formatDate(new Date(quotation.quoteDate || quotation.createdAt), "MMM dd, yyyy")}`, pageWidth - 20, 30, { align: 'right' });
      doc.text(`Quote #: ${quotation.quoteNumber}`, pageWidth - 20, 35, { align: 'right' });
      doc.text(`Valid Until: ${formatDate(new Date(quotation.validUntil), "MMM dd, yyyy")}`, pageWidth - 20, 40, { align: 'right' });
      
      // Horizontal line separator
      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(0.5);
      doc.line(20, 48, pageWidth - 20, 48);
      
      // Customer Information Box
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 249, 250);
      doc.rect(20, 55, pageWidth - 40, 24, 'FD');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('BILL TO:', 25, 62);
      doc.setFont('helvetica', 'normal');
      doc.text(`Customer: ${customerName}`, 25, 68);
      doc.text(`Customer Type: ${quotation.customerType}`, 25, 74);
      doc.text(`Status: ${quotation.status}`, pageWidth - 80, 68);
      
      // Items table
      if (quotationItems && quotationItems.length > 0) {
        const currency = quotation.currency || 'BHD';
        const tableData = quotationItems.map((item: QuotationItem, index: number) => {
          const qty = parseFloat(item.quantity?.toString() || '0');
          const costPrice = parseFloat((item as any).costPrice?.toString() || '0');
          const markupPct = parseFloat((item as any).markup?.toString() || '0');
          // Unit Price = Cost Price * (1 + Markup % / 100) - rounded to 3 decimals
          const computedUnitFromMarkup = costPrice > 0 ? costPrice * (1 + Math.max(0, markupPct) / 100) : 0;
          const unitPrice = Math.round((computedUnitFromMarkup > 0 ? computedUnitFromMarkup : parseFloat(item.unitPrice?.toString() || '0')) * 1000) / 1000;
          // Subtotal = Unit Price × Quantity - rounded to 2 decimals
          const subtotal = Math.round((qty * unitPrice) * 100) / 100;
          // Discount Amount = Subtotal * (Discount % / 100) or use explicit discount amount - rounded to 2 decimals
          const discountPerc = parseFloat((item as any).discountPercentage?.toString() || (quotation.discountPercentage as any)?.toString() || '0') || 0;
          const discountAmtRaw = parseFloat((item as any).discountAmount?.toString() || '0');
          let discountAmt = 0;
          if (discountPerc > 0) {
            // Prioritize discount percentage calculation - calculate directly from subtotal
            discountAmt = Math.round((subtotal * discountPerc / 100) * 100) / 100;
          } else if (discountAmtRaw > 0) {
            // Use explicit discount amount only if no percentage is provided
            discountAmt = Math.round(Math.min(subtotal, Math.abs(discountAmtRaw)) * 100) / 100;
          }
          // After Discount = Subtotal - Discount Amount - rounded to 2 decimals
          const afterDiscount = Math.round(Math.max(0, subtotal - discountAmt) * 100) / 100;
          // VAT Amount = After Discount * (VAT % / 100) or use explicit VAT amount - rounded to 2 decimals
          const vatPerc = parseFloat((item as any).vatPercent?.toString() || (quotation as any)?.vatPercent?.toString() || '0') || 0;
          const vatAmtRaw = parseFloat((item as any).vatAmount?.toString() || '0');
          let vatAmt = 0;
          if (vatPerc > 0) {
            // Prioritize VAT percentage calculation - calculate directly from afterDiscount
            vatAmt = Math.round((afterDiscount * vatPerc / 100) * 100) / 100;
          } else if (vatAmtRaw > 0) {
            // Use explicit VAT amount only if no percentage is provided
            vatAmt = Math.round(vatAmtRaw * 100) / 100;
          }
          // Line Total = After Discount + VAT Amount - rounded to 2 decimals
          const lineTotal = Math.round((afterDiscount + vatAmt) * 100) / 100;
          // Markup percentage for display
          const markupPerc = costPrice > 0 && unitPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : markupPct;

          return [
            (index + 1).toString(),
            item.description || 'Item Description',
            `${qty.toFixed(2)} PCS`,
            `${currency} ${costPrice.toFixed(3)}`,
            `${isFinite(markupPerc) ? markupPerc.toFixed(1) : '0.0'}%`,
            `${currency} ${unitPrice.toFixed(3)}`,
            `${discountPerc.toFixed(1)}%`,
            `${currency} ${discountAmt.toFixed(2)}`,
            `${vatPerc.toFixed(1)}%`,
            `${currency} ${vatAmt.toFixed(2)}`,
            `${currency} ${lineTotal.toFixed(2)}`
          ];
        });
        
        autoTable(doc, {
          head: [['S.I.', 'Item Description & Specifications', 'Qty', 'Cost Price', 'Markup %', 'Unit Price', 'Discount %', 'Discount Amount', 'VAT %', 'VAT Amount', 'Line Total']],
          body: tableData,
          startY: 86,
          theme: 'grid',
          headStyles: { 
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          styles: { 
            fontSize: 9,
            cellPadding: 4,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 58, halign: 'left' },
            2: { cellWidth: 16, halign: 'center' },
            3: { cellWidth: 22, halign: 'right' },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 20, halign: 'center' },
            7: { cellWidth: 26, halign: 'right' },
            8: { cellWidth: 18, halign: 'center' },
            9: { cellWidth: 26, halign: 'right' },
            10:{ cellWidth: 26, halign: 'right' }
          },
          alternateRowStyles: {
            fillColor: [248, 249, 250]
          }
        });
      }
      
      // Pricing summary
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      const currency = quotation.currency || 'BHD';
      
      // Calculate values safely
      const subtotal = parseFloat(quotation.subtotal?.toString() || '0') || 0;
      const discountAmount = parseFloat(quotation.discountAmount?.toString() || '0') || 0;
      const taxAmount = parseFloat(quotation.taxAmount?.toString() || '0') || 0;
      const netAmount = subtotal - discountAmount;
      const totalAmount = parseFloat(quotation.totalAmount?.toString() || '0') || (netAmount + taxAmount);
      
      // Summary table (right-aligned)
      const summaryData = [
        ['Subtotal', `${currency} ${subtotal.toFixed(2)}`],
        ['Discount Amount', `${currency} ${discountAmount.toFixed(2)}`],
        ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
        ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
        ['Total Amount', `${currency} ${totalAmount.toFixed(2)}`]
      ];
      
      autoTable(doc, {
        startY: finalY + 5,
        body: summaryData,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
          1: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
        },
        margin: { left: pageWidth - 75 }
      });
      
      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const pageHeight = doc.internal.pageSize.height;
      doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
      doc.text('Golden Tag - Your Trusted Trading Partner', 105, pageHeight - 15, { align: 'center' });
      doc.text('This is a computer-generated quotation and does not require a signature.', 105, pageHeight - 10, { align: 'center' });
      
      // Save the PDF
      doc.save(`quotation-${quotation.quoteNumber}.pdf`);
      
      toast({
        title: "Success",
        description: "Quotation PDF generated and downloaded successfully",
      });
    } catch (error) {
      console.error("Error generating client-side PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/quotations">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotations
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="quotation-title">
              {quotation.quoteNumber}
              {quotation.revision > 1 && (
                <span className="text-lg text-gray-600 ml-2">
                  (Revision {quotation.revision})
                </span>
              )}
            </h1>
            <p className="text-gray-600">
              Created on {formatDate(new Date(quotation.createdAt), "MMMM dd, yyyy")}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <StatusPill status={quotation.status.toLowerCase()} />
          {quotation.approvalStatus && (
            <StatusPill status={quotation.approvalStatus.toLowerCase()} />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          data-testid="button-edit"
          onClick={() => !isClientViewOnly && setShowEditDialog(true)}
          disabled={isClientViewOnly}
          title={isClientViewOnly ? "You do not have access to make changes" : undefined}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button 
          variant="outline" 
          data-testid="button-download" 
          onClick={downloadPDF}
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button 
          variant="outline" 
          data-testid="button-create-revision" 
          onClick={() => !isClientViewOnly && setShowRevisionDialog(true)}
          disabled={isClientViewOnly}
          title={isClientViewOnly ? "You do not have access to make changes" : undefined}
        >
          <Copy className="h-4 w-4 mr-2" />
          Create Revision
        </Button>
        {/* Only admin can approve quotations */}
        {user?.role === "admin" && quotation.status === "Draft" && quotation.approvalStatus !== "Pending" && (
          <EmailSendButton
            documentType="quotation"
            documentId={quotation.id}
            documentNumber={quotation.quotationNumber || quotation.quoteNumber}
            customerEmail={quotation.customer?.email}
            customerName={quotation.customer?.customerName || quotation.customer?.name}
            variant="outline"
            className="flex items-center space-x-2"
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotation.id}`] });
              updateStatusMutation.mutate({ status: "Sent" });
            }}
          />
        )}
        {/* Only admin can mark accepted/rejected */}
        {user?.role === "admin" && quotation.status === "Sent" && (
          <div className="flex gap-2">
            <Link href={`/quotations/${id}/acceptance`}>
              <Button variant="default" data-testid="button-customer-acceptance">
                <FileText className="h-4 w-4 mr-2" />
                Customer Acceptance
              </Button>
            </Link>
            <Button 
              onClick={() => !isClientViewOnly && updateStatusMutation.mutate({ status: "Accepted" })}
              disabled={updateStatusMutation.isPending || isClientViewOnly}
              data-testid="button-accept"
              variant="outline"
              className={getStatusBadgeClass("accepted")}
              title={isClientViewOnly ? "You do not have access to make changes" : undefined}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark Accepted
            </Button>
            <Button 
              variant="outline"
              onClick={() => !isClientViewOnly && updateStatusMutation.mutate({ status: "Rejected" })}
              disabled={updateStatusMutation.isPending || isClientViewOnly}
              data-testid="button-reject"
              className="border-red-700 text-red-700 hover:bg-red-50"
              title={isClientViewOnly ? "You do not have access to make changes" : undefined}
            >
              <X className="h-4 w-4 mr-2" />
              Mark Rejected
            </Button>
          </div>
        )}
      </div>

      {/* Warning for Pending Approval and Approve/Reject Buttons */}
      {quotation.approvalStatus === "Pending" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-medium">Approval Required</div>
                <div className="text-sm">
                  This quotation requires approval from: {quotation.requiredApprovalLevel}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items ({quotationItems?.length || 0})</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="revisions">Revisions ({allRevisions?.length || 1})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Customer Name</label>
                      <div className="font-medium">{customerName}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Customer Type</label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{quotation.customerType}</Badge>
                        <span className="text-sm text-gray-600">
                          ({quotation.customerType === "Retail" ? "70%" : "40%"} markup)
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quote Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Quote Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Quote Date</label>
                      <div className="font-medium">
                        {formatDate(new Date(quotation.quoteDate || quotation.createdAt), "MMM dd, yyyy")}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Valid Until</label>
                      <div className="font-medium">
                        {formatDate(new Date(quotation.validUntil), "MMM dd, yyyy")}
                        {new Date(quotation.validUntil) < new Date() && (
                          <span className="text-red-600 text-sm ml-2">(Expired)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {quotation.terms && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Terms & Conditions</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                        {quotation.terms}
                      </div>
                    </div>
                  )}
                  
                  {quotation.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Notes</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                        {quotation.notes}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pricing Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Pricing Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary Stats - Items, Amount, Tax */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Items Count */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Total Items:</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {quotationItems?.length || 0}
                      </span>
                    </div>

                    {/* Total Amount */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-700">Total Amount:</span>
                      </div>
                      <span className="text-lg font-bold text-blue-900">
                        {(() => {
                          const currency = quotation.currency || 'BHD';
                          const items = Array.isArray(quotationItems) ? quotationItems : [];
                          const totals = calculateQuotationTotals(items, quotation);
                          return `${currency} ${totals.totalAmount.toFixed(2)}`;
                        })()}
                      </span>
                    </div>

                    {/* Tax Amount */}
                    
                  </div>

                  

                  {/* Pricing Breakdown computed from all items */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-3">Pricing Breakdown</h4>
                    <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                      {(() => {
                        const currency = quotation.currency || 'BHD';
                        const items = Array.isArray(quotationItems) ? quotationItems : [];
                        const totals = calculateQuotationTotals(items, quotation);
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Subtotal</span>
                              <span className="font-medium">{currency} {totals.grossSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Discount Amount</span>
                              <span className="font-medium text-red-600">-{currency} {totals.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Net Amount</span>
                              <span className="font-medium">{currency} {totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">VAT Amount</span>
                              <span className="font-medium">{currency} {totals.totalTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 font-bold">
                              <span>Total Amount</span>
                              <span>{currency} {totals.totalAmount.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      
                      <div className="text-sm text-gray-800 font-medium">
                        {quotation.customerType} Pricing Applied
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <QuotationItemsManager 
            quotationId={id!}
            customerType={quotation.customerType}
            editable={quotation.approvalStatus !== "Approved"}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-50 via-white to-gray-200 rounded-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-400 shadow-md">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Approval Status</CardTitle>
                <div className="text-sm text-gray-500 font-medium">
                  {quotation.requiredApprovalLevel ? 
                    `Requires approval from: ${quotation.requiredApprovalLevel}` :
                    "No approval required"
                  }
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6 mt-2 p-4 rounded-xl bg-gradient-to-br from-blue-50 via-white to-gray-100 border border-blue-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-blue-500" />
                  <span className="text-base font-semibold text-gray-800">Approval Status Update</span>
                </div>
                <div className="flex flex-row items-center gap-4 flex-1 justify-center">
                  <Button
                    onClick={() => {
                      if (user?.role !== "admin") return;
                      if (quotation.approvalStatus === "Approved") return;
                      updateStatusMutation.mutate({ approvalStatus: "Approved", status: "Approved" });
                    }}
                    disabled={updateStatusMutation.isPending || user?.role !== "admin" || quotation.approvalStatus === "Approved" || quotation.approvalStatus === "Rejected"}
                    variant="default"
                    className="px-4 py-2 font-semibold rounded-lg shadow bg-green-600 text-white hover:bg-green-700 transition"
                  >
                    {updateStatusMutation.isPending && quotation.approvalStatus !== "Approved" ? "Updating..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => {
                      if (user?.role !== "admin") return;
                      if (quotation.approvalStatus === "Pending") return;
                      updateStatusMutation.mutate({ approvalStatus: "Pending", status: "Pending" });
                    }}
                    disabled={updateStatusMutation.isPending || user?.role !== "admin" || quotation.approvalStatus === "Approved" || quotation.approvalStatus === "Rejected"}
                    variant="outline"
                    className="px-4 py-2 font-semibold rounded-lg shadow border-orange-500 text-orange-600 hover:bg-orange-50 transition"
                  >
                    {updateStatusMutation.isPending && quotation.approvalStatus !== "Pending" ? "Updating..." : "Set Pending"}
                  </Button>
                  <Button
                    onClick={() => {
                      if (user?.role !== "admin") return;
                      if (quotation.approvalStatus === "Rejected") return;
                      updateStatusMutation.mutate({ approvalStatus: "Rejected", status: "Rejected" });
                    }}
                    disabled={updateStatusMutation.isPending || user?.role !== "admin" || quotation.approvalStatus === "Approved" || quotation.approvalStatus === "Rejected"}
                    variant="outline"
                    className="px-4 py-2 font-semibold rounded-lg shadow border-red-500 text-red-600 hover:bg-red-50 transition"
                  >
                    {updateStatusMutation.isPending && quotation.approvalStatus !== "Rejected" ? "Updating..." : "Reject"}
                  </Button>
                </div>
                {user?.role !== "admin" && (
                  <div className="text-xs text-gray-500 mt-2 md:mt-0">Only admin users can update approval status.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Copy className="h-5 w-5" />
                  Related Quotation Revisions
                  <Badge variant="outline" className="ml-2">
                    {allRevisions?.length || 1} version{(allRevisions?.length || 1) !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
                {allRevisions && allRevisions.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowComparisonDialog(true)}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Compare Revisions
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This shows all revisions related to this quotation, including the original quotation and all its revisions.
                </p>
              </div>
              <div className="space-y-4">
                {allRevisions?.length > 0 ? (
                  allRevisions.map((revision: any, index: number) => {
                    const isCurrent = revision.id === quotation.id;
                    const isOriginal = !revision.parentQuotationId;
                    const isLatest = index === allRevisions.length - 1;
                    
                    return (
                      <div
                        key={revision.id}
                        className={`p-6 border-2 rounded-xl transition-all duration-200 ${
                          isCurrent 
                            ? 'border-blue-500 bg-blue-50 shadow-lg' 
                            : isLatest && !isCurrent
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              isCurrent 
                                ? 'bg-blue-500' 
                                : isOriginal
                                ? 'bg-gray-500'
                                : 'bg-green-500'
                            }`}>
                              {revision.revision || 1}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">
                                {isOriginal ? 'Original Quotation' : `Revision ${revision.revision}`}
                                {isCurrent && (
                                  <Badge variant="default" className="ml-3 bg-blue-500">Current</Badge>
                                )}
                                {isLatest && !isCurrent && (
                                  <Badge variant="outline" className="ml-3 border-green-500 text-green-700">Latest</Badge>
                                )}
                                {revision.isSuperseded && (
                                  <Badge variant="secondary" className="ml-3">Superseded</Badge>
                                )}
                              </h3>
                              <p className="text-sm text-gray-600">
                                Created on {formatDate(new Date(revision.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">
                              BHD {parseFloat(revision.totalAmount || "0").toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-500">Total Amount</div>
                          </div>
                        </div>
                        
                        {revision.revisionReason && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <strong>Revision Reason:</strong> {revision.revisionReason}
                            </p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <StatusPill status={revision.status.toLowerCase()} />
                            <span className="text-sm text-gray-600">Status</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getApprovalStatusBadgeClass(revision.approvalStatus)}>
                              {revision.approvalStatus || 'None'}
                            </Badge>
                            <span className="text-sm text-gray-600">Approval</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {revision.customerType}
                            </Badge>
                            <span className="text-sm text-gray-600">Customer Type</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-500">
                            Quote Number: <span className="font-mono">{revision.quoteNumber}</span>
                          </div>
                          <div className="flex gap-2">
                            {revision.id !== quotation.id && (
                              <Link href={`/quotations/${revision.id}`}>
                                <Button variant="outline" size="sm">
                                  <FileText className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                              </Link>
                            )}
                            {!isClientViewOnly && revision.id !== quotation.id && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setRevisionReason("");
                                  setShowRevisionDialog(true);
                                }}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Create Revision
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Copy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No revisions found</p>
                    <p className="text-sm">This is the original quotation</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotation History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quotationHistory?.map((event: any, index: number) => {
                  const getEventColor = (action: string) => {
                    switch (action) {
                      case 'create': return 'border-green-500 bg-green-50';
                      case 'create_revision': return 'border-blue-500 bg-blue-50';
                      case 'update': return 'border-yellow-500 bg-yellow-50';
                      case 'supersede': return 'border-orange-500 bg-orange-50';
                      case 'approve': return 'border-green-500 bg-green-50';
                      case 'reject': return 'border-red-500 bg-red-50';
                      default: return 'border-gray-500 bg-gray-50';
                    }
                  };

                  const getEventTitle = (action: string) => {
                    switch (action) {
                      case 'create': return 'Quotation Created';
                      case 'create_revision': return 'Revision Created';
                      case 'update': return 'Quotation Updated';
                      case 'supersede': return 'Quotation Superseded';
                      case 'approve': return 'Quotation Approved';
                      case 'reject': return 'Quotation Rejected';
                      default: return action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                  };

                  return (
                    <div key={`${event.id}-${index}`} className={`flex items-center gap-3 p-3 border-l-4 ${getEventColor(event.action).replace('bg-blue-50', 'bg-gray-50')}`}> 
                      <Calendar className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{getEventTitle(event.action)}</div>
                        <div className="text-sm text-gray-600">
                          {formatDate(new Date(event.timestamp), "MMM dd, yyyy 'at' h:mm a")}
                        </div>
                        {event.comments && (
                          <div className="text-sm text-gray-700 mt-1">
                            <strong>Comments:</strong> {event.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!quotationHistory || quotationHistory.length === 0) && (
                  <div className="flex items-center gap-3 p-3 border-l-4 border-gray-500 bg-gray-50">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <div>
                      <div className="font-medium">Quotation Created</div>
                      <div className="text-sm text-gray-600">
                        {formatDate(new Date(quotation.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Revision Dialog */}
      {showRevisionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Quotation Revision</h3>
            <p className="text-sm text-gray-600 mb-4">
              Creating a revision will supersede the current quotation and create a new version that can be modified.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Revision <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="Explain why this revision is needed..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRevisionDialog(false);
                  setRevisionReason("");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateRevision}
                disabled={createRevisionMutation.isPending || !revisionReason.trim()}
              >
                {createRevisionMutation.isPending ? "Creating..." : "Create Revision"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quotation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              For comprehensive quotation editing, you can:
            </p>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
              <li>Create a revision to modify terms, pricing, or items</li>
              <li>Update the quotation status using the action buttons</li>
              <li>Edit individual items in the Items tab</li>
              <li>Add notes or modify terms directly</li>
            </ul>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Use "Create Revision" for major changes that need customer approval, 
                or directly modify items and terms for minor updates.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowEditDialog(false);
                  setShowRevisionDialog(true);
                }}
              >
                Create Revision
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revision Comparison Dialog */}
      <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Compare Quotation Revisions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {allRevisions && allRevisions.length > 1 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* From Revision */}
                <div>
                  <h3 className="font-semibold mb-3">From Revision</h3>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded-md"
                    onChange={(e) => {
                      const revision = allRevisions.find((r: any) => r.id === e.target.value);
                      setSelectedRevisions(prev => prev ? { ...prev, from: revision } : { from: revision, to: null });
                    }}
                  >
                    <option value="">Select revision...</option>
                    {allRevisions.map((revision: any) => (
                      <option key={revision.id} value={revision.id}>
                        {!revision.parentQuotationId ? 'Original' : `Revision ${revision.revision}`} - ${parseFloat(revision.totalAmount || "0").toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Revision */}
                <div>
                  <h3 className="font-semibold mb-3">To Revision</h3>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded-md"
                    onChange={(e) => {
                      const revision = allRevisions.find((r: any) => r.id === e.target.value);
                      setSelectedRevisions(prev => prev ? { ...prev, to: revision } : { from: null as any, to: revision });
                    }}
                  >
                    <option value="">Select revision...</option>
                    {allRevisions.map((revision: any) => (
                      <option key={revision.id} value={revision.id}>
                        {!revision.parentQuotationId ? 'Original' : `Revision ${revision.revision}`} - ${parseFloat(revision.totalAmount || "0").toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No revisions available for comparison</p>
            )}

            {/* Comparison Results */}
            {selectedRevisions?.from && selectedRevisions?.to && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Comparison Results</h3>
                
                {/* Basic Info Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-600">From: {!selectedRevisions.from.parentQuotationId ? 'Original' : `Revision ${selectedRevisions.from.revision}`}</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Total:</strong> ${parseFloat(selectedRevisions.from.totalAmount || "0").toFixed(2)}</div>
                      <div><strong>Status:</strong> {selectedRevisions.from.status}</div>
                      <div><strong>Created:</strong> {formatDate(new Date(selectedRevisions.from.createdAt), "MMM dd, yyyy")}</div>
                      {selectedRevisions.from.revisionReason && (
                        <div><strong>Reason:</strong> {selectedRevisions.from.revisionReason}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-green-600">To: {!selectedRevisions.to.parentQuotationId ? 'Original' : `Revision ${selectedRevisions.to.revision}`}</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Total:</strong> ${parseFloat(selectedRevisions.to.totalAmount || "0").toFixed(2)}</div>
                      <div><strong>Status:</strong> {selectedRevisions.to.status}</div>
                      <div><strong>Created:</strong> {formatDate(new Date(selectedRevisions.to.createdAt), "MMM dd, yyyy")}</div>
                      {selectedRevisions.to.revisionReason && (
                        <div><strong>Reason:</strong> {selectedRevisions.to.revisionReason}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount Difference */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Amount Difference</h4>
                  <div className="text-2xl font-bold">
                    {(() => {
                      const fromAmount = parseFloat(selectedRevisions.from.totalAmount || "0");
                      const toAmount = parseFloat(selectedRevisions.to.totalAmount || "0");
                      const difference = toAmount - fromAmount;
                      const percentage = fromAmount > 0 ? ((difference / fromAmount) * 100) : 0;
                      
                      return (
                        <span className={difference >= 0 ? "text-green-600" : "text-red-600"}>
                          {difference >= 0 ? "+" : ""}${difference.toFixed(2)} 
                          ({percentage >= 0 ? "+" : ""}{percentage.toFixed(1)}%)
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowComparisonDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}