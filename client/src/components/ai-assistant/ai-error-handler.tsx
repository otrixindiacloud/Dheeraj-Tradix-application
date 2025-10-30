import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, Lightbulb, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIErrorHandlerProps {
  error: string;
  context?: any;
  onFixApplied?: (fix: string) => void;
  className?: string;
  showDetails?: boolean;
}

interface ErrorAnalysis {
  explanation: string;
  suggestedFixes: string[];
  preventionTips: string[];
  severity: 'low' | 'medium' | 'high';
  category: string;
}

export default function AIErrorHandler({
  error,
  context = {},
  onFixApplied,
  className,
  showDetails = true
}: AIErrorHandlerProps) {
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<Set<number>>(new Set());
  const [showPrevention, setShowPrevention] = useState(false);

  const analyzeError = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/error-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error,
          context
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysis({
          ...result,
          severity: determineSeverity(error, result.explanation),
          category: categorizeError(error)
        });
      }
    } catch (error) {
      console.error('Error analyzing error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const determineSeverity = (error: string, explanation: string): 'low' | 'medium' | 'high' => {
    const highSeverityKeywords = ['critical', 'fatal', 'crash', 'data loss', 'security'];
    const mediumSeverityKeywords = ['warning', 'validation', 'format', 'missing'];
    
    const text = (error + ' ' + explanation).toLowerCase();
    
    if (highSeverityKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    } else if (mediumSeverityKeywords.some(keyword => text.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  };

  const categorizeError = (error: string): string => {
    const categories = {
      'validation': ['required', 'invalid', 'format', 'validation'],
      'network': ['timeout', 'connection', 'network', 'fetch'],
      'permission': ['unauthorized', 'forbidden', 'access', 'permission'],
      'data': ['not found', 'missing', 'duplicate', 'constraint'],
      'system': ['internal', 'server', 'database', 'system']
    };

    const lowerError = error.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerError.includes(keyword))) {
        return category;
      }
    }
    return 'general';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const applyFix = (fix: string, index: number) => {
    setAppliedFixes(prev => new Set([...prev, index]));
    onFixApplied?.(fix);
  };

  // Auto-analyze on mount
  React.useEffect(() => {
    if (error && !analysis) {
      analyzeError();
    }
  }, [error]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Error Analysis
            </CardTitle>
            <CardDescription>
              AI-powered error diagnosis and solutions
            </CardDescription>
          </div>
          {!analysis && (
            <Button
              onClick={analyzeError}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Analyze'
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Display */}
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <code className="text-sm font-mono">{error}</code>
          </AlertDescription>
        </Alert>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4">
            {/* Error Info */}
            <div className="flex items-center gap-2">
              <Badge className={getSeverityColor(analysis.severity)}>
                {getSeverityIcon(analysis.severity)}
                <span className="ml-1 capitalize">{analysis.severity} Severity</span>
              </Badge>
              <Badge variant="outline" className="capitalize">
                {analysis.category}
              </Badge>
            </div>

            {/* Explanation */}
            {showDetails && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">What went wrong?</h4>
                <p className="text-blue-800 text-sm">{analysis.explanation}</p>
              </div>
            )}

            {/* Suggested Fixes */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
                Suggested Solutions
              </h4>
              <div className="space-y-2">
                {analysis.suggestedFixes.map((fix, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 border rounded-md transition-colors",
                      appliedFixes.has(index)
                        ? "bg-green-50 border-green-200"
                        : "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-gray-800 flex-1">{fix}</p>
                      <Button
                        size="sm"
                        variant={appliedFixes.has(index) ? "default" : "outline"}
                        onClick={() => applyFix(fix, index)}
                        disabled={appliedFixes.has(index)}
                        className="shrink-0"
                      >
                        {appliedFixes.has(index) ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Applied
                          </>
                        ) : (
                          'Apply Fix'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prevention Tips */}
            {analysis.preventionTips && analysis.preventionTips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Prevention Tips
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrevention(!showPrevention)}
                  >
                    {showPrevention ? 'Hide' : 'Show'} Tips
                  </Button>
                </div>
                
                {showPrevention && (
                  <div className="space-y-2">
                    {analysis.preventionTips.map((tip, index) => (
                      <div
                        key={index}
                        className="p-3 bg-green-50 border border-green-200 rounded-md"
                      >
                        <p className="text-sm text-green-800">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Additional Help */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h4 className="font-medium text-gray-900 mb-2">Need more help?</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Documentation
                </Button>
                <Button variant="outline" size="sm">
                  Contact Support
                </Button>
                <Button variant="outline" size="sm" onClick={analyzeError}>
                  Re-analyze Error
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Analyzing error...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
