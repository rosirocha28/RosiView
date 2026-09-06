/**
 * RosiView — Signal & Generator Nodes
 * Geração de sinais (Senoide, Randon Number 0-1, Constante, Degrau, Rampa)
 * das Práticas 2, 3 e 4
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class RandomNumberNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'sig_random', title: 'Random Number (0-1)', icon: '🎲' });
    this.addOutput('0-1', DataTypes.DOUBLE, 0);
  }

  execute() {
    this.getOutput('0-1').value = Math.random();
  }
}

export class SineNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'sig_sine', title: 'Sine', icon: '∿' });
    this.addInput('x (rad)', DataTypes.DOUBLE, 0);
    this.addInput('amplitude', DataTypes.DOUBLE, 1.0);
    this.addInput('frequency (Hz)', DataTypes.DOUBLE, 0.2);
    this.addOutput('sin(x)', DataTypes.DOUBLE, 0);
  }

  execute(context = {}) {
    const directX = this.getInput('x (rad)').value;
    const amp = Number(this.getInput('amplitude').value) || 1.0;
    const freq = Number(this.getInput('frequency (Hz)').value) || 0.2;

    if (directX !== undefined && directX !== 0) {
      this.getOutput('sin(x)').value = amp * Math.sin(Number(directX));
    } else {
      const t = context.t || 0;
      this.getOutput('sin(x)').value = amp * Math.sin(2 * Math.PI * freq * t);
    }
  }
}

export class ConstantNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'sig_const', title: 'Numeric Constant', icon: '#' });
    this.constantValue = opts.constantValue !== undefined ? opts.constantValue : 0;
    this.addOutput('value', DataTypes.DOUBLE, this.constantValue);
  }

  setValue(v) {
    this.constantValue = Number(v) || 0;
    this.getOutput('value').value = this.constantValue;
  }

  execute() {
    this.getOutput('value').value = this.constantValue;
  }

  toJSON() {
    const json = super.toJSON();
    json.constantValue = this.constantValue;
    return json;
  }
}

export class TimeStepNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'sig_step', title: 'Degrau (Step)', icon: '⌐' });
    this.stepTime = opts.stepTime || 2.0;
    this.initialVal = opts.initialVal || 0.0;
    this.finalVal = opts.finalVal || 1.0;
    this.addOutput('step', DataTypes.DOUBLE, 0.0);
  }

  execute(context = {}) {
    const t = context.t || 0;
    this.getOutput('step').value = (t >= this.stepTime) ? this.finalVal : this.initialVal;
  }
}
