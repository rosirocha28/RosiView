/**
 * RosiView — Plant & Transfer Function Nodes
 * Bloco de Função de Transferência de 1ª Ordem G(s) = Kp / (tau*s + 1)
 * da Prática 4
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class TransferFunctionNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'plant_tf', title: 'Processo G(s)', icon: 'G(s)' });
    
    this.addInput('u (Entrada/MV)', DataTypes.DOUBLE, 0.0);
    this.addInput('Kp (Ganho)', DataTypes.DOUBLE, opts.kp || 1.0);
    this.addInput('tau (Constante s)', DataTypes.DOUBLE, opts.tau || 5.0);
    this.addInput('theta (Atraso s)', DataTypes.DOUBLE, opts.theta || 0.0);
    
    this.addOutput('y (Saída/PV)', DataTypes.DOUBLE, 0.0);

    this.y = 0.0;
    this.historyQueue = [];
  }

  execute(context = {}) {
    const u = Number(this.getInput('u (Entrada/MV)').value) || 0.0;
    const kp = Number(this.getInput('Kp (Ganho)').value) || 1.0;
    const tau = Math.max(0.001, Number(this.getInput('tau (Constante s)').value) || 5.0);
    const theta = Math.max(0, Number(this.getInput('theta (Atraso s)').value) || 0.0);
    const dt = (context.dt !== undefined && context.dt > 0) ? context.dt : 0.05;

    // Gerenciamento de atraso de transporte
    const now = Date.now();
    this.historyQueue.push({ time: now, val: u });
    const cutoff = now - (theta * 1000);
    
    let delayedU = u;
    while (this.historyQueue.length > 0 && this.historyQueue[0].time <= cutoff) {
      delayedU = this.historyQueue.shift().val;
    }
    if (this.historyQueue.length > 0 && theta > 0) {
      delayedU = this.historyQueue[0].val;
    }

    // Integração de 1ª ordem: dy/dt = (Kp * delayedU - y) / tau
    const dy = ((kp * delayedU - this.y) / tau) * dt;
    this.y += dy;

    this.getOutput('y (Saída/PV)').value = this.y;
  }

  reset() {
    this.y = 0.0;
    this.historyQueue = [];
  }

  toJSON() {
    const json = super.toJSON();
    json.y = this.y;
    return json;
  }
}
