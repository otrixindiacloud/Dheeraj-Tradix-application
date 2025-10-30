import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Eye, 
  Download,
  Bot,
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentAutomationProps {
  documentType: 'receipt' | 'return' | 'issue' | 'issue-return';
  onDataExtracted: (data: any) => void;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export default function DocumentAutomation({ 
  documentType, 
  onDataExtracted, 
  onClose,
  trigger 
}: DocumentAutomationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  const documentTypeLabels = {
    receipt: 'Material Receipt',
    return: 'Receipt Return',
    issue: 'Material Issue',
    'issue-return': 'Issue Return'
  };

  const documentTypeColors = {
    receipt: 'bg-green-100 text-green-800 border-green-200',
    return: 'bg-orange-100 text-orange-800 border-orange-200',
    issue: 'bg-blue-100 text-blue-800 border-blue-200',
    'issue-return': 'bg-purple-100 text-purple-800 border-purple-200'
  };

  const buttonLabels = {
    receipt: 'Upload Receipt Document',
    return: 'Upload Return Document',
    issue: 'Upload Issue Document',
    'issue-return': 'Upload Issue Return Document'
  };

  const initializeSteps = (): ProcessingStep[] => [
    {
      id: 'upload',
      title: 'Document Upload',
      description: 'Uploading PDF document to secure server',
      status: 'pending'
    },
    {
      id: 'extract',
      title: 'Text Extraction',
      description: 'Extracting text content using advanced PDF parser',
      status: 'pending'
    },
    {
      id: 'parse',
      title: 'AI Analysis',
      description: 'Using advanced AI to parse and structure data intelligently',
      status: 'pending'
    },
    {
      id: 'validate',
      title: 'Data Validation',
      description: 'Validating and enhancing extracted information for accuracy',
      status: 'pending'
    },
    {
      id: 'complete',
      title: 'Processing Complete',
      description: 'Document processed successfully - data ready for use',
      status: 'pending'
    }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF file.',
          variant: 'destructive'
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 10MB.',
          variant: 'destructive'
        });
        return;
      }

      setUploadedFile(file);
      setError(null);
      setExtractedData(null);
      setProcessingSteps(initializeSteps());
      setCurrentStep(0);
    }
  };

  const processDocument = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setError(null);
    setProcessingSteps(initializeSteps());
    setCurrentStep(0);

    try {
      // Step 1: Upload
      updateStepStatus(0, 'processing');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate upload
      updateStepStatus(0, 'completed');
      setCurrentStep(1);

      // Step 2: Extract text
      updateStepStatus(1, 'processing');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate extraction
      updateStepStatus(1, 'completed');
      setCurrentStep(2);

      // Step 3: AI Analysis
      updateStepStatus(2, 'processing');
      
      const formData = new FormData();
      formData.append('document', uploadedFile);

      const endpoint = `/api/ai-document-processing/extract-${documentType === 'issue-return' ? 'issue-return' : documentType}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process document');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Document processing failed');
      }

      updateStepStatus(2, 'completed');
      setCurrentStep(3);

      // Step 4: Validate data
      updateStepStatus(3, 'processing');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate validation
      updateStepStatus(3, 'completed');
      setCurrentStep(4);

      // Step 5: Complete
      updateStepStatus(4, 'completed');
      
      setExtractedData(result.data);
      
      toast({
        title: 'Document processed successfully',
        description: `Extracted ${result.data.items?.length || 0} items from the document.`,
      });

    } catch (error) {
      console.error('Error processing document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process document';
      setError(errorMessage);
      
      // Mark current step as error
      const currentStepIndex = currentStep;
      updateStepStatus(currentStepIndex, 'error', errorMessage);
      
      toast({
        title: 'Processing failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStepStatus = (stepIndex: number, status: ProcessingStep['status'], error?: string) => {
    setProcessingSteps(prev => prev.map((step, index) => 
      index === stepIndex 
        ? { ...step, status, error }
        : step
    ));
  };

  const handleUseData = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      setIsOpen(false);
      if (onClose) onClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setUploadedFile(null);
    setExtractedData(null);
    setError(null);
    setProcessingSteps([]);
    setCurrentStep(0);
    if (onClose) onClose();
  };

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const progress = processingSteps.length > 0 ? ((currentStep + 1) / processingSteps.length) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
            <Bot className="h-4 w-4 mr-2" />
            {buttonLabels[documentType]}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Document Processing
          </DialogTitle>
          <DialogDescription>
            Upload a {documentTypeLabels[documentType]} document and let AI extract the data automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Type Badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className={`px-4 py-2 text-sm font-medium ${documentTypeColors[documentType]}`}>
              {documentTypeLabels[documentType]}
            </Badge>
          </div>

          {/* File Upload Section */}
          {!uploadedFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Document</CardTitle>
                <CardDescription>
                  Select a PDF file to process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Choose PDF file</p>
                    <p className="text-sm text-gray-500">or drag and drop here</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select File
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Steps */}
          {uploadedFile && processingSteps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Processing Steps</CardTitle>
                <CardDescription>
                  AI is analyzing your document step by step
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    {processingSteps.map((step, index) => (
                      <div
                        key={step.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          step.status === 'completed' 
                            ? 'bg-green-50 border-green-200' 
                            : step.status === 'processing'
                            ? 'bg-blue-50 border-blue-200'
                            : step.status === 'error'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        {getStepIcon(step)}
                        <div className="flex-1">
                          <p className={`font-medium ${
                            step.status === 'completed' 
                              ? 'text-green-800' 
                              : step.status === 'processing'
                              ? 'text-blue-800'
                              : step.status === 'error'
                              ? 'text-red-800'
                              : 'text-gray-600'
                          }`}>
                            {step.title}
                          </p>
                          <p className={`text-sm ${
                            step.status === 'completed' 
                              ? 'text-green-600' 
                              : step.status === 'processing'
                              ? 'text-blue-600'
                              : step.status === 'error'
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}>
                            {step.error || step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Extracted Data Preview
                </CardTitle>
                <CardDescription>
                  Review the extracted information before using it
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Header Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Document Number</label>
                      <p className="text-sm">{extractedData.documentNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date</label>
                      <p className="text-sm">{extractedData.documentDate || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Supplier</label>
                      <p className="text-sm">{extractedData.supplierName || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Customer</label>
                      <p className="text-sm">{extractedData.customerName || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Items Found</label>
                    <p className="text-sm">{extractedData.items?.length || 0} items extracted</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleUseData} className="flex-1">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Use This Data
                    </Button>
                    <Button variant="outline" onClick={() => setExtractedData(null)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Process Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {uploadedFile && !extractedData && !isProcessing && (
              <Button onClick={processDocument} className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Bot className="h-4 w-4 mr-2" />
                Start AI Processing
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
