/**
 * RosiView — Base Node Class
 * Classe base para todos os blocos funcionais do Diagrama de Blocos
 */

import { Terminal, DataTypes } from '../core/graph.js';

export class BaseNode {
  constructor({ id, type, title, x = 100, y = 100, icon = 'ƒ' }) {
    this.id = id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.type = type;
    this.title = title || type;
    this.x = x;
    this.y = y;
    this.icon = icon;
    
    this.inputs = new Map();   // terminalId -> Terminal
    this.outputs = new Map();  // terminalId -> Terminal

    this.state = {};
  }

  addInput(name, type = DataTypes.DOUBLE, defaultValue = 0) {
    const id = `${this.id}_in_${name}`;
    const term = new Terminal({ id, nodeId: this.id, name, type, isOutput: false, defaultValue });
    this.inputs.set(id, term);
    return term;
  }

  addOutput(name, type = DataTypes.DOUBLE, defaultValue = 0) {
    const id = `${this.id}_out_${name}`;
    const term = new Terminal({ id, nodeId: this.id, name, type, isOutput: true, defaultValue });
    this.outputs.set(id, term);
    return term;
  }

  getInput(name) {
    const id = `${this.id}_in_${name}`;
    return this.inputs.get(id);
  }

  getOutput(name) {
    const id = `${this.id}_out_${name}`;
    return this.outputs.get(id);
  }

  /**
   * Execução da lógica do bloco durante o ciclo de dataflow
   * @param {Object} context - Contexto com runtime, DAQ, tempo t e dt
   */
  execute(context) {
    // Implementar nas subclasses
  }

  toJSON() {
    const inputsList = [];
    for (const [, inTerm] of this.inputs) {
      inputsList.push({ name: inTerm.name, value: inTerm.value, type: inTerm.type });
    }
    const outputsList = [];
    for (const [, outTerm] of this.outputs) {
      outputsList.push({ name: outTerm.name, value: outTerm.value, type: outTerm.type });
    }

    return {
      id: this.id,
      type: this.type,
      title: this.title,
      x: this.x,
      y: this.y,
      icon: this.icon,
      state: this.state,
      linkedWidgetId: this.linkedWidgetId,
      dataType: this.dataType,
      constantValue: this.constantValue,
      channel: this.channel,
      code: this.code,
      gain: this.gain,
      kp: this.kp,
      tau: this.tau,
      theta: this.theta,
      inputNames: inputsList.map(i => i.name),
      outputNames: outputsList.map(o => o.name),
      inputs: inputsList,
      outputs: outputsList
    };
  }
}
