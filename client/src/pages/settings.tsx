import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings as SettingsIcon, 
  Wifi, 
  Monitor, 
  Palette, 
  Shield, 
  RefreshCw,
  Save,
  RotateCcw,
  ArrowLeft
} from "lucide-react";

const settingsSchema = z.object({
  serverUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  discoveryInterval: z.coerce.number().min(5).max(300),
  theme: z.enum(["dark", "auto"]),
  autoRefresh: z.boolean(),
  showOfflineDevices: z.boolean(),
  enableNotifications: z.boolean(),
  apiTimeout: z.coerce.number().min(1000).max(30000),
  maxRetries: z.coerce.number().min(1).max(10),
});

type SettingsData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Load settings from localStorage or use defaults
  const getStoredSettings = (): SettingsData => {
    try {
      const stored = localStorage.getItem('iot-controller-settings');
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    return defaultSettings;
  };

  const defaultSettings: SettingsData = {
    serverUrl: "",
    discoveryInterval: 30,
    theme: "dark",
    autoRefresh: true,
    showOfflineDevices: true,
    enableNotifications: true,
    apiTimeout: 5000,
    maxRetries: 3,
  };

  const form = useForm<SettingsData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: getStoredSettings(),
  });

  const onSubmit = async (data: SettingsData) => {
    setIsLoading(true);
    try {
      // Save to localStorage
      localStorage.setItem('iot-controller-settings', JSON.stringify(data));
      
      toast({
        title: "Configurações salvas",
        description: "Suas configurações foram salvas com sucesso",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefaults = () => {
    form.reset(defaultSettings);
    toast({
      title: "Configurações restauradas",
      description: "Configurações padrão foram restauradas",
      duration: 3000,
    });
  };

  const testConnection = async () => {
    const serverUrl = form.getValues("serverUrl");
    if (!serverUrl) {
      toast({
        title: "URL não configurada",
        description: "Configure a URL do servidor ESPHome primeiro",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), form.getValues("apiTimeout"));
      
      const response = await fetch(`${serverUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        toast({
          title: "Conexão bem-sucedida",
          description: "Servidor ESPHome está respondendo",
          duration: 4000,
        });
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      toast({
        title: "Falha na conexão",
        description: "Não foi possível conectar ao servidor ESPHome",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-oled">
      {/* Header */}
      <header className="surface border-b border-surface-elevated px-4 py-3 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-status-neutral hover:text-white hover:bg-surface-elevated">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <SettingsIcon className="w-6 h-6 text-status-neutral" />
            <h1 className="text-lg font-semibold">Configurações</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Server Configuration */}
          <Card className="surface border-surface-elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wifi className="w-5 h-5 text-status-neutral" />
                <span>Configuração do Servidor</span>
              </CardTitle>
              <CardDescription>
                Configure a conexão com o servidor ESPHome
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">URL do Servidor ESPHome</Label>
                <div className="flex space-x-2">
                  <Input
                    id="serverUrl"
                    placeholder="http://192.168.1.100:8123"
                    className="surface-elevated border-gray-600 focus:ring-status-neutral flex-1"
                    {...form.register("serverUrl")}
                  />
                  <Button
                    type="button"
                    onClick={testConnection}
                    disabled={isLoading}
                    className="btn-status-neutral"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Testar"
                    )}
                  </Button>
                </div>
                {form.formState.errors.serverUrl && (
                  <p className="text-sm text-status-off">
                    {form.formState.errors.serverUrl.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discoveryInterval">Intervalo de Descoberta (s)</Label>
                  <Input
                    id="discoveryInterval"
                    type="number"
                    min="5"
                    max="300"
                    className="surface-elevated border-gray-600 focus:ring-status-neutral"
                    {...form.register("discoveryInterval")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiTimeout">Timeout da API (ms)</Label>
                  <Input
                    id="apiTimeout"
                    type="number"
                    min="1000"
                    max="30000"
                    step="1000"
                    className="surface-elevated border-gray-600 focus:ring-status-neutral"
                    {...form.register("apiTimeout")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interface Configuration */}
          <Card className="surface border-surface-elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="w-5 h-5 text-status-neutral" />
                <span>Interface</span>
              </CardTitle>
              <CardDescription>
                Personalize a aparência e comportamento da interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoRefresh">Atualização Automática</Label>
                  <p className="text-sm text-secondary">
                    Atualiza automaticamente o status dos dispositivos
                  </p>
                </div>
                <Switch
                  id="autoRefresh"
                  checked={form.watch("autoRefresh")}
                  onCheckedChange={(checked) => form.setValue("autoRefresh", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showOfflineDevices">Mostrar Dispositivos Offline</Label>
                  <p className="text-sm text-secondary">
                    Exibe dispositivos que estão desconectados
                  </p>
                </div>
                <Switch
                  id="showOfflineDevices"
                  checked={form.watch("showOfflineDevices")}
                  onCheckedChange={(checked) => form.setValue("showOfflineDevices", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableNotifications">Notificações</Label>
                  <p className="text-sm text-secondary">
                    Receber notificações sobre mudanças de status
                  </p>
                </div>
                <Switch
                  id="enableNotifications"
                  checked={form.watch("enableNotifications")}
                  onCheckedChange={(checked) => form.setValue("enableNotifications", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Configuration */}
          <Card className="surface border-surface-elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-status-neutral" />
                <span>Configurações Avançadas</span>
              </CardTitle>
              <CardDescription>
                Configurações para usuários experientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxRetries">Máximo de Tentativas</Label>
                <Input
                  id="maxRetries"
                  type="number"
                  min="1"
                  max="10"
                  className="surface-elevated border-gray-600 focus:ring-status-neutral"
                  {...form.register("maxRetries")}
                />
                <p className="text-sm text-secondary">
                  Número de tentativas antes de marcar um dispositivo como offline
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-status-on font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </Button>
            <Button
              type="button"
              onClick={resetToDefaults}
              variant="secondary"
              className="flex-1 surface text-white hover:bg-opacity-80"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar Padrões
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}