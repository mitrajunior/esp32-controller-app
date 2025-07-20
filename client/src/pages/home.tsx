import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import DeviceDiscovery from "@/components/device-discovery";
import DeviceList from "@/components/device-list";
import DeviceControlModal from "@/components/device-control-modal";
import AddDeviceModal from "@/components/add-device-modal";
import type { Device } from "@shared/schema";

export default function Home() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  const { data: devices = [], isLoading, refetch } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const handleDeviceControl = (device: Device) => {
    setSelectedDevice(device);
    setIsControlModalOpen(true);
  };

  const handleDeviceEdit = (device: Device) => {
    setEditingDevice(device);
    setIsAddModalOpen(true);
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    setIsAddModalOpen(true);
  };

  const closeControlModal = () => {
    setIsControlModalOpen(false);
    setSelectedDevice(null);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingDevice(null);
  };

  const deviceStats = {
    online: (devices as Device[]).filter((d: Device) => d.isOnline).length,
    offline: (devices as Device[]).filter((d: Device) => !d.isOnline).length,
    total: (devices as Device[]).length,
  };

  return (
    <>
      {/* Header */}
      <header className="surface border-b border-surface-elevated px-4 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-status-neutral" />
            <h1 className="text-lg font-semibold">IoT Controller</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-status-on rounded-full animate-pulse"></div>
              <span className="text-sm text-secondary">Connected</span>
            </div>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-status-neutral hover:text-white hover:bg-surface-elevated">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <DeviceDiscovery 
          deviceStats={deviceStats}
          onAddDevice={handleAddDevice}
          onRefreshDevices={refetch}
        />
        
        <DeviceList
          devices={devices}
          isLoading={isLoading}
          onDeviceControl={handleDeviceControl}
          onDeviceEdit={handleDeviceEdit}
          onRefreshDevices={refetch}
        />
      </main>

      {/* Modals */}
      <DeviceControlModal
        device={selectedDevice}
        isOpen={isControlModalOpen}
        onClose={closeControlModal}
      />
      
      <AddDeviceModal
        device={editingDevice}
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onSuccess={() => {
          refetch();
          closeAddModal();
        }}
      />
    </>
  );
}
