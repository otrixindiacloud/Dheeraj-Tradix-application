import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format as formatDateFns } from "date-fns";
import {
	ArrowLeft,
	Package,
	Boxes,
	Building2,
	Calendar,
	Ruler,
	Weight,
	ScanLine,
	MapPin,
	CheckCircle2,
	XCircle,
	Hash
} from "lucide-react";

interface InventoryItem {
	id: string;
	supplierCode: string;
	description: string;
	category: string;
	unitOfMeasure: string;
	supplierId: string | null;
	barcode: string | null;
	weight: string | number | null;
	dimensions: string | null;
	storageLocation: string | null;
	quantity: number;
	reservedQuantity: number;
	availableQuantity: number;
	totalStock: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface Supplier {
	id: string;
	name: string;
	email: string | null;
	phone: string | null;
}

function formatDate(dateStr?: string, pattern = 'MMM dd, yyyy') {
	if (!dateStr) return '—';
	try { return formatDateFns(new Date(dateStr), pattern); } catch { return String(dateStr); }
}

export default function InventoryItemDetailPage() {
	const [, params] = useRoute('/inventory-items/:id');
	const itemId = (params as any)?.id;
	const { toast } = useToast();

	const { data: item, isLoading, error } = useQuery<InventoryItem | null>({
		queryKey: ['inventory-item', itemId],
		enabled: !!itemId,
		queryFn: async () => {
			if (!itemId) return null;
			const res = await fetch(`/api/inventory-items/${itemId}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to load inventory item');
			}
			return res.json();
		}
	});

	const { data: supplier } = useQuery<Supplier | null>({
		queryKey: ['supplier-for-item', (item as any)?.supplierId],
		enabled: !!item?.supplierId,
		queryFn: async () => {
			if (!item?.supplierId) return null;
			const response = await fetch(`/api/suppliers`);
			if (!response.ok) return null;
			const suppliers = await response.json();
			return suppliers.find((s: Supplier) => s.id === item.supplierId) || null;
		}
	});

	useEffect(() => {
		if (error) {
			toast({ title: 'Error', description: (error as any).message || 'Failed to load inventory item', variant: 'destructive' });
		}
	}, [error]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header Section */}
				<div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6 border border-slate-200">
					<div className="flex items-center gap-4">
						<Link href="/inventory-management">
							<Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
								<ArrowLeft className="h-4 w-4 mr-2" /> Back to Inventory
							</Button>
						</Link>
						<div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
							<Package className="h-6 w-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Item Details</h1>
							<p className="text-sm text-slate-600">Full item information and stock overview</p>
						</div>
					</div>
				</div>

				{isLoading && (
					<div className="grid gap-6 md:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
					</div>
				)}

				{!isLoading && !item && (
					<Card className="p-12 text-center shadow-lg rounded-xl bg-white">
						<div className="flex flex-col items-center gap-4">
							<div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
								<Package className="h-8 w-8 text-slate-400" />
							</div>
							<p className="text-slate-600 text-lg font-medium mb-2">Inventory item not found.</p>
							<Link href="/inventory-management"><Button className="shadow-md">Go Back to Inventory</Button></Link>
						</div>
					</Card>
				)}

				{item && (
					<div className="space-y-6">
						{/* Status Overview Card */}
						<Card className="bg-white shadow-lg rounded-xl border-slate-200 overflow-hidden">
							<div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
								<div className="flex items-center justify-between flex-wrap gap-4">
									<div className="flex items-center gap-3">
										<div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
											<Package className="h-5 w-5 text-blue-600" />
										</div>
										<div>
											<p className="text-xs text-slate-600 font-medium">Supplier Code</p>
											<p className="text-lg font-bold text-slate-900 font-mono">{item.supplierCode}</p>
										</div>
									</div>
									<div className="flex flex-wrap gap-2">
										<Badge variant={null as any} className={`border font-semibold px-3 py-1 text-xs ${item.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
											{item.isActive ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
											{item.isActive ? 'Active' : 'Inactive'}
										</Badge>
										<Badge variant={null as any} className="bg-slate-50 text-slate-700 border-slate-200 border font-semibold px-3 py-1 text-xs flex items-center gap-1.5">
											<Hash className="h-3.5 w-3.5" />
											{item.category}
										</Badge>
									</div>
								</div>
							</div>
						</Card>

						{/* Identification & Stock Cards */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Identification */}
							<Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
								<div className="p-6 space-y-4">
									<div className="flex items-center gap-3 mb-4">
										<div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
											<Building2 className="h-5 w-5 text-blue-600" />
										</div>
										<h2 className="text-lg font-bold text-slate-900">Identification</h2>
									</div>
									<Separator />
									<div className="space-y-3">
										<div className="flex justify-between items-start">
											<span className="text-sm text-slate-600 font-medium">Description</span>
											<span className="text-sm font-semibold text-slate-900 text-right">{item.description}</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="text-sm text-slate-600 font-medium">Unit of Measure</span>
											<span className="text-sm font-semibold text-slate-900">{item.unitOfMeasure}</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="text-sm text-slate-600 font-medium">Supplier</span>
											<span className="text-sm font-semibold text-slate-900">{supplier?.name || 'Not assigned'}</span>
										</div>
									</div>
								</div>
							</Card>

							{/* Stock Overview */}
							<Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
								<div className="p-6 space-y-4">
									<div className="flex items-center gap-3 mb-4">
										<div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
											<Boxes className="h-5 w-5 text-emerald-600" />
										</div>
										<h2 className="text-lg font-bold text-slate-900">Stock Overview</h2>
									</div>
									<Separator />
									<div className="grid grid-cols-2 gap-6">
										<div>
											<span className="text-sm text-slate-600 font-medium">Total Stock</span>
											<p className="text-2xl font-bold text-slate-900">{item.totalStock || 0}</p>
										</div>
										<div>
											<span className="text-sm text-slate-600 font-medium">Quantity</span>
											<p className="text-2xl font-bold text-blue-600">{item.quantity || 0}</p>
										</div>
										<div>
											<span className="text-sm text-slate-600 font-medium">Reserved</span>
											<p className="text-2xl font-bold text-amber-600">{item.reservedQuantity || 0}</p>
										</div>
										<div>
											<span className="text-sm text-slate-600 font-medium">Available</span>
											<p className="text-2xl font-bold text-emerald-600">{item.availableQuantity || 0}</p>
										</div>
									</div>
								</div>
							</Card>
						</div>

						{/* Physical & Location */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							<Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
								<div className="p-6 space-y-4">
									<div className="flex items-center gap-3 mb-4">
										<div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
											<Weight className="h-5 w-5 text-orange-600" />
										</div>
										<h2 className="text-lg font-bold text-slate-900">Physical</h2>
									</div>
									<Separator />
									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Weight</span>
											<span className="text-sm font-semibold text-slate-900">{item.weight ? `${item.weight} kg` : '—'}</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="text-sm text-slate-600 font-medium">Dimensions</span>
											<span className="text-sm font-semibold text-slate-900 text-right">{item.dimensions || '—'}</span>
										</div>
									</div>
								</div>
							</Card>

							<Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
								<div className="p-6 space-y-4">
									<div className="flex items-center gap-3 mb-4">
										<div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
											<MapPin className="h-5 w-5 text-violet-600" />
										</div>
										<h2 className="text-lg font-bold text-slate-900">Location</h2>
									</div>
									<Separator />
									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Storage Location</span>
											<span className="text-sm font-semibold text-slate-900">{item.storageLocation || '—'}</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Barcode</span>
											<span className="text-sm font-mono font-bold text-blue-700">{item.barcode || '—'}</span>
										</div>
									</div>
								</div>
							</Card>

							<Card className="bg-white shadow-md rounded-xl border-slate-200 hover:shadow-lg transition-shadow">
								<div className="p-6 space-y-4">
									<div className="flex items-center gap-3 mb-4">
										<div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
											<Calendar className="h-5 w-5 text-blue-600" />
										</div>
										<h2 className="text-lg font-bold text-slate-900">Timeline</h2>
									</div>
									<Separator />
									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Created</span>
											<span className="text-sm font-semibold text-slate-900">{formatDate(item.createdAt)}</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-slate-600 font-medium">Updated</span>
											<span className="text-sm font-semibold text-slate-900">{formatDate(item.updatedAt, 'MMM dd, yyyy HH:mm')}</span>
										</div>
									</div>
								</div>
							</Card>
						</div>

						{/* Status Indicator */}
						<Card className="bg-gradient-to-r from-slate-50 to-slate-100 shadow-md rounded-xl border-slate-200">
							<div className="p-6">
								<div className="flex items-center justify-between flex-wrap gap-4">
									<div>
										<p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-1">Current Status</p>
										<Badge variant={null as any} className={`border font-semibold px-3 py-1 text-xs ${item.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
											{item.isActive ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
											{item.isActive ? 'Active' : 'Inactive'}
										</Badge>
									</div>
									<div className="text-right">
										<p className="text-xs text-slate-600 font-medium uppercase tracking-wide mb-1">Last Updated</p>
										<p className="text-sm font-semibold text-slate-900">{formatDate(item.updatedAt, 'MMM dd, yyyy HH:mm')}</p>
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

