import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorAlert, ErrorMessage, WarningMessage, InfoMessage, SuccessMessage } from '@/components/ui/error-alert'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { extractErrorMessage, formatErrorMessage } from '@/lib/error-utils'

/**
 * Example component demonstrating the new user-friendly error handling system
 * This shows how to use the ErrorAlert components and error handling hooks
 */
export function ErrorHandlingExample() {
  const [showInlineError, setShowInlineError] = useState(false)
  const [showValidationError, setShowValidationError] = useState(false)
  const { handleError, handleSuccess, handleInfo, handleWarning } = useErrorHandler({
    context: 'ErrorHandlingExample'
  })

  // Simulate different types of errors
  const simulateNetworkError = () => {
    const error = new Error('Network Error: Failed to fetch data from server')
    handleError(error)
  }

  const simulateValidationError = () => {
    const error = new Error('Validation failed: Email field is required')
    handleError(error)
  }

  const simulateServerError = () => {
    const error = new Error('Internal Server Error: Database connection failed')
    handleError(error)
  }

  const simulateSuccess = () => {
    handleSuccess('Operation completed successfully!')
  }

  const simulateInfo = () => {
    handleInfo('This is an informational message about the current process.')
  }

  const simulateWarning = () => {
    handleWarning('Please review your data before proceeding.')
  }

  // Example of inline error display
  const showInlineErrorExample = () => {
    setShowInlineError(true)
    setTimeout(() => setShowInlineError(false), 5000)
  }

  const showValidationErrorExample = () => {
    setShowValidationError(true)
    setTimeout(() => setShowValidationError(false), 5000)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">
            User-Friendly Error Handling Examples
          </CardTitle>
          <p className="text-gray-600">
            This demonstrates the new error handling system with better UX and clearer messaging.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Toast Notification Examples */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Toast Notifications</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button onClick={simulateNetworkError} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                Network Error
              </Button>
              <Button onClick={simulateValidationError} variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                Validation Error
              </Button>
              <Button onClick={simulateServerError} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                Server Error
              </Button>
              <Button onClick={simulateSuccess} variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
                Success Message
              </Button>
              <Button onClick={simulateInfo} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                Info Message
              </Button>
              <Button onClick={simulateWarning} variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                Warning Message
              </Button>
            </div>
          </div>

          {/* Inline Error Examples */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Inline Error Messages</h3>
            <div className="space-y-3">
              <Button onClick={showInlineErrorExample} variant="outline">
                Show Inline Error
              </Button>
              <Button onClick={showValidationErrorExample} variant="outline">
                Show Validation Error
              </Button>
            </div>

            {/* Inline Error Display */}
            {showInlineError && (
              <ErrorMessage
                title="Connection Problem"
                message="Unable to connect to the server. Please check your internet connection and try again."
                dismissible
                onDismiss={() => setShowInlineError(false)}
                actions={
                  <Button size="sm" variant="outline" onClick={() => setShowInlineError(false)}>
                    Retry
                  </Button>
                }
              />
            )}

            {showValidationError && (
              <WarningMessage
                title="Please Check Your Input"
                message="Some required fields are missing or contain invalid data. Please review and correct the highlighted fields."
                dismissible
                onDismiss={() => setShowValidationError(false)}
              />
            )}
          </div>

          {/* Different Error Types */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Error Alert Variants</h3>
            <div className="grid gap-4">
              <ErrorMessage
                title="Error"
                message="This is an error message with helpful context and suggestions."
                actions={
                  <Button size="sm" variant="outline">
                    Learn More
                  </Button>
                }
              />
              
              <WarningMessage
                title="Warning"
                message="This is a warning message that alerts users to potential issues."
              />
              
              <InfoMessage
                title="Information"
                message="This is an informational message providing helpful context."
              />
              
              <SuccessMessage
                title="Success"
                message="This is a success message confirming that an operation completed successfully."
              />
            </div>
          </div>

          {/* Error Utility Examples */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Error Message Formatting</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Before:</strong> "Error: Validation failed: Email field is required"
              </p>
              <p className="text-sm text-gray-600">
                <strong>After:</strong> {formatErrorMessage("Error: Validation failed: Email field is required")}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Before:</strong> "Network Error: Failed to fetch data from server"
              </p>
              <p className="text-sm text-gray-600">
                <strong>After:</strong> {formatErrorMessage("Network Error: Failed to fetch data from server")}
              </p>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How to Use</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>For Toast Notifications:</strong> Use the <code>useErrorHandler</code> hook</p>
              <p><strong>For Inline Messages:</strong> Use <code>ErrorAlert</code> components</p>
              <p><strong>For Form Validation:</strong> Use the enhanced <code>FormMessage</code> component</p>
              <p><strong>For Error Boundaries:</strong> Wrap components with the updated <code>ErrorBoundary</code></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
