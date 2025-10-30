import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft,
  Package,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  Building2,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReturnItem {
  id?: string;
  itemDescription: string;
  quantity: number;
  unitCost?: number;
  totalValue?: number;
  totalCost?: number;
  returnReason?: string;
}

interface ReturnReceipt {
  id: string;
  returnNumber: string;
  returnDate: string;
  goodsReceiptNumber: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierContactPerson?: string;
  returnReason?: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Processed" | "Cancelled";
  notes?: string;
  totalValue?: number;
  items?: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

function statusColor(status: string) {
  switch (status) {
    case "Draft": return "bg-slate-50 text-slate-700 border-slate-200";
    case "Pending Approval": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Approved": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Processed": return "bg-blue-50 text-blue-700 border-blue-200";
    case "Cancelled": return "bg-rose-50 text-rose-700 border-rose-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "Draft": return <FileText className="h-3.5 w-3.5" />;
    case "Pending Approval": return <Clock className="h-3.5 w-3.5" />;
    case "Approved": return <CheckCircle className="h-3.5 w-3.5" />;
    case "Processed": return <Package className="h-3.5 w-3.5" />;
    case "Cancelled": return <AlertTriangle className="h-3.5 w-3.5" />;
    default: return <FileText className="h-3.5 w-3.5" />;
  }
}

export default function ReturnDetail() {
  const { id } = useParams();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ReturnReceipt | null>({
    queryKey: ["return-receipt", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/receipt-returns/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load return receipt");
      return json.data as ReturnReceipt;
    }
  });

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: (error as any).message || "Failed to load return", variant: "destructive" });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/receipt-returns">
              <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
              </Button>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Return Receipt Details</h1>
              <p className="text-sm text-slate-600">Complete return information and summary</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        )}

        {!isLoading && !data && (
          <Card className="p-12 text-center shadow-lg rounded-xl bg-white">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 text-lg font-medium mb-2">Return not found.</p>
              <Link href="/receipt-returns"><Button className="shadow-md">Go Back to List</Button></Link>
            </div>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            {/* Overview Card */}
            <Card className="bg-white shadow-lg rounded-xl border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-medium">Return Number</p>
                      <p className="text-lg font-bold text-slate-900 font-mono">{data.returnNumber}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={null as any} className={`${statusColor(data.status)} border font-semibold px-3 py-1 text-xs flex items-center gap-1.5`}>
                      {statusIcon(data.status)}
                      {data.status}
                    </Badge>
                    <Badge variant={null as any} className="bg-slate-50 text-slate-700 border-slate-200 border font-semibold px-3 py-1 text-xs flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(data.returnDate).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Identification Card */}
              <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Identification Details</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Return Number</span>
                      <span className="text-sm font-mono font-bold text-slate-900">{data.returnNumber}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Linked Receipt</span>
                      <span className="text-sm font-semibold text-slate-900">{data.goodsReceiptNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Return Date</span>
                      <span className="text-sm font-semibold text-blue-700">{new Date(data.returnDate).toLocaleDateString()}</span>
                    </div>
                    {data.returnReason && (
                      <div className="pt-2">
                        <span className="text-sm text-slate-600 font-medium">Return Reason</span>
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.returnReason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Supplier Info */}
              <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Supplier Information</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-slate-600 font-medium">Supplier</span>
                      <span className="text-sm font-semibold text-slate-900">{data.supplierName || '—'}</span>
                    </div>
                    {data.supplierContactPerson && (
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-slate-600 font-medium">Contact</span>
                        <span className="text-sm font-semibold text-slate-900">{data.supplierContactPerson}</span>
                      </div>
                    )}
                    {data.supplierAddress && (
                      <div className="pt-2">
                        <span className="text-sm text-slate-600 font-medium">Address</span>
                        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.supplierAddress}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Items */}
            {data.items && data.items.length > 0 && (
              <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Returned Items</h2>
                    <Badge variant={null as any} className="bg-slate-100 text-slate-700 border-slate-200 border ml-auto font-semibold flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      {data.items.length} {data.items.length === 1 ? 'Item' : 'Items'}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    {data.items.map((item, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={null as any} className="bg-blue-50 text-blue-700 border-blue-200 border text-xs font-semibold">
                                {index + 1}
                              </Badge>
                              <h4 className="font-semibold text-slate-900">{item.itemDescription}</h4>
                            </div>
                            {item.returnReason && (
                              <p className="text-xs text-slate-600 italic mt-1">Reason: {item.returnReason}</p>
                            )}
                          </div>
                          <div className="text-right ml-4 space-y-2">
                            <Badge variant={null as any} className="bg-indigo-50 text-indigo-700 border-indigo-200 border font-semibold">
                              Qty: {item.quantity}
                            </Badge>
                          </div>
                        </div>
                        {(item.unitCost !== undefined || item.totalValue !== undefined || item.totalCost !== undefined) && (
                          <div className="flex gap-6 mt-3 pt-3 border-t border-slate-200">
                            {item.unitCost !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">Unit Cost:</span>
                                <span className="text-sm font-semibold text-slate-900">${Number(item.unitCost).toFixed(2)}</span>
                              </div>
                            )}
                            {(item.totalValue !== undefined || item.totalCost !== undefined) && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">Total:</span>
                                <span className="text-sm font-bold text-emerald-700">${Number(item.totalValue ?? item.totalCost ?? 0).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Financial Summary */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">Total Items:</span>
                          <span className="text-sm font-bold text-slate-900">{data.items.length}</span>
                        </div>
                        {(() => {
                          const calculated = data.items!.reduce((sum, item) => sum + Number(item.totalValue ?? item.totalCost ?? 0), 0);
                          return (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-700">Total Value:</span>
                              <span className="text-sm font-bold text-emerald-700">${calculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Timeline & Financial Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow md:col-span-1">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Timeline</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 font-medium">Created</span>
                      <span className="text-sm font-semibold text-slate-900">{new Date(data.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 font-medium">Updated</span>
                      <span className="text-sm font-semibold text-slate-900">{new Date(data.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow md:col-span-2">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Financial Snapshot</h2>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs text-slate-600 font-medium">Total Items</p>
                      <p className="text-lg font-bold text-slate-900">{data.items?.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs text-slate-600 font-medium">Total Quantity</p>
                      <p className="text-lg font-bold text-slate-900">{data.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <p className="text-xs text-slate-600 font-medium">Total Value</p>
                      <p className="text-lg font-bold text-emerald-700">${Number(data.totalValue ?? data.items?.reduce((s,i)=> s + Number(i.totalValue ?? i.totalCost ?? 0), 0) ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


