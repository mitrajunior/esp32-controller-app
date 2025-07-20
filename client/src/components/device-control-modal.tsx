import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import type { Device, DeviceStatus, DeviceCommand } from "@shared/model";
import { apiRequest } from "@/lib/queryClient";

interface DeviceControlModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeviceControlModal({
  device,
  isOpen,
  onClose,
}: DeviceControlModalProps) {
  const [brightness, setBrightness] = useState([85]);
  const [isLedOn, setIsLedOn] = useState(true);
  const { toast } = useToast();

  const { data: deviceStatus } = useQuery({
    queryKey: ["/api/devices", device?.id, "status"],
    enabled: !!device && isOpen && !!device.isOnline,
    refetchInterval: 5000,
  });

  const commandMutation = useMutation({
    mutationFn: (command: DeviceCommand) =>
      apiRequest("POST", `/api/devices/${device?.id}/command`, command),
    onSuccess: () => {
      toast({
        title: "Command executed",
        description: "Device command executed successfully",
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Command failed",
        description: "Failed to execute device command",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const executeCommand = (command: string, entityId?: string, value?: any) => {
    if (!device) return;
    commandMutation.mutate({ command, entityId, value });
  };

  const toggleLED = () => {
    const newState = !isLedOn;
    setIsLedOn(newState);
    executeCommand("toggle", "led_strip", { on: newState });
  };

  const updateBrightness = (values: number[]) => {
    setBrightness(values);
    executeCommand("set_brightness", "led_strip", { brightness: values[0] });
  };

  const setColor = (color: string) => {
    const colorMap: Record<string, { r: number; g: number; b: number }> = {
      red: { r: 255, g: 0, b: 0 },
      green: { r: 0, g: 255, b: 0 },
      blue: { r: 0, g: 0, b: 255 },
      yellow: { r: 255, g: 255, b: 0 },
      purple: { r: 255, g: 0, b: 255 },
      white: { r: 255, g: 255, b: 255 },
    };

    if (colorMap[color]) {
      executeCommand("set_color", "led_strip", { color: colorMap[color] });
      toast({
        title: "Color changed",
        description: `LED color set to ${color}`,
        duration: 2000,
      });
    }
  };

  const setEffect = (effect: string) => {
    executeCommand("set_effect", "led_strip", { effect });
    toast({
      title: "Effect applied",
      description: `Effect set to ${effect}`,
      duration: 2000,
    });
  };

  const restartDevice = () => {
    if (window.confirm("Are you sure you want to restart this device?")) {
      executeCommand("restart");
      toast({
        title: "Device restarting",
        description: "Device restart command sent",
        duration: 3000,
      });
    }
  };

  const factoryReset = () => {
    if (window.confirm("Are you sure you want to factory reset this device? This action cannot be undone.")) {
      executeCommand("factory_reset");
      toast({
        title: "Factory reset initiated",
        description: "Device factory reset command sent",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'light':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
      case 'sensor':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        );
    }
  };

  if (!device) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="surface max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-surface-elevated pb-4">
          <div className="flex items-center space-x-3">
            <div className="text-status-on">
              {getDeviceIcon(device.deviceType || 'unknown')}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">{device.name}</DialogTitle>
              <p className="text-secondary text-sm">{device.ip}:{device.port}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Device Status */}
          <div className="surface-elevated rounded-lg p-4">
            <h3 className="font-semibold mb-3">Device Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-secondary mb-1">Connection</div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${device.isOnline ? 'bg-status-on' : 'bg-status-off'}`}></div>
                  <span className="font-medium">{device.isOnline ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Uptime</div>
                <div className="font-medium">{(deviceStatus as any)?.uptime || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Signal Strength</div>
                <div className="font-medium">{(deviceStatus as any)?.signalStrength || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">IP Address</div>
                <div className="font-medium">{device.ip}</div>
              </div>
            </div>
          </div>

          {/* Control panels based on device type */}
          {device.deviceType === 'light' && (
            <div className="surface-elevated rounded-lg p-4">
              <h3 className="font-semibold mb-4">LED Controls</h3>
              
              {/* Power Toggle */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium">Power</span>
                <Button
                  onClick={toggleLED}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    isLedOn ? 'bg-status-on' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    isLedOn ? 'right-1' : 'left-1'
                  }`}></div>
                </Button>
              </div>

              {/* Brightness Slider */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Brightness</span>
                  <span className="text-sm text-secondary">{brightness[0]}%</span>
                </div>
                <Slider
                  value={brightness}
                  onValueChange={updateBrightness}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Color Controls */}
              <div className="mb-4">
                <span className="font-medium block mb-3">Color</span>
                <div className="grid grid-cols-6 gap-2">
                  {['red', 'green', 'blue', 'yellow', 'purple', 'white'].map((color) => (
                    <Button
                      key={color}
                      onClick={() => setColor(color)}
                      className={`w-10 h-10 rounded-lg hover:scale-110 transition-transform bg-${color}-500`}
                      style={{ 
                        backgroundColor: color === 'white' ? '#ffffff' : undefined 
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Effect Presets */}
              <div>
                <span className="font-medium block mb-3">Effects</span>
                <div className="grid grid-cols-2 gap-2">
                  {['solid', 'rainbow', 'fade', 'strobe'].map((effect) => (
                    <Button
                      key={effect}
                      onClick={() => setEffect(effect)}
                      variant="secondary"
                      className="surface text-white hover:bg-opacity-80 capitalize"
                    >
                      {effect} {effect === 'solid' && 'Color'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Additional Controls */}
          <div className="surface-elevated rounded-lg p-4">
            <h3 className="font-semibold mb-4">Device Management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                onClick={restartDevice}
                variant="secondary"
                className="surface text-white hover:bg-opacity-80"
                disabled={commandMutation.isPending}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart Device
              </Button>
              <Button
                onClick={factoryReset}
                className="btn-status-off hover:opacity-80"
                disabled={commandMutation.isPending}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Factory Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-surface-elevated">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1 surface text-white hover:bg-opacity-80"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
