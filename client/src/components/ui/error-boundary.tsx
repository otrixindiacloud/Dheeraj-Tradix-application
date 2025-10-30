import React, { Component, ReactNode } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="max-w-md w-full border-amber-200 bg-amber-50 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
              <CardTitle className="text-xl text-amber-800">
                Oops! Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="space-y-2">
                <p className="text-amber-700 text-sm leading-relaxed">
                  We encountered an unexpected issue while loading this page. 
                  Don't worry, this usually resolves itself with a simple refresh.
                </p>
                <p className="text-amber-600 text-xs">
                  If the problem persists, please contact support.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={this.handleReset}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100 font-medium py-2.5"
                >
                  Go to Homepage
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="text-sm font-medium text-amber-800 cursor-pointer hover:text-amber-900">
                    Technical Details (Development Mode)
                  </summary>
                  <div className="mt-3 p-3 bg-amber-100 rounded-lg">
                    <pre className="text-xs text-amber-700 overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}