/**
 * RosiView — WebSocket Bridge Client
 * Camada de comunicação universal compatível com Firefox, Chrome e Edge
 * Conecta ao micro-bridge local (ws://127.0.0.1:8765) que se comunica com a NI USB-6009
 */

import { IDAQDevice } from './daq_interface.js';

export class WSBridgeClient extends IDAQDevice {
  constructor(serverUrl = 'ws://127.0.0.1:8765') {
    super('NI USB-6009 WebSocket Universal Bridge');
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    
    this.analogInputs = new Array(8).fill(0.0);
    this.analogOutputs = new Array(2).fill(0.0);
    this.digitalInputs = new Array(8).fill(false);
    this.digitalOutputs = new Array(8).fill(false);

    this.onStatusChange = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
        
        this.ws.onopen = () => {
          this.connected = true;
          if (this.onStatusChange) this.onStatusChange(true);
          resolve(true);
        };

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

        this.ws.onerror = (err) => {
          this.connected = false;
          if (this.onStatusChange) this.onStatusChange(false);
          reject(err);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }

  readAnalog(channel = 0) {
    return this.analogInputs[channel] || 0.0;
  }

  writeAnalog(channel = 0, voltage = 0.0) {
    const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
    this.analogOutputs[channel] = v;

    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
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

    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        cmd: 'write_do',
        port: port,
        line: line,
        value: Boolean(value)
      }));
    }
  }
}
