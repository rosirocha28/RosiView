/**
 * RosiView — Math Nodes
 * Blocos de operações matemáticas: Soma, Subtração, Multiplicação, Divisão, Ganho, Saturação
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class AddNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'math_add', title: 'Add', icon: '+' });
    this.addInput('x', DataTypes.DOUBLE, 0);
    this.addInput('y', DataTypes.DOUBLE, 0);
    this.addOutput('x+y', DataTypes.DOUBLE, 0);
  }

  execute() {
    const x = Number(this.getInput('x').value) || 0;
    const y = Number(this.getInput('y').value) || 0;
    this.getOutput('x+y').value = x + y;
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
    super({ ...opts, type: 'math_mul', title: 'Multiply', icon: '×' });
    this.addInput('x', DataTypes.DOUBLE, 1);
    this.addInput('y', DataTypes.DOUBLE, 1);
    this.addOutput('x*y', DataTypes.DOUBLE, 1);
  }

  execute() {
    const x = this.getInput('x').value;
    const y = this.getInput('y').value;

    // Suporte a multiplicação de Array por Escalar (Prática 2)
    if (Array.isArray(x) && typeof y === 'number') {
      this.getOutput('x*y').value = x.map(v => v * y);
    } else if (Array.isArray(y) && typeof x === 'number') {
      this.getOutput('x*y').value = y.map(v => v * x);
    } else {
      this.getOutput('x*y').value = (Number(x) || 0) * (Number(y) || 0);
    }
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
