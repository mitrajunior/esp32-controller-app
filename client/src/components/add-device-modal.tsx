import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertDeviceSchema, updateDeviceSchema, type Device } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

interface AddDeviceModalProps {
  device?: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDeviceModal({
  device,
  isOpen,
  onClose,
  onSuccess,
}: AddDeviceModalProps) {
  const [connectionTest, setConnectionTest] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: 'Click "Test" to verify the connection' });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!device;

  const formSchema = isEditing ? updateDeviceSchema : insertDeviceSchema;
  
  const form = useForm({
    resolver: zodResolver(formSchema.extend({
      ip: z.string().regex(
        /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
        "Please enter a valid IP address"
      ),
      port: z.coerce.number().min(1).max(65535, "Port must be between 1 and 65535"),
    })),
    defaultValues: {
      name: device?.name || "",
      ip: device?.ip || "",
      port: device?.port || 6053,
      apiPassword: device?.apiPassword || "",
      autoDiscover: device?.autoDiscover ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/devices", data),
    onSuccess: () => {
      toast({
        title: "Device added",
        description: "Device has been successfully added",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add device",
        description: error.message || "An error occurred while adding the device",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/devices/${device?.id}`, data),
    onSuccess: () => {
      toast({
        title: "Device updated",
        description: "Device has been successfully updated",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update device",
        description: error.message || "An error occurred while updating the device",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (data: { ip: string; port: number; apiPassword?: string }) =>
      apiRequest("POST", "/api/devices/test-connection", data),
    onMutate: () => {
      setConnectionTest({ status: 'testing', message: 'Testing connection...' });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      setConnectionTest({
        status: result.success ? 'success' : 'error',
        message: result.message,
      });
    },
    onError: () => {
      setConnectionTest({
        status: 'error',
        message: 'Connection test failed',
      });
    },
  });

  const onSubmit = (data: any) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const testConnection = () => {
    const values = form.getValues();
    testConnectionMutation.mutate({
      ip: values.ip,
      port: values.port,
      apiPassword: values.apiPassword || undefined,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="surface max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit ESPHome Device' : 'Add ESPHome Device'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Smart LED Strip"
                      className="surface-elevated border-gray-600 focus:ring-status-neutral"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="192.168.1.100"
                      className="surface-elevated border-gray-600 focus:ring-status-neutral"
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the IP address of your ESPHome device
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      max={65535}
                      className="surface-elevated border-gray-600 focus:ring-status-neutral"
                    />
                  </FormControl>
                  <FormDescription>
                    Default ESPHome API port is 6053
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Password (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Leave empty if no password"
                      className="surface-elevated border-gray-600 focus:ring-status-neutral"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoDiscover"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Enable auto-discovery for this device</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Connection Test */}
            <div className="surface-elevated rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connection Test</span>
                <Button
                  type="button"
                  onClick={testConnection}
                  disabled={testConnectionMutation.isPending}
                  size="sm"
                  className="btn-status-neutral text-xs"
                >
                  {testConnectionMutation.isPending ? 'Testing...' : 'Test'}
                </Button>
              </div>
              <div className={`mt-2 text-xs ${
                connectionTest.status === 'success' ? 'text-status-on' :
                connectionTest.status === 'error' ? 'text-status-off' :
                'text-secondary'
              }`}>
                {connectionTest.message}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                className="flex-1 surface-elevated text-white hover:bg-opacity-80"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 btn-status-neutral font-medium"
              >
                {isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent mr-2" />
                ) : (
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isEditing ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    )}
                  </svg>
                )}
                {isEditing ? 'Update Device' : 'Add Device'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
