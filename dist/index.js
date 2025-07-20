// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import axios from "axios";
import esphomeApi from "esphome-native-api";
import { lookup } from "node:dns/promises";

// server/storage.ts
var MemStorage = class {
  devices;
  currentId;
  constructor() {
    this.devices = /* @__PURE__ */ new Map();
    this.currentId = 1;
  }
  async getDevices() {
    return Array.from(this.devices.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
  async getDevice(id) {
    return this.devices.get(id);
  }
  async getDeviceByIp(ip) {
    return Array.from(this.devices.values()).find((device) => device.ip === ip);
  }
  async createDevice(insertDevice) {
    const id = this.currentId++;
    const device = {
      ...insertDevice,
      id,
      port: insertDevice.port || 80,
      deviceType: insertDevice.deviceType || "unknown",
      autoDiscover: insertDevice.autoDiscover !== void 0 ? insertDevice.autoDiscover : true,
      apiPassword: insertDevice.apiPassword || null,
      isOnline: false,
      lastSeen: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.devices.set(id, device);
    return device;
  }
  async updateDevice(id, updates) {
    const device = this.devices.get(id);
    if (!device) return void 0;
    const updatedDevice = { ...device, ...updates };
    this.devices.set(id, updatedDevice);
    return updatedDevice;
  }
  async deleteDevice(id) {
    return this.devices.delete(id);
  }
  async updateDeviceStatus(ip, isOnline) {
    const device = Array.from(this.devices.values()).find((d) => d.ip === ip);
    if (device) {
      device.isOnline = isOnline;
      device.lastSeen = /* @__PURE__ */ new Date();
      this.devices.set(device.id, device);
    }
  }
};
var storage = new MemStorage();

// shared/model.ts
import { z } from "zod";
var insertDeviceSchema = z.object({
  name: z.string(),
  ip: z.string(),
  port: z.number().min(1).max(65535).default(80),
  apiPassword: z.string().optional().nullable(),
  deviceType: z.string().default("unknown"),
  autoDiscover: z.boolean().default(true)
});
var updateDeviceSchema = insertDeviceSchema.partial();
var deviceCommandSchema = z.object({
  command: z.string(),
  entityId: z.string().optional(),
  value: z.any().optional()
});

// server/routes.ts
import { z as z2 } from "zod";
var { Client: ESPHomeClient, Connection: ESPHomeConnection } = esphomeApi;
async function resolveHost(host) {
  try {
    const res = await lookup(host);
    return res.address;
  } catch (err) {
    return host;
  }
}
async function registerRoutes(app2) {
  app2.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });
  app2.get("/api/devices/:id", async (req, res) => {
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
  app2.post("/api/devices", async (req, res) => {
    try {
      const deviceData = insertDeviceSchema.parse(req.body);
      const existing = await storage.getDeviceByIp(deviceData.ip);
      if (existing) {
        return res.status(400).json({ message: "Device with this IP already exists" });
      }
      const detectedPort = await detectDevicePort(
        deviceData.ip,
        deviceData.port || 80,
        deviceData.apiPassword || void 0
      );
      if (detectedPort === null) {
        return res.status(400).json({ message: "Device is not reachable" });
      }
      const device = await storage.createDevice({ ...deviceData, port: detectedPort });
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid device data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create device" });
    }
  });
  app2.put("/api/devices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = updateDeviceSchema.parse(req.body);
      const device = await storage.updateDevice(id, updates);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update device" });
    }
  });
  app2.delete("/api/devices/:id", async (req, res) => {
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
  app2.post("/api/devices/test-connection", async (req, res) => {
    try {
      const { ip, port, apiPassword } = req.body;
      const detected = await detectDevicePort(ip, port || 80, apiPassword);
      res.json({
        success: detected !== null,
        port: detected,
        message: detected !== null ? "Device is reachable" : "Device is not reachable"
      });
    } catch (error) {
      res.status(500).json({ message: "Connection test failed" });
    }
  });
  app2.post("/api/devices/scan", async (req, res) => {
    try {
      const discoveredDevices = await scanNetworkForDevices();
      res.json({
        message: `Found ${discoveredDevices.length} devices`,
        devices: discoveredDevices
      });
    } catch (error) {
      res.status(500).json({ message: "Network scan failed" });
    }
  });
  app2.post("/api/devices/:id/command", async (req, res) => {
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
      const result = await sendDeviceCommand(device, command);
      res.json({
        success: true,
        message: "Command executed successfully",
        result
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Invalid command data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to execute command" });
    }
  });
  app2.get("/api/devices/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const device = await storage.getDevice(id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      if (!device.isOnline) {
        return res.json({ online: false });
      }
      const status = await getDeviceStatus(device);
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get device status" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
async function checkRest(ip, port) {
  const host = await resolveHost(ip);
  try {
    await axios.get(`http://${host}:${port}/status`, { timeout: 3e3 });
    return true;
  } catch (_err) {
    return false;
  }
}
async function checkNative(ip, port, password) {
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
      initializeSubscribeLogs: false
    });
    const cleanup = () => {
      client.removeAllListeners();
      try {
        client.disconnect();
      } catch (_err) {
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 5e3);
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
async function detectDevicePort(ip, port, password) {
  if (await checkRest(ip, port)) return port;
  if (await checkNative(ip, port, password)) return port;
  if (port !== 80 && await checkRest(ip, 80)) return 80;
  if (port !== 6053 && await checkNative(ip, 6053, password)) return 6053;
  return null;
}
async function scanNetworkForDevices() {
  return [];
}
async function sendDeviceCommand(device, command) {
  if (device.port === 80) {
    const host2 = await resolveHost(device.ip);
    await axios.post(`http://${host2}:${device.port}/command`, command, { timeout: 5e3 });
    return { via: "http" };
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
    initializeSubscribeLogs: false
  });
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      client.removeAllListeners();
      try {
        client.disconnect();
      } catch (_err) {
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout"));
    }, 5e3);
    client.once("connected", async () => {
      try {
        await executeNativeCommand(client, command);
        clearTimeout(timer);
        cleanup();
        resolve({ via: "native" });
      } catch (err) {
        clearTimeout(timer);
        cleanup();
        reject(err);
      }
    });
    client.once("error", (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    client.connect();
  });
}
async function executeNativeCommand(client, command) {
  switch (command.command) {
    case "toggle":
      await client.switchCommandService({ key: Number(command.entityId), state: command.value.on });
      break;
    case "set_brightness":
      await client.lightCommandService({ key: Number(command.entityId), brightness: command.value.brightness });
      break;
    case "set_color":
      await client.lightCommandService({ key: Number(command.entityId), red: command.value.color.r, green: command.value.color.g, blue: command.value.color.b });
      break;
    case "set_effect":
      await client.lightCommandService({ key: Number(command.entityId), effect: command.value.effect });
      break;
    default:
      throw new Error("Unsupported command");
  }
}
async function getDeviceStatus(device) {
  if (device.port === 80) {
    const res = await axios.get(`http://${device.ip}:${device.port}/status`, { timeout: 5e3 });
    return res.data;
  }
  const reachable = await checkNative(device.ip, device.port, device.apiPassword || void 0);
  return { online: reachable };
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
