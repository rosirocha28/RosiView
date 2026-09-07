/**
 * RosiView — Dataflow Runtime Engine
 * Motor de execução de fluxo de dados em tempo real com laço While Loop, controle de dt,
 * modo Highlight Execution e integração direta com a camada DAQ (Hardware Real / Virtual)
 */

export class RosiViewRuntime {
  constructor({ graph, daqDevice, frontPanel }) {
    this.graph = graph;
    this.daq = daqDevice;
    this.frontPanel = frontPanel;

    this.isRunning = false;
    this.isContinuous = false;
    this.isHighlight = false;
    this.timerId = null;

    this.dt = 0.05;           // Passo de tempo padrão: 50ms (20 Hz)
    this.simTime = 0.0;       // Tempo acumulado de simulação
    this.iterationCount = 0;  // Contador de iterações do laço [i]

    this.onStateChange = null;
    this.onStepCompleted = null;
  }

  setDAQDevice(daq) {
    this.daq = daq;
  }

  setHighlight(active) {
    this.isHighlight = Boolean(active);
  }

  /**
   * Executa uma única iteração do fluxo de dados
   */
  async step() {
    const executionOrder = this.graph.getExecutionOrder();
    const context = {
      t: this.simTime,
      dt: this.dt,
      iteration: this.iterationCount,
      daq: this.daq,
      runtime: this
    };

    // 1. Atualiza os nós de controle a partir dos valores da IHM do Painel Frontal
    if (this.frontPanel) {
      this.frontPanel.syncControlsToDiagram();
    }

    // 2. Propaga dados através das conexões (Wires)
    for (const [, conn] of this.graph.connections) {
      const fromNode = this.graph.getNode(conn.fromNodeId);
      const toNode = this.graph.getNode(conn.toNodeId);

      if (fromNode && toNode) {
        const outTerm = fromNode.outputs.get(conn.fromTerminalId);
        const inTerm = toNode.inputs.get(conn.toTerminalId);

        if (outTerm && inTerm) {
          inTerm.value = outTerm.value;
        }
      }
    }

    // 3. Executa cada nó na ordem topológica
    for (const node of executionOrder) {
      if (this.isHighlight) {
        const nodeEl = document.getElementById(`node_${node.id}`);
        if (nodeEl) nodeEl.classList.add('executing');
        await new Promise(r => setTimeout(r, 40));
      }

      node.execute(context);

      if (this.isHighlight) {
        const nodeEl = document.getElementById(`node_${node.id}`);
        if (nodeEl) nodeEl.classList.remove('executing');
      }
    }

    // 4. Atualiza os instrumentos do Painel Frontal com os novos valores
    if (this.frontPanel) {
      this.frontPanel.syncDiagramToIndicators();
    }

    this.simTime += this.dt;
    this.iterationCount++;

    if (this.onStepCompleted) {
      this.onStepCompleted({ time: this.simTime, iteration: this.iterationCount });
    }
  }

  /**
   * Inicia a execução contínua (While Loop)
   */
  startContinuous() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isContinuous = true;

    if (this.onStateChange) this.onStateChange(true);

    const loopInterval = this.isHighlight ? 120 : (this.dt * 1000);
    
    this.timerId = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.timerId);
        return;
      }
      await this.step();
    }, loopInterval);
  }

  /**
   * Executa uma única vez (Single Run)
   */
  async runOnce() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (this.onStateChange) this.onStateChange(true);

    await this.step();

    this.isRunning = false;
    if (this.onStateChange) this.onStateChange(false);
  }

  /**
   * Para a execução
   */
  stop() {
    this.isRunning = false;
    this.isContinuous = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.onStateChange) this.onStateChange(false);
  }

  reset() {
    this.stop();
    this.simTime = 0.0;
    this.iterationCount = 0;
  }
}
