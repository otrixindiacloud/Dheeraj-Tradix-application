import { useToast } from "@/hooks/use-toast"
import { extractErrorMessage, formatErrorMessage, getErrorVariant, getErrorTitle } from "@/lib/error-utils"

export interface UseErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  context?: string
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { toast } = useToast()
  const { showToast = true, logError = true, context } = options

  const handleError = (error: unknown, customMessage?: string) => {
    const message = customMessage || extractErrorMessage(error)
    const variant = getErrorVariant(error)
    const title = getErrorTitle(error)
    const formattedMessage = formatErrorMessage(message, variant)

    if (logError) {
      console.error(`[${context || 'ErrorHandler'}]`, error)
    }

    if (showToast) {
      toast({
        title: title,
        description: formattedMessage,
        variant: variant === 'error' ? 'destructive' : variant,
      })
    }

    return {
      message: formattedMessage,
      title,
      variant,
      originalError: error
    }
  }

  const handleSuccess = (message: string, title: string = 'Success') => {
    toast({
      title: title,
      description: message,
      variant: 'success',
    })
  }

  const handleInfo = (message: string, title: string = 'Info') => {
    toast({
      title: title,
      description: message,
      variant: 'info',
    })
  }

  const handleWarning = (message: string, title: string = 'Warning') => {
    toast({
      title: title,
      description: message,
      variant: 'warning',
    })
  }

  return {
    handleError,
    handleSuccess,
    handleInfo,
    handleWarning,
  }
}

// Convenience hook for common error handling patterns
export function useApiErrorHandler() {
  return useErrorHandler({
    context: 'API',
    showToast: true,
    logError: true
  })
}

export function useFormErrorHandler() {
  return useErrorHandler({
    context: 'Form',
    showToast: false, // Form errors are usually shown inline
    logError: false
  })
}
