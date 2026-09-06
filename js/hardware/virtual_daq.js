/**
 * RosiView — Virtual DAQ Driver
 * Driver de Simulação Universal (Compatível com Firefox, Chrome, Edge, Celulares e Tablets)
 * Conecta os canais AI0..AI7 e AO0..AO1 aos modelos dinâmicos das plantas virtuais
 */

import { IDAQDevice } from './daq_interface.js';
import { WaterTankSimulator } from '../plants/water_tank_sim.js';
import { ThermalSimulator } from '../plants/thermal_sim.js';

export class VirtualDAQDriver extends IDAQDevice {
  constructor() {
    super('Virtual DAQ Simulator (NI USB-6009 Emulation)');
    this.connected = true;
    
    // Plantas Virtuais Embutidas
    this.tankSim = new WaterTankSimulator();
    this.thermalSim = new ThermalSimulator();
    
    // Estados dos Canais
    this.analogOutputs = [0.0, 0.0]; // AO0, AO1
    this.digitalOutputs = new Array(8).fill(false);
    this.digitalInputs = new Array(8).fill(false);
    
    // Modos de Simulação Selecionados
    this.activePlant = 'tank'; // 'tank' ou 'thermal'
  }

  async connect() {
    this.connected = true;
    return true;
  }

  async disconnect() {
    this.connected = false;
    return true;
  }

  /**
   * Lê a tensão de um canal analógico (0 a 5V)
   * ai0: Sensor de nível do tanque (ou sensor térmico)
   * ai1: Sensor secundário
   * ai2..ai7: Canais auxiliares / Ruído
   */
  readAnalog(channel = 0) {
    if (this.activePlant === 'tank') {
      if (channel === 0) {
        return this.tankSim.getSensorVoltage();
      } else if (channel === 1) {
        return (this.analogOutputs[0] || 0.0); // Loopback do AO0
      }
    } else if (this.activePlant === 'thermal') {
      if (channel === 0) {
        return this.thermalSim.getSensorVoltage();
      }
    }
    
    // Canais não conectados
    return 0.0;
  }

  /**
   * Escreve tensão no canal de saída analógica
   * ao0: Atuação geral (0 a 5V)
   * ao1: Bomba da planta de nível (Prática 5)
   */
  writeAnalog(channel = 0, voltage = 0.0) {
    const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
    this.analogOutputs[channel] = v;
    
    // Atualiza dinamicamente as plantas físicas simuladas
    if (this.activePlant === 'tank') {
      // Se escrever em AO1 (Prática 5) ou AO0
      const pumpV = (channel === 1) ? v : (this.analogOutputs[1] || this.analogOutputs[0]);
      this.tankSim.step(pumpV, 0.05);
    } else if (this.activePlant === 'thermal') {
      this.thermalSim.step(this.analogOutputs[0], 0.05);
    }
  }

  readDigital(port = 0, line = 0) {
    return this.digitalInputs[line] || false;
  }

  writeDigital(port = 0, line = 0, value = false) {
    this.digitalOutputs[line] = Boolean(value);
  }

  setPlant(plantType = 'tank') {
    this.activePlant = plantType;
  }
}
