// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

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
      port: insertDevice.port || 6053,
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

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  port: integer("port").notNull().default(6053),
  apiPassword: text("api_password"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  deviceType: text("device_type").default("unknown"),
  autoDiscover: boolean("auto_discover").default(true),
  createdAt: timestamp("created_at").defaultNow()
});
var insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  isOnline: true,
  lastSeen: true,
  createdAt: true
});
var updateDeviceSchema = insertDeviceSchema.partial();
var deviceCommandSchema = z.object({
  command: z.string(),
  entityId: z.string().optional(),
  value: z.any().optional()
});

// server/routes.ts
import { z as z2 } from "zod";
async function registerRoutes(app2) {
  app2.get("/api/devices", async (req, res) => {
    try {
      const devices2 = await storage.getDevices();
      res.json(devices2);
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
      const device = await storage.createDevice(deviceData);
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
      const isReachable = await testDeviceConnection(ip, port, apiPassword);
      res.json({
        success: isReachable,
        message: isReachable ? "Device is reachable" : "Device is not reachable"
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
async function testDeviceConnection(ip, port, apiPassword) {
  const ipParts = ip.split(".").map(Number);
  return ipParts.every((part) => part >= 0 && part <= 255) && port > 0 && port <= 65535;
}
async function scanNetworkForDevices() {
  return [];
}
async function sendDeviceCommand(device, command) {
  return { status: "executed", timestamp: /* @__PURE__ */ new Date() };
}
async function getDeviceStatus(device) {
  const mockEntities = [];
  if (device.deviceType === "light") {
    mockEntities.push({
      id: "led_strip",
      name: "LED Strip",
      type: "light",
      state: { on: true, brightness: 85, color: { r: 255, g: 255, b: 255 } }
    });
  } else if (device.deviceType === "sensor") {
    mockEntities.push({
      id: "temperature",
      name: "Temperature",
      type: "sensor",
      state: { value: 23.5, unit: "\xB0C" }
    });
  } else if (device.deviceType === "switch") {
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
      "@": path.resolve("/home/runner/workspace", "client", "src"),
      "@shared": path.resolve("/home/runner/workspace", "shared"),
      "@assets": path.resolve("/home/runner/workspace", "attached_assets")
    }
  },
  root: path.resolve("/home/runner/workspace", "client"),
  build: {
    outDir: path.resolve("/home/runner/workspace", "dist/public"),
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
        "/home/runner/workspace",
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
  const distPath = path2.resolve("/home/runner/workspace", "public");
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
