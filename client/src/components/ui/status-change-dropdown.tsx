import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, CheckCircle, Clock, XCircle, AlertTriangle, FileText, TrendingUp } from "lucide-react";

// Status configuration with icons and colors
const statusConfig = {
  "Draft": { 
    icon: FileText, 
    color: "bg-gray-100 text-gray-800 border-gray-300",
    badgeColor: "bg-gray-100 text-gray-800"
  },
  "Pending Approval": { 
    icon: Clock, 
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    badgeColor: "bg-yellow-100 text-yellow-800"
  },
  "Approved": { 
    icon: CheckCircle, 
    color: "bg-green-100 text-green-800 border-green-300",
    badgeColor: "bg-green-100 text-green-800"
  },
  "Rejected": { 
    icon: XCircle, 
    color: "bg-red-100 text-red-800 border-red-300",
    badgeColor: "bg-red-100 text-red-800"
  },
  "Processing": { 
    icon: TrendingUp, 
    color: "bg-blue-100 text-blue-800 border-blue-300",
    badgeColor: "bg-blue-100 text-blue-800"
  },
  "Completed": { 
    icon: CheckCircle, 
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    badgeColor: "bg-emerald-100 text-emerald-800"
  },
  "Cancelled": { 
    icon: XCircle, 
    color: "bg-red-100 text-red-800 border-red-300",
    badgeColor: "bg-red-100 text-red-800"
  },
};

const statusOptions = [
  "Draft",
  "Pending Approval", 
  "Approved",
  "Rejected",
  "Processing",
  "Completed",
  "Cancelled"
];

interface StatusChangeDropdownProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "button" | "badge";
}

export function StatusChangeDropdown({
  currentStatus,
  onStatusChange,
  disabled = false,
  size = "sm",
  variant = "button"
}: StatusChangeDropdownProps) {
  const currentConfig = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig["Draft"];
  const CurrentIcon = currentConfig.icon;

  const handleStatusChange = (newStatus: string) => {
    if (newStatus !== currentStatus) {
      onStatusChange(newStatus);
    }
  };

  if (variant === "badge") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={size}
            disabled={disabled}
            className={`${currentConfig.color} hover:opacity-80 transition-opacity`}
          >
            <CurrentIcon className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-xs font-medium">{currentStatus}</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {statusOptions.map((status) => {
            const config = statusConfig[status as keyof typeof statusConfig];
            const StatusIcon = config.icon;
            const isSelected = status === currentStatus;
            
            return (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <StatusIcon className="h-4 w-4" />
                <span className="flex-1">{status}</span>
                {isSelected && <CheckCircle className="h-4 w-4 text-green-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <CurrentIcon className="h-4 w-4" />
          <span>Change Status</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {statusOptions.map((status) => {
          const config = statusConfig[status as keyof typeof statusConfig];
          const StatusIcon = config.icon;
          const isSelected = status === currentStatus;
          
          return (
            <DropdownMenuItem
              key={status}
              onClick={() => handleStatusChange(status)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <StatusIcon className="h-4 w-4" />
              <span className="flex-1">{status}</span>
              {isSelected && <CheckCircle className="h-4 w-4 text-green-600" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Helper function to get status badge for display
export function getStatusBadge(status: string) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig["Draft"];
  const Icon = config.icon;
  
  return (
    <Badge
      variant="outline"
      className={`shadow-none inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ${config.badgeColor}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{status}</span>
    </Badge>
  );
}
