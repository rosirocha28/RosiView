/**
 * RosiView — Universal Bridge Client (HTTP Polling + WebSocket)
 * Camada universal de comunicação com hardware real (Chrome, Edge, Firefox)
 * Conecta ao micro-bridge local (RosiViewBridge.exe via HTTP ou rosiview_bridge.py via WebSocket)
 * na porta local 8765 (127.0.0.1:8765)
 */

import { IDAQDevice } from './daq_interface.js';

export class WSBridgeClient extends IDAQDevice {
  constructor(baseUrl = 'http://127.0.0.1:8765') {
    super('NI USB-6009 Universal Bridge');
    this.httpUrl = baseUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
    this.wsUrl = baseUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    
    this.mode = null; // 'http' | 'websocket' | null
    this.ws = null;
    this.pollInterval = null;
    this.connected = false;
    
    this.analogInputs = new Array(8).fill(0.0);
    this.analogOutputs = new Array(2).fill(0.0);
    this.digitalInputs = new Array(8).fill(false);
    this.digitalOutputs = new Array(8).fill(false);

    this.onStatusChange = null;
    this.failCount = 0;
    this.isPolling = false;
    this.deviceName = 'NI USB-6009';
  }

  async connect() {
    this.connected = false;
    this.mode = null;

    // 1. Tenta primeiro comunicação HTTP rápida com RosiViewBridge.exe
    try {
      // Solicita exibição da janela do console em segundo plano
      fetch(`${this.httpUrl}/show`, { cache: 'no-store' }).catch(() => {});

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const resp = await fetch(`${this.httpUrl}/`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.connected === true) {
          this.mode = 'http';
          this.connected = true;
          this.failCount = 0;
          if (data.device) this.deviceName = data.device;
          if (Array.isArray(data.ai)) this.analogInputs = data.ai;
          if (Array.isArray(data.ao)) this.analogOutputs = data.ao;
          this.startHttpPolling();
          if (this.onStatusChange) this.onStatusChange(true, this.deviceName);
          return true;
        } else {
          this.connected = false;
          if (this.onStatusChange) this.onStatusChange(false);
          throw new Error('PLACA_NAO_DETECTADA');
        }
      }
    } catch (e) {
      if (e.message === 'PLACA_NAO_DETECTADA') {
        throw new Error(
          'O Bridge do RosiView está ativo, mas nenhuma placa NI USB-6009 foi detectada no computador.\n\n' +
          '1. Conecte o cabo USB da placa à porta USB do computador.\n' +
          '2. Aguarde 2 segundos e clique em "Conectar" novamente.'
        );
      }
      // HTTP falhou ou não respondeu, tenta WebSocket
    }

    // 2. Se HTTP não respondeu, tenta WebSocket (compatível com rosiview_bridge.py)
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const ws = new WebSocket(this.wsUrl);
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            try { ws.close(); } catch (_) {}
            reject(new Error('Timeout de conexão WebSocket com Bridge local'));
          }
        }, 1500);

        ws.onopen = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.ws = ws;
            this.mode = 'websocket';
            this.connected = true;
            this.setupWebSocketListeners();
            if (this.onStatusChange) this.onStatusChange(true, this.deviceName);
            resolve(true);
          }
        };

        ws.onerror = (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        };
      });
      return true;
    } catch (e) {
      this.connected = false;
      if (this.onStatusChange) this.onStatusChange(false);
      throw new Error(
        'Não foi possível conectar ao Bridge da NI USB-6009 em 127.0.0.1:8765.\n\n' +
        'Certifique-se de executar o arquivo "INICIAR_ROSIVIEW_BRIDGE.bat" na pasta do RosiView.'
      );
    }
  }

  startHttpPolling() {
    this.stopHttpPolling();
    this.pollInterval = setInterval(async () => {
      if (this.isPolling) return;
      this.isPolling = true;
      try {
        const resp = await fetch(`${this.httpUrl}/`, { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.connected === true) {
            const wasDisconnected = !this.connected;
            this.connected = true;
            this.failCount = 0;
            if (data.device) this.deviceName = data.device;
            if (Array.isArray(data.ai)) this.analogInputs = data.ai;
            if (Array.isArray(data.ao)) this.analogOutputs = data.ao;
            if (wasDisconnected && this.onStatusChange) {
              this.onStatusChange(true, this.deviceName);
            }
          } else {
            // Placa desconectada fisicamente pelo usuário
            this.handlePhysicalDisconnect();
          }
        } else {
          this.handleHttpFail();
        }
      } catch (err) {
        this.handleHttpFail();
      } finally {
        this.isPolling = false;
      }
    }, 40); // 25 Hz
  }

  handlePhysicalDisconnect() {
    if (this.connected) {
      this.connected = false;
      this.analogInputs.fill(0.0);
      if (this.onStatusChange) this.onStatusChange(false);
    }
  }

  handleHttpFail() {
    this.failCount++;
    if (this.failCount > 4) {
      if (this.connected) {
        this.connected = false;
        this.analogInputs.fill(0.0);
        if (this.onStatusChange) this.onStatusChange(false);
      }
    }
  }

  stopHttpPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  setupWebSocketListeners() {
    if (!this.ws) return;
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ai_data' && Array.isArray(data.values)) {
          this.analogInputs = data.values;
        } else if (data.type === 'di_data' && Array.isArray(data.values)) {
          this.digitalInputs = data.values;
        }
      } catch (e) {
        console.warn('Erro ao decodificar dados do bridge:', e);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.onStatusChange) this.onStatusChange(false);
    };

    this.ws.onerror = () => {
      this.connected = false;
      if (this.onStatusChange) this.onStatusChange(false);
    };
  }

  async disconnect() {
    this.stopHttpPolling();
    fetch(`${this.httpUrl}/hide`, { cache: 'no-store' }).catch(() => {});
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this.connected = false;
    this.mode = null;
    if (this.onStatusChange) this.onStatusChange(false);
  }

  readAnalog(channel = 0) {
    return this.analogInputs[channel] || 0.0;
  }

  writeAnalog(channel = 0, voltage = 0.0) {
    const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
    this.analogOutputs[channel] = v;

    if (!this.connected) return;

    if (this.mode === 'http') {
      fetch(`${this.httpUrl}/write_ao?channel=${channel}&value=${v.toFixed(3)}`, {
        mode: 'cors',
        cache: 'no-store'
      }).catch(e => console.warn('Erro ao enviar AO via Bridge HTTP:', e));
    } else if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        cmd: 'write_ao',
        channel: channel,
        value: v
      }));
    }
  }

  readDigital(port = 0, line = 0) {
    return this.digitalInputs[line] || false;
  }

  writeDigital(port = 0, line = 0, value = false) {
    this.digitalOutputs[line] = Boolean(value);

    if (this.connected && this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        cmd: 'write_do',
        port: port,
        line: line,
        value: Boolean(value)
      }));
    }
  }
}
