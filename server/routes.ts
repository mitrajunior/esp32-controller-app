import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDeviceSchema, updateDeviceSchema, deviceCommandSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all devices
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  // Get device by ID
  app.get("/api/devices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const device = await storage.getDevice(id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch device" });
    }
  });

  // Create new device
  app.post("/api/devices", async (req, res) => {
    try {
      const deviceData = insertDeviceSchema.parse(req.body);
      
      // Check if device already exists
      const existing = await storage.getDeviceByIp(deviceData.ip);
      if (existing) {
        return res.status(400).json({ message: "Device with this IP already exists" });
      }

      const device = await storage.createDevice(deviceData);
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid device data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create device" });
    }
  });

  // Update device
  app.put("/api/devices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = updateDeviceSchema.parse(req.body);
      
      const device = await storage.updateDevice(id, updates);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      res.json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update device" });
    }
  });

  // Delete device
  app.delete("/api/devices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDevice(id);
      if (!success) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json({ message: "Device deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete device" });
    }
  });

  // Test device connection
  app.post("/api/devices/test-connection", async (req, res) => {
    try {
      const { ip, port, apiPassword } = req.body;
      
      // Simulate connection test (in real implementation, use ESPHome API)
      const isReachable = await testDeviceConnection(ip, port, apiPassword);
      
      res.json({ 
        success: isReachable,
        message: isReachable ? "Device is reachable" : "Device is not reachable"
      });
    } catch (error) {
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  // Scan network for devices
  app.post("/api/devices/scan", async (req, res) => {
    try {
      // Simulate network scanning (in real implementation, use mDNS and IP scanning)
      const discoveredDevices = await scanNetworkForDevices();
      
      // Update device statuses for discovered devices
      // Since we're not returning any devices, no status updates needed
      
      res.json({ 
        message: `Found ${discoveredDevices.length} devices`,
        devices: discoveredDevices 
      });
    } catch (error) {
      res.status(500).json({ message: "Network scan failed" });
    }
  });

  // Send command to device
  app.post("/api/devices/:id/command", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const command = deviceCommandSchema.parse(req.body);
      
      const device = await storage.getDevice(id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      if (!device.isOnline) {
        return res.status(400).json({ message: "Device is offline" });
      }
      
      // Simulate command execution (in real implementation, use ESPHome API)
      const result = await sendDeviceCommand(device, command);
      
      res.json({ 
        success: true,
        message: "Command executed successfully",
        result 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid command data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to execute command" });
    }
  });

  // Get device status and entities
  app.get("/api/devices/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const device = await storage.getDevice(id);
      
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      if (!device.isOnline) {
        return res.json({ online: false });
      }
      
      // Simulate getting device status (in real implementation, use ESPHome API)
      const status = await getDeviceStatus(device);
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get device status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Utility functions (simulate ESPHome API calls)
async function testDeviceConnection(ip: string, port: number, apiPassword?: string): Promise<boolean> {
  // In real implementation: connect to ESPHome API at ip:port
  // For now, simulate based on IP pattern
  const ipParts = ip.split('.').map(Number);
  return ipParts.every(part => part >= 0 && part <= 255) && port > 0 && port <= 65535;
}

async function scanNetworkForDevices() {
  // In real implementation: use mDNS discovery and IP range scanning
  // For now, return empty array - devices should be added manually
  return [];
}

async function sendDeviceCommand(device: any, command: any): Promise<any> {
  // In real implementation: use ESPHome API to send commands
  return { status: "executed", timestamp: new Date() };
}

async function getDeviceStatus(device: any): Promise<any> {
  // In real implementation: query ESPHome API for device status and entities
  const mockEntities = [];
  
  if (device.deviceType === 'light') {
    mockEntities.push({
      id: "led_strip",
      name: "LED Strip",
      type: "light",
      state: { on: true, brightness: 85, color: { r: 255, g: 255, b: 255 } }
    });
  } else if (device.deviceType === 'sensor') {
    mockEntities.push({
      id: "temperature",
      name: "Temperature",
      type: "sensor",
      state: { value: 23.5, unit: "°C" }
    });
  } else if (device.deviceType === 'switch') {
    mockEntities.push({
      id: "relay",
      name: "Relay",
      type: "switch",
      state: { on: false }
    });
  }
  
  return {
    online: true,
    uptime: "2h 34m",
    signalStrength: "-45 dBm",
    entities: mockEntities
  };
}
