# IoT Controller - Instruções de Produção

## Executando em Produção

### Para Node.js v18 (Compatibilidade)

Se você estiver usando Node.js v18.x, use o script de compatibilidade:

```bash
# 1. Fazer o build da aplicação
npm run build

# 2. Executar o servidor de produção com compatibilidade
NODE_ENV=production node start-prod.js
```

### Para Node.js v20+ (Nativo)

Se você estiver usando Node.js v20 ou superior:

```bash
# 1. Fazer o build da aplicação
npm run build

# 2. Executar o servidor de produção
npm run start
```

## Verificação

Após iniciar o servidor, você pode verificar se está funcionando:

```bash
# Testar a API
curl http://localhost:5000/api/devices

# Ou abrir no navegador
http://localhost:5000
```

## Configuração de Rede

O servidor está configurado para escutar em `0.0.0.0:5000`, tornando-o acessível:

- **Localmente**: http://localhost:5000
- **Na rede local**: http://SEU-IP:5000

Para encontrar seu IP local:
```bash
# Linux/Mac
ip addr show | grep inet
# ou
ifconfig | grep inet
```

## Funcionalidades Disponíveis

✓ Interface mobile-first com tema OLED  
✓ Adicionar dispositivos ESPHome manualmente  
✓ Descoberta automática de dispositivos na rede  
✓ Controle de dispositivos (luzes, sensores, switches)  
✓ Configurações de servidor ESPHome  
✓ Interface responsiva para desktop e mobile  

## Notas Importantes

- A aplicação inicia sem dispositivos de teste
- Adicione seus dispositivos ESPHome reais através da interface
- Configure o servidor ESPHome nas configurações
- O tema OLED otimiza o uso de bateria em telas OLED
- Antes de fazer o deploy, execute `npm run build` para gerar a pasta `dist/`.
