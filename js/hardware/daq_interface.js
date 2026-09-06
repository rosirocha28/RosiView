/**
 * RosiView — DAQ Interface Abstraction
 * Define o contrato padrão para comunicação com placas reais e simuladores virtuais
 */

export class IDAQDevice {
  constructor(name = 'Generic DAQ') {
    this.name = name;
    this.connected = false;
  }

  async connect() {
    throw new Error('connect() não implementado');
  }

  async disconnect() {
    this.connected = false;
  }

  /**
   * Lê a tensão de um canal analógico (ex: AI0 a AI7) em Volts
   */
  readAnalog(channel = 0) {
    return 0.0;
  }

  /**
   * Escreve uma tensão em um canal analógico (ex: AO0 ou AO1) de 0 a 5V
   */
  writeAnalog(channel = 0, voltage = 0.0) {
    // Implementar no driver
  }

  /**
   * Lê uma porta/linha digital (ex: P0.0 a P0.7)
   */
  readDigital(port = 0, line = 0) {
    return false;
  }

  /**
   * Escreve em uma linha digital
   */
  writeDigital(port = 0, line = 0, value = false) {
    // Implementar no driver
  }
}
