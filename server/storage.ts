import { type Device, type InsertDevice, type UpdateDevice } from "@shared/model";

export interface IStorage {
  // Device management
  getDevices(): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceByIp(ip: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, updates: UpdateDevice): Promise<Device | undefined>;
  deleteDevice(id: number): Promise<boolean>;
  updateDeviceStatus(ip: string, isOnline: boolean): Promise<void>;
}

export class MemStorage implements IStorage {
  private devices: Map<number, Device>;
  private currentId: number;

  constructor() {
    this.devices = new Map();
    this.currentId = 1;
  }

  async getDevices(): Promise<Device[]> {
    return Array.from(this.devices.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getDevice(id: number): Promise<Device | undefined> {
    return this.devices.get(id);
  }

  async getDeviceByIp(ip: string): Promise<Device | undefined> {
    return Array.from(this.devices.values()).find(device => device.ip === ip);
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const id = this.currentId++;
    const device: Device = {
      ...insertDevice,
      id,
      port: insertDevice.port || 80,
      deviceType: insertDevice.deviceType || 'unknown',
      autoDiscover: insertDevice.autoDiscover !== undefined ? insertDevice.autoDiscover : true,
      apiPassword: insertDevice.apiPassword || null,
      isOnline: false,
      lastSeen: null,
      createdAt: new Date(),
    };
    this.devices.set(id, device);
    return device;
  }

  async updateDevice(id: number, updates: UpdateDevice): Promise<Device | undefined> {
    const device = this.devices.get(id);
    if (!device) return undefined;

    const updatedDevice: Device = { ...device, ...updates };
    this.devices.set(id, updatedDevice);
    return updatedDevice;
  }

  async deleteDevice(id: number): Promise<boolean> {
    return this.devices.delete(id);
  }

  async updateDeviceStatus(ip: string, isOnline: boolean): Promise<void> {
    const device = Array.from(this.devices.values()).find(d => d.ip === ip);
    if (device) {
      device.isOnline = isOnline;
      device.lastSeen = new Date();
      this.devices.set(device.id, device);
    }
  }
}

export const storage = new MemStorage();
