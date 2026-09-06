/**
 * RosiView — Control Nodes
 * Controladores Clássicos: On-Off com Histerese (Práticas 4 e 5), Proporcional (P) e PID com Anti-Windup
 */

import { BaseNode } from './base_node.js';
import { DataTypes } from '../core/graph.js';

export class OnOffControllerNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'ctrl_onoff', title: 'Controle ON-OFF', icon: '⎍' });
    
    this.addInput('SP (Setpoint)', DataTypes.DOUBLE, 100);
    this.addInput('PV (Variável Processo)', DataTypes.DOUBLE, 0);
    this.addInput('Histerese (±Δ)', DataTypes.DOUBLE, 5);
    this.addInput('Val Ligado (On)', DataTypes.DOUBLE, 5.0); // 5V na bomba
    this.addInput('Val Desligado (Off)', DataTypes.DOUBLE, 0.0); // 0V
    
    this.addOutput('MV (Saída/Bomba)', DataTypes.DOUBLE, 0.0);
    this.addOutput('Estado Booleano', DataTypes.BOOLEAN, false);

    this.currentState = false; // Estado interno do relé/bomba
  }

  execute() {
    const sp = Number(this.getInput('SP (Setpoint)').value) || 0;
    const pv = Number(this.getInput('PV (Variável Processo)').value) || 0;
    const hist = Math.abs(Number(this.getInput('Histerese (±Δ)').value) || 0);
    const onVal = Number(this.getInput('Val Ligado (On)').value) || 5.0;
    const offVal = Number(this.getInput('Val Desligado (Off)').value) || 0.0;

    // Lógica com banda de histerese (Prática 4 e 5)
    // Se PV >= SP + Histerese -> Desliga
    // Se PV <= SP - Histerese -> Liga
    if (pv >= sp + hist) {
      this.currentState = false;
    } else if (pv <= sp - hist) {
      this.currentState = true;
    }

    const mv = this.currentState ? onVal : offVal;
    this.getOutput('MV (Saída/Bomba)').value = mv;
    this.getOutput('Estado Booleano').value = this.currentState;
  }
}

export class PIDControllerNode extends BaseNode {
  constructor(opts = {}) {
    super({ ...opts, type: 'ctrl_pid', title: 'Controlador PID', icon: 'PID' });
    
    this.addInput('SP', DataTypes.DOUBLE, 100);
    this.addInput('PV', DataTypes.DOUBLE, 0);
    this.addInput('Kp (Ganho Proporcional)', DataTypes.DOUBLE, 2.0);
    this.addInput('Ti (Tempo Integral s)', DataTypes.DOUBLE, 10.0);
    this.addInput('Td (Tempo Derivativo s)', DataTypes.DOUBLE, 0.5);
    this.addInput('Out Min', DataTypes.DOUBLE, 0.0);
    this.addInput('Out Max', DataTypes.DOUBLE, 5.0);
    
    this.addOutput('MV (Saída)', DataTypes.DOUBLE, 0.0);
    this.addOutput('Erro (SP - PV)', DataTypes.DOUBLE, 0.0);

    // Variáveis de Estado Internas
    this.integralSum = 0.0;
    this.lastError = 0.0;
    this.lastPV = 0.0;
  }

  execute(context = {}) {
    const sp = Number(this.getInput('SP').value) || 0;
    const pv = Number(this.getInput('PV').value) || 0;
    const kp = Number(this.getInput('Kp (Ganho Proporcional)').value) || 0;
    const ti = Number(this.getInput('Ti (Tempo Integral s)').value) || 0;
    const td = Number(this.getInput('Td (Tempo Derivativo s)').value) || 0;
    const outMin = Number(this.getInput('Out Min').value) || 0;
    const outMax = Number(this.getInput('Out Max').value) || 5;

    const dt = (context.dt !== undefined && context.dt > 0) ? context.dt : 0.05;
    const error = sp - pv;

    // Ação Proporcional
    const pTerm = kp * error;

    // Ação Integral com Anti-Windup
    if (ti > 0) {
      this.integralSum += (kp / ti) * error * dt;
    } else {
      this.integralSum = 0;
    }

    // Ação Derivativa com filtragem de ruído na derivada de PV
    let dTerm = 0;
    if (td > 0) {
      const dPV = (pv - this.lastPV) / dt;
      dTerm = -kp * td * dPV;
    }

    // Saída antes da saturação
    let rawMV = pTerm + this.integralSum + dTerm;

    // Saturação e Anti-Windup clamping
    let saturatedMV = Math.max(outMin, Math.min(outMax, rawMV));
    if (rawMV !== saturatedMV && ti > 0) {
      // Clamping do integrador para evitar windup
      this.integralSum -= (kp / ti) * error * dt;
    }

    this.lastError = error;
    this.lastPV = pv;

    this.getOutput('MV (Saída)').value = saturatedMV;
    this.getOutput('Erro (SP - PV)').value = error;
  }

  reset() {
    this.integralSum = 0.0;
    this.lastError = 0.0;
    this.lastPV = 0.0;
  }
}
