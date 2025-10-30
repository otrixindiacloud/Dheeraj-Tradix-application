import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmailSendDialog } from './EmailSendDialog';
import { AutoEmailSendButton } from './AutoEmailSendButton';

interface EmailSendButtonProps {
  documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order' | 'purchase_invoice';
  documentId: string;
  documentNumber: string;
  customerEmail?: string;
  customerName?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSuccess?: () => void;
  autoSend?: boolean; // New prop for one-click sending
}

export function EmailSendButton({
  documentType,
  documentId,
  documentNumber,
  customerEmail,
  customerName,
  variant = 'outline',
  size = 'sm',
  className,
  onSuccess,
  autoSend = false
}: EmailSendButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleEmailClick = async () => {
    setIsLoading(true);
    try {
      // Prepare the document for email sending
      const response = await fetch(`/api/email/${documentType}/${documentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customerEmail,
          customMessage: ''
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to prepare document: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setPdfDataUrl(data.data.pdfDataUrl);
        setIsDialogOpen(true);
      } else {
        throw new Error(data.message || 'Failed to prepare document');
      }
    } catch (error) {
      console.error('Error preparing document for email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to prepare document for email',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setPdfDataUrl(null);
  };

  const handleEmailSuccess = () => {
    onSuccess?.();
  };

  // If autoSend is true and we have customer email, use the automated button
  if (autoSend && customerEmail) {
    return (
      <AutoEmailSendButton
        documentType={documentType}
        documentId={documentId}
        documentNumber={documentNumber}
        recipientEmail={customerEmail}
        recipientName={customerName || 'Customer'}
        variant={variant}
        size={size}
        className={className}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleEmailClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </>
        )}
      </Button>

      <EmailSendDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        documentType={documentType}
        documentNumber={documentNumber}
        customerEmail={customerEmail}
        customerName={customerName}
        pdfDataUrl={pdfDataUrl || undefined}
        onSuccess={handleEmailSuccess}
      />
    </>
  );
}

