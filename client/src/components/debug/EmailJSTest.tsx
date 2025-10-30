import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Bug } from 'lucide-react';
import { emailService } from '@/lib/email-service';

export function EmailJSTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testEmailJS = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing EmailJS service...');
      
      const testResult = await emailService.sendSimpleEmail(
        'test@example.com',
        'Test User',
        'Test Email from ERP',
        'This is a test email to verify EmailJS integration is working correctly.'
      );

      console.log('EmailJS test result:', testResult);
      setResult({
        success: testResult.success,
        message: testResult.message,
        details: testResult
      });
    } catch (error) {
      console.error('EmailJS test error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testEmailWithPdf = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing EmailJS with PDF...');
      
      const testResult = await emailService.sendEmailWithPdfLink(
        'test@example.com',
        'Test User',
        'invoice',
        'TEST-001',
        'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgovVHlwZSAvUGFnZQo+PgpzdHJlYW0KdGVzdCBwZGYKZW5kc3RyZWFtCmVuZG9iagoKMyAwIG9iago8PAovTGVuZ3RoIDQKPj4Kc3RyZWFtCjEyMzQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE2NwolJUVPRgo=',
        'Test PDF attachment'
      );

      console.log('EmailJS with PDF test result:', testResult);
      setResult({
        success: testResult.success,
        message: testResult.message,
        details: testResult
      });
    } catch (error) {
      console.error('EmailJS with PDF test error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            EmailJS Integration Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will test the EmailJS integration by sending actual test emails.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button 
              onClick={testEmailJS} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? 'Testing...' : 'Test Simple Email'}
            </Button>
            
            <Button 
              onClick={testEmailWithPdf} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? 'Testing...' : 'Test Email with PDF'}
            </Button>
          </div>

          {result && (
            <div className="mt-4">
              <div className={`flex items-center gap-2 p-4 rounded-lg border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <h4 className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? 'Success!' : 'Error!'}
                  </h4>
                  <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    {result.message}
                  </p>
                </div>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                  View Details
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
