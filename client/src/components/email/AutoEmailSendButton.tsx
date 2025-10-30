import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { emailService } from '@/lib/email-service';

interface AutoEmailSendButtonProps {
  documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order' | 'purchase_invoice';
  documentId: string;
  documentNumber: string;
  recipientEmail: string;
  recipientName: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSuccess?: () => void;
  customMessage?: string;
}

export function AutoEmailSendButton({
  documentType,
  documentId,
  documentNumber,
  recipientEmail,
  recipientName,
  variant = 'default',
  size = 'sm',
  className,
  onSuccess,
  customMessage
}: AutoEmailSendButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isError, setIsError] = useState(false);
  const { toast } = useToast();

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Recipient email is required',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setIsSent(false);

    try {
      const result = await emailService.sendDocumentDirectly(
        documentType,
        documentId,
        recipientEmail,
        recipientName,
        customMessage
      );

      if (result.success) {
        setIsSent(true);
        toast({
          title: 'Success',
          description: `${documentType.replace('_', ' ').toUpperCase()} sent successfully to ${recipientEmail}!`
        });
        onSuccess?.();
        
        // Reset status after 3 seconds
        setTimeout(() => {
          setIsSent(false);
        }, 3000);
      } else {
        setIsError(true);
        toast({
          title: 'Error',
          description: result.message || 'Failed to send email',
          variant: 'destructive'
        });
        
        // Reset error status after 3 seconds
        setTimeout(() => {
          setIsError(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setIsError(true);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive'
      });
      
      // Reset error status after 3 seconds
      setTimeout(() => {
        setIsError(false);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      );
    }
    
    if (isSent) {
      return (
        <>
          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          Sent!
        </>
      );
    }
    
    if (isError) {
      return (
        <>
          <XCircle className="mr-2 h-4 w-4 text-red-500" />
          Failed
        </>
      );
    }
    
    return (
      <>
        <Mail className="mr-2 h-4 w-4" />
        Send Email
      </>
    );
  };

  const getButtonVariant = () => {
    if (isSent) return 'outline';
    if (isError) return 'destructive';
    return variant;
  };

  return (
    <Button
      variant={getButtonVariant()}
      size={size}
      className={className}
      onClick={handleSendEmail}
      disabled={isLoading || !recipientEmail.trim()}
    >
      {getButtonContent()}
    </Button>
  );
}
