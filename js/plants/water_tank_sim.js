/**
 * RosiView — Simulador Dinâmico do Tanque de Nível (Plant Simulation)
 * Baseado nos modelos físicos e experimentais das Práticas 4 e 5
 */

export class WaterTankSimulator {
  constructor() {
    // Parâmetros Físicos do Tanque
    this.maxHeight = 300;      // Altura máxima em mm (escala da Prática 5)
    this.currentLevel = 30;    // Nível atual (mm)
    this.area = 120.0;         // Área da seção transversal (cm²)
    this.cv = 1.45;            // Coeficiente de vazão da válvula de saída (cm³/s / sqrt(mm))
    this.pumpMaxFlow = 45.0;   // Vazão máxima da bomba de entrada (cm³/s)
    
    // Perturbação de Dreno
    this.disturbanceFlow = 0.0;// Vazão adicional de perturbação
    
    // Ruído do Sensor
    this.noiseAmplitude = 0.4; // Ruído gaussiano leve (mm)
    
    // Parâmetros de Calibração Sensor (Prática 5: Nivel = a * V + b)
    // Tensão 0V a 5V -> Nível 30mm a 280mm
    // V = (Nivel - 30) / (280 - 30) * 5
    this.vMin = 0.0;
    this.vMax = 5.0;
    this.hMin = 30.0;
    this.hMax = 280.0;
  }

  /**
   * Executa um passo de integração temporal (Euler)
   * @param {number} pumpVoltage - Tensão aplicada na bomba (0 a 5V)
   * @param {number} dt - Passo de tempo em segundos (ex: 0.05s)
   */
  step(pumpVoltage, dt = 0.05) {
    // Saturação da tensão de entrada
    const v = Math.max(0, Math.min(5, Number(pumpVoltage) || 0));
    
    // Vazão de entrada proporcional à tensão da bomba
    const qIn = (v / 5.0) * this.pumpMaxFlow;
    
    // Vazão de saída por gravidade (Não linear: Torricelli Cv * sqrt(h))
    const qOut = this.cv * Math.sqrt(Math.max(0, this.currentLevel));
    
    // Variação do nível: dh/dt = (qIn - qOut - qDisturb) / A
    const dh = ((qIn - qOut - this.disturbanceFlow) / this.area) * (dt * 10);
    
    this.currentLevel = Math.max(0, Math.min(this.maxHeight, this.currentLevel + dh));
    
    return this.getLevel();
  }

  /**
   * Retorna o nível medido atual em mm com leve ruído de processo
   */
  getLevel() {
    const noise = (Math.random() - 0.5) * this.noiseAmplitude;
    return Math.max(0, Math.min(this.maxHeight, this.currentLevel + noise));
  }

  /**
   * Retorna a tensão simulada do sensor de nível (0 a 5V) conectada ao canal AI0
   */
  getSensorVoltage() {
    const level = this.getLevel();
    const voltage = ((level - this.hMin) / (this.hMax - this.hMin)) * (this.vMax - this.vMin) + this.vMin;
    return Math.max(0, Math.min(5.0, voltage));
  }

  /**
   * Aplica uma perturbação de vazão (ex: abertura manual da válvula de dreno)
   */
  setDisturbance(active = true, magnitude = 12.0) {
    this.disturbanceFlow = active ? magnitude : 0.0;
  }

  reset(initialLevel = 30) {
    this.currentLevel = initialLevel;
    this.disturbanceFlow = 0.0;
  }
}
