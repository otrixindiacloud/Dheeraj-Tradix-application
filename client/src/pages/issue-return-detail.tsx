import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { format as formatDateFns } from "date-fns";
import {
  ArrowLeft,
  AlertTriangle,
  Eye,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Timer,
  Hash,
} from "lucide-react";

interface IssueReturn {
  id: string;
  returnNumber: string;
  stockIssueId: string | null;
  returnType: string;
  priority: "Low" | "Medium" | "High" | "Urgent" | string;
  description: string;
  returnedBy: string;
  returnDate: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed" | string;
  resolution: string | null;
  assignedTo: string | null;
  estimatedResolution: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  stockIssueNumber?: string;
  customerName?: string;
  supplierName?: string;
}

function formatDate(dateStr?: string | null, pattern = 'MMM dd, yyyy') {
  if (!dateStr) return '—';
  try { return formatDateFns(new Date(dateStr), pattern); } catch { return String(dateStr); }
}

const priorityColor = (p?: string) => {
  switch (p) {
    case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Urgent': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const priorityIcon = (p?: string) => {
  switch (p) {
    case 'Low': return <Timer className="h-3.5 w-3.5" />;
    case 'Medium': return <Timer className="h-3.5 w-3.5" />;
    case 'High': return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'Urgent': return <AlertTriangle className="h-3.5 w-3.5" />;
    default: return <Timer className="h-3.5 w-3.5" />;
  }
};

const statusColor = (s?: string) => {
  switch (s) {
    case 'Open': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Closed': return 'bg-slate-50 text-slate-700 border-slate-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export default function IssueReturnDetailPage() {
  const [, params] = useRoute('/issue-return/:id');
  const issueReturnId = (params as any)?.id;
  const { toast } = useToast();

  const { data: issueReturn, isLoading, error } = useQuery<IssueReturn | null>({
    queryKey: ['issue-return', issueReturnId],
    enabled: !!issueReturnId,
    queryFn: async () => {
      if (!issueReturnId) return null;
      const res = await fetch(`/api/issue-returns/${issueReturnId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load issue return');
      }
      return res.json();
    }
  });

  useEffect(() => {
    if (error) {
      toast({ title: 'Error', description: (error as any).message || 'Failed to load issue return', variant: 'destructive' });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/issue-return">
              <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
              </Button>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Issue Return Details</h1>
              <p className="text-sm text-slate-600">Complete details of the issue return</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        )}

        {!isLoading && !issueReturn && (
          <Card className="p-12 text-center shadow-lg rounded-xl bg-white">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 text-lg font-medium mb-2">Issue return not found.</p>
              <Link href="/issue-return"><Button className="shadow-md">Go Back to List</Button></Link>
            </div>
          </Card>
        )}

        {issueReturn && (
          <div className="space-y-6">
            <Card className="bg-white shadow-lg rounded-xl border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      <Hash className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-medium">Return Number</p>
                      <p className="text-lg font-bold text-slate-900 font-mono">{issueReturn.returnNumber}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={null as any} className={`${statusColor(issueReturn.status)} border font-semibold px-3 py-1 text-xs`}>
                      {issueReturn.status}
                    </Badge>
                    <Badge variant={null as any} className={`${priorityColor(issueReturn.priority)} border font-semibold px-3 py-1 text-xs flex items-center gap-1.5`}>
                      {priorityIcon(issueReturn.priority)}
                      {issueReturn.priority} Priority
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Stock Issue</span>
                    <span className="text-sm font-semibold text-slate-900">{issueReturn.stockIssueNumber || issueReturn.stockIssueId || '—'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Return Type</span>
                    <span className="text-sm font-semibold text-slate-900">{issueReturn.returnType || '—'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Returned By</span>
                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-1"><User className="h-3.5 w-3.5" /> {issueReturn.returnedBy || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Return Date</span>
                    <span className="text-sm font-semibold text-slate-900">{formatDate(issueReturn.returnDate)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Assigned To</span>
                    <span className="text-sm font-semibold text-slate-900">{issueReturn.assignedTo || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">ETA Resolution</span>
                    <span className="text-sm font-semibold text-blue-600">{formatDate(issueReturn.estimatedResolution)}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 font-medium">Resolution</span>
                    <span className="text-sm font-semibold text-slate-900">{issueReturn.resolution || '—'}</span>
                  </div>
                </div>
              </div>
            </Card>

            {issueReturn.description && (
              <Card className="bg-white shadow-md rounded-xl border-slate-200">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Description</h2>
                  </div>
                  <Separator />
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{issueReturn.description}</p>
                  </div>
                </div>
              </Card>
            )}

            {(issueReturn.customerName || issueReturn.supplierName) && (
              <Card className="bg-white shadow-md rounded-xl border-slate-200">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <User className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Parties</h2>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {issueReturn.customerName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-medium">Customer</span>
                        <span className="text-sm font-semibold text-slate-900">{issueReturn.customerName}</span>
                      </div>
                    )}
                    {issueReturn.supplierName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-medium">Supplier</span>
                        <span className="text-sm font-semibold text-slate-900">{issueReturn.supplierName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 shadow-md rounded-xl border-slate-200">
              <div className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-1">Current Status</p>
                    <Badge variant={null as any} className={`${statusColor(issueReturn.status)} border font-semibold px-3 py-1 text-xs`}>{issueReturn.status}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-1">Created / Updated</p>
                    <p className="text-sm font-semibold text-slate-900">{formatDate(issueReturn.createdAt)} • {formatDate(issueReturn.updatedAt, 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


