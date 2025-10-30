import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Brain, TrendingUp, AlertTriangle, Lightbulb, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIDataAnalysisProps {
  dataType: string;
  data: any[];
  title?: string;
  description?: string;
  className?: string;
  onInsightClick?: (insight: string) => void;
}

interface AnalysisResult {
  insights: string;
  trends?: string[];
  recommendations?: string[];
  warnings?: string[];
}

export default function AIDataAnalysis({
  dataType,
  data,
  title = 'AI Data Analysis',
  description = 'Get intelligent insights from your data',
  className,
  onInsightClick
}: AIDataAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeData = async () => {
    if (!data || data.length === 0) {
      setError('No data available for analysis');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/insights/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType,
          data: data.slice(0, 50) // Limit data size for API
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysis({
          insights: result.insights,
          trends: extractTrends(result.insights),
          recommendations: extractRecommendations(result.insights),
          warnings: extractWarnings(result.insights)
        });
      } else {
        setError('Failed to analyze data');
      }
    } catch (error) {
      console.error('Error analyzing data:', error);
      setError('Unable to connect to analysis service');
    } finally {
      setIsLoading(false);
    }
  };

  const extractTrends = (insights: string): string[] => {
    const trendKeywords = ['increasing', 'decreasing', 'trend', 'pattern', 'growth', 'decline', 'rise', 'fall'];
    const sentences = insights.split('.').filter(s => s.trim());
    return sentences.filter(sentence => 
      trendKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    ).slice(0, 3);
  };

  const extractRecommendations = (insights: string): string[] => {
    const recKeywords = ['recommend', 'suggest', 'should', 'consider', 'improve', 'optimize'];
    const sentences = insights.split('.').filter(s => s.trim());
    return sentences.filter(sentence => 
      recKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    ).slice(0, 3);
  };

  const extractWarnings = (insights: string): string[] => {
    const warningKeywords = ['warning', 'alert', 'risk', 'concern', 'issue', 'problem'];
    const sentences = insights.split('.').filter(s => s.trim());
    return sentences.filter(sentence => 
      warningKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    ).slice(0, 2);
  };

  const getDataSummary = () => {
    if (!data || data.length === 0) return 'No data available';
    
    const total = data.length;
    const hasNumericFields = data.some(item => 
      Object.values(item).some(value => typeof value === 'number')
    );
    
    return `${total} ${dataType} records${hasNumericFields ? ' with numeric data' : ''}`;
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            onClick={analyzeData}
            disabled={isLoading || !data || data.length === 0}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            {isLoading ? 'Analyzing...' : 'Analyze Data'}
          </Button>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{getDataSummary()}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Analysis Error</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-4">
            {/* Main Insights */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Key Insights
              </h4>
              <p className="text-blue-800 text-sm leading-relaxed">
                {analysis.insights}
              </p>
            </div>

            {/* Trends */}
            {analysis.trends && analysis.trends.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Trends & Patterns
                </h4>
                <div className="space-y-2">
                  {analysis.trends.map((trend, index) => (
                    <div
                      key={index}
                      className="p-3 bg-green-50 border border-green-200 rounded-md cursor-pointer hover:bg-green-100 transition-colors"
                      onClick={() => onInsightClick?.(trend)}
                    >
                      <p className="text-green-800 text-sm">{trend}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                  Recommendations
                </h4>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="p-3 bg-yellow-50 border border-yellow-200 rounded-md cursor-pointer hover:bg-yellow-100 transition-colors"
                      onClick={() => onInsightClick?.(rec)}
                    >
                      <p className="text-yellow-800 text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {analysis.warnings && analysis.warnings.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Warnings & Concerns
                </h4>
                <div className="space-y-2">
                  {analysis.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="p-3 bg-red-50 border border-red-200 rounded-md cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => onInsightClick?.(warning)}
                    >
                      <p className="text-red-800 text-sm">{warning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!analysis && !error && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Click "Analyze Data" to get AI-powered insights</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
