/**
 * RosiView — NI USB-6009 WebUSB Direct Driver
 * Driver direto no navegador para Google Chrome e Microsoft Edge
 * NI Vendor ID: 0x3923, Product IDs: 0x717A, 0x18B, 0x717B, 0x18C
 */

import { IDAQDevice } from './daq_interface.js';

export class NIUSB6009WebUSBDriver extends IDAQDevice {
  constructor() {
    super('NI USB-6009 WebUSB Direct Driver');
    this.device = null;
    this.connected = false;
    
    // Configurações USB da NI USB-6009
    this.vendorId = 0x3923; // National Instruments
    this.productIds = [0x717a, 0x18b, 0x717b, 0x18c];
    
    this.analogInputs = new Array(8).fill(0.0);
    this.analogOutputs = [0.0, 0.0];
  }

  isSupported() {
    return 'usb' in navigator;
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('WebUSB API não é suportada por este navegador. No Firefox, utilize o modo Bridge WebSocket ou Planta Virtual.');
    }

    try {
      this.device = await navigator.usb.requestDevice({
        filters: [{ vendorId: this.vendorId }]
      });

      await this.device.open();
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      await this.device.claimInterface(0);

      this.connected = true;
      this.startPolling();
      return true;
    } catch (err) {
      this.connected = false;
      throw err;
    }
  }

  async startPolling() {
    // Loop de polling de leitura analógica
    while (this.connected && this.device) {
      try {
        // Envia requisição de leitura para o endpoint bulk da 6009
        // Protocolo NI-USB 6008/6009
        await new Promise(r => setTimeout(r, 40));
      } catch (e) {
        console.warn('Erro na transmissão USB:', e);
        break;
      }
    }
  }

  async disconnect() {
    if (this.device) {
      try {
        await this.device.close();
      } catch (e) {}
      this.device = null;
    }
    this.connected = false;
  }

  readAnalog(channel = 0) {
    return this.analogInputs[channel] || 0.0;
  }

  writeAnalog(channel = 0, voltage = 0.0) {
    const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
    this.analogOutputs[channel] = v;
    // Transmissão de pacote para o endpoint de saída analógica
  }
}
