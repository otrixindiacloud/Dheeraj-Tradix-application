import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAutofillProps {
  value: string;
  onChange: (value: string) => void;
  fieldType: string;
  formType?: string;
  currentData?: any;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface Suggestion {
  text: string;
  confidence: number;
}

export default function AIAutofill({
  value,
  onChange,
  fieldType,
  formType = 'general',
  currentData = {},
  placeholder = 'Type to get AI suggestions...',
  className,
  disabled = false
}: AIAutofillProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autofillValue, setAutofillValue] = useState('');
  const [confidence, setConfidence] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced suggestion fetching
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length > 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions();
      }, 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fieldType, formType]);

  const fetchSuggestions = async () => {
    if (disabled) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/suggestions/field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldType,
          context: {
            formType,
            currentData,
            currentValue: value
          }
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          const suggestionList = data.suggestions.map((s: string, index: number) => ({
            text: s,
            confidence: 0.9 - (index * 0.1) // Higher confidence for first suggestions
          }));
          setSuggestions(suggestionList);
          setShowSuggestions(true);
        } else {
          console.warn('Received non-JSON response from AI suggestions API');
          setSuggestions([]);
        }
      } else {
        console.warn('AI suggestions API returned error:', response.status);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    setAutofillValue(suggestion.text);
    setConfidence(suggestion.confidence);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setAutofillValue(newValue);
    setConfidence(0);
  };

  const handleAIEnhance = async () => {
    if (disabled || !value) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/autofill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formType,
          fieldName: fieldType,
          currentData: {
            ...currentData,
            [fieldType]: value
          }
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.autofillValue && data.confidence > 0.5) {
            onChange(data.autofillValue);
            setAutofillValue(data.autofillValue);
            setConfidence(data.confidence);
          }
        } else {
          console.warn('Received non-JSON response from AI autofill API');
        }
      } else {
        console.warn('AI autofill API returned error:', response.status);
      }
    } catch (error) {
      console.error('Error enhancing with AI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearValue = () => {
    onChange('');
    setAutofillValue('');
    setConfidence(0);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(
            "pr-20",
            confidence > 0.7 && "border-green-500 bg-green-50",
            confidence > 0.5 && confidence <= 0.7 && "border-yellow-500 bg-yellow-50",
            className
          )}
          disabled={disabled}
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          
          {!isLoading && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAIEnhance}
              className="h-6 w-6 p-0 hover:bg-blue-100"
              disabled={disabled}
            >
              <Sparkles className="h-3 w-3 text-blue-600" />
            </Button>
          )}
          
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearValue}
              className="h-6 w-6 p-0 hover:bg-red-100"
              disabled={disabled}
            >
              <X className="h-3 w-3 text-red-600" />
            </Button>
          )}
        </div>
      </div>

      {/* AI Confidence Indicator */}
      {confidence > 0 && (
        <div className="mt-1 flex items-center gap-2">
          <Badge 
            variant={confidence > 0.7 ? "default" : confidence > 0.5 ? "secondary" : "outline"}
            className="text-xs"
          >
            AI Enhanced {Math.round(confidence * 100)}%
          </Badge>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm">{suggestion.text}</span>
                <Badge variant="outline" className="text-xs">
                  {Math.round(suggestion.confidence * 100)}%
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
