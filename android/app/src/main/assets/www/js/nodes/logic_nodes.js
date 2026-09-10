/**
 * RosiView — Logic & Comparison Nodes
 * Blocos de comparação (> , < , == , >= , <=) e lógica booleana (AND, OR, NOT, Select)
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class GreaterNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_gt', title: 'Greater?', icon: '>' });
    this.addInput('x', DataTypes.DOUBLE, 0);
    this.addInput('y', DataTypes.DOUBLE, 0);
    this.addOutput('x > y?', DataTypes.BOOLEAN, false);
  }

  execute() {
    const x = Number(this.getInput('x').value) || 0;
    const y = Number(this.getInput('y').value) || 0;
    this.getOutput('x > y?').value = x > y;
  }
}

export class LessNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_lt', title: 'Less?', icon: '<' });
    this.addInput('x', DataTypes.DOUBLE, 0);
    this.addInput('y', DataTypes.DOUBLE, 0);
    this.addOutput('x < y?', DataTypes.BOOLEAN, false);
  }

  execute() {
    const x = Number(this.getInput('x').value) || 0;
    const y = Number(this.getInput('y').value) || 0;
    this.getOutput('x < y?').value = x < y;
  }
}

export class EqualNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_eq', title: 'Equal?', icon: '=' });
    this.addInput('x', DataTypes.DOUBLE, 0);
    this.addInput('y', DataTypes.DOUBLE, 0);
    this.addOutput('x == y?', DataTypes.BOOLEAN, false);
  }

  execute() {
    const x = Number(this.getInput('x').value) || 0;
    const y = Number(this.getInput('y').value) || 0;
    this.getOutput('x == y?').value = Math.abs(x - y) < 1e-6;
  }
}

export class AndNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_and', title: opts.title || 'And', icon: '&' });
    const count = opts.inputCount || 2;
    this.setupInputs(count);
    this.addOutput('x .and. y', DataTypes.BOOLEAN, false);
  }

  setupInputs(count) {
    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    this.inputs.clear();
    const total = Math.max(2, Math.min(8, count));
    for (let i = 0; i < total; i++) {
      this.addInput(names[i] || `in_${i + 1}`, DataTypes.BOOLEAN, false);
    }
    this.inputCount = total;
  }

  setInputCount(newCount, graph = null) {
    const total = Math.max(2, Math.min(8, Number(newCount) || 2));
    if (this.inputCount === total) return;

    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    if (total > this.inputCount) {
      for (let i = this.inputCount; i < total; i++) {
        this.addInput(names[i] || `in_${i + 1}`, DataTypes.BOOLEAN, false);
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
    let allTrue = true;
    for (const [, term] of this.inputs) {
      if (!term.value) {
        allTrue = false;
        break;
      }
    }
    this.getOutput('x .and. y').value = allTrue;
  }

  toJSON() {
    const json = super.toJSON ? super.toJSON() : { id: this.id, type: this.type, x: this.x, y: this.y, title: this.title };
    json.inputCount = this.inputCount || this.inputs.size;
    return json;
  }
}

export class OrNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_or', title: opts.title || 'Or', icon: '≥1' });
    const count = opts.inputCount || 2;
    this.setupInputs(count);
    this.addOutput('x .or. y', DataTypes.BOOLEAN, false);
  }

  setupInputs(count) {
    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    this.inputs.clear();
    const total = Math.max(2, Math.min(8, count));
    for (let i = 0; i < total; i++) {
      this.addInput(names[i] || `in_${i + 1}`, DataTypes.BOOLEAN, false);
    }
    this.inputCount = total;
  }

  setInputCount(newCount, graph = null) {
    const total = Math.max(2, Math.min(8, Number(newCount) || 2));
    if (this.inputCount === total) return;

    const names = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's'];
    if (total > this.inputCount) {
      for (let i = this.inputCount; i < total; i++) {
        this.addInput(names[i] || `in_${i + 1}`, DataTypes.BOOLEAN, false);
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
    let anyTrue = false;
    for (const [, term] of this.inputs) {
      if (Boolean(term.value)) {
        anyTrue = true;
        break;
      }
    }
    this.getOutput('x .or. y').value = anyTrue;
  }

  toJSON() {
    const json = super.toJSON ? super.toJSON() : { id: this.id, type: this.type, x: this.x, y: this.y, title: this.title };
    json.inputCount = this.inputCount || this.inputs.size;
    return json;
  }
}

export class NotNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_not', title: 'Not', icon: '!' });
    this.addInput('x', DataTypes.BOOLEAN, false);
    this.addOutput('.not. x', DataTypes.BOOLEAN, true);
  }

  execute() {
    const x = Boolean(this.getInput('x').value);
    this.getOutput('.not. x').value = !x;
  }
}

export class SelectNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_select', title: 'Select', icon: '?' });
    this.addInput('t', DataTypes.DOUBLE, 1);       // Valor se True
    this.addInput('s', DataTypes.BOOLEAN, false);  // Condição Seletora
    this.addInput('f', DataTypes.DOUBLE, 0);       // Valor se False
    this.addOutput('out', DataTypes.DOUBLE, 0);
  }

  execute() {
    const s = Boolean(this.getInput('s').value);
    const t = this.getInput('t').value;
    const f = this.getInput('f').value;
    this.getOutput('out').value = s ? t : f;
  }
}
