import { queryClient } from "./queryClient";

export interface ApiError {
  message: string;
  errors?: any[];
}

export class ApiClient {
  private baseUrl = "";

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message);
    }

    return response.json();
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message);
    }

    return response.json();
  }

  async put<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message);
    }

    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();

// Device-specific API functions
export const deviceApi = {
  getAll: () => apiClient.get("/api/devices"),
  getById: (id: number) => apiClient.get(`/api/devices/${id}`),
  create: (device: any) => apiClient.post("/api/devices", device),
  update: (id: number, device: any) => apiClient.put(`/api/devices/${id}`, device),
  delete: (id: number) => apiClient.delete(`/api/devices/${id}`),
  testConnection: (data: { ip: string; port: number; apiPassword?: string }) =>
    apiClient.post("/api/devices/test-connection", data),
  scan: () => apiClient.post("/api/devices/scan"),
  sendCommand: (id: number, command: any) =>
    apiClient.post(`/api/devices/${id}/command`, command),
  getStatus: (id: number) => apiClient.get(`/api/devices/${id}/status`),
};
