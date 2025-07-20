import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Plus, Loader2 } from "lucide-react";

interface DeviceDiscoveryProps {
  deviceStats: {
    online: number;
    offline: number;
    total: number;
  };
  onAddDevice: () => void;
  onRefreshDevices: () => void;
}

export default function DeviceDiscovery({ 
  deviceStats, 
  onAddDevice, 
  onRefreshDevices 
}: DeviceDiscoveryProps) {
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/devices/scan"),
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Network scan completed",
        description: data.message,
        duration: 4000,
      });
      onRefreshDevices();
    },
    onError: () => {
      toast({
        title: "Scan failed",
        description: "Failed to scan network for devices",
        variant: "destructive",
        duration: 4000,
      });
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  const handleScanNetwork = () => {
    setIsScanning(true);
    toast({
      title: "Scanning network...",
      description: "Looking for ESPHome devices",
      duration: 2000,
    });
    scanMutation.mutate();
  };

  return (
    <section className="surface rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Device Discovery</h2>
          <p className="text-secondary text-sm">Automatically detect and manage ESPHome devices</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleScanNetwork}
            disabled={isScanning}
            className="btn-status-neutral font-medium touch-target"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Scan Network
          </Button>
          <Button
            onClick={onAddDevice}
            variant="secondary"
            className="surface-elevated text-white hover:bg-opacity-80 font-medium touch-target"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Manual
          </Button>
        </div>
      </div>

      {/* Scan Progress */}
      {isScanning && (
        <div className="surface-elevated rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-status-neutral border-t-transparent"></div>
            <span className="text-sm">Scanning network for ESPHome devices...</span>
          </div>
          <div className="mt-3 bg-oled rounded-full h-2">
            <div className="bg-status-neutral h-2 rounded-full transition-all duration-1000 animate-pulse" style={{ width: '65%' }}></div>
          </div>
        </div>
      )}

      {/* Device Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="surface-elevated rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-status-on">{deviceStats.online}</div>
          <div className="text-sm text-secondary">Online</div>
        </div>
        <div className="surface-elevated rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-status-off">{deviceStats.offline}</div>
          <div className="text-sm text-secondary">Offline</div>
        </div>
        <div className="surface-elevated rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-status-neutral">{deviceStats.total}</div>
          <div className="text-sm text-secondary">Total</div>
        </div>
        <div className="surface-elevated rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">2m</div>
          <div className="text-sm text-secondary">Last Scan</div>
        </div>
      </div>
    </section>
  );
}
