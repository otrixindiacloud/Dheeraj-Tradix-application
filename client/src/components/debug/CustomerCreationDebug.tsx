import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bug, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DebugResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

export function CustomerCreationDebug() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);
  const [testData, setTestData] = useState({
    name: 'Debug Test Customer',
    email: 'debug@test.com',
    phone: '1234567890',
    address: 'Test Address',
    customerType: 'Retail',
    classification: 'Individual',
    taxId: 'TAX123',
    creditLimit: '1000',
    paymentTerms: 'Net 30',
    isActive: true
  });

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const newResults: DebugResult[] = [];

    try {
      // Step 1: Test API endpoint availability
      newResults.push({
        step: 'API Endpoint Check',
        success: false,
        message: 'Checking if /api/customers endpoint is available...'
      });
      setResults([...newResults]);

      const healthCheck = await fetch('/api/customers', {
        method: 'GET',
        credentials: 'include'
      });

      newResults[0] = {
        step: 'API Endpoint Check',
        success: healthCheck.ok,
        message: healthCheck.ok ? 'API endpoint is available' : `API endpoint returned ${healthCheck.status}`,
        data: { status: healthCheck.status, statusText: healthCheck.statusText }
      };
      setResults([...newResults]);

      if (!healthCheck.ok) {
        throw new Error('API endpoint not available');
      }

      // Step 2: Test schema validation
      newResults.push({
        step: 'Schema Validation',
        success: false,
        message: 'Testing data validation...'
      });
      setResults([...newResults]);

      const validationResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(testData)
      });

      const validationResult = await validationResponse.json();

      newResults[1] = {
        step: 'Schema Validation',
        success: validationResponse.ok,
        message: validationResponse.ok ? 'Data validation passed' : `Validation failed: ${validationResult.message}`,
        data: validationResult
      };
      setResults([...newResults]);

      if (!validationResponse.ok) {
        throw new Error(`Validation failed: ${validationResult.message}`);
      }

      // Step 3: Test duplicate check
      newResults.push({
        step: 'Duplicate Check',
        success: false,
        message: 'Testing duplicate customer creation...'
      });
      setResults([...newResults]);

      const duplicateResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(testData)
      });

      const duplicateResult = await duplicateResponse.json();

      newResults[2] = {
        step: 'Duplicate Check',
        success: duplicateResponse.status === 409,
        message: duplicateResponse.status === 409 ? 'Duplicate detection working correctly' : 
                duplicateResponse.ok ? 'Customer created successfully (no duplicate detected)' :
                `Unexpected error: ${duplicateResult.message}`,
        data: duplicateResult
      };
      setResults([...newResults]);

      // Step 4: Test with minimal data
      newResults.push({
        step: 'Minimal Data Test',
        success: false,
        message: 'Testing with minimal required data...'
      });
      setResults([...newResults]);

      const minimalData = {
        name: 'Minimal Test Customer',
        customerType: 'Retail',
        classification: 'Individual'
      };

      const minimalResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(minimalData)
      });

      const minimalResult = await minimalResponse.json();

      newResults[3] = {
        step: 'Minimal Data Test',
        success: minimalResponse.ok,
        message: minimalResponse.ok ? 'Minimal data test passed' : `Minimal data test failed: ${minimalResult.message}`,
        data: minimalResult
      };
      setResults([...newResults]);

    } catch (error) {
      newResults.push({
        step: 'Error',
        success: false,
        message: `Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      });
      setResults([...newResults]);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    if (success) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"}>
        {success ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Customer Creation Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This tool will test various aspects of customer creation to identify issues.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Customer Name</Label>
              <Input
                id="name"
                value={testData.name}
                onChange={(e) => setTestData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={testData.email}
                onChange={(e) => setTestData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="customerType">Customer Type</Label>
              <Select
                value={testData.customerType}
                onValueChange={(value) => setTestData(prev => ({ ...prev, customerType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="classification">Classification</Label>
              <Select
                value={testData.classification}
                onValueChange={(value) => setTestData(prev => ({ ...prev, classification: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Family">Family</SelectItem>
                  <SelectItem value="Ministry">Ministry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                  {getStatusIcon(result.success)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{result.step}</h4>
                      {getStatusBadge(result.success)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                    {result.data && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
