import { z } from 'zod';

export const insertDeviceSchema = z.object({
  name: z.string(),
  ip: z.string(),
  port: z.number().min(1).max(65535).default(80),
  apiPassword: z.string().optional().nullable(),
  deviceType: z.string().default('unknown'),
  autoDiscover: z.boolean().default(true),
});

export const updateDeviceSchema = insertDeviceSchema.partial();

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type UpdateDevice = z.infer<typeof updateDeviceSchema>;

export interface Device {
  id: number;
  name: string;
  ip: string;
  port: number;
  apiPassword?: string | null;
  deviceType: string;
  autoDiscover: boolean;
  isOnline: boolean;
  lastSeen: Date | null;
  createdAt: Date;
}

export const deviceCommandSchema = z.object({
  command: z.string(),
  entityId: z.string().optional(),
  value: z.any().optional(),
});

export type DeviceCommand = z.infer<typeof deviceCommandSchema>;

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
