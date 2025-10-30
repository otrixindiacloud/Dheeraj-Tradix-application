import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSupplierSchema, type InsertSupplier } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function EditSupplier() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InsertSupplier>({
    resolver: zodResolver(insertSupplierSchema),
  });

  // Fetch supplier details
  const { data: supplier, isLoading } = useQuery({
    queryKey: ["/api/suppliers/" + id + "/details"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/details`);
      if (!res.ok) throw new Error("Failed to fetch supplier");
      return res.json();
    },
    enabled: !!id,
  });

  // Reset form when supplier data is loaded
  useEffect(() => {
    if (supplier?.supplier) {
      reset({
        name: supplier.supplier.name,
        contactPerson: supplier.supplier.contactPerson,
        email: supplier.supplier.email,
        phone: supplier.supplier.phone,
        address: supplier.supplier.address,
        paymentTerms: supplier.supplier.paymentTerms,
      });
    }
  }, [supplier, reset]);

  // Mutation for updating supplier
  const mutation = useMutation({
    mutationFn: async (formData: InsertSupplier) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update supplier");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Supplier updated successfully" });
      setLocation(`/suppliers/${id}`);
    },
    onError: () => {
      toast({ title: "Failed to update supplier", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertSupplier) => {
    mutation.mutate(data);
  };

  if (isLoading) return <div className="container mx-auto py-8">Loading...</div>;

  return (
    <div className="container mx-auto py-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-red-500">{String(errors.name.message)}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Contact Person</label>
              <Input {...register("contactPerson")} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input {...register("email")} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input 
                type="tel"
                {...register("phone")} 
                onChange={(e) => {
                  // Only allow numbers in phone input
                  const numbersOnly = e.target.value.replace(/[^0-9]/g, '');
                  e.target.value = numbersOnly;
                  register("phone").onChange(e);
                }}
                onKeyPress={(e) => {
                  // Allow only numbers for phone number
                  const allowedChars = /[0-9]/;
                  if (!allowedChars.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input {...register("address")} />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Terms</label>
              <Input {...register("paymentTerms")} />
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => setLocation('/suppliers')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
