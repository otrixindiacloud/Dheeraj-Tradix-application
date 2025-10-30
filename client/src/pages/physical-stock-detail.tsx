import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { usePhysicalStock, useInventoryItems } from "@/hooks/usePhysicalStock";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Package,
  Warehouse,
  User,
  Calendar,
  FileText,
  Hash,
  BarChart3,
  ClipboardList
} from "lucide-react";

export default function PhysicalStockDetailPage() {
  const [, params] = useRoute("/physical-stock/:id");
  const stockId = (params as any)?.id as string | undefined;

  const { data: stockList = [], isLoading } = usePhysicalStock();
  const { data: items = [] } = useInventoryItems();

  const stock = useMemo(() => (Array.isArray(stockList) ? stockList.find((s: any) => s.id === stockId) : undefined), [stockList, stockId]);
  const itemMeta = useMemo(() => (stock ? items.find((it: any) => it.id === stock.itemId) : undefined), [items, stock]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/physical-stock">
              <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
              </Button>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Physical Stock Details</h1>
              <p className="text-sm text-slate-600">Item stock information and last count</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && !stock && (
          <Card className="p-8">
            <div className="text-center text-slate-600">Physical stock entry not found.</div>
          </Card>
        )}

        {!!stock && (
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-6 space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Package className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Item</div>
                  <div className="text-base font-semibold text-slate-900">
                    {stock.itemName || itemMeta?.name || itemMeta?.description || stock.itemId || "N/A"}
                  </div>
                  <div className="text-[11px] text-slate-500 tracking-wide uppercase">
                    {itemMeta?.barcode || itemMeta?.itemCode || ""}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Warehouse className="h-4 w-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Location</div>
                      <div className="text-sm font-medium">{stock.location || "N/A"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Quantity</div>
                      <div className="text-sm font-medium">{stock.quantity ?? 0}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Last Counted</div>
                      <div className="text-sm font-medium">{stock.lastUpdated ? formatDate(stock.lastUpdated) : "N/A"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500">Counted By</div>
                      <div className="text-sm font-medium">{stock.countedBy || "N/A"}</div>
                    </div>
                  </div>
                </div>
              </div>
              {stock.notes && (
                <div className="mt-4">
                  <div className="text-xs text-slate-500 mb-1">Notes</div>
                  <Card className="p-4 bg-slate-50 border-slate-200">
                    <div className="text-sm text-slate-700">{stock.notes}</div>
                  </Card>
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <Hash className="h-4 w-4" />
                  <div className="text-sm font-semibold">Identifiers</div>
                </div>
                <div className="text-xs text-slate-500">Stock ID</div>
                <div className="text-sm font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 break-all">{stock.id}</div>
                {!!stock.itemId && (
                  <>
                    <div className="text-xs text-slate-500">Item ID</div>
                    <div className="text-sm font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 break-all">{stock.itemId}</div>
                  </>
                )}
              </Card>

              <Card className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <ClipboardList className="h-4 w-4" />
                  <div className="text-sm font-semibold">Actions</div>
                </div>
                <div className="text-sm text-slate-600">You can edit or delete this entry from the list page.</div>
                <Link href="/physical-stock">
                  <Button variant="outline">Go to Physical Stock</Button>
                </Link>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


