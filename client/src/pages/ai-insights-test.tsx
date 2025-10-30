import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, TestTube, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import AIInsightsWidget from '@/components/ai-assistant/ai-insights-widget';
import AIDataAnalysis from '@/components/ai-assistant/ai-data-analysis';

// Sample data for testing
const sampleSalesData = [
  {
    id: 1,
    customer_name: "Acme Corporation",
    product: "Premium Widget A",
    quantity: 100,
    price: 25.50,
    total: 2550.00,
    date: "2024-01-15",
    status: "completed"
  },
  {
    id: 2,
    customer_name: "Beta Industries",
    product: "Standard Widget B",
    quantity: 50,
    price: 30.00,
    total: 1500.00,
    date: "2024-01-16",
    status: "completed"
  },
  {
    id: 3,
    customer_name: "Gamma LLC",
    product: "Premium Widget A",
    quantity: 75,
    price: 25.50,
    total: 1912.50,
    date: "2024-01-17",
    status: "pending"
  },
  {
    id: 4,
    customer_name: "Delta Corp",
    product: "Basic Widget C",
    quantity: 200,
    price: 15.75,
    total: 3150.00,
    date: "2024-01-18",
    status: "completed"
  },
  {
    id: 5,
    customer_name: "Epsilon Ltd",
    product: "Standard Widget B",
    quantity: 30,
    price: 30.00,
    total: 900.00,
    date: "2024-01-19",
    status: "completed"
  },
  {
    id: 6,
    customer_name: "Zeta Enterprises",
    product: "Premium Widget A",
    quantity: 120,
    price: 25.50,
    total: 3060.00,
    date: "2024-01-20",
    status: "completed"
  }
];

const sampleCustomerData = [
  {
    id: 1,
    name: "Acme Corporation",
    email: "contact@acme.com",
    phone: "+1-555-0101",
    customer_type: "Enterprise",
    total_orders: 45,
    total_spent: 125000.00,
    last_order: "2024-01-20",
    status: "active"
  },
  {
    id: 2,
    name: "Beta Industries",
    email: "orders@beta.com",
    phone: "+1-555-0102",
    customer_type: "Wholesale",
    total_orders: 23,
    total_spent: 67500.00,
    last_order: "2024-01-18",
    status: "active"
  },
  {
    id: 3,
    name: "Gamma LLC",
    email: "info@gamma.com",
    phone: "+1-555-0103",
    customer_type: "Retail",
    total_orders: 12,
    total_spent: 18500.00,
    last_order: "2024-01-15",
    status: "active"
  }
];

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
}

export default function AIInsightsTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runAPITest = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    try {
      // Test 1: API Health Check
      results.push({
        test: "API Health Check",
        success: false,
        message: "Testing API endpoint availability..."
      });
      setTestResults([...results]);

      const healthResponse = await fetch('/api/ai/insights/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType: 'test',
          data: [{ test: 'data' }]
        }),
      });

      results[0] = {
        test: "API Health Check",
        success: healthResponse.ok,
        message: healthResponse.ok ? 'API endpoint is responding' : `API returned ${healthResponse.status}`,
        details: { status: healthResponse.status }
      };
      setTestResults([...results]);

      if (!healthResponse.ok) {
        throw new Error('API endpoint not available');
      }

      // Test 2: Sales Data Insights
      results.push({
        test: "Sales Data Insights",
        success: false,
        message: "Testing sales data analysis..."
      });
      setTestResults([...results]);

      const salesResponse = await fetch('/api/ai/insights/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType: 'sales_orders',
          data: sampleSalesData
        }),
      });

      if (salesResponse.ok) {
        const salesResult = await salesResponse.json();
        results[1] = {
          test: "Sales Data Insights",
          success: true,
          message: 'Sales insights generated successfully',
          details: { insightsLength: salesResult.insights?.length || 0 }
        };
      } else {
        results[1] = {
          test: "Sales Data Insights",
          success: false,
          message: `Sales insights failed: ${salesResponse.status}`,
        };
      }
      setTestResults([...results]);

      // Test 3: Customer Data Insights
      results.push({
        test: "Customer Data Insights",
        success: false,
        message: "Testing customer data analysis..."
      });
      setTestResults([...results]);

      const customerResponse = await fetch('/api/ai/insights/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType: 'customers',
          data: sampleCustomerData
        }),
      });

      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        results[2] = {
          test: "Customer Data Insights",
          success: true,
          message: 'Customer insights generated successfully',
          details: { insightsLength: customerResult.insights?.length || 0 }
        };
      } else {
        results[2] = {
          test: "Customer Data Insights",
          success: false,
          message: `Customer insights failed: ${customerResponse.status}`,
        };
      }
      setTestResults([...results]);

    } catch (error) {
      console.error('API test error:', error);
      results.push({
        test: "Error Handling",
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"}>
        {success ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-2">
        <Brain className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">AI Insights Test Page</h1>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          This page tests the AI Insights functionality including API endpoints and frontend components.
        </AlertDescription>
      </Alert>

      {/* API Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            API Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runAPITest} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running Tests...' : 'Run API Tests'}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">Test Results:</h4>
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.success)}
                    <div>
                      <div className="font-medium">{result.test}</div>
                      <div className="text-sm text-gray-600">{result.message}</div>
                      {result.details && (
                        <div className="text-xs text-gray-500 mt-1">
                          Details: {JSON.stringify(result.details)}
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(result.success)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights Widget Test */}
      <Card>
        <CardHeader>
          <CardTitle>AI Insights Widget - Sales Data</CardTitle>
        </CardHeader>
        <CardContent>
          <AIInsightsWidget
            dataType="sales_orders"
            data={sampleSalesData}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* AI Data Analysis Test */}
      <Card>
        <CardHeader>
          <CardTitle>AI Data Analysis - Customer Data</CardTitle>
        </CardHeader>
        <CardContent>
          <AIDataAnalysis
            dataType="customers"
            data={sampleCustomerData}
            title="Customer Analysis"
            description="Analyzing customer data for insights"
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Raw Data Display */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Sales Data ({sampleSalesData.length} records)</h4>
              <div className="text-sm text-gray-600 max-h-40 overflow-y-auto">
                <pre>{JSON.stringify(sampleSalesData, null, 2)}</pre>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Customer Data ({sampleCustomerData.length} records)</h4>
              <div className="text-sm text-gray-600 max-h-40 overflow-y-auto">
                <pre>{JSON.stringify(sampleCustomerData, null, 2)}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
