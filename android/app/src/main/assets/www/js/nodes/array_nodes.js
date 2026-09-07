/**
 * RosiView — Array & Cluster/Bundle Nodes
 * Manipulação de vetores, criação de gráficos multi-traço (Build Array, Array Subset, Bundle)
 * das Práticas 2 e 3
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class BuildArrayNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'array_build', title: 'Build Array', icon: '[+]' });
    this.addInput('element 0', DataTypes.ANY, 0);
    this.addInput('element 1', DataTypes.ANY, 0);
    this.addOutput('appended array', DataTypes.ARRAY, []);
  }

  execute() {
    const el0 = this.getInput('element 0').value;
    const el1 = this.getInput('element 1').value;

    let res = [];
    if (Array.isArray(el0)) res = res.concat(el0);
    else if (el0 !== undefined) res.push(el0);

    if (Array.isArray(el1)) res = res.concat(el1);
    else if (el1 !== undefined) res.push(el1);

    this.getOutput('appended array').value = res;
  }
}

export class ArraySubsetNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'array_subset', title: 'Array Subset', icon: '[..]' });
    this.addInput('array', DataTypes.ARRAY, []);
    this.addInput('index', DataTypes.INTEGER, 0);
    this.addInput('length', DataTypes.INTEGER, 5);
    this.addOutput('subarray', DataTypes.ARRAY, []);
  }

  execute() {
    const arr = this.getInput('array').value;
    const idx = Math.max(0, parseInt(this.getInput('index').value) || 0);
    const len = Math.max(0, parseInt(this.getInput('length').value) || 0);

    if (Array.isArray(arr)) {
      this.getOutput('subarray').value = arr.slice(idx, idx + len);
    } else {
      this.getOutput('subarray').value = [];
    }
  }
}

export class BundleNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'cluster_bundle', title: 'Bundle (Cluster)', icon: '📦' });
    this.addInput('plot 0 (SP)', DataTypes.ANY, 0);
    this.addInput('plot 1 (PV)', DataTypes.ANY, 0);
    this.addInput('plot 2 (MV)', DataTypes.ANY, 0);
    this.addOutput('output cluster', DataTypes.CLUSTER, {});
  }

  execute() {
    const p0 = this.getInput('plot 0 (SP)').value;
    const p1 = this.getInput('plot 1 (PV)').value;
    const p2 = this.getInput('plot 2 (MV)').value;

    this.getOutput('output cluster').value = {
      plots: [p0, p1, p2].filter(v => v !== undefined)
    };
  }
}
