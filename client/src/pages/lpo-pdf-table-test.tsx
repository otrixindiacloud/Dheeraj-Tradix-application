import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import LpoPdfTable from '@/components/lpo-pdf-table';

export default function LpoPdfTableTestPage() {
  const [lpoId, setLpoId] = useState('');
  const [selectedLpoId, setSelectedLpoId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<'manual' | 'auto'>('manual');

  // Fetch available LPOs for testing
  const { data: lpos, isLoading: lposLoading } = useQuery({
    queryKey: ['/api/supplier-lpos'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/supplier-lpos');
      return response;
    },
    staleTime: 30000,
  });

  // Test the PDF table data endpoint
  const { data: testResult, isLoading: testLoading, error: testError } = useQuery({
    queryKey: ['/api/supplier-lpos', selectedLpoId, 'pdf-table-data-test'],
    queryFn: async () => {
      if (!selectedLpoId) throw new Error('No LPO ID provided');
      const response = await apiRequest('GET', `/api/supplier-lpos/${selectedLpoId}/pdf-table-data`);
      return response;
    },
    enabled: !!selectedLpoId,
    staleTime: 0, // Always fetch fresh data for testing
  });

  const handleTestLpo = () => {
    if (lpoId.trim()) {
      setSelectedLpoId(lpoId.trim());
    }
  };

  const handleSelectLpo = (id: string) => {
    setSelectedLpoId(id);
    setLpoId(id);
  };

  const handleAutoTest = () => {
    if (lpos && lpos.length > 0) {
      // Select the first LPO for auto testing
      const firstLpo = lpos[0];
      setSelectedLpoId(firstLpo.id);
      setLpoId(firstLpo.id);
      setTestMode('auto');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            LPO PDF Table Data Test
          </CardTitle>
          <CardDescription>
            Test the LPO PDF table data fetching functionality with the exact table structure:
            S/N, Item Description & Specifications, Qty, Unit Rate, Disc %, Disc Amt, Net Total, VAT %, VAT Amt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Manual Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Manual Test</CardTitle>
                <CardDescription>Enter an LPO ID to test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="lpo-id">LPO ID</Label>
                  <Input
                    id="lpo-id"
                    value={lpoId}
                    onChange={(e) => setLpoId(e.target.value)}
                    placeholder="Enter LPO ID..."
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleTestLpo} disabled={!lpoId.trim()}>
                  <Search className="h-4 w-4 mr-2" />
                  Test LPO PDF Table Data
                </Button>
              </CardContent>
            </Card>

            {/* Auto Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Auto Test</CardTitle>
                <CardDescription>Test with available LPOs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {lposLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : lpos && lpos.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Available LPOs ({lpos.length}):
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {lpos.slice(0, 5).map((lpo: any) => (
                        <div
                          key={lpo.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSelectLpo(lpo.id)}
                        >
                          <div>
                            <span className="font-medium">#{lpo.lpoNumber}</span>
                            <span className="text-sm text-gray-600 ml-2">
                              {new Date(lpo.lpoDate).toLocaleDateString()}
                            </span>
                          </div>
                          <Badge variant="outline">{lpo.status}</Badge>
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleAutoTest} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Auto Test First LPO
                    </Button>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No LPOs found. Create an LPO first to test the functionality.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Test Results */}
          {selectedLpoId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {testLoading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : testError ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : testResult ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                  Test Results
                </CardTitle>
                <CardDescription>
                  Testing LPO ID: {selectedLpoId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testLoading && (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                )}

                {testError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Test failed: {testError.message || 'Unknown error'}
                    </AlertDescription>
                  </Alert>
                )}

                {testResult && (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        ✅ Test successful! PDF table data fetched successfully.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-green-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-600">LPO Number</p>
                        <p className="text-lg font-semibold">#{testResult.lpoNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Items Count</p>
                        <p className="text-lg font-semibold">{testResult.itemCount}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Currency</p>
                        <p className="text-lg font-semibold">{testResult.currency}</p>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      <strong>Table Headers:</strong> {testResult.tableHeaders.join(' | ')}
                    </div>

                    <div className="text-sm text-gray-600">
                      <strong>Sample Data (First Item):</strong>
                      <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(testResult.tableData[0], null, 2)}
                      </pre>
                    </div>

                    <div className="text-sm text-gray-600">
                      <strong>Totals:</strong>
                      <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(testResult.totals, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Full PDF Table Component */}
          {selectedLpoId && (
            <Card>
              <CardHeader>
                <CardTitle>Full PDF Table Component</CardTitle>
                <CardDescription>
                  Complete PDF table display component with all formatting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LpoPdfTable lpoId={selectedLpoId} />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
