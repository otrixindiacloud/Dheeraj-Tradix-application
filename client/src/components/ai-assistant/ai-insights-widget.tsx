import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb, 
  BarChart3,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightsWidgetProps {
  dataType: 'dashboard' | 'sales' | 'inventory' | 'customers' | 'enquiries';
  data: any[];
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface Insight {
  id: string;
  type: 'trend' | 'alert' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  value?: string | number;
  change?: number;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  category: string;
}

export default function AIInsightsWidget({
  dataType,
  data,
  className,
  autoRefresh = true,
  refreshInterval = 300000 // 5 minutes
}: AIInsightsWidgetProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const generateInsights = async () => {
    if (!data || data.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/insights/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType,
          data: data.slice(0, 100) // Limit data size
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const parsedInsights = parseInsights(result.insights, dataType);
        setInsights(parsedInsights);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseInsights = (insightsText: string, type: string): Insight[] => {
    const insights: Insight[] = [];
    const sentences = insightsText.split('.').filter(s => s.trim());
    
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) return;

      const insight: Insight = {
        id: `${type}-${index}`,
        type: determineInsightType(trimmed),
        title: generateTitle(trimmed, type),
        description: trimmed,
        priority: determinePriority(trimmed),
        actionable: isActionable(trimmed),
        category: type
      };

      // Extract value and change if present
      const valueMatch = trimmed.match(/(\d+(?:\.\d+)?%?)/);
      if (valueMatch) {
        insight.value = valueMatch[1];
      }

      const changeMatch = trimmed.match(/(increased|decreased|up|down|rise|fall)/i);
      if (changeMatch) {
        insight.change = changeMatch[1].toLowerCase().includes('increased') || 
                       changeMatch[1].toLowerCase().includes('up') || 
                       changeMatch[1].toLowerCase().includes('rise') ? 1 : -1;
      }

      insights.push(insight);
    });

    return insights.slice(0, 8); // Limit to 8 insights
  };

  const determineInsightType = (text: string): Insight['type'] => {
    const lower = text.toLowerCase();
    if (lower.includes('trend') || lower.includes('increasing') || lower.includes('decreasing')) {
      return 'trend';
    } else if (lower.includes('alert') || lower.includes('warning') || lower.includes('concern')) {
      return 'alert';
    } else if (lower.includes('recommend') || lower.includes('suggest') || lower.includes('should')) {
      return 'recommendation';
    } else if (lower.includes('achievement') || lower.includes('success') || lower.includes('good')) {
      return 'achievement';
    }
    return 'trend';
  };

  const determinePriority = (text: string): Insight['priority'] => {
    const lower = text.toLowerCase();
    if (lower.includes('critical') || lower.includes('urgent') || lower.includes('immediate')) {
      return 'high';
    } else if (lower.includes('important') || lower.includes('significant')) {
      return 'medium';
    }
    return 'low';
  };

  const isActionable = (text: string): boolean => {
    const lower = text.toLowerCase();
    return lower.includes('should') || lower.includes('recommend') || 
           lower.includes('consider') || lower.includes('suggest');
  };

  const generateTitle = (text: string, type: string): string => {
    const words = text.split(' ').slice(0, 6);
    return words.join(' ') + (words.length < text.split(' ').length ? '...' : '');
  };

  const toggleInsight = (insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'trend': return <TrendingUp className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4" />;
      case 'achievement': return <BarChart3 className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const getInsightColor = (type: Insight['type'], priority: Insight['priority']) => {
    if (type === 'alert' && priority === 'high') return 'text-red-600 bg-red-100 border-red-200';
    if (type === 'alert' && priority === 'medium') return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    if (type === 'achievement') return 'text-green-600 bg-green-100 border-green-200';
    if (type === 'recommendation') return 'text-blue-600 bg-blue-100 border-blue-200';
    return 'text-gray-600 bg-gray-100 border-gray-200';
  };

  const getPriorityColor = (priority: Insight['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && data && data.length > 0) {
      generateInsights();
      const interval = setInterval(generateInsights, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [data, autoRefresh, refreshInterval]);

  const displayedInsights = showAll ? insights : insights.slice(0, 4);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              AI Insights
            </CardTitle>
            <CardDescription>
              Intelligent analysis of your {dataType} data
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={generateInsights}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && insights.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-sm text-muted-foreground">Generating insights...</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-sm text-muted-foreground">No insights available</p>
            <Button onClick={generateInsights} className="mt-2" size="sm">
              Generate Insights
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedInsights.map((insight) => (
              <div
                key={insight.id}
                className={cn(
                  "p-3 border rounded-lg transition-all cursor-pointer",
                  getInsightColor(insight.type, insight.priority),
                  expandedInsights.has(insight.id) && "shadow-md"
                )}
                onClick={() => toggleInsight(insight.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {insight.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          <div className={cn("w-2 h-2 rounded-full", getPriorityColor(insight.priority))} />
                          {insight.actionable && (
                            <Badge variant="outline" className="text-xs">
                              Actionable
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {expandedInsights.has(insight.id) && (
                        <p className="text-xs opacity-90 mt-2 leading-relaxed">
                          {insight.description}
                        </p>
                      )}
                      
                      {insight.value && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-medium">{insight.value}</span>
                          {insight.change !== undefined && (
                            <div className="flex items-center gap-1">
                              {insight.change > 0 ? (
                                <TrendingUp className="h-3 w-3 text-green-600" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {expandedInsights.has(insight.id) ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {insights.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="w-full mt-3"
              >
                {showAll ? 'Show Less' : `Show All ${insights.length} Insights`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}