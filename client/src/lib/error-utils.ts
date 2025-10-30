/**
 * Utility functions for consistent error message formatting and handling
 */

export interface ErrorInfo {
  message: string
  code?: string
  details?: string
  suggestions?: string[]
}

/**
 * Common error types and their user-friendly messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Unable to connect to the server. Please check your internet connection and try again.",
  SERVER_ERROR: "Something went wrong on our end. Please try again in a few moments.",
  VALIDATION_ERROR: "Please check your input and try again.",
  NOT_FOUND: "The requested item could not be found.",
  UNAUTHORIZED: "You don't have permission to perform this action.",
  FORBIDDEN: "Access denied. Please contact your administrator.",
  TIMEOUT: "The request took too long to complete. Please try again.",
  UNKNOWN: "An unexpected error occurred. Please try again."
} as const

/**
 * Maps HTTP status codes to user-friendly error messages
 */
export const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check your input and try again.",
  401: "Please log in to continue.",
  403: "You don't have permission to perform this action.",
  404: "The requested item could not be found.",
  409: "This action conflicts with existing data. Please refresh and try again.",
  422: "Please check your input and try again.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again later.",
  502: "Service temporarily unavailable. Please try again later.",
  503: "Service temporarily unavailable. Please try again later.",
  504: "Request timeout. Please try again later."
}

/**
 * Extracts user-friendly error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }

    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES.TIMEOUT
    }

    if (error.message.includes('validation') || error.message.includes('required')) {
      return ERROR_MESSAGES.VALIDATION_ERROR
    }

    return error.message
  }

  // Handle API response errors
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as any
    const status = apiError.response?.status
    const message = apiError.response?.data?.message

    if (status && HTTP_ERROR_MESSAGES[status]) {
      return HTTP_ERROR_MESSAGES[status]
    }

    if (message) {
      return message
    }
  }

  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as any).message
  }

  return ERROR_MESSAGES.UNKNOWN
}

/**
 * Creates a structured error info object
 */
export function createErrorInfo(error: unknown, context?: string): ErrorInfo {
  const message = extractErrorMessage(error)
  
  let suggestions: string[] = []
  
  // Add contextual suggestions based on error type
  if (message.includes('network') || message.includes('connection')) {
    suggestions = [
      "Check your internet connection",
      "Try refreshing the page",
      "Contact support if the problem persists"
    ]
  } else if (message.includes('permission') || message.includes('unauthorized')) {
    suggestions = [
      "Log out and log back in",
      "Contact your administrator for access",
      "Check if your account has the required permissions"
    ]
  } else if (message.includes('validation') || message.includes('required')) {
    suggestions = [
      "Check all required fields are filled",
      "Verify the format of your input",
      "Try using a different value"
    ]
  } else if (message.includes('not found')) {
    suggestions = [
      "Check if the item still exists",
      "Try refreshing the page",
      "Navigate back to the main page"
    ]
  }

  return {
    message,
    code: context,
    suggestions
  }
}

/**
 * Formats error message for display with emoji and better readability
 */
export function formatErrorMessage(message: string, type: 'error' | 'warning' | 'info' = 'error'): string {
  const emoji = {
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️'
  }[type]

  // Remove technical jargon and make more user-friendly
  let friendlyMessage = message
    .replace(/Error:/gi, '')
    .replace(/Failed to/gi, 'Unable to')
    .replace(/Invalid/gi, 'Please check')
    .replace(/Required/gi, 'Please provide')
    .replace(/Validation/gi, 'Input')
    .replace(/Network/gi, 'Connection')
    .replace(/Server/gi, 'System')
    .replace(/Database/gi, 'Data')
    .replace(/API/gi, 'Service')
    .replace(/HTTP \d+/g, '')
    .replace(/Status: \d+/g, '')
    .trim()

  // Add emoji if not already present
  if (!friendlyMessage.startsWith('⚠️') && !friendlyMessage.startsWith('ℹ️') && !friendlyMessage.startsWith('✅')) {
    friendlyMessage = `${emoji} ${friendlyMessage}`
  }

  return friendlyMessage
}

/**
 * Determines the appropriate error variant based on error type
 */
export function getErrorVariant(error: unknown): 'error' | 'warning' | 'info' {
  const message = extractErrorMessage(error).toLowerCase()
  
  if (message.includes('warning') || message.includes('caution')) {
    return 'warning'
  }
  
  if (message.includes('info') || message.includes('note')) {
    return 'info'
  }
  
  return 'error'
}

/**
 * Creates a user-friendly error title based on error type
 */
export function getErrorTitle(error: unknown): string {
  const message = extractErrorMessage(error).toLowerCase()
  
  if (message.includes('network') || message.includes('connection')) {
    return 'Connection Problem'
  }
  
  if (message.includes('permission') || message.includes('unauthorized')) {
    return 'Access Denied'
  }
  
  if (message.includes('validation') || message.includes('required')) {
    return 'Please Check Your Input'
  }
  
  if (message.includes('not found')) {
    return 'Item Not Found'
  }
  
  if (message.includes('timeout')) {
    return 'Request Timeout'
  }
  
  return 'Something Went Wrong'
}
