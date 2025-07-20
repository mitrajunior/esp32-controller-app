import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Device } from "@shared/model";
import { 
  Lightbulb, 
  Thermometer, 
  ToggleLeft, 
  Star, 
  Wifi, 
  Settings,
  Trash2,
  RotateCcw,
  Search
} from "lucide-react";

interface DeviceListProps {
  devices: Device[];
  isLoading: boolean;
  onDeviceControl: (device: Device) => void;
  onDeviceEdit: (device: Device) => void;
  onRefreshDevices: () => void;
}

export default function DeviceList({
  devices,
  isLoading,
  onDeviceControl,
  onDeviceEdit,
  onRefreshDevices,
}: DeviceListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (deviceId: number) => 
      apiRequest("DELETE", `/api/devices/${deviceId}`),
    onSuccess: () => {
      toast({
        title: "Device removed",
        description: "Device has been successfully removed",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove device",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleDeviceRemove = (device: Device) => {
    if (window.confirm(`Are you sure you want to remove "${device.name}"?`)) {
      deleteMutation.mutate(device.id);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'light':
        return <Lightbulb className="w-5 h-5" />;
      case 'sensor':
        return <Thermometer className="w-5 h-5" />;
      case 'switch':
        return <ToggleLeft className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "Never";
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  if (isLoading) {
    return (
      <section className="surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Discovered Devices</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-elevated rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 bg-gray-600 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (devices.length === 0) {
    return (
      <section className="surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Discovered Devices</h2>
          <Button
            onClick={onRefreshDevices}
            variant="ghost"
            size="sm"
            className="text-status-neutral hover:text-white"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        <div className="text-center py-12">
          <svg className="w-16 h-16 text-secondary mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">No Devices Found</h3>
          <p className="text-secondary mb-6">Start by scanning the network or adding a device manually</p>
          <Button
            onClick={() => window.location.reload()}
            className="btn-status-neutral font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Device
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Discovered Devices</h2>
        <Button
          onClick={onRefreshDevices}
          variant="ghost"
          size="sm"
          className="text-status-neutral hover:text-white"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className={`surface-elevated rounded-lg p-4 border-l-4 hover:bg-opacity-80 transition-colors ${
              device.isOnline ? 'border-status-on' : 'border-status-off opacity-70'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={device.isOnline ? 'text-status-on' : 'text-status-off'}>
                    {getDeviceIcon(device.deviceType || 'unknown')}
                  </div>
                  <h3 className="font-semibold">{device.name}</h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      device.isOnline
                        ? 'bg-status-on text-black'
                        : 'bg-status-off text-white'
                    }`}
                  >
                    {device.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-secondary">
                  <div className="flex items-center space-x-2">
                    <Wifi className="w-4 h-4" />
                    <span>{device.ip}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4" />
                    <span>{device.port}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4" />
                    <span>Last seen {formatLastSeen(device.lastSeen?.toString() || null)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => onDeviceControl(device)}
                  disabled={!device.isOnline}
                  className={`touch-target font-medium ${
                    device.isOnline
                      ? 'btn-status-neutral'
                      : 'bg-gray-600 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Control
                </Button>
                <Button
                  onClick={() => onDeviceEdit(device)}
                  variant="secondary"
                  className="surface text-white hover:bg-opacity-80 touch-target font-medium"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleDeviceRemove(device)}
                  className="btn-status-off hover:opacity-80 touch-target font-medium"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
