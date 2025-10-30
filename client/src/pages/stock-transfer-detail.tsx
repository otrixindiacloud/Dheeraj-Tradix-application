import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { format as formatDateFns } from "date-fns";
import {
	ArrowLeft,
	Box,
	Hash,
	MapPin,
	Package,
	Truck,
	User,
	Calendar,
	Clock,
	DollarSign,
	FileText,
	CheckCircle2,
	AlertTriangle,
	XCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface StockMovementDetail {
	id: string;
	transferNumber?: string;
	referenceId?: string;
	referenceType?: string;
	movementType?: string;
	status?: string;
	itemId?: string;
	itemName?: string;
	variantId?: string;
	quantityMoved?: number | string;
	quantityBefore?: number | string;
	quantityAfter?: number | string;
	fromLocation?: string;
	toLocation?: string;
	storageLocation?: string;
	transferDate?: string;
	requestedBy?: string;
	createdBy?: string;
	reason?: string;
	notes?: string;
	unitCost?: string | number;
	totalValue?: string | number;
	createdAt?: string;
	updatedAt?: string;
}

const statusBadge = (status?: string) => {
	switch (status) {
		case "Completed":
			return <Badge variant="outline" className="border-green-200 text-green-700">Completed</Badge>;
		case "Approved":
			return <Badge variant="outline" className="border-emerald-200 text-emerald-700">Approved</Badge>;
		case "In Transit":
			return <Badge variant="outline" className="border-indigo-200 text-indigo-700">In Transit</Badge>;
		case "Pending":
		case "Pending Approval":
			return <Badge variant="outline" className="border-amber-200 text-amber-700">{status}</Badge>;
		case "Cancelled":
			return <Badge variant="outline" className="border-rose-200 text-rose-700">Cancelled</Badge>;
		default:
			return <Badge variant="outline" className="border-slate-200 text-slate-700">{status || "Draft"}</Badge>;
	}
};

export default function StockTransferDetailPage() {
	const [, params] = useRoute('/stock-transfer/:id');
	const transferId = (params as any)?.id;
	const { toast } = useToast();

	const { data: movement, isLoading, error } = useQuery<StockMovementDetail | null>({
		queryKey: ['stock-movement', transferId],
		enabled: !!transferId,
		queryFn: async () => {
			if (!transferId) return null;
			const res = await fetch(`/api/stock-movements/${transferId}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to load stock transfer');
			}
			return res.json();
		}
	});

	useEffect(() => {
		if (error) {
			toast({ title: 'Error', description: (error as any).message || 'Failed to load stock transfer', variant: 'destructive' });
		}
	}, [error]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
					<div className="flex items-center gap-4">
						<Link href="/stock-transfer">
							<Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow" data-testid="button-back-transfer-list">
								<ArrowLeft className="h-4 w-4 mr-2" /> Back to List
							</Button>
						</Link>
						<div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
							<ArrowLeft className="h-6 w-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold tracking-tight text-slate-900">Stock Transfer Details</h1>
							<p className="text-sm text-slate-600">Complete transfer information</p>
						</div>
					</div>
					<div className="flex gap-2">
						{movement?.transferNumber && (
							<Badge variant="outline" className="text-slate-700 border-slate-300">
								<Hash className="h-3.5 w-3.5 mr-1" /> {movement.transferNumber}
							</Badge>
						)}
					</div>
				</div>

				{isLoading && (
					<div className="grid gap-6 md:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
					</div>
				)}

				{!isLoading && !movement && (
					<Card className="p-8">
						<div className="text-center text-slate-600">No transfer found.</div>
					</Card>
				)}

				{movement && (
					<div className="space-y-6">
						{/* Summary */}
						<div className="grid gap-6 md:grid-cols-3">
							<Card className="p-6">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<p className="text-sm text-slate-500">Status</p>
										<div className="flex items-center gap-2">
											{statusBadge(movement.status)}
										</div>
									</div>
									<StatusPill status={movement.status || 'Draft'} />
								</div>
							</Card>
							<Card className="p-6">
								<p className="text-sm text-slate-500">Item</p>
								<div className="mt-1 flex items-center gap-2 text-slate-900 font-medium">
									<Package className="h-4 w-4" /> {movement.itemName || movement.itemId || 'N/A'}
								</div>
								<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
									<div className="text-slate-500">Quantity</div>
									<div className="text-blue-700 font-semibold">{movement.quantityMoved ?? '-'}</div>
									<div className="text-slate-500">Unit Cost</div>
									<div className="text-slate-900">{movement.unitCost ?? '-'}</div>
									<div className="text-slate-500">Total Value</div>
									<div className="text-slate-900">{movement.totalValue ?? '-'}</div>
								</div>
							</Card>
							<Card className="p-6">
								<p className="text-sm text-slate-500">Transfer</p>
								<div className="mt-1 grid grid-cols-2 gap-3 text-sm">
									<div className="flex items-center gap-2 text-slate-900"><MapPin className="h-4 w-4" /> From: {movement.fromLocation || '-'}</div>
									<div className="flex items-center gap-2 text-slate-900"><MapPin className="h-4 w-4" /> To: {movement.toLocation || '-'}</div>
									<div className="flex items-center gap-2 text-slate-900"><Calendar className="h-4 w-4" /> Date: {movement.transferDate ? formatDateFns(new Date(movement.transferDate), 'PPP') : '-'}</div>
									<div className="flex items-center gap-2 text-slate-900"><User className="h-4 w-4" /> Requested By: {movement.requestedBy || movement.createdBy || '-'}</div>
								</div>
							</Card>
						</div>

						{/* Details */}
						<Card className="p-6">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-semibold">Details</h2>
								<div className="flex items-center gap-2 text-sm text-slate-500">
									<Hash className="h-4 w-4" /> {movement.referenceId || movement.id}
								</div>
							</div>
							<Separator className="my-4" />
							<div className="grid gap-6 md:grid-cols-3">
								<div className="space-y-2">
									<p className="text-sm text-slate-500">Reason</p>
									<p className="text-slate-900">{movement.reason || '-'}</p>
								</div>
								<div className="space-y-2">
									<p className="text-sm text-slate-500">Notes</p>
									<p className="text-slate-900">{movement.notes || '-'}</p>
								</div>
								<div className="space-y-2">
									<p className="text-sm text-slate-500">Created</p>
									<p className="text-slate-900">{movement.createdAt ? formatDateFns(new Date(movement.createdAt), 'PPpp') : '-'}</p>
								</div>
							</div>
						</Card>
					</div>
				)}
			</div>
		</div>
	);
}
