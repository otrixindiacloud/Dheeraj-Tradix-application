import * as React from "react"
import { AlertTriangle, X, Info, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ErrorAlertProps {
  title?: string
  message: string
  variant?: "error" | "warning" | "info" | "success"
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
  showIcon?: boolean
  actions?: React.ReactNode
}

const alertConfig = {
  error: {
    icon: AlertTriangle,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-900",
    iconColor: "text-red-600",
    titleColor: "text-red-800"
  },
  warning: {
    icon: AlertCircle,
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-900",
    iconColor: "text-amber-600",
    titleColor: "text-amber-800"
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-900",
    iconColor: "text-blue-600",
    titleColor: "text-blue-800"
  },
  success: {
    icon: CheckCircle,
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-900",
    iconColor: "text-green-600",
    titleColor: "text-green-800"
  }
}

export function ErrorAlert({
  title,
  message,
  variant = "error",
  dismissible = false,
  onDismiss,
  className,
  showIcon = true,
  actions
}: ErrorAlertProps) {
  const config = alertConfig[variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-sm",
        config.bgColor,
        config.borderColor,
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.iconColor)} />
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn("text-sm font-semibold mb-1", config.titleColor)}>
              {title}
            </h4>
          )}
          <p className={cn("text-sm", config.textColor)}>
            {message}
          </p>
          {actions && (
            <div className="mt-3 flex gap-2">
              {actions}
            </div>
          )}
        </div>
        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className={cn(
              "h-6 w-6 p-0 hover:bg-transparent",
              config.textColor,
              "hover:opacity-70"
            )}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// Convenience components for common use cases
export function ErrorMessage({ message, ...props }: Omit<ErrorAlertProps, 'variant'>) {
  return <ErrorAlert message={message} variant="error" {...props} />
}

export function WarningMessage({ message, ...props }: Omit<ErrorAlertProps, 'variant'>) {
  return <ErrorAlert message={message} variant="warning" {...props} />
}

export function InfoMessage({ message, ...props }: Omit<ErrorAlertProps, 'variant'>) {
  return <ErrorAlert message={message} variant="info" {...props} />
}

export function SuccessMessage({ message, ...props }: Omit<ErrorAlertProps, 'variant'>) {
  return <ErrorAlert message={message} variant="success" {...props} />
}
