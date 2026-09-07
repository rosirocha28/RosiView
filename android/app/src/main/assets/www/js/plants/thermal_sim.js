/**
 * RosiView — Simulador Dinâmico Térmico (Thermal Process Simulation)
 * Modelo de 1ª ordem com dissipação ambiente e atraso de transporte
 */

export class ThermalSimulator {
  constructor() {
    this.ambientTemp = 22.0;    // Temperatura ambiente em °C
    this.currentTemp = 22.0;    // Temperatura atual em °C
    this.heaterPower = 0.0;     // Potência de aquecimento (0 a 100% ou 0 a 5V)
    this.tau = 12.0;            // Constante de tempo térmica em segundos
    this.gain = 1.2;            // Ganho térmico (°C / %potência)
    this.delayQueue = [];       // Fila de atraso de transporte
    this.deadTime = 1.5;        // Atraso de transporte (segundos)
  }

  step(heaterVoltage, dt = 0.05) {
    const v = Math.max(0, Math.min(5, Number(heaterVoltage) || 0));
    const powerPct = (v / 5.0) * 100.0;
    
    // Gerenciamento do atraso de transporte
    this.delayQueue.push({ time: Date.now(), val: powerPct });
    const cutoffTime = Date.now() - (this.deadTime * 1000);
    
    let delayedPower = 0;
    while (this.delayQueue.length > 0 && this.delayQueue[0].time <= cutoffTime) {
      delayedPower = this.delayQueue.shift().val;
    }
    if (this.delayQueue.length > 0) {
      delayedPower = this.delayQueue[0].val;
    }

    // dT/dt = (K * P - (T - Tamb)) / tau
    const targetTemp = this.ambientTemp + (this.gain * delayedPower);
    const dT = ((targetTemp - this.currentTemp) / this.tau) * dt;
    
    this.currentTemp += dT;
    return this.getTemperature();
  }

  getTemperature() {
    const noise = (Math.random() - 0.5) * 0.15;
    return this.currentTemp + noise;
  }

  /**
   * Converte a temperatura para tensão do sensor de 0-5V (escala 20°C a 70°C da Prática 1)
   */
  getSensorVoltage() {
    const t = this.getTemperature();
    // T = 10 * V + 20  =>  V = (T - 20) / 10
    const v = (t - 20.0) / 10.0;
    return Math.max(0, Math.min(5.0, v));
  }

  reset(ambient = 22.0) {
    this.ambientTemp = ambient;
    this.currentTemp = ambient;
    this.delayQueue = [];
  }
}
