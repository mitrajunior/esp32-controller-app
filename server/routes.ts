import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import esphomeApi from "esphome-native-api";
import { lookup } from "node:dns/promises";
import mdns from "multicast-dns";
import { networkInterfaces } from "node:os";
import net, { Socket } from "node:net";

const { Client: ESPHomeClient, Connection: ESPHomeConnection } = esphomeApi as any;
import { storage } from "./storage";
import { insertDeviceSchema, updateDeviceSchema, deviceCommandSchema } from "@shared/model";
import { z } from "zod";

async function resolveHost(host: string): Promise<string> {
  try {
    const res = await lookup(host);
    return res.address;
  } catch (err) {
    return host;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all devices
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDevices();

      // Refresh connection status for each device on every listing
      await Promise.all(
        devices.map(async (d) => {
          const reachable = await testDeviceConnection(
            d.ip,
            d.port,
            d.apiPassword || undefined,
          );
          await storage.updateDeviceStatus(d.ip, reachable);
        }),
      );

      res.json(await storage.getDevices());
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

      const online = await testDeviceConnection(device.ip, device.port, device.apiPassword || undefined);
      await storage.updateDeviceStatus(device.ip, online);

      res.status(201).json(await storage.getDevice(device.id));
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

      const online = await testDeviceConnection(
        device.ip,
        device.port,
        device.apiPassword || undefined,
      );
      await storage.updateDeviceStatus(device.ip, online);

      res.json(await storage.getDevice(device.id));
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
      if ((error as any)?.message === 'Unsupported command') {
        return res.status(400).json({ message: 'Unsupported command' });
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
  } catch (_err) {
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
      try {
        client.disconnect();
      } catch (_err) {
        /* ignore */
      }
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
    } catch (_err) {
      clearTimeout(timer);
      cleanup();
      resolve(false);
    }
  });
}

async function checkSocket(ip: string, port: number): Promise<boolean> {
  const host = await resolveHost(ip);
  return new Promise((resolve) => {
    const socket = new Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });

    socket.once('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
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
  // first try a short ESPHome handshake using the provided credentials
  if (await checkNative(ip, port, apiPassword)) {
    return true;
  }

  // fallback to a simple TCP socket check for devices without the native API
  return await checkSocket(ip, port);
}

async function scanNetworkForDevices() {
  const results: { name: string; ip: string; port: number }[] = [];

  try {
    const mdnsBrowser = mdns();
    const devices = new Map<string, { name: string; ip: string; port: number }>();

    const handle = (packet: any) => {
      let ptr: any = packet.answers.find((a: any) => a.type === 'PTR' && a.name === '_esphomelib._tcp.local');
      if (!ptr) return;

      const srv = packet.additionals.find((a: any) => a.type === 'SRV' && a.name === ptr.data);
      const aRec = packet.additionals.find((a: any) => a.type === 'A' && srv && a.name === srv.data.target);
      if (srv && aRec) {
        devices.set(aRec.data, {
          name: ptr.data.replace('._esphomelib._tcp.local', ''),
          ip: aRec.data,
          port: srv.data.port,
        });
      }
    };

    mdnsBrowser.on('response', handle);
    mdnsBrowser.query({ questions: [{ name: '_esphomelib._tcp.local', type: 'PTR' }] });

    await new Promise((resolve) => setTimeout(resolve, 5000));
    mdnsBrowser.removeListener('response', handle);
    mdnsBrowser.destroy();

    results.push(...Array.from(devices.values()));
  } catch (_err) {
    // ignore mDNS errors
  }

  if (results.length > 0) {
    return results;
  }

  // fallback IP range scan for port 6053
  const nets = networkInterfaces();
  const prefixes = new Set<string>();
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          prefixes.add(parts.slice(0, 3).join('.'));
        }
      }
    }
  }

  if (prefixes.size === 0) {
    prefixes.add('192.168.0');
    prefixes.add('192.168.1');
  }

  const checked = new Set<string>();
  await Promise.all(
    Array.from(prefixes).flatMap((base) =>
      Array.from({ length: 254 }, (_, i) => {
        const ip = `${base}.${i + 1}`;
        if (checked.has(ip)) return Promise.resolve();
        checked.add(ip);
        return new Promise<void>((resolve) => {
          const socket = net.createConnection({ host: ip, port: 6053, timeout: 500 }, () => {
            results.push({ name: ip, ip, port: 6053 });
            socket.end();
            resolve();
          });
          socket.on('error', () => resolve());
          socket.on('timeout', () => {
            socket.destroy();
            resolve();
          });
        });
      })
    )
  );

  return results;
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
      try {
        client.disconnect();
      } catch (_err) {
        /* ignore */
      }
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
    case 'restart':
      await client.rebootService();
      break;
    case 'factory_reset':
      await client.factoryResetService();
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
