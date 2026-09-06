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
    super({ ...opts, type: 'logic_and', title: 'And', icon: '&' });
    this.addInput('x', DataTypes.BOOLEAN, false);
    this.addInput('y', DataTypes.BOOLEAN, false);
    this.addOutput('x .and. y', DataTypes.BOOLEAN, false);
  }

  execute() {
    const x = Boolean(this.getInput('x').value);
    const y = Boolean(this.getInput('y').value);
    this.getOutput('x .and. y').value = x && y;
  }
}

export class OrNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'logic_or', title: 'Or', icon: '≥1' });
    this.addInput('x', DataTypes.BOOLEAN, false);
    this.addInput('y', DataTypes.BOOLEAN, false);
    this.addOutput('x .or. y', DataTypes.BOOLEAN, false);
  }

  execute() {
    const x = Boolean(this.getInput('x').value);
    const y = Boolean(this.getInput('y').value);
    this.getOutput('x .or. y').value = x || y;
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
