import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import esphomeApi from "esphome-native-api";
import { lookup } from "node:dns/promises";
const { Client: ESPHomeClient, Connection: ESPHomeConnection } = esphomeApi as any;
import { storage } from "./storage";
import { insertDeviceSchema, updateDeviceSchema, deviceCommandSchema } from "@shared/model";
import { z } from "zod";

async function resolveHost(host: string): Promise<string> {
  try {
    const res = await lookup(host);
    return res.address;
  } catch {
    return host;
  }
}

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
async function checkRest(ip: string, port: number): Promise<boolean> {
  const host = await resolveHost(ip);
  try {
    await axios.get(`http://${host}:${port}/status`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function checkNative(ip: string, port: number, password?: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    const host = await resolveHost(ip);
    const client = new ESPHomeClient({
      host,
      port,
      password: password || "",
      reconnect: false,
      clearSession: true,
      initializeDeviceInfo: false,
      initializeListEntities: false,
      initializeSubscribeStates: false,
      initializeSubscribeLogs: false,
    });

    const cleanup = () => {
      client.removeAllListeners();
      try { client.disconnect(); } catch {}
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 5000);

    client.once("connected", () => {
      clearTimeout(timer);
      cleanup();
      resolve(true);
    });

    client.once("error", () => {
      clearTimeout(timer);
      cleanup();
      resolve(false);
    });

    try {
      client.connect();
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(false);
    }
  });
}

async function detectDevicePort(ip: string, port: number, password?: string): Promise<number | null> {
  // first try the provided port using REST
  if (await checkRest(ip, port)) return port;

  // if not accessible via REST, try native API (default 6053)
  if (await checkNative(ip, port, password)) return port;

  // fallback to common defaults
  if (port !== 80 && await checkRest(ip, 80)) return 80;
  if (port !== 6053 && await checkNative(ip, 6053, password)) return 6053;

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
    const host = await resolveHost(device.ip);
    await axios.post(`http://${host}:${device.port}/command`, command, { timeout: 5000 });
    return { via: 'http' };
  }

  const host = await resolveHost(device.ip);
  const client = new ESPHomeClient({
    host,
    port: device.port,
    password: device.apiPassword || "",
    reconnect: false,
    clearSession: true,
    initializeDeviceInfo: false,
    initializeListEntities: false,
    initializeSubscribeStates: false,
    initializeSubscribeLogs: false,
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      client.removeAllListeners();
      try { client.disconnect(); } catch {}
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout'));
    }, 5000);

    client.once('connected', async () => {
      try {
        await executeNativeCommand(client, command);
        clearTimeout(timer);
        cleanup();
        resolve({ via: 'native' });
      } catch (err: any) {
        clearTimeout(timer);
        cleanup();
        reject(err);
      }
    });

    client.once('error', (err: any) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });

    client.connect();
  });
}

async function executeNativeCommand(client: any, command: any): Promise<void> {
  switch (command.command) {
    case 'toggle':
      await client.switchCommandService({ key: Number(command.entityId), state: command.value.on });
      break;
    case 'set_brightness':
      await client.lightCommandService({ key: Number(command.entityId), brightness: command.value.brightness });
      break;
    case 'set_color':
      await client.lightCommandService({ key: Number(command.entityId), red: command.value.color.r, green: command.value.color.g, blue: command.value.color.b });
      break;
    case 'set_effect':
      await client.lightCommandService({ key: Number(command.entityId), effect: command.value.effect });
      break;
    default:
      throw new Error('Unsupported command');
  }
}

async function getDeviceStatus(device: any): Promise<any> {
  if (device.port === 80) {
    const res = await axios.get(`http://${device.ip}:${device.port}/status`, { timeout: 5000 });
    return res.data;
  }

  const reachable = await checkNative(device.ip, device.port, device.apiPassword || undefined);
  return { online: reachable };
}
