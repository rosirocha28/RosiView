/**
 * RosiView — Math Nodes
 * Blocos de operações matemáticas: Soma, Subtração, Multiplicação, Divisão, Ganho, Saturação
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class AddNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_add', title: opts.title || 'Add', icon: '+' });
    const count = opts.inputCount || 2;
    this.setupInputs(count);
    this.addOutput('x+y', DataTypes.DOUBLE, 0);
  }

  setupInputs(count) {
    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    this.inputs.clear();
    const total = Math.max(2, Math.min(8, count));
    for (let i = 0; i < total; i++) {
      this.addInput(names[i] || `in_${i + 1}`, DataTypes.DOUBLE, 0);
    }
    this.inputCount = total;
  }

  setInputCount(newCount, graph = null) {
    const total = Math.max(2, Math.min(8, Number(newCount) || 2));
    if (this.inputCount === total) return;

    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    if (total > this.inputCount) {
      for (let i = this.inputCount; i < total; i++) {
        this.addInput(names[i] || `in_${i + 1}`, DataTypes.DOUBLE, 0);
      }
    } else {
      const toRemove = [];
      const currentKeys = Array.from(this.inputs.keys());
      for (let i = total; i < currentKeys.length; i++) {
        toRemove.push(currentKeys[i]);
      }
      for (const k of toRemove) {
        if (graph) {
          const connsToRemove = [];
          for (const [cId, conn] of graph.connections) {
            if (conn.toNodeId === this.id && conn.toTerminalId === k) {
              connsToRemove.push(cId);
            }
          }
          connsToRemove.forEach(id => graph.connections.delete(id));
        }
        this.inputs.delete(k);
      }
    }
    this.inputCount = total;
  }

  execute() {
    let sum = 0;
    for (const [, term] of this.inputs) {
      sum += (Number(term.value) || 0);
    }
    this.getOutput('x+y').value = sum;
  }

  toJSON() {
    const json = super.toJSON ? super.toJSON() : { id: this.id, type: this.type, x: this.x, y: this.y, title: this.title };
    json.inputCount = this.inputCount || this.inputs.size;
    return json;
  }
}

export class SubtractNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_sub', title: 'Subtract', icon: '−' });
    this.addInput('x', DataTypes.DOUBLE, 0);
    this.addInput('y', DataTypes.DOUBLE, 0);
    this.addOutput('x-y', DataTypes.DOUBLE, 0);
  }

  execute() {
    const x = Number(this.getInput('x').value) || 0;
    const y = Number(this.getInput('y').value) || 0;
    this.getOutput('x-y').value = x - y;
  }
}

export class MultiplyNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_mul', title: opts.title || 'Multiply', icon: '×' });
    const count = opts.inputCount || 2;
    this.setupInputs(count);
    this.addOutput('x*y', DataTypes.DOUBLE, 1);
  }

  setupInputs(count) {
    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    this.inputs.clear();
    const total = Math.max(2, Math.min(8, count));
    for (let i = 0; i < total; i++) {
      this.addInput(names[i] || `in_${i + 1}`, DataTypes.DOUBLE, 1);
    }
    this.inputCount = total;
  }

  setInputCount(newCount, graph = null) {
    const total = Math.max(2, Math.min(8, Number(newCount) || 2));
    if (this.inputCount === total) return;

    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    if (total > this.inputCount) {
      for (let i = this.inputCount; i < total; i++) {
        this.addInput(names[i] || `in_${i + 1}`, DataTypes.DOUBLE, 1);
      }
    } else {
      const toRemove = [];
      const currentKeys = Array.from(this.inputs.keys());
      for (let i = total; i < currentKeys.length; i++) {
        toRemove.push(currentKeys[i]);
      }
      for (const k of toRemove) {
        if (graph) {
          const connsToRemove = [];
          for (const [cId, conn] of graph.connections) {
            if (conn.toNodeId === this.id && conn.toTerminalId === k) {
              connsToRemove.push(cId);
            }
          }
          connsToRemove.forEach(id => graph.connections.delete(id));
        }
        this.inputs.delete(k);
      }
    }
    this.inputCount = total;
  }

  execute() {
    let prod = 1;
    let hasArray = false;
    let arrayVal = null;

    for (const [, term] of this.inputs) {
      if (Array.isArray(term.value)) {
        hasArray = true;
        arrayVal = term.value;
      } else {
        prod *= (Number(term.value) || 0);
      }
    }

    if (hasArray && arrayVal) {
      this.getOutput('x*y').value = arrayVal.map(v => v * prod);
    } else {
      this.getOutput('x*y').value = prod;
    }
  }

  toJSON() {
    const json = super.toJSON ? super.toJSON() : { id: this.id, type: this.type, x: this.x, y: this.y, title: this.title };
    json.inputCount = this.inputCount || this.inputs.size;
    return json;
  }
}

export class DivideNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_div', title: 'Divide', icon: '÷' });
    this.addInput('x', DataTypes.DOUBLE, 1);
    this.addInput('y', DataTypes.DOUBLE, 1);
    this.addOutput('x/y', DataTypes.DOUBLE, 1);
  }

  execute() {
    const x = Number(this.getInput('x').value) || 0;
    const y = Number(this.getInput('y').value) || 1;
    this.getOutput('x/y').value = y !== 0 ? x / y : 0;
  }
}

export class GainNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_gain', title: 'Gain (Kp)', icon: 'K' });
    this.gain = opts.gain || 1.0;
    this.addInput('in', DataTypes.DOUBLE, 0);
    this.addOutput('out', DataTypes.DOUBLE, 0);
  }

  execute() {
    const val = Number(this.getInput('in').value) || 0;
    this.getOutput('out').value = val * this.gain;
  }
}

export class SaturationNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_sat', title: 'Saturation', icon: '⫰' });
    this.min = opts.min !== undefined ? opts.min : 0.0;
    this.max = opts.max !== undefined ? opts.max : 5.0;
    this.addInput('in', DataTypes.DOUBLE, 0);
    this.addOutput('out', DataTypes.DOUBLE, 0);
  }

  execute() {
    const val = Number(this.getInput('in').value) || 0;
    this.getOutput('out').value = Math.max(this.min, Math.min(this.max, val));
  }
}
