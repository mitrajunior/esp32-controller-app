import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";

import { storage } from "./storage";
import { insertDeviceSchema, updateDeviceSchema, deviceCommandSchema } from "@shared/model";
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

      const detectedPort = await detectDevicePort(
        deviceData.ip,
        deviceData.port || 80,
        deviceData.apiPassword || undefined,
      );

      if (detectedPort === null) {
        return res.status(400).json({ message: "Device is not reachable" });
      }

      const device = await storage.createDevice({ ...deviceData, port: detectedPort });
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

      const detected = await detectDevicePort(ip, port || 80, apiPassword);

      res.json({
        success: detected !== null,
        port: detected,
        message: detected !== null ? "Device is reachable" : "Device is not reachable",
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

// Utility functions

    return true;
  } catch {
    return false;
  }
}

async function checkNative(ip: string, port: number, password?: string): Promise<boolean> {

  return null;
}

async function testDeviceConnection(ip: string, port: number, apiPassword?: string): Promise<boolean> {
  const detected = await detectDevicePort(ip, port, apiPassword);
  return detected !== null;
}

async function scanNetworkForDevices() {
  // Discovery not implemented
  return [] as any[];
}

async function sendDeviceCommand(device: any, command: any): Promise<any> {
  if (device.port === 80) {

  return { via: 'native' };
}

async function getDeviceStatus(device: any): Promise<any> {
  if (device.port === 80) {

}
