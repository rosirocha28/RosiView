/**
 * RosiView — DAQ Assistant Nodes (NI USB-6009)
 * Leitura de Entradas Analógicas (AI0 a AI7) e Escrita em Saídas Analógicas (AO0, AO1)
 * da Prática 5
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class DAQAssistantAINode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'daq_ai', title: 'DAQ Assistant (AI)', icon: '📥' });
    this.channel = opts.channel || 0; // ai0 por padrão
    this.minV = opts.minV !== undefined ? opts.minV : 0.0;
    this.maxV = opts.maxV !== undefined ? opts.maxV : 5.0;

    this.addOutput('data (Tensão V)', DataTypes.DOUBLE, 0.0);
  }

  setChannel(ch) {
    this.channel = parseInt(ch) || 0;
    this.title = `DAQ Assist (AI${this.channel})`;
  }

  execute(context = {}) {
    if (context.daq) {
      const voltage = context.daq.readAnalog(this.channel);
      this.getOutput('data (Tensão V)').value = voltage;
    }
  }

  toJSON() {
    const json = super.toJSON();
    json.channel = this.channel;
    json.minV = this.minV;
    json.maxV = this.maxV;
    return json;
  }
}

export class DAQAssistantAONode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'daq_ao', title: 'DAQ Assistant (AO)', icon: '📤' });
    this.channel = opts.channel !== undefined ? opts.channel : 1; // ao1 (Bomba) por padrão na Prática 5
    
    this.addInput('data (Tensão V)', DataTypes.DOUBLE, 0.0);
  }

  setChannel(ch) {
    this.channel = parseInt(ch) || 0;
    this.title = `DAQ Assist (AO${this.channel})`;
  }

  execute(context = {}) {
    if (context.daq) {
      const voltage = Number(this.getInput('data (Tensão V)').value) || 0.0;
      context.daq.writeAnalog(this.channel, voltage);
    }
  }

  toJSON() {
    const json = super.toJSON();
    json.channel = this.channel;
    return json;
  }
}
