import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Download, FileText, Calculator, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';

interface LpoPdfTableData {
  serialNumber: number;
  itemDescription: string;
  quantity: string;
  unitRate: string;
  discountPercent: string;
  discountAmount: string;
  netTotal: string;
  vatPercent: string;
  vatAmount: string;
  rawData?: {
    quantity: any;
    unitCost: any;
    discountPercent: any;
    discountAmount: any;
    vatPercent: any;
    vatAmount: any;
    grossAmount: number;
    calculatedDiscountAmount: number;
    calculatedVatAmount: number;
    calculatedVatPercent: number;
  };
  error?: string;
}

interface LpoPdfTableResponse {
  success: boolean;
  lpoId: string;
  lpoNumber: string;
  currency: string;
  tableHeaders: string[];
  tableData: LpoPdfTableData[];
  totals: {
    totalGrossAmount: string;
    totalDiscountAmount: string;
    totalNetAmount: string;
    totalVatAmount: string;
    totalAmount: string;
  };
  lpoDetails: {
    lpoDate: string;
    supplierName: string;
    supplierId: string;
    status: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
  };
  itemCount: number;
  generatedAt: string;
}

interface LpoPdfTableProps {
  lpoId: string;
  onClose?: () => void;
}

export default function LpoPdfTable({ lpoId, onClose }: LpoPdfTableProps) {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<LpoPdfTableResponse>({
    queryKey: ['/api/supplier-lpos', lpoId, 'pdf-table-data'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/supplier-lpos/${lpoId}/pdf-table-data`);
      return response;
    },
    enabled: !!lpoId,
    staleTime: 30000, // 30 seconds
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrencyValue = (value: string, currency: string = 'BHD') => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return formatCurrency(numValue, currency);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'received':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            LPO PDF Table Data
          </CardTitle>
          <CardDescription>Loading LPO table data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            LPO PDF Table Data
          </CardTitle>
          <CardDescription>Error loading LPO table data</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load LPO PDF table data: {error.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Retry
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            LPO PDF Table Data
          </CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No LPO PDF table data found for this LPO.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-7xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              LPO PDF Table Data
            </CardTitle>
            <CardDescription>
              LPO #{data.lpoNumber} - {data.lpoDetails.supplierName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(data.lpoDetails.status)}>
              {data.lpoDetails.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* LPO Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-600">LPO Date</p>
            <p className="text-lg font-semibold">
              {new Date(data.lpoDetails.lpoDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Items Count</p>
            <p className="text-lg font-semibold">{data.itemCount}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Generated At</p>
            <p className="text-lg font-semibold">
              {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Table Headers */}
        <div className="text-sm text-gray-600 mb-2">
          <strong>Table Headers:</strong> {data.tableHeaders.join(' | ')}
        </div>

        {/* PDF Table Data */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-center font-semibold">S/N</TableHead>
                <TableHead className="font-semibold">Item Description & Specifications</TableHead>
                <TableHead className="text-center font-semibold">Qty</TableHead>
                <TableHead className="text-right font-semibold">Unit Rate</TableHead>
                <TableHead className="text-center font-semibold">Disc %</TableHead>
                <TableHead className="text-right font-semibold">Disc Amt</TableHead>
                <TableHead className="text-right font-semibold">Net Total</TableHead>
                <TableHead className="text-center font-semibold">VAT %</TableHead>
                <TableHead className="text-right font-semibold">VAT Amt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tableData.map((row, index) => (
                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <TableCell className="text-center font-medium">{row.serialNumber}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={row.itemDescription}>
                      {row.itemDescription}
                    </div>
                    {row.error && (
                      <div className="text-xs text-red-600 mt-1">
                        Error: {row.error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{row.quantity}</TableCell>
                  <TableCell className="text-right">
                    {row.unitRate ? `${data.currency} ${row.unitRate}` : '-'}
                  </TableCell>
                  <TableCell className="text-center">{row.discountPercent}%</TableCell>
                  <TableCell className="text-right">
                    {row.discountAmount ? `${data.currency} ${row.discountAmount}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.netTotal ? `${data.currency} ${row.netTotal}` : '-'}
                  </TableCell>
                  <TableCell className="text-center">{row.vatPercent}%</TableCell>
                  <TableCell className="text-right">
                    {row.vatAmount ? `${data.currency} ${row.vatAmount}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals Summary */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculated Totals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Gross Amount</p>
              <p className="text-lg font-semibold text-blue-700">
                {formatCurrencyValue(data.totals.totalGrossAmount, data.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Discount Amount</p>
              <p className="text-lg font-semibold text-orange-700">
                {formatCurrencyValue(data.totals.totalDiscountAmount, data.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Net Amount</p>
              <p className="text-lg font-semibold text-green-700">
                {formatCurrencyValue(data.totals.totalNetAmount, data.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">VAT Amount</p>
              <p className="text-lg font-semibold text-purple-700">
                {formatCurrencyValue(data.totals.totalVatAmount, data.currency)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-lg font-semibold text-red-700">
                {formatCurrencyValue(data.totals.totalAmount, data.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Raw Data Debug (Optional) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
              Debug: Raw Data
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-64">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
