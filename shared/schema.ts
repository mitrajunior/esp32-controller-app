import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  port: integer("port").notNull().default(6053),
  apiPassword: text("api_password"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  deviceType: text("device_type").default("unknown"),
  autoDiscover: boolean("auto_discover").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  isOnline: true,
  lastSeen: true,
  createdAt: true,
});

export const updateDeviceSchema = insertDeviceSchema.partial();

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type UpdateDevice = z.infer<typeof updateDeviceSchema>;

// Device control schemas
export const deviceCommandSchema = z.object({
  command: z.string(),
  entityId: z.string().optional(),
  value: z.any().optional(),
});

export type DeviceCommand = z.infer<typeof deviceCommandSchema>;

// Device status interface
export interface DeviceStatus {
  online: boolean;
  uptime?: string;
  signalStrength?: string;
  entities?: DeviceEntity[];
}

export interface DeviceEntity {
  id: string;
  name: string;
  type: 'switch' | 'light' | 'sensor' | 'binary_sensor';
  state: any;
  attributes?: Record<string, any>;
}
