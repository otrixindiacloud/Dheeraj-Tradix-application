import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Mail, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { emailService } from '@/lib/email-service';

interface EmailSendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order';
  documentNumber: string;
  customerEmail?: string;
  customerName?: string;
  pdfDataUrl?: string;
  onSuccess?: () => void;
}

export function EmailSendDialog({
  isOpen,
  onClose,
  documentType,
  documentNumber,
  customerEmail = '',
  customerName = '',
  pdfDataUrl,
  onSuccess
}: EmailSendDialogProps) {
  const [email, setEmail] = useState(customerEmail);
  const [name, setName] = useState(customerName);
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!email.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      let result;
      
      if (pdfDataUrl) {
        // Send email with PDF link
        result = await emailService.sendEmailWithPdfLink(
          email,
          name || 'Customer',
          documentType,
          documentNumber,
          pdfDataUrl,
          customMessage || undefined
        );
      } else {
        // Send simple email
        result = await emailService.sendSimpleEmail(
          email,
          name || 'Customer',
          `${documentType.toUpperCase()} - ${documentNumber}`,
          customMessage || `Please find your ${documentType.replace('_', ' ')} #${documentNumber} attached.`
        );
      }

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Email sent successfully!'
        });
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail(customerEmail);
    setName(customerName);
    setCustomMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send {documentType.replace('_', ' ').toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Send {documentType.replace('_', ' ')} #{documentNumber} via email
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Recipient Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer Name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message">Custom Message</Label>
            <Textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a custom message (optional)"
              rows={3}
            />
          </div>

          {pdfDataUrl && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>PDF Attachment:</strong> The document will be attached to the email.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

