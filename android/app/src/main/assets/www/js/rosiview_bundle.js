/**
 * ==========================================================================
 * RosiView — Standalone All-In-One Application Bundle (v2.0 - LabVIEW Two-Way Sync)
 * Suporte completo a criação de simulações do zero, sincronização bidirecional automática
 * entre Painel Frontal e Diagrama de Blocos, Menu de Contexto (Right-Click) e NI USB-6009.
 * ==========================================================================
 */

(function() {
  'use strict';

  // ==========================================================================
  // 1. DATA TYPES & GRAPH CORE
  // ==========================================================================
  const DataTypes = {
    DOUBLE: 'double',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    CLUSTER: 'cluster',
    ANY: 'any'
  };

  class Terminal {
    constructor({ id, nodeId, name, type = DataTypes.DOUBLE, isOutput = false, defaultValue = 0 }) {
      this.id = id;
      this.nodeId = nodeId;
      this.name = name;
      this.type = type;
      this.isOutput = isOutput;
      this.defaultValue = defaultValue;
      this.value = defaultValue;
    }
  }

  class Connection {
    constructor({ id, fromNodeId, fromTerminalId, toNodeId, toTerminalId, type = DataTypes.DOUBLE }) {
      this.id = id;
      this.fromNodeId = fromNodeId;
      this.fromTerminalId = fromTerminalId;
      this.toNodeId = toNodeId;
      this.toTerminalId = toTerminalId;
      this.type = type;
    }
  }

  class DiagramGraph {
    constructor() {
      this.nodes = new Map();
      this.connections = new Map();
    }

    addNode(node) {
      this.nodes.set(node.id, node);
      return node;
    }

    removeNode(nodeId) {
      const connToRemove = [];
      for (const [id, conn] of this.connections) {
        if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
          connToRemove.push(id);
        }
      }
      connToRemove.forEach(id => this.connections.delete(id));
      this.nodes.delete(nodeId);
    }

    getNode(nodeId) {
      return this.nodes.get(nodeId);
    }

    addConnection({ fromNodeId, fromTerminalId, toNodeId, toTerminalId, type }) {
      for (const [id, conn] of this.connections) {
        if (conn.toNodeId === toNodeId && conn.toTerminalId === toTerminalId) {
          this.connections.delete(id);
        }
      }
      const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const conn = new Connection({ id, fromNodeId, fromTerminalId, toNodeId, toTerminalId, type });
      this.connections.set(id, conn);
      return conn;
    }

    removeConnection(connectionId) {
      this.connections.delete(connectionId);
    }

    getExecutionOrder() {
      const inDegree = new Map();
      const adjList = new Map();

      for (const [nodeId] of this.nodes) {
        inDegree.set(nodeId, 0);
        adjList.set(nodeId, []);
      }

      for (const [, conn] of this.connections) {
        if (this.nodes.has(conn.fromNodeId) && this.nodes.has(conn.toNodeId)) {
          inDegree.set(conn.toNodeId, (inDegree.get(conn.toNodeId) || 0) + 1);
          adjList.get(conn.fromNodeId).push(conn.toNodeId);
        }
      }

      const queue = [];
      for (const [nodeId, deg] of inDegree) {
        if (deg === 0) queue.push(nodeId);
      }

      const order = [];
      while (queue.length > 0) {
        const current = queue.shift();
        order.push(current);

        for (const neighbor of (adjList.get(current) || [])) {
          inDegree.set(neighbor, inDegree.get(neighbor) - 1);
          if (inDegree.get(neighbor) === 0) {
            queue.push(neighbor);
          }
        }
      }

      for (const [nodeId] of this.nodes) {
        if (!order.includes(nodeId)) {
          order.push(nodeId);
        }
      }

      return order.map(id => this.nodes.get(id)).filter(Boolean);
    }

    clear() {
      this.nodes.clear();
      this.connections.clear();
    }

    toJSON() {
      const nodesData = [];
      for (const [, node] of this.nodes) {
        nodesData.push(node.toJSON ? node.toJSON() : { id: node.id, type: node.type, x: node.x, y: node.y });
      }
      return {
        nodes: nodesData,
        connections: Array.from(this.connections.values())
      };
    }
  }

  // ==========================================================================
  // 2. WIRE ROUTER
  // ==========================================================================
  class WireRouter {
    static getCubicBezierPath(x1, y1, x2, y2) {
      const dx = Math.abs(x2 - x1);
      const offset = Math.max(dx * 0.5, 35);
      return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
    }
  }

  // ==========================================================================
  // 3. PLANT SIMULATORS
  // ==========================================================================
  class WaterTankSimulator {
    constructor() {
      this.maxHeight = 300;
      this.currentLevel = 60.0;
      this.area = 120.0;
      this.cv = 1.45;
      this.pumpMaxFlow = 45.0;
      this.disturbanceFlow = 0.0;
      this.noiseAmplitude = 0.05;
      this.vMin = 0.0;
      this.vMax = 5.0;
    }

    step(pumpVoltage, dt = 0.05) {
      const v = Math.max(0, Math.min(5, Number(pumpVoltage) || 0));
      const qIn = (v / 5.0) * this.pumpMaxFlow;
      const qOut = this.cv * Math.sqrt(Math.max(0, this.currentLevel));
      const dh = ((qIn - qOut - this.disturbanceFlow) / this.area) * (dt * 10);
      this.currentLevel = Math.max(0, Math.min(this.maxHeight, this.currentLevel + dh));
      return this.getLevel();
    }

    getLevel() {
      const noise = (Math.random() - 0.5) * this.noiseAmplitude;
      return Math.max(0, Math.min(this.maxHeight, this.currentLevel + noise));
    }

    getSensorVoltage() {
      const level = this.getLevel();
      // Calibração real da bancada NI (Prática 5):
      // nivel (mm) = 126.5112 * V - 349.2611
      // => V = (nivel + 349.2611) / 126.5112
      const voltage = (level + 349.2611) / 126.5112;
      return Math.max(0.0, Math.min(5.0, voltage));
    }

    setDisturbance(active = true, magnitude = 14.0) {
      this.disturbanceFlow = active ? magnitude : 0.0;
    }

    reset(initialLevel = 60.0) {
      this.currentLevel = initialLevel;
      this.disturbanceFlow = 0.0;
    }
  }

  class ThermalSimulator {
    constructor() {
      this.ambientTemp = 22.0;
      this.currentTemp = 22.0;
      this.heaterPower = 0.0;
      this.tau = 12.0;
      this.gain = 1.2;
      this.delayQueue = [];
      this.deadTime = 1.5;
    }

    step(heaterVoltage, dt = 0.05) {
      const v = Math.max(0, Math.min(5, Number(heaterVoltage) || 0));
      const powerPct = (v / 5.0) * 100.0;
      this.delayQueue.push({ time: Date.now(), val: powerPct });
      const cutoffTime = Date.now() - (this.deadTime * 1000);
      let delayedPower = 0;
      while (this.delayQueue.length > 0 && this.delayQueue[0].time <= cutoffTime) {
        delayedPower = this.delayQueue.shift().val;
      }
      if (this.delayQueue.length > 0) delayedPower = this.delayQueue[0].val;

      const targetTemp = this.ambientTemp + (this.gain * delayedPower);
      const dT = ((targetTemp - this.currentTemp) / this.tau) * dt;
      this.currentTemp += dT;
      return this.getTemperature();
    }

    getTemperature() {
      const noise = (Math.random() - 0.5) * 0.15;
      return this.currentTemp + noise;
    }

    getSensorVoltage() {
      const t = this.getTemperature();
      const v = (t - 20.0) / 10.0;
      return Math.max(0, Math.min(5.0, v));
    }

    reset(ambient = 22.0) {
      this.ambientTemp = ambient;
      this.currentTemp = ambient;
      this.delayQueue = [];
    }
  }

  // ==========================================================================
  // 4. HARDWARE DRIVERS
  // ==========================================================================
  class IDAQDevice {
    constructor(name = 'Generic DAQ') {
      this.name = name;
      this.connected = false;
    }
    async connect() { return true; }
    async disconnect() { this.connected = false; }
    readAnalog(channel = 0) { return 0.0; }
    writeAnalog(channel = 0, voltage = 0.0) {}
    readDigital(port = 0, line = 0) { return false; }
    writeDigital(port = 0, line = 0, value = false) {}
  }

  class VirtualDAQDriver extends IDAQDevice {
    constructor() {
      super('Virtual DAQ Simulator');
      this.connected = true;
      this.tankSim = new WaterTankSimulator();
      this.thermalSim = new ThermalSimulator();
      this.analogOutputs = [0.0, 0.0];
      this.activePlant = 'tank';
    }

    stepSimulation(dt = 0.05) {
      if (this.activePlant === 'tank') {
        const pumpV = this.analogOutputs[1] !== undefined ? this.analogOutputs[1] : (this.analogOutputs[0] || 0.0);
        this.tankSim.step(pumpV, dt);
      } else if (this.activePlant === 'thermal') {
        this.thermalSim.step(this.analogOutputs[0] || 0.0, dt);
      }
    }

    readAnalog(channel = 0) {
      if (this.activePlant === 'tank') {
        if (channel === 0) return this.tankSim.getSensorVoltage();
        if (channel === 1) return (this.analogOutputs[1] !== undefined ? this.analogOutputs[1] : (this.analogOutputs[0] || 0.0));
      } else if (this.activePlant === 'thermal') {
        if (channel === 0) return this.thermalSim.getSensorVoltage();
      }
      return 0.0;
    }

    writeAnalog(channel = 0, voltage = 0.0) {
      const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
      this.analogOutputs[channel] = v;
      this.stepSimulation(0.05);
    }
  }

  class WSBridgeClient extends IDAQDevice {
    constructor(serverUrl = 'http://127.0.0.1:8765') {
      super('NI USB-6009 Bridge');
      this.serverUrl = serverUrl;
      this.ws = null;
      this.analogInputs = new Array(8).fill(0.0);
      this.analogOutputs = new Array(2).fill(0.0);
      this.pollInterval = null;
    }

    async connect() {
      // Tenta conexão HTTP direta com o RosiViewBridge nativo
      try {
        const res = await fetch('http://127.0.0.1:8765/data', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ai) this.analogInputs = data.ai;
          this.connected = true;
          this.startHttpPolling();
          return true;
        }
      } catch (e) {}

      // Fallback para WebSocket ws://127.0.0.1:8765
      return new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket('ws://127.0.0.1:8765');
          this.ws.onopen = () => { this.connected = true; resolve(true); };
          this.ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'ai_data' && Array.isArray(data.values)) {
                this.analogInputs = data.values;
              } else if (data.ai) {
                this.analogInputs = data.ai;
              }
            } catch (e) {}
          };
          this.ws.onclose = () => { this.connected = false; };
          this.ws.onerror = (err) => { 
            if (!this.connected) reject(new Error('Bridge não encontrado na porta 8765. Execute INICIAR_ROSIVIEW_BRIDGE.bat.')); 
          };
        } catch (e) { reject(e); }
      });
    }

    startHttpPolling() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(async () => {
        if (!this.connected) return;
        try {
          const res = await fetch('http://127.0.0.1:8765/data', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.ai) this.analogInputs = data.ai;
          }
        } catch (e) {}
      }, 30); // ~33 Hz
    }

    readAnalog(channel = 0) { 
      return this.analogInputs[channel] || 0.0; 
    }

    writeAnalog(channel = 0, voltage = 0.0) {
      const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
      this.analogOutputs[channel] = v;
      
      // Envia comando HTTP e/ou WebSocket
      fetch(`http://127.0.0.1:8765/write_ao?channel=${channel}&value=${v}`).catch(() => {});
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ cmd: 'write_ao', channel, value: v }));
      }
    }
  }

  class NIUSB6009WebUSBDriver extends IDAQDevice {
    constructor() {
      super('NI USB-6009 WebUSB Direct');
      this.device = null;
      this.vendorId = 0x3923;
      this.analogInputs = new Array(8).fill(0.0);
      this.analogOutputs = [0.0, 0.0];
      this.inEndpoint = 1;
      this.outEndpoint = 2;
      this.isPolling = false;
    }

    async connect() {
      if (!('usb' in navigator)) {
        throw new Error('WebUSB não suportado neste navegador. Utilize o Google Chrome ou Edge, ou selecione o modo Bridge/Planta Virtual.');
      }
      this.device = await navigator.usb.requestDevice({ filters: [{ vendorId: this.vendorId }] });
      await this.device.open();
      if (this.device.configuration === null) await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);

      // Identifica dinamicamente os endpoints IN e OUT
      try {
        const endpoints = this.device.configuration.interfaces[0].alternates[0].endpoints;
        for (const ep of endpoints) {
          if (ep.direction === 'in') this.inEndpoint = ep.endpointNumber;
          if (ep.direction === 'out') this.outEndpoint = ep.endpointNumber;
        }
      } catch (e) {}

      this.connected = true;
      this.startPolling();
      return true;
    }

    startPolling() {
      if (this.isPolling) return;
      this.isPolling = true;

      const poll = async () => {
        if (!this.connected || !this.device) {
          this.isPolling = false;
          return;
        }

        try {
          // Solicita leitura analógica do canal AI0
          const cmd = new Uint8Array(64);
          cmd[0] = 0x00; // Comando Leitura AI
          cmd[1] = 0x00; // Canal AI0
          cmd[2] = 0x00; // Modo RSE / 0-5V

          await this.device.transferOut(this.outEndpoint, cmd);
          const res = await this.device.transferIn(this.inEndpoint, 64);
          if (res && res.data && res.data.byteLength >= 2) {
            // Conversor AD 14-bit (0 a 5V)
            const raw16 = res.data.getInt16(0, false);
            const volt = Math.max(0.0, Math.min(5.0, (Math.abs(raw16) / 8192.0) * 5.0));
            this.analogInputs[0] = volt;
          }
        } catch (err) {
          // Erro temporário de pacote USB
        }

        setTimeout(poll, 40); // 25 Hz
      };

      poll();
    }

    readAnalog(channel = 0) { 
      return this.analogInputs[channel] || 0.0; 
    }

    async writeAnalog(channel = 0, voltage = 0.0) {
      const v = Math.max(0, Math.min(5.0, Number(voltage) || 0));
      this.analogOutputs[channel] = v;
      if (this.connected && this.device) {
        try {
          const rawDAC = Math.round((v / 5.0) * 4095);
          const cmd = new Uint8Array(64);
          cmd[0] = 0x03; // Comando Escrita AO
          cmd[1] = channel & 0x01; // AO0 ou AO1
          cmd[2] = (rawDAC >> 8) & 0x0F;
          cmd[3] = rawDAC & 0xFF;
          await this.device.transferOut(this.outEndpoint, cmd);
        } catch (e) {}
      }
    }
  }

  // ==========================================================================
  // 5. BASE NODE & TERMINAL NODES (DO PAINEL FRONTAL)
  // ==========================================================================
  class BaseNode {
    constructor({ id, type, title, x = 100, y = 100, icon = 'ƒ' }) {
      this.id = id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      this.type = type;
      this.title = title || type;
      this.x = x;
      this.y = y;
      this.icon = icon;
      this.inputs = new Map();
      this.outputs = new Map();
      this.state = {};
      this.linkedWidgetId = null; // Vínculo bidirecional com o Painel Frontal
    }

    addInput(name, type = DataTypes.DOUBLE, defaultValue = 0) {
      const id = `${this.id}_in_${name}`;
      const term = new Terminal({ id, nodeId: this.id, name, type, isOutput: false, defaultValue });
      this.inputs.set(id, term);
      return term;
    }

    addOutput(name, type = DataTypes.DOUBLE, defaultValue = 0) {
      const id = `${this.id}_out_${name}`;
      const term = new Terminal({ id, nodeId: this.id, name, type, isOutput: true, defaultValue });
      this.outputs.set(id, term);
      return term;
    }

    getInput(name) { return this.inputs.get(`${this.id}_in_${name}`); }
    getOutput(name) { return this.outputs.get(`${this.id}_out_${name}`); }
    toJSON() {
      const inputsList = [];
      for (const [, inTerm] of this.inputs) {
        inputsList.push({ name: inTerm.name, value: inTerm.value, type: inTerm.type });
      }
      const outputsList = [];
      for (const [, outTerm] of this.outputs) {
        outputsList.push({ name: outTerm.name, value: outTerm.value, type: outTerm.type });
      }

      return {
        id: this.id,
        type: this.type,
        title: this.title,
        x: this.x,
        y: this.y,
        icon: this.icon,
        state: this.state,
        linkedWidgetId: this.linkedWidgetId,
        dataType: this.dataType,
        constantValue: this.constantValue,
        channel: this.channel,
        code: this.code,
        gain: this.gain,
        kp: this.kp,
        tau: this.tau,
        theta: this.theta,
        inputNames: inputsList.map(i => i.name),
        outputNames: outputsList.map(o => o.name),
        inputs: inputsList,
        outputs: outputsList
      };
    }
  }

  // Terminal de Controle do Painel Frontal (Ex: Slider, Numeric Control, Chave Toggle)
  class FPControlTerminalNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'fp_control', title: opts.title || 'Controle', icon: '🎛' });
      this.linkedWidgetId = opts.linkedWidgetId;
      this.dataType = opts.dataType || DataTypes.DOUBLE;
      this.currentVal = opts.initialValue !== undefined ? opts.initialValue : 0;
      this.addOutput('value', this.dataType, this.currentVal);
    }
    setValue(val) {
      this.currentVal = val;
      this.getOutput('value').value = val;
    }
    execute() {
      this.getOutput('value').value = this.currentVal;
    }
  }

  // Terminal de Indicador do Painel Frontal (Ex: Tanque, Termômetro, Chart, LED, Numeric Indicator)
  class FPIndicatorTerminalNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'fp_indicator', title: opts.title || 'Indicador', icon: '📊' });
      this.linkedWidgetId = opts.linkedWidgetId;
      this.dataType = opts.dataType || DataTypes.DOUBLE;
      this.addInput('value', this.dataType, 0);
    }
    execute() {}
  }

  // ==========================================================================
  // 6. FUNCTION NODES
  // ==========================================================================
  class AddNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'math_add', title: opts.title || 'Soma', icon: '+' });
      this.addInput('x', DataTypes.DOUBLE, 0);
      this.addInput('y', DataTypes.DOUBLE, 0);
      this.addOutput('x+y', DataTypes.DOUBLE, 0);
    }
    execute() {
      this.getOutput('x+y').value = (Number(this.getInput('x').value) || 0) + (Number(this.getInput('y').value) || 0);
    }
  }

  class SubtractNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'math_sub', title: opts.title || 'Subtração', icon: '−' });
      this.addInput('x', DataTypes.DOUBLE, 0);
      this.addInput('y', DataTypes.DOUBLE, 0);
      this.addOutput('x-y', DataTypes.DOUBLE, 0);
    }
    execute() {
      this.getOutput('x-y').value = (Number(this.getInput('x').value) || 0) - (Number(this.getInput('y').value) || 0);
    }
  }

  class MultiplyNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'math_mul', title: opts.title || 'Multiplicação', icon: '×' });
      this.addInput('x', DataTypes.DOUBLE, 1);
      this.addInput('y', DataTypes.DOUBLE, 1);
      this.addOutput('x*y', DataTypes.DOUBLE, 1);
    }
    execute() {
      const x = this.getInput('x').value;
      const y = this.getInput('y').value;
      if (Array.isArray(x) && typeof y === 'number') {
        this.getOutput('x*y').value = x.map(v => v * y);
      } else if (Array.isArray(y) && typeof x === 'number') {
        this.getOutput('x*y').value = y.map(v => v * x);
      } else {
        this.getOutput('x*y').value = (Number(x) || 0) * (Number(y) || 0);
      }
    }
  }

  class DivideNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'math_div', title: opts.title || 'Divisão', icon: '÷' });
      this.addInput('x', DataTypes.DOUBLE, 1);
      this.addInput('y', DataTypes.DOUBLE, 1);
      this.addOutput('x/y', DataTypes.DOUBLE, 1);
    }
    execute() {
      const x = Number(this.getInput('x').value) || 0;
      const y = Number(this.getInput('y').value) || 1;
      this.getOutput('x/y').value = (y !== 0) ? x / y : 0;
    }
  }

  class GainNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'math_gain', title: opts.title || 'Ganho (Kp)', icon: 'K' });
      this.gain = opts.gain || 1.0;
      this.addInput('in', DataTypes.DOUBLE, 0);
      this.addOutput('out', DataTypes.DOUBLE, 0);
    }
    execute() {
      this.getOutput('out').value = (Number(this.getInput('in').value) || 0) * this.gain;
    }
  }

  class SaturationNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'math_sat', title: opts.title || 'Saturação', icon: '⫰' });
      this.min = opts.min !== undefined ? opts.min : 0.0;
      this.max = opts.max !== undefined ? opts.max : 5.0;
      this.addInput('in', DataTypes.DOUBLE, 0);
      this.addOutput('out', DataTypes.DOUBLE, 0);
    }
    execute() {
      const val = Number(this.getInput('in').value) || 0;
      this.getOutput('out').value = Math.max(this.min, Math.min(this.max, val));
    }
  }

  class FormulaNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'formula_node', title: opts.title || 'Formula Node', icon: 'fx' });
      this.code = opts.code || 'y = x;';
      if (opts.inputNames && Array.isArray(opts.inputNames)) {
        opts.inputNames.forEach(name => this.addInput(name, DataTypes.DOUBLE, 0));
      } else {
        this.addInput('x', DataTypes.DOUBLE, 0);
      }
      if (opts.outputNames && Array.isArray(opts.outputNames)) {
        opts.outputNames.forEach(name => this.addOutput(name, DataTypes.DOUBLE, 0));
      } else {
        this.addOutput('y', DataTypes.DOUBLE, 0);
      }
      this.internalState = {};
    }
    setCode(newCode) {
      this.code = newCode;
    }
    execute(context = {}) {
      try {
        const scope = {};
        // Carrega estado persistente anterior (ex: state da histerese)
        Object.assign(scope, this.internalState);

        for (const [, input] of this.inputs) {
          const val = Number(input.value) || 0;
          scope[input.name] = val;
          const cleanKey = input.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_$]/g, '_');
          if (cleanKey && cleanKey !== input.name) scope[cleanKey] = val;
        }
        if (context.t !== undefined && scope.t === undefined) scope.t = context.t;
        if (context.dt !== undefined && scope.dt === undefined) scope.dt = context.dt;
        for (const [, output] of this.outputs) {
          const val = output.value !== undefined ? output.value : 0;
          scope[output.name] = val;
          const cleanKey = output.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_$]/g, '_');
          if (cleanKey && cleanKey !== output.name) scope[cleanKey] = val;
        }

        const mathHelpers = { exp: Math.exp, sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt, pow: Math.pow, abs: Math.abs, max: Math.max, min: Math.min, PI: Math.PI };
        
        // Suporta tanto nomes diretos quanto nomes normalizados
        const returnProps = Array.from(this.outputs.values()).map(o => {
          const cleanKey = o.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_$]/g, '_');
          return `"${o.name}": (typeof ${cleanKey} !== 'undefined' ? ${cleanKey} : (typeof ${JSON.stringify(o.name)} !== 'undefined' ? ${JSON.stringify(o.name)} : 0))`;
        }).join(', ');

        const returnObjCode = `return { ${returnProps}, __internalState: (typeof state !== 'undefined' ? { state: state } : {}) };`;
        const fn = new Function(...Object.keys(mathHelpers), ...Object.keys(scope), `${this.code}\n${returnObjCode}`);
        const result = fn(...Object.values(mathHelpers), ...Object.values(scope));

        if (result && result.__internalState) {
          Object.assign(this.internalState, result.__internalState);
        }

        for (const [, output] of this.outputs) {
          if (result && result[output.name] !== undefined) {
            output.value = result[output.name];
          }
        }
      } catch (err) {}
    }
  }

  class GreaterNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_gt', title: opts.title || 'Maior que? (>)', icon: '>' });
      this.addInput('x', DataTypes.DOUBLE, 0);
      this.addInput('y', DataTypes.DOUBLE, 0);
      this.addOutput('x > y?', DataTypes.BOOLEAN, false);
    }
    execute() {
      this.getOutput('x > y?').value = (Number(this.getInput('x').value) || 0) > (Number(this.getInput('y').value) || 0);
    }
  }

  class LessNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_lt', title: opts.title || 'Menor que? (<)', icon: '<' });
      this.addInput('x', DataTypes.DOUBLE, 0);
      this.addInput('y', DataTypes.DOUBLE, 0);
      this.addOutput('x < y?', DataTypes.BOOLEAN, false);
    }
    execute() {
      this.getOutput('x < y?').value = (Number(this.getInput('x').value) || 0) < (Number(this.getInput('y').value) || 0);
    }
  }

  class EqualNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_eq', title: opts.title || 'Igual a? (=)', icon: '=' });
      this.addInput('x', DataTypes.DOUBLE, 0);
      this.addInput('y', DataTypes.DOUBLE, 0);
      this.addOutput('x == y?', DataTypes.BOOLEAN, false);
    }
    execute() {
      this.getOutput('x == y?').value = Math.abs((Number(this.getInput('x').value) || 0) - (Number(this.getInput('y').value) || 0)) < 1e-6;
    }
  }

  class AndNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_and', title: opts.title || 'Porta E (AND)', icon: '&' });
      this.addInput('x', DataTypes.BOOLEAN, false);
      this.addInput('y', DataTypes.BOOLEAN, false);
      this.addOutput('x .and. y', DataTypes.BOOLEAN, false);
    }
    execute() {
      this.getOutput('x .and. y').value = Boolean(this.getInput('x').value) && Boolean(this.getInput('y').value);
    }
  }

  class OrNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_or', title: opts.title || 'Porta OU (OR)', icon: '≥1' });
      this.addInput('x', DataTypes.BOOLEAN, false);
      this.addInput('y', DataTypes.BOOLEAN, false);
      this.addOutput('x .or. y', DataTypes.BOOLEAN, false);
    }
    execute() {
      this.getOutput('x .or. y').value = Boolean(this.getInput('x').value) || Boolean(this.getInput('y').value);
    }
  }

  class NotNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_not', title: opts.title || 'Inversor (NOT)', icon: '!' });
      this.addInput('x', DataTypes.BOOLEAN, false);
      this.addOutput('.not. x', DataTypes.BOOLEAN, true);
    }
    execute() {
      this.getOutput('.not. x').value = !Boolean(this.getInput('x').value);
    }
  }

  class SelectNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'logic_select', title: 'Select', icon: '?' });
      this.addInput('t', DataTypes.DOUBLE, 1);
      this.addInput('s', DataTypes.BOOLEAN, false);
      this.addInput('f', DataTypes.DOUBLE, 0);
      this.addOutput('out', DataTypes.DOUBLE, 0);
    }
    execute() {
      this.getOutput('out').value = Boolean(this.getInput('s').value) ? this.getInput('t').value : this.getInput('f').value;
    }
  }

  class BuildArrayNode extends BaseNode {
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

  class ArraySubsetNode extends BaseNode {
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
      this.getOutput('subarray').value = Array.isArray(arr) ? arr.slice(idx, idx + len) : [];
    }
  }

  class BundleNode extends BaseNode {
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
      this.getOutput('output cluster').value = { plots: [p0, p1, p2].filter(v => v !== undefined) };
    }
  }

  class OnOffControllerNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'ctrl_onoff', title: 'Controle ON-OFF', icon: '⎍' });
      this.addInput('SP (Setpoint)', DataTypes.DOUBLE, 100);
      this.addInput('PV (Variável Processo)', DataTypes.DOUBLE, 0);
      this.addInput('Histerese (±Δ)', DataTypes.DOUBLE, 5);
      this.addInput('Val Ligado (On)', DataTypes.DOUBLE, 5.0);
      this.addInput('Val Desligado (Off)', DataTypes.DOUBLE, 0.0);
      this.addOutput('MV (Saída/Bomba)', DataTypes.DOUBLE, 0.0);
      this.addOutput('Estado Booleano', DataTypes.BOOLEAN, false);
      this.currentState = false;
    }
    execute() {
      const sp = Number(this.getInput('SP (Setpoint)').value) || 0;
      const pv = Number(this.getInput('PV (Variável Processo)').value) || 0;
      const hist = Math.abs(Number(this.getInput('Histerese (±Δ)').value) || 0);
      const onVal = Number(this.getInput('Val Ligado (On)').value) || 5.0;
      const offVal = Number(this.getInput('Val Desligado (Off)').value) || 0.0;

      if (pv >= sp + hist) this.currentState = false;
      else if (pv <= sp - hist) this.currentState = true;

      this.getOutput('MV (Saída/Bomba)').value = this.currentState ? onVal : offVal;
      this.getOutput('Estado Booleano').value = this.currentState;
    }
  }

  class PIDControllerNode extends BaseNode {
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

      this.integralSum = 0.0;
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

      const pTerm = kp * error;
      if (ti > 0) this.integralSum += (kp / ti) * error * dt;
      else this.integralSum = 0;

      let dTerm = 0;
      if (td > 0) {
        const dPV = (pv - this.lastPV) / dt;
        dTerm = -kp * td * dPV;
      }

      let rawMV = pTerm + this.integralSum + dTerm;
      let saturatedMV = Math.max(outMin, Math.min(outMax, rawMV));
      if (rawMV !== saturatedMV && ti > 0) {
        this.integralSum -= (kp / ti) * error * dt;
      }

      this.lastPV = pv;
      this.getOutput('MV (Saída)').value = saturatedMV;
      this.getOutput('Erro (SP - PV)').value = error;
    }
  }

  class RandomNumberNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'sig_random', title: 'Random Number (0-1)', icon: '🎲' });
      this.addOutput('0-1', DataTypes.DOUBLE, 0);
    }
    execute() { this.getOutput('0-1').value = Math.random(); }
  }

  class SineNode extends BaseNode {
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

  class ConstantNode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'sig_const', title: opts.title || 'Constante', icon: '#' });
      this.constantValue = opts.constantValue !== undefined ? opts.constantValue : 0;
      this.addOutput('value', DataTypes.DOUBLE, this.constantValue);
    }
    setValue(v) {
      this.constantValue = Number(v) || 0;
      this.getOutput('value').value = this.constantValue;
    }
    execute() { this.getOutput('value').value = this.constantValue; }
    toJSON() {
      const json = super.toJSON();
      json.constantValue = this.constantValue;
      return json;
    }
  }

  class DAQAssistantAINode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'daq_ai', title: opts.title || 'DAQ Assist (ai0)', icon: '📥' });
      this.channel = opts.channel !== undefined ? opts.channel : 0;
      this.addOutput('data (Tensão V)', DataTypes.DOUBLE, 0.0);
    }
    execute(context = {}) {
      if (context.daq) {
        const val = context.daq.readAnalog(this.channel);
        for (const [, outTerm] of this.outputs) {
          outTerm.value = val;
        }
      }
    }
  }

  class DAQAssistantAONode extends BaseNode {
    constructor(opts = {}) {
      super({ ...opts, type: 'daq_ao', title: opts.title || 'DAQ Assist (ao1)', icon: '📤' });
      this.channel = opts.channel !== undefined ? opts.channel : 1;
      this.addInput('data (Tensão V)', DataTypes.DOUBLE, 0.0);
    }
    execute(context = {}) {
      if (context.daq) {
        let voltage = 0.0;
        for (const [, inTerm] of this.inputs) {
          voltage = Number(inTerm.value) || 0.0;
          break;
        }
        context.daq.writeAnalog(this.channel, voltage);
      }
    }
  }

  class TransferFunctionNode extends BaseNode {
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

      const now = Date.now();
      this.historyQueue.push({ time: now, val: u });
      const cutoff = now - (theta * 1000);
      let delayedU = u;
      while (this.historyQueue.length > 0 && this.historyQueue[0].time <= cutoff) {
        delayedU = this.historyQueue.shift().val;
      }
      if (this.historyQueue.length > 0 && theta > 0) delayedU = this.historyQueue[0].val;

      const dy = ((kp * delayedU - this.y) / tau) * dt;
      this.y += dy;
      this.getOutput('y (Saída/PV)').value = this.y;
    }
  }

  // ==========================================================================
  // 7. WIDGETS DO PAINEL FRONTAL
  // ==========================================================================
  class ThermometerWidget {
    constructor({ id, title = 'Termômetro', min = 0, max = 200, unit = '°C', x = 50, y = 50 }) {
      this.id = id;
      this.kind = 'thermometer';
      this.title = title;
      this.min = min;
      this.max = max;
      this.unit = unit;
      this.x = x;
      this.y = y;
      this.value = min;
      this.element = null;
      this.liquidEl = null;
      this.displayValEl = null;
      this.scaleEl = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="thermometer-wrapper">
            <div class="thermometer-scale" id="scale_${this.id}"></div>
            <div class="thermometer-body">
              <div class="thermometer-tube">
                <div class="thermometer-liquid" id="liquid_${this.id}"></div>
              </div>
              <div class="thermometer-bulb"></div>
            </div>
          </div>
          <div class="numeric-box" style="margin-top: 6px;">
            <div class="numeric-indicator-val" id="val_${this.id}">0.00</div>
            <span style="padding: 0 4px; font-weight: bold; font-size: 11px; color: #64748b;">${this.unit}</span>
          </div>
        </div>
      `;

      this.element = el;
      this.liquidEl = el.querySelector(`#liquid_${this.id}`);
      this.displayValEl = el.querySelector(`#val_${this.id}`);
      this.scaleEl = el.querySelector(`#scale_${this.id}`);

      this.updateScale();
      this.setValue(this.value);
      this.setupDrag();
    }

    updateScale() {
      this.scaleEl.innerHTML = '';
      const steps = 4;
      for (let i = steps; i >= 0; i--) {
        const val = this.min + (this.max - this.min) * (i / steps);
        const mark = document.createElement('div');
        mark.className = 'scale-mark';
        mark.innerHTML = `<span>${Math.round(val)}</span>`;
        this.scaleEl.appendChild(mark);
      }
    }

    setValue(val) {
      this.value = Number(val) || 0;
      const clamped = Math.max(this.min, Math.min(this.max, this.value));
      const pct = ((clamped - this.min) / (this.max - this.min)) * 100;
      if (this.liquidEl) this.liquidEl.style.height = `${pct}%`;
      if (this.displayValEl) this.displayValEl.textContent = this.value.toFixed(2);
    }

    setUnit(unit, min, max) {
      this.unit = unit;
      if (min !== undefined) this.min = min;
      if (max !== undefined) this.max = max;
      const span = this.element.querySelector('.numeric-box span');
      if (span) span.textContent = unit;
      this.updateScale();
      this.setValue(this.value);
    }

    setupDrag() {}
  }

  class TankWidget {
    constructor({ id, title = 'Tanque de Nível', min = 0, max = 300, unit = 'mm', x = 60, y = 60 }) {
      this.id = id;
      this.kind = 'tank';
      this.title = title;
      this.min = min;
      this.max = max;
      this.unit = unit;
      this.x = x;
      this.y = y;
      this.value = 30;
      this.element = null;
      this.waterEl = null;
      this.displayValEl = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="tank-container">
            <div class="tank-scale">
              <div>300 mm</div>
              <div>200 mm</div>
              <div>100 mm</div>
              <div>0 mm</div>
            </div>
            <div class="tank-vessel">
              <div class="tank-water" id="water_${this.id}">
                <div class="tank-wave"></div>
              </div>
            </div>
          </div>
          <div class="numeric-box" style="margin-top: 6px;">
            <div class="numeric-indicator-val" id="val_${this.id}">30.00</div>
            <span style="padding: 0 4px; font-weight: bold; font-size: 11px; color: #64748b;">${this.unit}</span>
          </div>
        </div>
      `;

      this.element = el;
      this.waterEl = el.querySelector(`#water_${this.id}`);
      this.displayValEl = el.querySelector(`#val_${this.id}`);
      this.setValue(this.value);
      this.setupDrag();
    }

    setValue(val) {
      this.value = Number(val) || 0;
      const clamped = Math.max(this.min, Math.min(this.max, this.value));
      const pct = ((clamped - this.min) / (this.max - this.min)) * 100;
      if (this.waterEl) this.waterEl.style.height = `${pct}%`;
      if (this.displayValEl) this.displayValEl.textContent = this.value.toFixed(2);
    }

    setupDrag() {}
  }

  class ChartWidget {
    constructor({ id, title = 'Waveform Chart', maxPoints = 200, x = 200, y = 50, plots = ['Plot 0'] }) {
      this.id = id;
      this.kind = 'chart';
      this.title = title;
      this.maxPoints = maxPoints;
      this.x = x;
      this.y = y;
      this.plotColors = ['#38bdf8', '#4ade80', '#f87171', '#fde047', '#c084fc'];
      this.plotNames = plots || ['Plot 0'];
      this.dataBuffers = this.plotNames.map(() => []);
      this.element = null;
      this.canvas = null;
      this.ctx = null;
      this.legendEl = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;
      el.style.padding = '4px';

      el.innerHTML = `
        <div class="fp-widget-header" style="margin-bottom: 2px;">${this.title}</div>
        <div class="chart-container">
          <div class="chart-header-bar">
            <div class="chart-legend" id="legend_${this.id}"></div>
            <button class="tool-btn" style="height: 20px; font-size: 10px; padding: 0 4px;" id="clear_${this.id}">Limpar</button>
          </div>
          <div class="chart-canvas-area">
            <canvas class="chart-canvas" id="canvas_${this.id}" width="420" height="210"></canvas>
          </div>
        </div>
      `;

      this.element = el;
      this.canvas = el.querySelector(`#canvas_${this.id}`);
      this.ctx = this.canvas.getContext('2d');
      this.legendEl = el.querySelector(`#legend_${this.id}`);

      el.querySelector(`#clear_${this.id}`).addEventListener('click', () => this.clear());
      this.updateLegend();
      this.draw();
      this.setupDrag();
    }

    updateLegend() {
      this.legendEl.innerHTML = '';
      this.plotNames.forEach((name, idx) => {
        const color = this.plotColors[idx % this.plotColors.length];
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="legend-color" style="background: ${color};"></span><span>${name}</span>`;
        this.legendEl.appendChild(item);
      });
    }

    setPlotNames(names) {
      if (Array.isArray(names) && names.length > 0) {
        this.plotNames = names;
        while (this.dataBuffers.length < names.length) {
          this.dataBuffers.push([]);
        }
        this.updateLegend();
      }
    }

    pushData(data) {
      if (typeof data === 'number') {
        if (this.dataBuffers[0]) {
          this.dataBuffers[0].push(data);
          if (this.dataBuffers[0].length > this.maxPoints) this.dataBuffers[0].shift();
        }
      } else if (Array.isArray(data)) {
        if (data.length !== this.plotNames.length) {
          const names = data.map((_, i) => (i === 0 ? 'SP' : i === 1 ? 'PV (Nível)' : 'MV (Bomba)'));
          this.setPlotNames(names);
        }
        data.forEach((val, idx) => {
          if (!this.dataBuffers[idx]) this.dataBuffers[idx] = [];
          this.dataBuffers[idx].push(Number(val) || 0);
          if (this.dataBuffers[idx].length > this.maxPoints) this.dataBuffers[idx].shift();
        });
      } else if (data && typeof data === 'object' && Array.isArray(data.plots)) {
        this.pushData(data.plots);
        return;
      }
      this.draw();
    }

    clear() {
      this.dataBuffers = this.plotNames.map(() => []);
      this.draw();
    }

    draw() {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      let minVal = Infinity, maxVal = -Infinity;
      for (const buf of this.dataBuffers) {
        for (const val of buf) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      }
      if (minVal === Infinity || maxVal === -Infinity || minVal === maxVal) {
        minVal = 0; maxVal = 100;
      } else {
        const margin = (maxVal - minVal) * 0.1 || 5;
        minVal -= margin; maxVal += margin;
      }

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const numGridY = 5;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      for (let i = 0; i <= numGridY; i++) {
        const y = (h / numGridY) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        const labelVal = maxVal - (maxVal - minVal) * (i / numGridY);
        ctx.fillText(labelVal.toFixed(1), 4, y - 2);
      }

      const numGridX = 8;
      for (let i = 0; i <= numGridX; i++) {
        const x = (w / numGridX) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      this.dataBuffers.forEach((buf, plotIdx) => {
        if (buf.length < 2) return;
        ctx.strokeStyle = this.plotColors[plotIdx % this.plotColors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        const stepX = w / (this.maxPoints - 1);
        const startXOffset = w - (buf.length - 1) * stepX;
        buf.forEach((val, i) => {
          const x = startXOffset + i * stepX;
          const normalizedY = (val - minVal) / (maxVal - minVal);
          const y = h - normalizedY * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    }

    setupDrag() {}
  }

  class KnobWidget {
    constructor({ id, title = 'Knob', min = 0, max = 10, step = 0.1, initialValue = 0, unit = 'V', x = 60, y = 60 }) {
      this.id = id;
      this.kind = 'knob';
      this.title = title;
      this.min = Number(min);
      this.max = Number(max);
      this.step = Number(step);
      this.value = Number(initialValue);
      this.unit = unit;
      this.x = x;
      this.y = y;
      this.element = null;
      this.dialWrapper = null;
      this.needleEl = null;
      this.inputEl = null;
      this.minLabelEl = null;
      this.maxLabelEl = null;
      this.unitEl = null;
      this.onChangeCallback = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="knob-container">
            <div class="knob-dial-wrapper" id="knob_dial_${this.id}" title="Arraste para cima/baixo ou use a roda do mouse">
              <svg class="knob-dial-svg" viewBox="0 0 78 78">
                <defs>
                  <radialGradient id="knob_grad_${this.id}" cx="40%" cy="40%" r="60%">
                    <stop offset="0%" stop-color="#475569" />
                    <stop offset="60%" stop-color="#1e293b" />
                    <stop offset="100%" stop-color="#0f172a" />
                  </radialGradient>
                </defs>
                <circle cx="39" cy="39" r="36" fill="#1e222d" stroke="#334155" stroke-width="2"/>
                <path d="M 13.5,64.5 A 36 36 0 1 1 64.5,64.5" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
                <circle cx="39" cy="39" r="28" fill="url(#knob_grad_${this.id})" stroke="#64748b" stroke-width="1.5"/>
                <g id="knob_needle_${this.id}" style="transform-origin: 39px 39px;">
                  <circle cx="39" cy="18" r="3.5" fill="#38bdf8"/>
                  <line x1="39" y1="21" x2="39" y2="29" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
                </g>
                <circle cx="39" cy="39" r="8" fill="#0f172a" stroke="#475569" stroke-width="1"/>
              </svg>
            </div>
            <div class="knob-scale-labels">
              <span id="knob_min_${this.id}">${this.min}</span>
              <span id="knob_max_${this.id}">${this.max}</span>
            </div>
            <div class="knob-bottom">
              <input type="number" class="knob-input" id="knob_num_${this.id}" 
                     step="${this.step}" min="${this.min}" max="${this.max}" value="${this.value}">
              <span class="knob-unit" id="knob_unit_${this.id}">${this.unit}</span>
            </div>
          </div>
        </div>
      `;

      this.element = el;
      this.dialWrapper = el.querySelector(`#knob_dial_${this.id}`);
      this.needleEl = el.querySelector(`#knob_needle_${this.id}`);
      this.inputEl = el.querySelector(`#knob_num_${this.id}`);
      this.minLabelEl = el.querySelector(`#knob_min_${this.id}`);
      this.maxLabelEl = el.querySelector(`#knob_max_${this.id}`);
      this.unitEl = el.querySelector(`#knob_unit_${this.id}`);

      this.setupInteractions();
      this.updateAngle();
      this.setupDrag();
    }

    setupInteractions() {
      this.inputEl.addEventListener('input', (e) => this.setValue(e.target.value));
      this.inputEl.addEventListener('change', (e) => this.setValue(e.target.value));
      this.dialWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? this.step : -this.step;
        this.setValue(this.value + delta);
      });

      let isDraggingDial = false, startY = 0, startVal = 0;
      this.dialWrapper.addEventListener('mousedown', (e) => {
        isDraggingDial = true;
        startY = e.clientY;
        startVal = this.value;
        const onMouseMove = (ev) => {
          if (!isDraggingDial) return;
          const dy = startY - ev.clientY;
          const range = this.max - this.min;
          this.setValue(startVal + (dy / 150) * range);
        };
        const onMouseUp = () => {
          isDraggingDial = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      this.element.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.getAttribute('contenteditable') === 'true') return;
        this.openConfigDialog();
      });
    }

    setValue(val) {
      let num = Number(val);
      if (isNaN(num)) num = this.min;
      num = Math.max(this.min, Math.min(this.max, num));
      const decimals = (this.step.toString().split('.')[1] || '').length;
      this.value = Number(num.toFixed(Math.max(decimals, 1)));
      if (this.inputEl && document.activeElement !== this.inputEl) this.inputEl.value = this.value;
      this.updateAngle();
      if (this.onChangeCallback) this.onChangeCallback(this.value);
    }

    updateAngle() {
      if (!this.needleEl) return;
      const range = this.max - this.min || 1;
      const pct = Math.max(0, Math.min(1, (this.value - this.min) / range));
      const angle = -135 + pct * 270;
      this.needleEl.style.transform = `rotate(${angle}deg)`;
    }

    getValue() { return this.value; }

    openConfigDialog() {
      const existing = document.querySelector('.widget-config-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'widget-config-modal';
      modal.innerHTML = `
        <div class="widget-config-box">
          <div class="widget-config-header">
            <span>Configuração do Knob</span>
            <button class="palette-close-btn" id="cfg_close">✕</button>
          </div>
          <div class="widget-config-body">
            <div class="config-field"><label>Rótulo / Título:</label><input type="text" id="cfg_title" value="${this.title}"></div>
            <div class="config-field"><label>Escala Mínima:</label><input type="number" id="cfg_min" value="${this.min}" step="any"></div>
            <div class="config-field"><label>Escala Máxima:</label><input type="number" id="cfg_max" value="${this.max}" step="any"></div>
            <div class="config-field"><label>Passo:</label><input type="number" id="cfg_step" value="${this.step}" step="any"></div>
            <div class="config-field"><label>Unidade:</label><input type="text" id="cfg_unit" value="${this.unit}"></div>
          </div>
          <div class="widget-config-footer">
            <button class="config-btn config-btn-cancel" id="cfg_cancel">Cancelar</button>
            <button class="config-btn config-btn-save" id="cfg_save">Salvar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelector('#cfg_close').onclick = close;
      modal.querySelector('#cfg_cancel').onclick = close;
      modal.querySelector('#cfg_save').onclick = () => {
        this.title = modal.querySelector('#cfg_title').value.trim() || 'Knob';
        this.min = Number(modal.querySelector('#cfg_min').value) || 0;
        this.max = Number(modal.querySelector('#cfg_max').value) || 10;
        this.step = Number(modal.querySelector('#cfg_step').value) || 0.1;
        this.unit = modal.querySelector('#cfg_unit').value.trim();
        const header = this.element.querySelector('.fp-widget-header');
        if (header) header.textContent = this.title;
        if (this.minLabelEl) this.minLabelEl.textContent = this.min;
        if (this.maxLabelEl) this.maxLabelEl.textContent = this.max;
        if (this.unitEl) this.unitEl.textContent = this.unit;
        if (this.inputEl) {
          this.inputEl.min = this.min;
          this.inputEl.max = this.max;
          this.inputEl.step = this.step;
        }
        this.setValue(this.value);
        close();
      };
    }

    setupDrag() {}
  }

  class GaugeWidget {
    constructor({ id, title = 'Tacômetro', min = 0, max = 3000, initialValue = 0, unit = 'RPM', x = 60, y = 60 }) {
      this.id = id;
      this.kind = 'gauge';
      this.title = title;
      this.min = Number(min);
      this.max = Number(max);
      this.value = Number(initialValue);
      this.unit = unit;
      this.x = x;
      this.y = y;
      this.element = null;
      this.needleEl = null;
      this.valEl = null;
      this.unitEl = null;
      this.minTextEl = null;
      this.maxTextEl = null;
      this.midTextEl = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;
      const midVal = Math.round((this.min + this.max) / 2);

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="gauge-container">
            <svg class="gauge-svg" viewBox="0 0 180 128">
              <defs>
                <linearGradient id="gauge_safe_${this.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#38bdf8"/>
                  <stop offset="60%" stop-color="#22c55e"/>
                  <stop offset="100%" stop-color="#eab308"/>
                </linearGradient>
              </defs>

              <!-- Fundo da escala (Arco escuro de 240 graus) -->
              <path d="M 38.04,115 A 60 60 0 1 1 141.96,115" fill="none" stroke="#1e293b" stroke-width="9" stroke-linecap="round"/>
              
              <!-- Faixa Normal / Segura (0 a 80%) -->
              <path d="M 38.04,115 A 60 60 0 1 1 147.06,66.46" fill="none" stroke="url(#gauge_safe_${this.id})" stroke-width="6" stroke-linecap="round"/>
              
              <!-- Faixa de Alarme / Sobrerotação (80% a 100%) -->
              <path d="M 147.06,66.46 A 60 60 0 0 1 141.96,115" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>

              <!-- Marcas de Graduação Principais (a cada 20%) -->
              <line x1="34.57" y1="117" x2="28.51" y2="120.5" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="29.13" y1="65.22" x2="22.47" y2="63.06" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="63.97" y1="26.53" x2="61.12" y2="20.14" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="116.03" y1="26.53" x2="118.88" y2="20.14" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="150.87" y1="65.22" x2="157.53" y2="63.06" stroke="#f87171" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="145.43" y1="117" x2="151.49" y2="120.5" stroke="#f87171" stroke-width="1.8" stroke-linecap="round"/>

              <!-- Marcas de Graduação Secundárias (a cada 10%) -->
              <line x1="26.35" y1="91.69" x2="22.87" y2="92.06" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
              <line x1="42.44" y1="42.18" x2="39.84" y2="39.83" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
              <line x1="90" y1="21" x2="90" y2="17.5" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
              <line x1="137.56" y1="42.18" x2="140.16" y2="39.83" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
              <line x1="153.65" y1="91.69" x2="157.13" y2="92.06" stroke="#f87171" stroke-width="1" stroke-linecap="round"/>

              <!-- Rótulos Numéricos Internos -->
              <text x="52.8" y="106.5" fill="#94a3b8" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" id="gauge_min_${this.id}">${this.min}</text>
              <text x="90" y="44" fill="#94a3b8" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" id="gauge_mid_${this.id}">${midVal}</text>
              <text x="127.2" y="106.5" fill="#f87171" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" id="gauge_max_${this.id}">${this.max}</text>

              <!-- Agulha Indicadora (Pivô fixado no centro exato 90, 85) -->
              <g transform="translate(90, 85)">
                <g id="gauge_needle_${this.id}" class="gauge-needle" transform="rotate(-120)">
                  <polygon points="-2,2 2,2 0.8,-52 -0.8,-52" fill="#ef4444" filter="drop-shadow(0 0 2px rgba(239,68,68,0.8))"/>
                  <circle cx="0" cy="0" r="9" fill="#0f172a" stroke="#cbd5e1" stroke-width="2"/>
                  <circle cx="0" cy="0" r="3.5" fill="#ef4444"/>
                </g>
              </g>
            </svg>
            <div class="gauge-lcd">
              <span class="gauge-lcd-val" id="gauge_val_${this.id}">${this.value.toFixed(1)}</span>
              <span class="gauge-lcd-unit" id="gauge_unit_${this.id}">${this.unit}</span>
            </div>
          </div>
        </div>
      `;

      this.element = el;
      this.needleEl = el.querySelector(`#gauge_needle_${this.id}`);
      this.valEl = el.querySelector(`#gauge_val_${this.id}`);
      this.unitEl = el.querySelector(`#gauge_unit_${this.id}`);
      this.minTextEl = el.querySelector(`#gauge_min_${this.id}`);
      this.maxTextEl = el.querySelector(`#gauge_max_${this.id}`);
      this.midTextEl = el.querySelector(`#gauge_mid_${this.id}`);

      this.setValue(this.value);

      this.element.addEventListener('dblclick', (e) => {
        if (e.target.getAttribute('contenteditable') === 'true') return;
        this.openConfigDialog();
      });

      this.setupDrag();
    }

    setValue(val) {
      let num = Number(val);
      if (isNaN(num)) num = this.min;
      this.value = num;
      if (this.valEl) this.valEl.textContent = this.value.toFixed(1);
      if (this.needleEl) {
        const range = this.max - this.min || 1;
        const pct = Math.max(0, Math.min(1.05, (this.value - this.min) / range));
        const angle = -120 + pct * 240;
        this.needleEl.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
      }
    }

    getValue() { return this.value; }

    openConfigDialog() {
      const existing = document.querySelector('.widget-config-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'widget-config-modal';
      modal.innerHTML = `
        <div class="widget-config-box">
          <div class="widget-config-header">
            <span>Configuração do Mostrador (Gauge)</span>
            <button class="palette-close-btn" id="cfg_close">✕</button>
          </div>
          <div class="widget-config-body">
            <div class="config-field"><label>Rótulo / Título:</label><input type="text" id="cfg_title" value="${this.title}"></div>
            <div class="config-field"><label>Escala Mínima:</label><input type="number" id="cfg_min" value="${this.min}" step="any"></div>
            <div class="config-field"><label>Escala Máxima:</label><input type="number" id="cfg_max" value="${this.max}" step="any"></div>
            <div class="config-field"><label>Unidade:</label><input type="text" id="cfg_unit" value="${this.unit}"></div>
          </div>
          <div class="widget-config-footer">
            <button class="config-btn config-btn-cancel" id="cfg_cancel">Cancelar</button>
            <button class="config-btn config-btn-save" id="cfg_save">Salvar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelector('#cfg_close').onclick = close;
      modal.querySelector('#cfg_cancel').onclick = close;
      modal.querySelector('#cfg_save').onclick = () => {
        this.title = modal.querySelector('#cfg_title').value.trim() || 'Tacômetro';
        this.min = Number(modal.querySelector('#cfg_min').value) || 0;
        this.max = Number(modal.querySelector('#cfg_max').value) || 3000;
        this.unit = modal.querySelector('#cfg_unit').value.trim();
        const header = this.element.querySelector('.fp-widget-header');
        if (header) header.textContent = this.title;
        if (this.minTextEl) this.minTextEl.textContent = this.min;
        if (this.maxTextEl) this.maxTextEl.textContent = this.max;
        if (this.midTextEl) this.midTextEl.textContent = Math.round((this.min + this.max) / 2);
        if (this.unitEl) this.unitEl.textContent = this.unit;
        this.setValue(this.value);
        close();
      };
    }

    setupDrag() {}
  }

  class SliderWidget {
    constructor({ id, title = 'Slider (Setpoint)', min = 0, max = 300, step = 1, initialValue = 100, x = 60, y = 280, isVertical = false }) {
      this.id = id;
      this.kind = 'slider';
      this.title = title;
      this.min = min;
      this.max = max;
      this.step = step;
      this.value = initialValue;
      this.isVertical = isVertical;
      this.x = x;
      this.y = y;
      this.element = null;
      this.inputEl = null;
      this.displayValEl = null;
      this.onChangeCallback = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="slider-container">
            <input type="range" class="${this.isVertical ? 'slider-input-v' : 'slider-input-h'}" 
                   id="slider_${this.id}" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.value}">
            <div class="numeric-box">
              <input type="number" class="numeric-input" id="num_${this.id}" value="${this.value}">
            </div>
          </div>
        </div>
      `;

      this.element = el;
      this.inputEl = el.querySelector(`#slider_${this.id}`);
      this.displayValEl = el.querySelector(`#num_${this.id}`);

      this.inputEl.addEventListener('input', (e) => this.setValue(e.target.value));
      this.displayValEl.addEventListener('change', (e) => this.setValue(e.target.value));
      this.setupDrag();
    }

    setValue(val) {
      this.value = Number(val) || 0;
      if (this.inputEl) this.inputEl.value = this.value;
      if (this.displayValEl) this.displayValEl.value = this.value;
      if (this.onChangeCallback) this.onChangeCallback(this.value);
    }

    getValue() { return this.value; }

    setupDrag() {}
  }

  class ToggleSwitchWidget {
    constructor({ id, title = 'Interruptor', labelOn = 'ON', labelOff = 'OFF', initialState = false, x = 50, y = 50 }) {
      this.id = id;
      this.kind = 'switch';
      this.title = title;
      this.labelOn = labelOn;
      this.labelOff = labelOff;
      this.state = initialState;
      this.x = x;
      this.y = y;
      this.element = null;
      this.switchEl = null;
      this.onChangeCallback = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="toggle-switch-box">
            <div style="font-size: 10px; font-weight: 700; color: #475569;">${this.labelOn}</div>
            <div class="toggle-switch ${this.state ? 'active' : ''}" id="switch_${this.id}">
              <div class="toggle-handle"></div>
            </div>
            <div style="font-size: 10px; font-weight: 700; color: #475569;">${this.labelOff}</div>
          </div>
        </div>
      `;

      this.element = el;
      this.switchEl = el.querySelector(`#switch_${this.id}`);
      this.switchEl.addEventListener('click', () => this.setState(!this.state));
      this.setupDrag();
    }

    setState(newState) {
      this.state = Boolean(newState);
      if (this.switchEl) {
        if (this.state) this.switchEl.classList.add('active');
        else this.switchEl.classList.remove('active');
      }
      if (this.onChangeCallback) this.onChangeCallback(this.state);
    }

    getState() { return this.state; }
    getValue() { return this.state; }
    setValue(val) { this.setState(val); }

    setupDrag() {}
  }

  class LEDWidget {
    constructor({ id, title = 'LED Indicador', color = 'green', initialState = false, x = 120, y = 50 }) {
      this.id = id;
      this.kind = 'led';
      this.title = title;
      this.color = color || 'green';
      this.state = initialState;
      this.x = x;
      this.y = y;
      this.element = null;
      this.ledEl = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content" style="padding: 10px;">
          <div class="led-indicator ${this.state ? `on-${this.color || 'green'}` : ''}" id="led_${this.id}"></div>
        </div>
      `;

      this.element = el;
      this.ledEl = el.querySelector(`#led_${this.id}`);
      this.setupDrag();
    }

    _clearColorClasses() {
      if (this.ledEl) {
        this.ledEl.classList.remove('on-green', 'on-blue', 'on-yellow', 'on-red', 'on-orange');
        for (const cls of Array.from(this.ledEl.classList)) {
          if (cls.startsWith('on-')) {
            this.ledEl.classList.remove(cls);
          }
        }
      }
    }

    setColor(color) {
      this.color = color || 'green';
      this._clearColorClasses();
      if (this.ledEl && this.state) {
        this.ledEl.classList.add(`on-${this.color}`);
      }
    }

    setState(newState) {
      const isOn = (newState === true || newState === 1 || newState === 'true' || newState === '1' || (typeof newState === 'number' && newState > 0));
      this.state = Boolean(isOn);
      this._clearColorClasses();
      if (this.ledEl && this.state) {
        this.ledEl.classList.add(`on-${this.color || 'green'}`);
      }
    }

    getValue() { return this.state; }
    setValue(val) { this.setState(val); }

    reset() {
      this.state = false;
      this._clearColorClasses();
    }

    setupDrag() {}
  }

  class NumericControlWidget {
    constructor({ id, title = 'Controle Numérico', initialValue = 0, isIndicator = false, x = 50, y = 50 }) {
      this.id = id;
      this.kind = isIndicator ? 'num_ind' : 'num_ctrl';
      this.title = title;
      this.value = initialValue;
      this.isIndicator = isIndicator;
      this.x = x;
      this.y = y;
      this.element = null;
      this.inputEl = null;
      this.onChangeCallback = null;
      this.render();
    }

    render() {
      const el = document.createElement('div');
      el.className = 'fp-widget';
      el.id = `widget_${this.id}`;
      el.style.left = `${this.x}px`;
      el.style.top = `${this.y}px`;

      el.innerHTML = `
        <div class="fp-widget-header">${this.title}</div>
        <div class="fp-widget-content">
          <div class="numeric-box">
            ${this.isIndicator 
              ? `<div class="numeric-indicator-val" id="num_${this.id}">0.00</div>` 
              : `<input type="number" class="numeric-input" id="num_${this.id}" value="${this.value}">`
            }
          </div>
        </div>
      `;

      this.element = el;
      this.inputEl = el.querySelector(`#num_${this.id}`);

      if (!this.isIndicator && this.inputEl) {
        this.inputEl.addEventListener('change', (e) => this.setValue(e.target.value));
        this.inputEl.addEventListener('input', (e) => this.setValue(e.target.value));
      }
      this.setupDrag();
    }

    setValue(val) {
      this.value = Number(val) || 0;
      if (this.inputEl) {
        if (this.isIndicator) this.inputEl.textContent = this.value.toFixed(2);
        else this.inputEl.value = this.value;
      }
      if (this.onChangeCallback) this.onChangeCallback(this.value);
    }

    getValue() { return this.value; }

    setupDrag() {}
  }


  // ==========================================================================
  // 7.5 TOUCH & GESTURE CONTROLLER (PINCH-TO-ZOOM & PAN)
  // ==========================================================================
  class TouchGestureHandler {
    static attachPinchZoom(containerEl, targetZoomEl, options = {}) {
      if (!containerEl || !targetZoomEl) return null;

      const minScale = options.minScale || 0.4;
      const maxScale = options.maxScale || 2.8;
      let currentScale = options.initialScale || 1.0;

      let initialDist = 0;
      let lastDist = 0;
      let lastCenter = { x: 0, y: 0 };
      let isPinching = false;

      targetZoomEl.style.transformOrigin = '0 0';

      function getTouchDistance(t1, t2) {
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      }

      function getTouchCenter(t1, t2) {
        return {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };
      }

      function applyScale(newScale, focalX, focalY) {
        const prevScale = currentScale;
        currentScale = Math.min(Math.max(newScale, minScale), maxScale);

        if (focalX !== undefined && focalY !== undefined && prevScale !== currentScale) {
          const rect = containerEl.getBoundingClientRect();
          const offsetX = focalX - rect.left;
          const offsetY = focalY - rect.top;

          const ratio = currentScale / prevScale;
          containerEl.scrollLeft = (containerEl.scrollLeft + offsetX) * ratio - offsetX;
          containerEl.scrollTop = (containerEl.scrollTop + offsetY) * ratio - offsetY;
        }

        targetZoomEl.style.transform = `scale(${currentScale})`;
        if (typeof options.onZoom === 'function') {
          options.onZoom(currentScale);
        }
      }

      containerEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          isPinching = true;
          initialDist = getTouchDistance(e.touches[0], e.touches[1]);
          lastDist = initialDist;
          lastCenter = getTouchCenter(e.touches[0], e.touches[1]);
          e.preventDefault();
        }
      }, { passive: false });

      containerEl.addEventListener('touchmove', (e) => {
        if (isPinching && e.touches.length === 2) {
          const dist = getTouchDistance(e.touches[0], e.touches[1]);
          const center = getTouchCenter(e.touches[0], e.touches[1]);

          if (lastDist > 0 && Math.abs(dist - lastDist) > 1) {
            const factor = dist / lastDist;
            applyScale(currentScale * factor, center.x, center.y);
          }

          const deltaX = center.x - lastCenter.x;
          const deltaY = center.y - lastCenter.y;
          containerEl.scrollLeft -= deltaX;
          containerEl.scrollTop -= deltaY;

          lastDist = dist;
          lastCenter = center;
          e.preventDefault();
        }
      }, { passive: false });

      const endPinch = (e) => {
        if (e.touches.length < 2) {
          isPinching = false;
          initialDist = 0;
          lastDist = 0;
        }
      };

      containerEl.addEventListener('touchend', endPinch);
      containerEl.addEventListener('touchcancel', endPinch);

      return {
        getScale: () => currentScale,
        setScale: (s) => applyScale(s),
        reset: () => applyScale(1.0)
      };
    }
  }

  // ==========================================================================
  // 8. MANAGERS (FRONT PANEL, BLOCK DIAGRAM, RUNTIME)
  // ==========================================================================
  class FrontPanelManager {
    constructor(containerIdOrOpts, maybeApp = null) {
      let containerId = containerIdOrOpts;
      let app = maybeApp;
      if (typeof containerIdOrOpts === 'object' && containerIdOrOpts !== null) {
        containerId = containerIdOrOpts.containerId;
        app = containerIdOrOpts.app || maybeApp;
      }
      this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      this.app = app;
      this.widgets = new Map();
      this.bindings = [];
      this.selectedWidgetId = null;
      this.contextMenuEl = null;

      this.cameraLayer = null;
      this.zoomWrapper = null;
      this.pan = { x: 0, y: 0 };
      this.zoom = 1.0;
      this.isPanning = false;

      this.init();
    }

    init() {
      this.container.className = 'front-panel-canvas';
      if (!this.cameraLayer) {
        this.cameraLayer = document.createElement('div');
        this.cameraLayer.id = 'front-panel-camera-layer';
        this.cameraLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 0; transform-origin: 0 0;';
        this.container.appendChild(this.cameraLayer);
        this.zoomWrapper = this.cameraLayer;
      }

      // Clique no fundo vazio desseleciona elemento e fecha menu de contexto
      this.container.addEventListener('click', (e) => {
        if (!e.target.closest('.fp-widget') && !e.target.closest('.fp-context-menu') && !e.target.closest('.widget-config-modal')) {
          this.selectWidget(null);
          this.closeContextMenu();
        }
      });

      // Pan com botão esquerdo na área vazia (navegação de câmera e movimentação da grade)
      this.container.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          if (!e.target.closest('.fp-widget, .fp-context-menu, .widget-config-modal, input, button, select, textarea')) {
            this.selectWidget(null);
            this.closeContextMenu();

            this.isPanning = true;
            const startMouseX = e.clientX;
            const startMouseY = e.clientY;
            const startPanX = this.pan.x;
            const startPanY = this.pan.y;
            this.container.style.cursor = 'grabbing';

            const onMouseMove = (ev) => {
              if (!this.isPanning) return;
              this.pan.x = startPanX + (ev.clientX - startMouseX);
              this.pan.y = startPanY + (ev.clientY - startMouseY);
              this.updateTransform();
            };

            const onMouseUp = () => {
              this.isPanning = false;
              this.container.style.cursor = 'default';
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }
        }
      });

      // Zoom com roda do mouse centralizado no cursor
      this.container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.pan.x) / this.zoom;
        const worldY = (mouseY - this.pan.y) / this.zoom;

        const factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
        const newZoom = Math.min(Math.max(this.zoom * factor, 0.25), 3.5);

        this.pan.x = mouseX - worldX * newZoom;
        this.pan.y = mouseY - worldY * newZoom;
        this.zoom = newZoom;

        this.updateTransform();
      }, { passive: false });

      // Touch pan (1 dedo) e pinch zoom (2 dedos) no Painel Frontal (Mobile/Android)
      let touchInitialDist = 0;
      let touchInitialScale = 1.0;
      let touchStartCenter = { x: 0, y: 0 };
      let touchStartPan = { x: 0, y: 0 };
      let isTouchPanning = false;

      this.container.addEventListener('touchstart', (e) => {
        if (e.target.closest('.fp-widget, .fp-context-menu, .widget-config-modal, input, button, select, textarea')) {
          return;
        }
        this.selectWidget(null);
        this.closeContextMenu();

        if (e.touches.length === 1) {
          isTouchPanning = true;
          touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchStartPan = { x: this.pan.x, y: this.pan.y };
        } else if (e.touches.length === 2) {
          isTouchPanning = false;
          touchInitialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          touchInitialScale = this.zoom;
          touchStartCenter = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
          };
          touchStartPan = { x: this.pan.x, y: this.pan.y };
        }
      }, { passive: true });

      this.container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isTouchPanning) {
          const dx = e.touches[0].clientX - touchStartCenter.x;
          const dy = e.touches[0].clientY - touchStartCenter.y;
          this.pan.x = touchStartPan.x + dx;
          this.pan.y = touchStartPan.y + dy;
          this.updateTransform();
          e.preventDefault();
        } else if (e.touches.length === 2 && touchInitialDist > 0) {
          const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          const factor = dist / touchInitialDist;
          const newZoom = Math.min(Math.max(touchInitialScale * factor, 0.25), 3.5);

          const rect = this.container.getBoundingClientRect();
          const mouseX = touchStartCenter.x - rect.left;
          const mouseY = touchStartCenter.y - rect.top;
          const worldX = (mouseX - touchStartPan.x) / touchInitialScale;
          const worldY = (mouseY - touchStartPan.y) / touchInitialScale;

          this.pan.x = mouseX - worldX * newZoom;
          this.pan.y = mouseY - worldY * newZoom;
          this.zoom = newZoom;

          this.updateTransform();
          e.preventDefault();
        }
      }, { passive: false });

      const onTouchEnd = (e) => {
        if (e.touches.length === 0) {
          isTouchPanning = false;
          touchInitialDist = 0;
        } else if (e.touches.length === 1) {
          isTouchPanning = true;
          touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchStartPan = { x: this.pan.x, y: this.pan.y };
          touchInitialDist = 0;
        }
      };
      this.container.addEventListener('touchend', onTouchEnd, { passive: true });
      this.container.addEventListener('touchcancel', onTouchEnd, { passive: true });

      // Right-click no fundo do canvas abre a paleta (se não for sobre um widget)
      this.container.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.fp-widget')) return;
        e.preventDefault();
        this.closeContextMenu();
        if (this.app && this.app.palette) {
          this.app.palette.openAt(e.clientX, e.clientY);
        }
      });

      // Tecla Delete / Backspace para excluir o elemento selecionado no Painel Frontal
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
          if (this.selectedWidgetId) {
            e.preventDefault();
            this.deleteWidget(this.selectedWidgetId);
          }
        }
      });
    }

    updateTransform() {
      if (this.cameraLayer) {
        this.cameraLayer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
      }
      this.container.style.backgroundPosition = `${this.pan.x}px ${this.pan.y}px`;
      this.container.style.backgroundSize = `${16 * this.zoom}px ${16 * this.zoom}px`;
    }

    screenToWorld(clientX, clientY) {
      const rect = this.container.getBoundingClientRect();
      return {
        x: (clientX - rect.left - this.pan.x) / this.zoom,
        y: (clientY - rect.top - this.pan.y) / this.zoom
      };
    }

    getCurrentScale() {
      return this.zoom || 1.0;
    }

    selectWidget(widgetId) {
      this.selectedWidgetId = widgetId || null;

      for (const [id, w] of this.widgets) {
        if (w && w.element) {
          if (this.selectedWidgetId && id === this.selectedWidgetId) {
            w.element.classList.add('selected');
          } else {
            w.element.classList.remove('selected');
          }
        }
      }
    }

    closeContextMenu() {
      if (this.contextMenuEl && this.contextMenuEl.parentNode) {
        this.contextMenuEl.parentNode.removeChild(this.contextMenuEl);
      }
      this.contextMenuEl = null;
    }

    openContextMenu(widget, clientX, clientY) {
      this.closeContextMenu();
      this.selectWidget(widget.id);

      const menu = document.createElement('div');
      menu.className = 'fp-context-menu';
      menu.innerHTML = `
        <div class="fp-context-item" data-action="duplicate">
          <span class="fp-context-icon">📋</span>
          <span>Duplicar</span>
        </div>
        <div class="fp-context-item" data-action="reset">
          <span class="fp-context-icon">🔄</span>
          <span>Resetar</span>
        </div>
        <div class="fp-context-divider"></div>
        <div class="fp-context-item" data-action="config">
          <span class="fp-context-icon">⚙️</span>
          <span>Configurações</span>
        </div>
        <div class="fp-context-divider"></div>
        <div class="fp-context-item item-delete" data-action="delete">
          <span class="fp-context-icon">🗑️</span>
          <span>Deletar</span>
        </div>
      `;

      document.body.appendChild(menu);
      this.contextMenuEl = menu;

      // Posicionamento com proteção contra bordas da janela
      const rect = menu.getBoundingClientRect();
      let posX = clientX;
      let posY = clientY;
      if (posX + rect.width > window.innerWidth - 10) {
        posX = window.innerWidth - rect.width - 10;
      }
      if (posY + rect.height > window.innerHeight - 10) {
        posY = window.innerHeight - rect.height - 10;
      }
      menu.style.left = `${Math.max(10, posX)}px`;
      menu.style.top = `${Math.max(10, posY)}px`;

      menu.querySelector('[data-action="duplicate"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeContextMenu();
        this.duplicateWidget(widget.id);
      });

      menu.querySelector('[data-action="reset"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeContextMenu();
        this.resetWidget(widget.id);
      });

      menu.querySelector('[data-action="config"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeContextMenu();
        this.handleWidgetConfigure(widget);
      });

      menu.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeContextMenu();
        this.deleteWidget(widget.id);
      });

      const onDismiss = (ev) => {
        if (!ev.target.closest('.fp-context-menu')) {
          this.closeContextMenu();
          document.removeEventListener('click', onDismiss);
          document.removeEventListener('contextmenu', onDismiss);
          document.removeEventListener('touchstart', onDismiss);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', onDismiss);
        document.addEventListener('contextmenu', onDismiss);
        document.addEventListener('touchstart', onDismiss);
      }, 50);
    }

    handleWidgetConfigure(widget) {
      const kind = this.getWidgetKind(widget);
      if (kind === 'led') {
        this.openLedConfig(widget);
      } else if (kind === 'switch' || kind === 'num_ctrl' || kind === 'num_ind') {
        this.openSimpleTitleConfig(widget);
      } else {
        this.openWidgetConfig(widget);
      }
    }

    openLedConfig(widget) {
      const existing = document.querySelector('.widget-config-modal');
      if (existing) existing.remove();

      const titleVal = widget.title || 'LED Indicador';
      const currentColor = widget.color || 'green';

      const modal = document.createElement('div');
      modal.className = 'widget-config-modal';
      modal.innerHTML = `
        <div class="widget-config-box">
          <div class="widget-config-header">
            <div class="widget-config-title">
              <span style="font-size: 15px;">⚙️</span>
              <span>Configurar LED Indicador</span>
            </div>
            <button class="palette-close-btn" id="cfg_close" title="Fechar">✕</button>
          </div>
          <div class="widget-config-body">
            <div class="config-field">
              <label for="cfg_title">Rótulo / Título:</label>
              <input type="text" id="cfg_title" value="${titleVal}" placeholder="Nome do LED">
            </div>
            <div class="config-field">
              <label>Cor do LED Ativo:</label>
              <div class="led-color-picker" style="display: flex; gap: 12px; margin-bottom: 10px; justify-content: center; padding: 6px 0;">
                <div class="led-color-circle ${currentColor === 'green' ? 'active' : ''}" data-color="green" title="Verde" style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; cursor: pointer; border: 3px solid ${currentColor === 'green' ? '#ffffff' : 'transparent'}; box-shadow: 0 0 10px rgba(34,197,94,0.7); transition: transform 0.15s, border-color 0.15s; ${currentColor === 'green' ? 'transform: scale(1.15);' : ''}"></div>
                <div class="led-color-circle ${currentColor === 'blue' ? 'active' : ''}" data-color="blue" title="Azul" style="width: 32px; height: 32px; border-radius: 50%; background: #38bdf8; cursor: pointer; border: 3px solid ${currentColor === 'blue' ? '#ffffff' : 'transparent'}; box-shadow: 0 0 10px rgba(56,189,248,0.7); transition: transform 0.15s, border-color 0.15s; ${currentColor === 'blue' ? 'transform: scale(1.15);' : ''}"></div>
                <div class="led-color-circle ${currentColor === 'yellow' ? 'active' : ''}" data-color="yellow" title="Amarelo" style="width: 32px; height: 32px; border-radius: 50%; background: #eab308; cursor: pointer; border: 3px solid ${currentColor === 'yellow' ? '#ffffff' : 'transparent'}; box-shadow: 0 0 10px rgba(234,179,8,0.7); transition: transform 0.15s, border-color 0.15s; ${currentColor === 'yellow' ? 'transform: scale(1.15);' : ''}"></div>
                <div class="led-color-circle ${currentColor === 'red' ? 'active' : ''}" data-color="red" title="Vermelho" style="width: 32px; height: 32px; border-radius: 50%; background: #ef4444; cursor: pointer; border: 3px solid ${currentColor === 'red' ? '#ffffff' : 'transparent'}; box-shadow: 0 0 10px rgba(239,68,68,0.7); transition: transform 0.15s, border-color 0.15s; ${currentColor === 'red' ? 'transform: scale(1.15);' : ''}"></div>
                <div class="led-color-circle ${currentColor === 'orange' ? 'active' : ''}" data-color="orange" title="Laranja" style="width: 32px; height: 32px; border-radius: 50%; background: #f97316; cursor: pointer; border: 3px solid ${currentColor === 'orange' ? '#ffffff' : 'transparent'}; box-shadow: 0 0 10px rgba(249,115,22,0.7); transition: transform 0.15s, border-color 0.15s; ${currentColor === 'orange' ? 'transform: scale(1.15);' : ''}"></div>
              </div>
              <select id="cfg_led_color" style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 7px 10px; border-radius: 6px; font-size: 13px; outline: none;">
                <option value="green" ${currentColor === 'green' ? 'selected' : ''}>Verde (padrão)</option>
                <option value="blue" ${currentColor === 'blue' ? 'selected' : ''}>Azul</option>
                <option value="yellow" ${currentColor === 'yellow' ? 'selected' : ''}>Amarelo</option>
                <option value="red" ${currentColor === 'red' ? 'selected' : ''}>Vermelho</option>
                <option value="orange" ${currentColor === 'orange' ? 'selected' : ''}>Laranja</option>
              </select>
            </div>
          </div>
          <div class="widget-config-footer">
            <button class="config-btn config-btn-cancel" id="cfg_cancel">Cancelar</button>
            <button class="config-btn config-btn-save" id="cfg_save">Salvar</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const colorSelect = modal.querySelector('#cfg_led_color');
      const circles = modal.querySelectorAll('.led-color-circle');

      const updateCircleSelection = (selectedColor) => {
        circles.forEach(c => {
          const cColor = c.getAttribute('data-color');
          if (cColor === selectedColor) {
            c.classList.add('active');
            c.style.borderColor = '#ffffff';
            c.style.transform = 'scale(1.15)';
          } else {
            c.classList.remove('active');
            c.style.borderColor = 'transparent';
            c.style.transform = 'scale(1.0)';
          }
        });
      };

      circles.forEach(c => {
        c.addEventListener('click', () => {
          const color = c.getAttribute('data-color');
          colorSelect.value = color;
          updateCircleSelection(color);
        });
      });

      colorSelect.addEventListener('change', () => {
        updateCircleSelection(colorSelect.value);
      });

      const close = () => modal.remove();
      modal.querySelector('#cfg_close').onclick = close;
      modal.querySelector('#cfg_cancel').onclick = close;

      modal.querySelector('#cfg_save').onclick = () => {
        const newTitle = modal.querySelector('#cfg_title').value.trim() || 'LED Indicador';
        const newColor = modal.querySelector('#cfg_led_color').value;

        widget.title = newTitle;
        widget.color = newColor;
        if (typeof widget.setColor === 'function') {
          widget.setColor(newColor);
        }

        this.applyWidgetConfig(widget);
        close();
        if (this.app && this.app.undoManager) {
          this.app.undoManager.pushState();
        }
        if (this.app && typeof this.app.showToast === 'function') {
          this.app.showToast(`LED '${newTitle}' atualizado!`);
        }
      };
    }

    openSimpleTitleConfig(widget) {
      const existing = document.querySelector('.widget-config-modal');
      if (existing) existing.remove();

      const titleVal = widget.title || 'Instrumento';
      const kind = this.getWidgetKind(widget);
      let titleHeader = 'Configurar Instrumento';
      if (kind === 'switch') titleHeader = 'Configurar Chave Toggle';
      else if (kind === 'num_ctrl') titleHeader = 'Configurar Controle Numérico';
      else if (kind === 'num_ind') titleHeader = 'Configurar Display Numérico';

      const modal = document.createElement('div');
      modal.className = 'widget-config-modal';
      modal.innerHTML = `
        <div class="widget-config-box">
          <div class="widget-config-header">
            <div class="widget-config-title">
              <span style="font-size: 15px;">⚙️</span>
              <span>${titleHeader}</span>
            </div>
            <button class="palette-close-btn" id="cfg_close" title="Fechar">✕</button>
          </div>
          <div class="widget-config-body">
            <div class="config-field">
              <label for="cfg_title">Rótulo / Título:</label>
              <input type="text" id="cfg_title" value="${titleVal}" placeholder="Nome do instrumento">
            </div>
          </div>
          <div class="widget-config-footer">
            <button class="config-btn config-btn-cancel" id="cfg_cancel">Cancelar</button>
            <button class="config-btn config-btn-save" id="cfg_save">Salvar</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelector('#cfg_close').onclick = close;
      modal.querySelector('#cfg_cancel').onclick = close;

      modal.querySelector('#cfg_save').onclick = () => {
        const newTitle = modal.querySelector('#cfg_title').value.trim() || titleVal;
        widget.title = newTitle;
        this.applyWidgetConfig(widget);
        close();
        if (this.app && this.app.undoManager) {
          this.app.undoManager.pushState();
        }
        if (this.app && typeof this.app.showToast === 'function') {
          this.app.showToast(`'${newTitle}' atualizado!`);
        }
      };
    }

    openWidgetConfig(widget) {
      const existing = document.querySelector('.widget-config-modal');
      if (existing) existing.remove();

      const minVal = widget.min !== undefined ? widget.min : 0;
      const maxVal = widget.max !== undefined ? widget.max : 100;
      const stepVal = widget.step !== undefined ? widget.step : 1;
      const unitVal = widget.unit || '';
      const titleVal = widget.title || 'Instrumento';

      const modal = document.createElement('div');
      modal.className = 'widget-config-modal';
      modal.innerHTML = `
        <div class="widget-config-box">
          <div class="widget-config-header">
            <div class="widget-config-title">
              <span style="font-size: 15px;">⚙️</span>
              <span>Configurar Instrumento</span>
            </div>
            <button class="palette-close-btn" id="cfg_close" title="Fechar">✕</button>
          </div>
          <div class="widget-config-body">
            <div class="config-field">
              <label for="cfg_title">Rótulo / Título:</label>
              <input type="text" id="cfg_title" value="${titleVal}" placeholder="Nome do instrumento">
            </div>
            <div class="config-grid-2">
              <div class="config-field">
                <label for="cfg_min">Escala Mínima:</label>
                <input type="number" id="cfg_min" value="${minVal}" step="any">
              </div>
              <div class="config-field">
                <label for="cfg_max">Escala Máxima:</label>
                <input type="number" id="cfg_max" value="${maxVal}" step="any">
              </div>
            </div>
            <div class="config-grid-2">
              <div class="config-field">
                <label for="cfg_step">Passo (Step):</label>
                <input type="number" id="cfg_step" value="${stepVal}" step="any">
              </div>
              <div class="config-field">
                <label for="cfg_unit">Unidade (ex: V, RPM, °C):</label>
                <input type="text" id="cfg_unit" value="${unitVal}" placeholder="ex: V, RPM, mm">
              </div>
            </div>
          </div>
          <div class="widget-config-footer">
            <button class="config-btn config-btn-cancel" id="cfg_cancel">Cancelar</button>
            <button class="config-btn config-btn-save" id="cfg_save">Salvar</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelector('#cfg_close').onclick = close;
      modal.querySelector('#cfg_cancel').onclick = close;

      modal.querySelector('#cfg_save').onclick = () => {
        const newTitle = modal.querySelector('#cfg_title').value.trim() || 'Instrumento';
        const newMin = Number(modal.querySelector('#cfg_min').value) || 0;
        const newMax = Number(modal.querySelector('#cfg_max').value) || 100;
        const newStep = Number(modal.querySelector('#cfg_step').value) || 1;
        const newUnit = modal.querySelector('#cfg_unit').value.trim();

        widget.title = newTitle;
        widget.min = newMin;
        widget.max = newMax;
        widget.step = newStep;
        widget.unit = newUnit;

        this.applyWidgetConfig(widget);
        close();
        if (this.app && typeof this.app.showToast === 'function') {
          this.app.showToast(`Instrumento '${newTitle}' atualizado!`);
        }
      };
    }

    applyWidgetConfig(widget) {
      if (!widget || !widget.element) return;

      const header = widget.element.querySelector('.fp-widget-header, .widget-title, .chart-title, .switch-title, .led-title, .num-title, h4');
      if (header) {
        header.textContent = widget.title;
      }

      if (widget.color && typeof widget.setColor === 'function') {
        widget.setColor(widget.color);
      }

      if (typeof widget.applyConfig === 'function') {
        widget.applyConfig({
          title: widget.title,
          min: widget.min,
          max: widget.max,
          step: widget.step,
          unit: widget.unit
        });
      }

      const unitEls = widget.element.querySelectorAll('.widget-unit, .tank-scale-unit, .chart-unit, .num-unit');
      unitEls.forEach(u => u.textContent = widget.unit ? `[${widget.unit}]` : '');

      const sliderInput = widget.element.querySelector('input[type="range"]');
      if (sliderInput) {
        if (widget.min !== undefined) sliderInput.min = widget.min;
        if (widget.max !== undefined) sliderInput.max = widget.max;
        if (widget.step !== undefined) sliderInput.step = widget.step;
        const minSpan = widget.element.querySelector('.slider-min');
        const maxSpan = widget.element.querySelector('.slider-max');
        if (minSpan) minSpan.textContent = widget.min;
        if (maxSpan) maxSpan.textContent = widget.max;
      }

      const numInput = widget.element.querySelector('input[type="number"]');
      if (numInput) {
        if (widget.min !== undefined) numInput.min = widget.min;
        if (widget.max !== undefined) numInput.max = widget.max;
        if (widget.step !== undefined) numInput.step = widget.step;
      }

      const tankScale = widget.element.querySelector('.tank-scale');
      if (tankScale) {
        const spans = tankScale.querySelectorAll('span');
        if (spans.length >= 3) {
          spans[0].textContent = widget.max;
          spans[1].textContent = ((widget.min + widget.max) / 2).toFixed(0);
          spans[2].textContent = widget.min;
        }
        if (typeof widget.setValue === 'function' && widget.value !== undefined) {
          widget.setValue(widget.value);
        }
      }

      const thermoScale = widget.element.querySelector('.thermometer-scale');
      if (thermoScale) {
        const spans = thermoScale.querySelectorAll('span');
        if (spans.length >= 3) {
          spans[0].textContent = `${widget.max}°`;
          spans[1].textContent = `${((widget.min + widget.max) / 2).toFixed(0)}°`;
          spans[2].textContent = `${widget.min}°`;
        }
        if (typeof widget.setValue === 'function' && widget.value !== undefined) {
          widget.setValue(widget.value);
        }
      }

      if (typeof widget.drawGauge === 'function') {
        widget.drawGauge();
      } else if (typeof widget.setValue === 'function' && widget.value !== undefined) {
        widget.setValue(widget.value);
      }

      if (typeof widget.updateTicks === 'function') {
        widget.updateTicks();
      }

      if (this.app && this.app.graph) {
        const binding = this.bindings.find(b => b.widgetId === widget.id);
        if (binding) {
          const node = this.app.graph.getNode(binding.nodeId);
          if (node) {
            node.title = widget.title;
            const nodeTitleEl = document.querySelector(`#node_${node.id} .node-title`);
            if (nodeTitleEl) nodeTitleEl.textContent = widget.title;
          }
        }
      }
    }

    deleteWidget(widgetId) {
      if (!widgetId) return;
      const widget = this.widgets.get(widgetId);
      const title = widget ? widget.title : 'Instrumento';

      const bindings = this.bindings.filter(b => b.widgetId === widgetId);
      if (this.app && this.app.graph) {
        for (const b of bindings) {
          this.app.graph.removeNode(b.nodeId);
        }
        if (this.app.editor) {
          this.app.editor.render();
        }
      }

      this.removeWidget(widgetId);
      if (this.selectedWidgetId === widgetId) {
        this.selectWidget(null);
      }
      if (this.app && typeof this.app.showToast === 'function') {
        this.app.showToast(`Instrumento '${title}' excluído.`);
      }
    }

    resetWidget(widgetId) {
      const widget = this.widgets.get(widgetId);
      if (!widget) return;

      const defaultVal = widget.min !== undefined ? widget.min : 0;
      if (typeof widget.setState === 'function') {
        widget.setState(false);
      } else if (typeof widget.setValue === 'function') {
        widget.setValue(defaultVal);
      } else if (widget.data && Array.isArray(widget.data)) {
        widget.data = [];
        if (typeof widget.redraw === 'function') widget.redraw();
      } else {
        widget.value = defaultVal;
      }

      this.syncControlsToDiagram(this.app ? this.app.graph : null);
      if (this.app && typeof this.app.showToast === 'function') {
        this.app.showToast(`Instrumento '${widget.title || ''}' resetado para valores padrão.`);
      }
    }

    getWidgetKind(widget) {
      if (!widget) return 'knob';
      if (widget.kind) return widget.kind;
      if (widget.ledEl || widget.element?.querySelector?.('.led-indicator')) return 'led';
      if (widget.switchEl || widget.toggleEl || widget.element?.querySelector?.('.toggle-switch')) return 'switch';
      if (widget.plotEl || widget.canvas || widget.element?.querySelector?.('.chart-canvas')) return 'chart';
      if (widget.inputEl || widget.element?.querySelector?.('input[type="number"]')) return widget.isIndicator ? 'num_ind' : 'num_ctrl';
      const name = widget.constructor ? widget.constructor.name : '';
      if (name === 'KnobWidget') return 'knob';
      if (name === 'SliderWidget') return 'slider';
      if (name === 'GaugeWidget') return 'gauge';
      if (name === 'TankWidget') return 'tank';
      if (name === 'ThermometerWidget') return 'thermometer';
      if (name === 'ChartWidget') return 'chart';
      if (name === 'ToggleSwitchWidget') return 'switch';
      if (name === 'LEDWidget') return 'led';
      if (name === 'NumericControlWidget') return widget.isIndicator ? 'num_ind' : 'num_ctrl';
      return 'knob';
    }

    duplicateWidget(widgetId) {
      const orig = this.widgets.get(widgetId);
      if (!orig) return;

      if (this.app && typeof this.app.duplicateFrontPanelWidget === 'function') {
        this.app.duplicateFrontPanelWidget(orig);
      }
    }

    attachWidgetInteractions(widget) {
      const el = widget.element;
      if (!el) return;

      // 1. Clique seleciona o elemento (desselecionando qualquer outro anterior)
      el.addEventListener('click', (e) => {
        if (e.target.closest('.fp-context-menu') || e.target.closest('.widget-config-modal')) return;
        e.stopPropagation();
        this.selectWidget(widget.id);
      });

      // 2. Duplo clique abre Configurações apropriadas para o tipo de instrumento
      el.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleWidgetConfigure(widget);
      });

      // 3. Botão direito (Desktop) abre Menu de Contexto
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openContextMenu(widget, e.clientX, e.clientY);
      });

      // 4. Arraste com Mouse no Desktop (com compensação de escala de Zoom)
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.toggle-switch, .knob-dial-wrapper, input, button, select, textarea, [contenteditable="true"], .fp-context-menu, .widget-config-modal')) {
          e.stopPropagation();
          this.selectWidget(widget.id);
          return;
        }

        e.stopPropagation();
        this.selectWidget(widget.id);
        this.closeContextMenu();

        const scale = this.getCurrentScale();
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = widget.x || parseInt(el.style.left, 10) || 40;
        const origY = widget.y || parseInt(el.style.top, 10) || 40;
        let isDragging = false;

        const onMouseMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!isDragging && Math.hypot(dx, dy) > 5) {
            isDragging = true;
            el.style.zIndex = '100';
          }
          if (isDragging) {
            widget.x = Math.max(10, origX + dx / scale);
            widget.y = Math.max(10, origY + dy / scale);
            el.style.left = `${widget.x}px`;
            el.style.top = `${widget.y}px`;
          }
        };

        const onMouseUp = () => {
          if (isDragging) {
            el.style.zIndex = '10';
          }
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      // 5. Arraste Touch & Pressionar e Segurar (Long-Press 500ms) no Android
      let longPressTimer = null;
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (e.target.closest('.widget-config-modal') || e.target.closest('.fp-context-menu')) return;

        const touch = e.touches[0];
        const startTouchX = touch.clientX;
        const startTouchY = touch.clientY;
        const origX = widget.x || parseInt(el.style.left, 10) || 40;
        const origY = widget.y || parseInt(el.style.top, 10) || 40;
        const scale = this.getCurrentScale();
        let isDragging = false;
        let longPressFired = false;

        // Menu de Contexto ao manter pressionado (500ms)
        longPressTimer = setTimeout(() => {
          if (!isDragging) {
            longPressFired = true;
            this.openContextMenu(widget, startTouchX, startTouchY);
            if (navigator.vibrate) {
              try { navigator.vibrate(40); } catch (vErr) {}
            }
          }
        }, 500);

        const onTouchMove = (ev) => {
          if (ev.touches.length !== 1) return;
          const t = ev.touches[0];
          const dx = t.clientX - startTouchX;
          const dy = t.clientY - startTouchY;

          if (Math.hypot(dx, dy) > 8) {
            clearTimeout(longPressTimer);
            if (longPressFired) return;

            if (e.target.closest('.knob-dial-wrapper, input, button, select, textarea')) {
              return;
            }

            if (!isDragging) {
              isDragging = true;
              this.selectWidget(widget.id);
              el.style.zIndex = '100';
            }
            ev.preventDefault();
            widget.x = Math.max(10, origX + dx / scale);
            widget.y = Math.max(10, origY + dy / scale);
            el.style.left = `${widget.x}px`;
            el.style.top = `${widget.y}px`;
          }
        };

        const onTouchEnd = () => {
          clearTimeout(longPressTimer);
          if (isDragging) {
            el.style.zIndex = '10';
          } else if (!longPressFired) {
            this.selectWidget(widget.id);
          }
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        };

        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
      }, { passive: true });
    }

    addWidget(widget) {
      this.widgets.set(widget.id, widget);
      const layer = this.cameraLayer || this.zoomWrapper || this.container;
      if (this.cameraLayer && !this.container.contains(this.cameraLayer)) {
        this.container.appendChild(this.cameraLayer);
      }
      if (widget.element) {
        widget.element.style.pointerEvents = 'auto';
      }
      layer.appendChild(widget.element);
      this.attachWidgetInteractions(widget);
      return widget;
    }

    removeWidget(widgetId) {
      const widget = this.widgets.get(widgetId);
      if (widget && widget.element.parentNode) {
        widget.element.parentNode.removeChild(widget.element);
      }
      this.widgets.delete(widgetId);
      this.bindings = this.bindings.filter(b => b.widgetId !== widgetId);
    }

    bindWidgetToNode({ widgetId, nodeId, terminalName, isInputToDiagram }) {
      this.bindings.push({ widgetId, nodeId, terminalName, isInputToDiagram });
      if (isInputToDiagram) {
        const widget = this.widgets.get(widgetId);
        if (widget) {
          widget.onChangeCallback = (val) => {
            const graph = this.app ? this.app.graph : (window.app && window.app.graph);
            if (graph) {
              const node = graph.getNode(nodeId);
              if (node) {
                if (typeof node.setValue === 'function') node.setValue(val);
                if (node.outputs && node.outputs.has(terminalName)) node.outputs.get(terminalName).value = val;
              }
            }
          };
        }
      }
    }

    syncControlsToDiagram(graph) {
      if (!graph) return;
      for (const binding of this.bindings) {
        if (binding.isInputToDiagram) {
          const widget = this.widgets.get(binding.widgetId);
          const node = graph.getNode(binding.nodeId);
          if (widget && node) {
            const val = widget.getValue ? widget.getValue() : (widget.getState ? widget.getState() : (widget.state !== undefined ? widget.state : widget.value));
            if (typeof node.setValue === 'function') {
              node.setValue(val);
            } else {
              const inTerm = node.getInput ? node.getInput(binding.terminalName) : null;
              if (inTerm) inTerm.value = val;
            }
            if (node.outputs && node.outputs.has(binding.terminalName)) {
              node.outputs.get(binding.terminalName).value = val;
            }
          }
        }
      }
    }

    resetAllIndicators() {
      for (const [, widget] of this.widgets) {
        if (typeof widget.reset === 'function') {
          widget.reset();
        } else if (typeof widget.setState === 'function') {
          widget.setState(false);
        }
      }
    }

    syncDiagramToIndicators(graph) {
      const g = graph || (this.app ? this.app.graph : null) || (window.app && window.app.graph);
      if (!g) return;
      for (const binding of this.bindings) {
        if (!binding.isInputToDiagram) {
          const widget = this.widgets.get(binding.widgetId);
          const node = g.getNode(binding.nodeId);
          if (widget && node) {
            let val = undefined;
            if (node.type === 'fp_indicator') {
              const inTerm = node.inputs ? (node.inputs.get(binding.terminalName) || (node.inputs.size > 0 ? Array.from(node.inputs.values())[0] : null)) : null;
              if (inTerm) {
                val = inTerm.value;
              }
            } else {
              const outTerm = node.getOutput ? node.getOutput(binding.terminalName) : null;
              if (outTerm && outTerm.value !== undefined) {
                val = outTerm.value;
              } else if (node.outputs) {
                for (const [, outT] of node.outputs) {
                  val = outT.value;
                  break;
                }
              }
            }

            if (val !== undefined && val !== null) {
              if (widget instanceof ChartWidget || (widget.constructor && widget.constructor.name === 'ChartWidget')) {
                widget.pushData(val);
              } else if (widget instanceof LEDWidget || (widget.constructor && widget.constructor.name === 'LEDWidget') || (typeof widget.setState === 'function' && widget.kind === 'led')) {
                widget.setState(val);
              } else if (widget.setValue) {
                widget.setValue(val);
              }
            } else {
              if (widget instanceof LEDWidget || (widget.constructor && widget.constructor.name === 'LEDWidget') || (typeof widget.setState === 'function' && widget.kind === 'led')) {
                widget.setState(false);
              }
            }
          }
        }
      }
    }

    clear() {
      if (this.cameraLayer) {
        this.cameraLayer.innerHTML = '';
      } else if (this.zoomWrapper) {
        this.zoomWrapper.innerHTML = '';
      } else {
        this.container.innerHTML = '';
      }
      this.widgets.clear();
      this.bindings = [];
      this.selectedWidgetId = null;
      this.closeContextMenu();
      this.pan = { x: 0, y: 0 };
      this.zoom = 1.0;
      this.updateTransform();
    }

    toJSON() {
      const widgetsData = [];
      for (const [, widget] of this.widgets) {
        let kind = 'tank';
        if (widget instanceof SliderWidget) kind = 'slider';
        else if (widget instanceof KnobWidget) kind = 'knob';
        else if (widget instanceof GaugeWidget) kind = 'gauge';
        else if (widget instanceof TankWidget) kind = 'tank';
        else if (widget instanceof ThermometerWidget) kind = 'thermometer';
        else if (widget instanceof ChartWidget) kind = 'chart';
        else if (widget instanceof ToggleSwitchWidget) kind = 'switch';
        else if (widget instanceof LEDWidget) kind = 'led';
        else if (widget instanceof NumericControlWidget) kind = widget.isIndicator ? 'num_ind' : 'num_ctrl';

        const posX = parseInt(widget.element ? widget.element.style.left : widget.x, 10) || widget.x || 40;
        const posY = parseInt(widget.element ? widget.element.style.top : widget.y, 10) || widget.y || 40;

        widgetsData.push({
          id: widget.id,
          kind: kind,
          title: widget.title,
          x: posX,
          y: posY,
          min: widget.min,
          max: widget.max,
          unit: widget.unit,
          step: widget.step,
          initialValue: widget.value !== undefined ? widget.value : (widget.state !== undefined ? widget.state : 0),
          isIndicator: widget.isIndicator,
          color: widget.color,
          plots: widget.plots,
          labelOn: widget.labelOn,
          labelOff: widget.labelOff
        });
      }
      return {
        widgets: widgetsData,
        bindings: this.bindings
      };
    }
  }

  class BlockDiagramEditor {
    constructor({ containerId, graph, onNodeSelect, onWireCreated, app = null }) {
      this.container = document.getElementById(containerId);
      this.graph = graph;
      this.app = app;
      this.onNodeSelect = onNodeSelect;
      this.onWireCreated = onWireCreated;
      this.nodesContainer = null;
      this.svgLayer = null;
      this.pendingWire = null;
      this.previewPathEl = null;
      this.selectedNodeId = null;
      this.selectedWireId = null;
      this.contextMenuEl = null;

      this.pan = { x: 0, y: 0 };
      this.zoom = 1.0;
      this.isPanning = false;
      this.cameraLayer = null;

      this.init();
    }

    init() {
      this.container.innerHTML = `
        <div class="diagram-canvas-container" id="diagram-canvas">
          <div id="diagram-camera-layer" style="position: absolute; top: 0; left: 0; width: 0; height: 0; transform-origin: 0 0; pointer-events: none;">
            <svg class="diagram-wire-layer" id="diagram-wires"></svg>
            <div id="diagram-nodes-layer" style="position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none;"></div>
          </div>
        </div>
      `;
      this.canvas = this.container.querySelector('#diagram-canvas');
      this.cameraLayer = this.container.querySelector('#diagram-camera-layer');
      this.nodesContainer = this.container.querySelector('#diagram-nodes-layer');
      this.svgLayer = this.container.querySelector('#diagram-wires');
      this.zoomWrapper = this.cameraLayer;

      this.setupEventListeners();
    }

    updateTransform() {
      if (this.cameraLayer) {
        this.cameraLayer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
      }
      const canvas = this.canvas || this.container.querySelector('#diagram-canvas') || this.container;
      canvas.style.backgroundPosition = `${this.pan.x}px ${this.pan.y}px`;
      canvas.style.backgroundSize = `${16 * this.zoom}px ${16 * this.zoom}px`;
    }

    screenToWorld(clientX, clientY) {
      const canvas = this.canvas || this.container.querySelector('#diagram-canvas') || this.container;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - this.pan.x) / this.zoom,
        y: (clientY - rect.top - this.pan.y) / this.zoom
      };
    }

    getCurrentScale() {
      return this.zoom || 1.0;
    }

    closeContextMenu() {
      if (this.contextMenuEl && this.contextMenuEl.parentNode) {
        this.contextMenuEl.parentNode.removeChild(this.contextMenuEl);
      }
      this.contextMenuEl = null;
    }

    deleteNode(nodeId) {
      if (!nodeId) return;
      if (this.app && this.app.frontPanel) {
        const binding = this.app.frontPanel.bindings.find(b => b.nodeId === nodeId);
        if (binding) {
          this.app.frontPanel.deleteWidget(binding.widgetId);
          return;
        }
      }
      this.graph.removeNode(nodeId);
      if (this.selectedNodeId === nodeId) this.selectedNodeId = null;
      this.render();
      if (this.app && this.app.undoManager) this.app.undoManager.pushState();
    }

    setupEventListeners() {
      const canvas = this.canvas || this.container.querySelector('#diagram-canvas');

      // Movimento do mouse para fiação temporária
      canvas.addEventListener('mousemove', (e) => {
        if (this.pendingWire && this.previewPathEl) {
          const endPos = this.screenToWorld(e.clientX, e.clientY);
          const pathD = WireRouter.getCubicBezierPath(this.pendingWire.startX, this.pendingWire.startY, endPos.x, endPos.y);
          this.previewPathEl.setAttribute('d', pathD);
        }
      });

      // Pan com botão esquerdo na área vazia e desseleção imediata (movimentação da grade)
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          if (!e.target.closest('.diagram-node, .wire-path, .terminal-dot, .terminal-connector, .fp-context-menu, input, textarea, button')) {
            this.cancelPendingWire();
            this.selectNode(null);
            this.selectWire(null);
            this.closeContextMenu();

            this.isPanning = true;
            const startMouseX = e.clientX;
            const startMouseY = e.clientY;
            const startPanX = this.pan.x;
            const startPanY = this.pan.y;
            canvas.style.cursor = 'grabbing';

            const onMouseMove = (ev) => {
              if (!this.isPanning) return;
              this.pan.x = startPanX + (ev.clientX - startMouseX);
              this.pan.y = startPanY + (ev.clientY - startMouseY);
              this.updateTransform();
            };

            const onMouseUp = () => {
              this.isPanning = false;
              canvas.style.cursor = 'default';
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }
        }
      });

      // Zoom com roda do mouse centralizado no cursor
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.pan.x) / this.zoom;
        const worldY = (mouseY - this.pan.y) / this.zoom;

        const factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
        const newZoom = Math.min(Math.max(this.zoom * factor, 0.25), 3.5);

        this.pan.x = mouseX - worldX * newZoom;
        this.pan.y = mouseY - worldY * newZoom;
        this.zoom = newZoom;

        this.updateTransform();
      }, { passive: false });

      // Touch pan (1 dedo) e pinch zoom (2 dedos) no Diagrama de Blocos (Mobile/Android)
      let touchInitialDist = 0;
      let touchInitialScale = 1.0;
      let touchStartCenter = { x: 0, y: 0 };
      let touchStartPan = { x: 0, y: 0 };
      let isTouchPanning = false;

      canvas.addEventListener('touchstart', (e) => {
        if (e.target.closest('.diagram-node, .wire-path, .terminal-dot, .terminal-connector, .fp-context-menu, input, textarea, button')) {
          return;
        }
        this.cancelPendingWire();
        this.selectNode(null);
        this.selectWire(null);
        this.closeContextMenu();

        if (e.touches.length === 1) {
          isTouchPanning = true;
          touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchStartPan = { x: this.pan.x, y: this.pan.y };
        } else if (e.touches.length === 2) {
          isTouchPanning = false;
          touchInitialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          touchInitialScale = this.zoom;
          touchStartCenter = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
          };
          touchStartPan = { x: this.pan.x, y: this.pan.y };
        }
      }, { passive: true });

      canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isTouchPanning) {
          const dx = e.touches[0].clientX - touchStartCenter.x;
          const dy = e.touches[0].clientY - touchStartCenter.y;
          this.pan.x = touchStartPan.x + dx;
          this.pan.y = touchStartPan.y + dy;
          this.updateTransform();
          e.preventDefault();
        } else if (e.touches.length === 2 && touchInitialDist > 0) {
          const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          const factor = dist / touchInitialDist;
          const newZoom = Math.min(Math.max(touchInitialScale * factor, 0.25), 3.5);

          const rect = canvas.getBoundingClientRect();
          const mouseX = touchStartCenter.x - rect.left;
          const mouseY = touchStartCenter.y - rect.top;
          const worldX = (mouseX - touchStartPan.x) / touchInitialScale;
          const worldY = (mouseY - touchStartPan.y) / touchInitialScale;

          this.pan.x = mouseX - worldX * newZoom;
          this.pan.y = mouseY - worldY * newZoom;
          this.zoom = newZoom;

          this.updateTransform();
          e.preventDefault();
        }
      }, { passive: false });

      const onTouchEnd = (e) => {
        if (e.touches.length === 0) {
          isTouchPanning = false;
          touchInitialDist = 0;
        } else if (e.touches.length === 1) {
          isTouchPanning = true;
          touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchStartPan = { x: this.pan.x, y: this.pan.y };
          touchInitialDist = 0;
        }
      };
      canvas.addEventListener('touchend', onTouchEnd, { passive: true });
      canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });

      // Clique na área vazia garante cancelamento de seleção e fiação
      canvas.addEventListener('click', (e) => {
        if (!e.target.closest('.diagram-node, .wire-path, .terminal-dot, .terminal-connector, .fp-context-menu')) {
          this.cancelPendingWire();
          this.selectNode(null);
          this.selectWire(null);
          this.closeContextMenu();
        }
      });

      // Right-click no canvas vazio abre a paleta de funções
      canvas.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.diagram-node, .wire-path, .terminal-dot, .terminal-connector')) return;
        e.preventDefault();
        this.closeContextMenu();
        if (this.app && this.app.palette) {
          this.app.palette.openAt(e.clientX, e.clientY);
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('[contenteditable="true"]')) {
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.selectedWireId) {
            this.graph.removeConnection(this.selectedWireId);
            this.selectedWireId = null;
            this.renderWires();
            if (this.app && this.app.undoManager) this.app.undoManager.pushState();
          } else if (this.selectedNodeId) {
            this.deleteNode(this.selectedNodeId);
          }
        }
      });
    }

    render() {
      this.renderNodes();
      this.renderWires();
    }

    renderNodes() {
      // Captura o estado atual de todos os textareas de fórmulas antes de re-renderizar
      for (const [, node] of this.graph.nodes) {
        if (node.type === 'formula_node') {
          const existingTextarea = this.nodesContainer.querySelector(`#code_${node.id}`);
          if (existingTextarea) {
            node.code = existingTextarea.value;
          }
        }
      }
      this.nodesContainer.innerHTML = '';
      for (const [, node] of this.graph.nodes) {
        this.renderNodeElement(node);
      }
    }

    renderNodeElement(node) {
      const el = document.createElement('div');
      el.className = `diagram-node ${this.selectedNodeId === node.id ? 'selected' : ''}`;
      el.id = `node_${node.id}`;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;

      let bodyContent = '';
      if (node.type === 'formula_node') {
        bodyContent = `
          <div class="formula-node-box">
            <textarea class="formula-textarea" id="code_${node.id}" placeholder="y = x;">${node.code || ''}</textarea>
          </div>
        `;
      }

      if (node.type === 'sig_const') {
        const val = node.constantValue !== undefined ? node.constantValue : 0;
        bodyContent = `
          <div class="constant-node-box" style="padding: 2px 4px; display: flex; align-items: center;">
            <input type="number" class="constant-input" id="const_${node.id}" value="${val}" step="any"
                   style="width: 68px; background: #0f172a; border: 1px solid #38bdf8; border-radius: 4px; color: #38bdf8; font-family: monospace; font-size: 12px; font-weight: 700; padding: 2px 4px; text-align: right; outline: none;">
          </div>
        `;
      }

      el.innerHTML = `
        <div class="node-header">
          <div class="node-icon">${node.icon || 'ƒ'}</div>
          <div class="node-title" contenteditable="true" spellcheck="false" title="Clique para renomear este bloco">${node.title}</div>
        </div>
        <div class="node-body">
          <div class="terminals-col terminals-left" id="inputs_${node.id}"></div>
          ${bodyContent}
          <div class="terminals-col terminals-right" id="outputs_${node.id}"></div>
        </div>
      `;

      // Edição direta do título do bloco
      const titleEl = el.querySelector('.node-title');
      if (titleEl) {
        titleEl.addEventListener('click', (e) => e.stopPropagation());
        titleEl.addEventListener('mousedown', (e) => e.stopPropagation());
        titleEl.addEventListener('input', () => {
          node.title = titleEl.textContent.trim();
          if (node.linkedWidgetId && this.app && this.app.frontPanel) {
            const widget = this.app.frontPanel.widgets.get(node.linkedWidgetId);
            if (widget && widget.element) {
              const hdr = widget.element.querySelector('.fp-widget-header');
              if (hdr) hdr.textContent = node.title;
            }
          }
        });
        titleEl.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            titleEl.blur();
          }
        });
      }

      const inputsCol = el.querySelector(`#inputs_${node.id}`);
      const outputsCol = el.querySelector(`#outputs_${node.id}`);

      for (const [, term] of node.inputs) {
        const termEl = document.createElement('div');
        termEl.className = 'terminal-item';
        termEl.innerHTML = `
          <div class="terminal-dot dot-${term.type}" data-node-id="${node.id}" data-term-id="${term.id}" data-is-output="false" title="${term.name} (${term.type})"></div>
          <span contenteditable="true" spellcheck="false" title="Clique para renomear variável">${term.name}</span>
        `;
        const span = termEl.querySelector('span');
        span.addEventListener('click', (e) => e.stopPropagation());
        span.addEventListener('mousedown', (e) => e.stopPropagation());
        span.addEventListener('input', () => {
          term.name = span.textContent.trim();
        });
        span.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            span.blur();
          }
        });
        inputsCol.appendChild(termEl);
      }

      for (const [, term] of node.outputs) {
        const termEl = document.createElement('div');
        termEl.className = 'terminal-item';
        termEl.innerHTML = `
          <span contenteditable="true" spellcheck="false" title="Clique para renomear variável">${term.name}</span>
          <div class="terminal-dot dot-${term.type}" data-node-id="${node.id}" data-term-id="${term.id}" data-is-output="true" title="${term.name} (${term.type})"></div>
        `;
        const span = termEl.querySelector('span');
        span.addEventListener('click', (e) => e.stopPropagation());
        span.addEventListener('mousedown', (e) => e.stopPropagation());
        span.addEventListener('input', () => {
          term.name = span.textContent.trim();
        });
        span.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            span.blur();
          }
        });
        outputsCol.appendChild(termEl);
      }

      if (node.type === 'formula_node') {
        const textarea = el.querySelector(`#code_${node.id}`);
        if (textarea) {
          textarea.value = node.code || '';
          textarea.addEventListener('input', (e) => {
            node.code = e.target.value;
          });
          textarea.addEventListener('change', (e) => {
            node.code = e.target.value;
          });
          textarea.addEventListener('keyup', (e) => {
            e.stopPropagation();
            node.code = e.target.value;
          });
          textarea.addEventListener('keydown', (e) => {
            e.stopPropagation();
          });
        }

        const actionsBar = document.createElement('div');
        actionsBar.className = 'formula-term-actions';
        actionsBar.innerHTML = `
          <button class="btn-add-term" id="add_in_${node.id}" title="Adicionar variável de entrada">+ Entr.</button>
          <button class="btn-add-term" id="add_out_${node.id}" title="Adicionar variável de saída">+ Saída</button>
        `;
        el.appendChild(actionsBar);

        actionsBar.querySelector(`#add_in_${node.id}`).addEventListener('click', (e) => {
          e.stopPropagation();
          const name = prompt('Nome da nova variável de ENTRADA (ex: v, sp, pv, t):', `in${node.inputs.size + 1}`);
          if (name && name.trim()) {
            node.addInput(name.trim(), DataTypes.DOUBLE, 0);
            this.render();
          }
        });

        actionsBar.querySelector(`#add_out_${node.id}`).addEventListener('click', (e) => {
          e.stopPropagation();
          const name = prompt('Nome da nova variável de SAÍDA (ex: Nivel, Bomba, y):', `out${node.outputs.size + 1}`);
          if (name && name.trim()) {
            node.addOutput(name.trim(), DataTypes.DOUBLE, 0);
            this.render();
          }
        });
      }

      if (node.type === 'sig_const') {
        const constInput = el.querySelector(`#const_${node.id}`);
        if (constInput) {
          const updateVal = (e) => {
            node.setValue(e.target.value);
          };
          constInput.addEventListener('input', updateVal);
          constInput.addEventListener('change', updateVal);
          constInput.addEventListener('mousedown', (e) => e.stopPropagation());
          constInput.addEventListener('keydown', (e) => e.stopPropagation());
        }
      }

      this.nodesContainer.appendChild(el);
      this.setupNodeInteraction(node, el);
    }

    setupNodeInteraction(node, el) {
      const dots = el.querySelectorAll('.terminal-dot');
      dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOutput = dot.getAttribute('data-is-output') === 'true';
          const nodeId = dot.getAttribute('data-node-id');
          const termId = dot.getAttribute('data-term-id');

          if (!this.pendingWire) {
            if (isOutput) this.startPendingWire(nodeId, termId, dot);
          } else {
            if (!isOutput && this.pendingWire.fromNodeId !== nodeId) {
              this.completePendingWire(nodeId, termId);
            } else {
              this.cancelPendingWire();
            }
          }
        });
      });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.target.closest('.terminal-dot') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        this.selectNode(node.id);
        const startX = e.clientX, startY = e.clientY, origX = node.x, origY = node.y;
        const scale = this.getCurrentScale();
        const onMouseMove = (ev) => {
          node.x = origX + (ev.clientX - startX) / scale;
          node.y = origY + (ev.clientY - startY) / scale;
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
          this.renderWires();
        };
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      // Touch drag para dispositivos móveis (1 dedo com limiar de toque)
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (e.target.closest('.terminal-dot') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        e.stopPropagation();

        const touch = e.touches[0];
        const startTouchX = touch.clientX;
        const startTouchY = touch.clientY;
        const origX = node.x;
        const origY = node.y;
        const scale = this.getCurrentScale();
        let isDragging = false;

        const onTouchMove = (ev) => {
          if (ev.touches.length !== 1) return;
          const t = ev.touches[0];
          const dx = t.clientX - startTouchX;
          const dy = t.clientY - startTouchY;
          if (!isDragging && Math.hypot(dx, dy) > 8) {
            isDragging = true;
            this.selectNode(node.id);
          }
          if (isDragging) {
            ev.preventDefault();
            node.x = origX + dx / scale;
            node.y = origY + dy / scale;
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
            this.renderWires();
          }
        };

        const onTouchEnd = () => {
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        };

        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
      }, { passive: true });
    }

    startPendingWire(fromNodeId, fromTerminalId, dotEl) {
      const dotRect = dotEl.getBoundingClientRect();
      const pos = this.screenToWorld(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
      const startX = pos.x;
      const startY = pos.y;

      const fromNode = this.graph.getNode(fromNodeId);
      const term = fromNode ? fromNode.outputs.get(fromTerminalId) : null;
      const type = term ? term.type : DataTypes.DOUBLE;

      this.pendingWire = { fromNodeId, fromTerminalId, type, startX, startY };

      this.previewPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.previewPathEl.setAttribute('class', `wire-path wire-${type}`);
      this.previewPathEl.style.strokeDasharray = '4, 4';
      this.svgLayer.appendChild(this.previewPathEl);
    }

    completePendingWire(toNodeId, toTerminalId) {
      if (!this.pendingWire) return;
      this.graph.addConnection({
        fromNodeId: this.pendingWire.fromNodeId,
        fromTerminalId: this.pendingWire.fromTerminalId,
        toNodeId: toNodeId,
        toTerminalId: toTerminalId,
        type: this.pendingWire.type
      });
      this.cancelPendingWire();
      this.renderWires();
    }

    cancelPendingWire() {
      if (this.previewPathEl && this.previewPathEl.parentNode) {
        this.previewPathEl.parentNode.removeChild(this.previewPathEl);
      }
      this.pendingWire = null;
      this.previewPathEl = null;
    }

    renderWires() {
      this.svgLayer.innerHTML = '';
      const canvas = this.canvas || this.container.querySelector('#diagram-canvas');
      if (!canvas) return;

      for (const [, conn] of this.graph.connections) {
        const fromNodeEl = this.container.querySelector(`#node_${conn.fromNodeId}`);
        const toNodeEl = this.container.querySelector(`#node_${conn.toNodeId}`);

        if (fromNodeEl && toNodeEl) {
          const fromDot = fromNodeEl.querySelector(`[data-term-id="${conn.fromTerminalId}"]`);
          const toDot = toNodeEl.querySelector(`[data-term-id="${conn.toTerminalId}"]`);

          if (fromDot && toDot) {
            const fromRect = fromDot.getBoundingClientRect();
            const toRect = toDot.getBoundingClientRect();

            const p1 = this.screenToWorld(fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2);
            const p2 = this.screenToWorld(toRect.left + toRect.width / 2, toRect.top + toRect.height / 2);

            const pathD = WireRouter.getCubicBezierPath(p1.x, p1.y, p2.x, p2.y);
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', pathD);
            pathEl.setAttribute('class', `wire-path wire-${conn.type} ${this.selectedWireId === conn.id ? 'selected' : ''}`);
            
            pathEl.addEventListener('click', (e) => {
              e.stopPropagation();
              this.selectWire(conn.id);
            });

            this.svgLayer.appendChild(pathEl);
          }
        }
      }
    }

    selectNode(nodeId) {
      this.selectedNodeId = nodeId;
      this.selectedWireId = null;
      const allNodes = this.container.querySelectorAll('.diagram-node');
      allNodes.forEach(n => n.classList.remove('selected'));
      if (nodeId) {
        const el = this.container.querySelector(`#node_${nodeId}`);
        if (el) el.classList.add('selected');
      }
    }

    selectWire(wireId) {
      this.selectedWireId = wireId;
      this.selectedNodeId = null;
      this.renderWires();
    }
  }

  class RosiViewRuntime {
    constructor({ graph, daqDevice, frontPanel }) {
      this.graph = graph;
      this.daq = daqDevice;
      this.frontPanel = frontPanel;
      this.isRunning = false;
      this.isContinuous = false;
      this.isHighlight = false;
      this.timerId = null;
      this.dt = 0.05;
      this.simTime = 0.0;
      this.iterationCount = 0;
      this.onStateChange = null;
      this.onStepCompleted = null;
    }

    setDAQDevice(daq) { this.daq = daq; }
    setHighlight(active) { this.isHighlight = Boolean(active); }

    async step() {
      // Avança a simulação física em tempo real do DAQ Virtual
      if (this.daq && typeof this.daq.stepSimulation === 'function') {
        this.daq.stepSimulation(this.dt);
      }

      const executionOrder = this.graph.getExecutionOrder();
      const context = {
        t: this.simTime,
        dt: this.dt,
        iteration: this.iterationCount,
        daq: this.daq,
        runtime: this
      };

      if (this.frontPanel) this.frontPanel.syncControlsToDiagram(this.graph);

      // Garante que terminais de indicadores sem conexões ativas fiquem desligados (0 / false)
      const connectedTargets = new Set();
      for (const [, conn] of this.graph.connections) {
        connectedTargets.add(conn.toNodeId);
      }
      for (const [, node] of this.graph.nodes) {
        if (node.type === 'fp_indicator' && !connectedTargets.has(node.id)) {
          for (const [, inTerm] of node.inputs) {
            inTerm.value = 0;
          }
        }
      }

      for (const [, conn] of this.graph.connections) {
        const fromNode = this.graph.getNode(conn.fromNodeId);
        const toNode = this.graph.getNode(conn.toNodeId);
        if (fromNode && toNode) {
          const outTerm = fromNode.outputs.get(conn.fromTerminalId);
          const inTerm = toNode.inputs.get(conn.toTerminalId);
          if (outTerm && inTerm) inTerm.value = outTerm.value;
        }
      }

      for (const node of executionOrder) {
        if (this.isHighlight) {
          const nodeEl = document.getElementById(`node_${node.id}`);
          if (nodeEl) nodeEl.classList.add('executing');
          await new Promise(r => setTimeout(r, 35));
        }

        node.execute(context);

        // Propaga imediatamente os novos valores calculados pelos fios de saída deste bloco
        for (const [, conn] of this.graph.connections) {
          if (conn.fromNodeId === node.id) {
            const toNode = this.graph.getNode(conn.toNodeId);
            if (toNode) {
              let outTerm = node.outputs.get(conn.fromTerminalId);
              if (!outTerm && node.outputs.size === 1) {
                outTerm = Array.from(node.outputs.values())[0];
              }
              let inTerm = toNode.inputs.get(conn.toTerminalId);
              if (!inTerm && toNode.inputs.size === 1) {
                inTerm = Array.from(toNode.inputs.values())[0];
              }
              if (outTerm && inTerm) inTerm.value = outTerm.value;
            }
          }
        }

        if (this.isHighlight) {
          const nodeEl = document.getElementById(`node_${node.id}`);
          if (nodeEl) nodeEl.classList.remove('executing');
        }
      }

      if (this.frontPanel) this.frontPanel.syncDiagramToIndicators(this.graph);

      this.simTime += this.dt;
      this.iterationCount++;

      if (this.onStepCompleted) {
        this.onStepCompleted({ time: this.simTime, iteration: this.iterationCount });
      }
    }

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

    async runOnce() {
      if (this.isRunning) return;
      this.isRunning = true;
      if (this.onStateChange) this.onStateChange(true);
      await this.step();
      this.isRunning = false;
      if (this.onStateChange) this.onStateChange(false);
    }

    stop() {
      this.isRunning = false;
      this.isContinuous = false;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (this.frontPanel) {
        this.frontPanel.resetAllIndicators();
      }
      if (this.onStateChange) this.onStateChange(false);
    }

    reset() {
      this.stop();
      this.simTime = 0.0;
      this.iterationCount = 0;
    }
  }

  // ==========================================================================
  // 9. PALETTE MANAGER COM SUPORTE A CLIQUE E POSICIONAMENTO
  // ==========================================================================
  class PaletteManager {
    constructor({ onAddNode, onAddWidget }) {
      this.onAddNode = onAddNode;
      this.onAddWidget = onAddWidget;
      this.paletteEl = null;
      this.isOpen = false;
      this.hasBeenMoved = false;
      this.init();
    }

    init() {
      const el = document.createElement('div');
      el.className = 'floating-palette';
      el.id = 'palette-drawer';
      el.style.display = 'none';

      el.innerHTML = `
        <div class="palette-header" title="Clique e arraste para mover a paleta na tela">
          <span>Paleta de Funções & Controles</span>
          <button class="palette-close-btn" id="palette-close" title="Fechar">✕</button>
        </div>
        <div class="palette-search">
          <input type="text" class="palette-search-input" id="palette-search-input" placeholder="Buscar função ou instrumento...">
        </div>
        <div class="palette-categories" id="palette-list">
          
          <!-- Controles do Painel Frontal (Entradas) -->
          <div class="palette-category">
            <div class="category-title">🎛 Controles (Entradas)</div>
            <div class="category-grid">
              <div class="palette-item" data-type="widget" data-kind="knob">
                <span class="palette-item-icon" style="background:#0284c7;color:#fff;">🎛</span>
                <span>Knob (Giratório)</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="slider">
                <span class="palette-item-icon" style="background:#475569;color:#fff;">🎚</span>
                <span>Slider (Deslizador)</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="num_ctrl">
                <span class="palette-item-icon" style="background:#0284c7;color:#fff;">123</span>
                <span>Entrada Numérica</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="switch">
                <span class="palette-item-icon" style="background:#334155;color:#fff;">🔘</span>
                <span>Chave Liga/Desliga</span>
              </div>
            </div>
          </div>

          <!-- Indicadores do Painel Frontal (Saídas) -->
          <div class="palette-category">
            <div class="category-title">📊 Indicadores (Saídas)</div>
            <div class="category-grid">
              <div class="palette-item" data-type="widget" data-kind="gauge">
                <span class="palette-item-icon" style="background:#f97316;color:#fff;">⏱</span>
                <span>Gauge (Tacômetro)</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="chart">
                <span class="palette-item-icon" style="background:#0f172a;color:#38bdf8;">📈</span>
                <span>Gráfico Temporal</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="led">
                <span class="palette-item-icon" style="background:#16a34a;color:#fff;">💡</span>
                <span>LED Indicador</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="tank">
                <span class="palette-item-icon" style="background:#0284c7;color:#fff;">🛢</span>
                <span>Tanque de Nível</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="thermometer">
                <span class="palette-item-icon" style="background:#dc2626;color:#fff;">🌡</span>
                <span>Termômetro</span>
              </div>
              <div class="palette-item" data-type="widget" data-kind="num_ind">
                <span class="palette-item-icon" style="background:#64748b;color:#fff;">[123]</span>
                <span>Display Numérico</span>
              </div>
            </div>
          </div>

          <!-- Matemática -->
          <div class="palette-category">
            <div class="category-title">➕ Matemática</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="sig_const">
                <span class="palette-item-icon" style="background:#3b82f6;color:#fff;">#</span>
                <span>Constante Numérica</span>
              </div>
              <div class="palette-item" data-type="node" data-kind="math_add"><span class="palette-item-icon">+</span><span>Soma (+)</span></div>
              <div class="palette-item" data-type="node" data-kind="math_sub"><span class="palette-item-icon">−</span><span>Subtração (−)</span></div>
              <div class="palette-item" data-type="node" data-kind="math_mul"><span class="palette-item-icon">×</span><span>Multiplicação (×)</span></div>
              <div class="palette-item" data-type="node" data-kind="math_div"><span class="palette-item-icon">÷</span><span>Divisão (÷)</span></div>
              <div class="palette-item" data-type="node" data-kind="math_gain"><span class="palette-item-icon">K</span><span>Ganho (Kp)</span></div>
              <div class="palette-item" data-type="node" data-kind="math_sat"><span class="palette-item-icon">⫰</span><span>Saturação</span></div>
            </div>
          </div>

          <!-- Lógica & Comparação -->
          <div class="palette-category">
            <div class="category-title">⚖ Lógica & Comparação</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="logic_gt"><span class="palette-item-icon">&gt;</span><span>Maior que? (&gt;)</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_lt"><span class="palette-item-icon">&lt;</span><span>Menor que? (&lt;)</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_eq"><span class="palette-item-icon">=</span><span>Igual a? (=)</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_and"><span class="palette-item-icon">&amp;</span><span>Porta E (AND)</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_or"><span class="palette-item-icon">≥1</span><span>Porta OU (OR)</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_not"><span class="palette-item-icon">!</span><span>Inversor (NOT)</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_select"><span class="palette-item-icon">?</span><span>Seletor (?)</span></div>
            </div>
          </div>

          <!-- Controle de Processos -->
          <div class="palette-category">
            <div class="category-title">⚙ Controle de Processos</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="ctrl_onoff">
                <span class="palette-item-icon">⎍</span>
                <span>Controle ON-OFF</span>
              </div>
              <div class="palette-item" data-type="node" data-kind="ctrl_pid">
                <span class="palette-item-icon">PID</span>
                <span>Controlador PID</span>
              </div>
              <div class="palette-item" data-type="node" data-kind="plant_tf">
                <span class="palette-item-icon">G(s)</span>
                <span>Processo G(s)</span>
              </div>
              <div class="palette-item" data-type="node" data-kind="formula_node">
                <span class="palette-item-icon">fx</span>
                <span>Nó de Fórmula</span>
              </div>
            </div>
          </div>

          <!-- Aquisição (NI USB-6009) -->
          <div class="palette-category">
            <div class="category-title">🔌 Aquisição (NI USB-6009)</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="daq_ai">
                <span class="palette-item-icon" style="background:#38bdf8;color:#0369a1;">AI</span>
                <span>Entrada Analógica (AI)</span>
              </div>
              <div class="palette-item" data-type="node" data-kind="daq_ao">
                <span class="palette-item-icon" style="background:#f87171;color:#991b1b;">AO</span>
                <span>Saída Analógica (AO)</span>
              </div>
            </div>
          </div>

          <!-- Sinais & Arranjos -->
          <div class="palette-category">
            <div class="category-title">📦 Sinais & Arranjos</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="sig_const"><span class="palette-item-icon">#</span><span>Constante Numérica</span></div>
              <div class="palette-item" data-type="node" data-kind="sig_random"><span class="palette-item-icon">🎲</span><span>Gerador Aleatório (0-1)</span></div>
              <div class="palette-item" data-type="node" data-kind="sig_sine"><span class="palette-item-icon">∿</span><span>Onda Senoidal</span></div>
              <div class="palette-item" data-type="node" data-kind="cluster_bundle"><span class="palette-item-icon">📦</span><span>Agrupar (Bundle)</span></div>
              <div class="palette-item" data-type="node" data-kind="array_build"><span class="palette-item-icon">[+]</span><span>Criar Arranjo</span></div>
              <div class="palette-item" data-type="node" data-kind="array_subset"><span class="palette-item-icon">[..]</span><span>Subconjunto</span></div>
            </div>
          </div>

        </div>
      `;

      document.body.appendChild(el);
      this.paletteEl = el;

      el.querySelector('#palette-close').addEventListener('click', () => this.toggle(false));

      this.setupPaletteDrag(el);

      const items = el.querySelectorAll('.palette-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-type');
          const kind = item.getAttribute('data-kind');
          if (type === 'node' && this.onAddNode) this.onAddNode(kind);
          else if (type === 'widget' && this.onAddWidget) this.onAddWidget(kind);
        });
      });

      const searchInput = el.querySelector('#palette-search-input');
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        items.forEach(it => {
          it.style.display = it.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
        });
      });
    }

    setupPaletteDrag(el) {
      const header = el.querySelector('.palette-header');
      let isDragging = false;
      let startX = 0, startY = 0, origX = 0, origY = 0;

      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.palette-close-btn')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = el.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;

        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.left = `${origX}px`;
        el.style.top = `${origY}px`;
        el.style.zIndex = '1100';
        this.hasBeenMoved = true;

        const onMouseMove = (ev) => {
          if (!isDragging) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;

          const maxLeft = window.innerWidth - el.offsetWidth - 10;
          const maxTop = window.innerHeight - 80;
          const newX = Math.max(10, Math.min(maxLeft, origX + dx));
          const newY = Math.max(10, Math.min(maxTop, origY + dy));

          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
        };

        const onMouseUp = () => {
          isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    openAt(clientX, clientY) {
      const w = this.paletteEl.offsetWidth || 265;
      const h = this.paletteEl.offsetHeight || 420;
      const posX = Math.max(10, Math.min(window.innerWidth - w - 20, clientX));
      const posY = Math.max(10, Math.min(window.innerHeight - h - 20, clientY));

      this.paletteEl.style.left = `${posX}px`;
      this.paletteEl.style.top = `${posY}px`;
      this.paletteEl.style.right = 'auto';
      this.hasBeenMoved = true;
      this.toggle(true);
    }

    toggle(forceState) {
      this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
      this.paletteEl.style.display = this.isOpen ? 'flex' : 'none';

      if (this.isOpen) {
        if (!this.hasBeenMoved) {
          const w = 265;
          this.paletteEl.style.left = `${Math.max(10, window.innerWidth - w - 25)}px`;
          this.paletteEl.style.top = '55px';
          this.paletteEl.style.right = 'auto';
        }

        const search = this.paletteEl.querySelector('#palette-search-input');
        if (search) {
          search.value = '';
          const items = this.paletteEl.querySelectorAll('.palette-item');
          items.forEach(it => it.style.display = 'flex');
          search.focus();
        }
      }
    }
  }

  // ==========================================================================
  // 10. CENTRAL APP ORCHESTRATOR COM SINCRONIZAÇÃO BIDIRECIONAL AUTOMÁTICA
  // ==========================================================================
  class RosiViewApp {
    constructor() {
      this.graph = new DiagramGraph();
      this.virtualDAQ = new VirtualDAQDriver();
      this.wsBridge = new WSBridgeClient();
      this.webUSB = new NIUSB6009WebUSBDriver();
      this.currentDAQ = this.virtualDAQ;

      this.frontPanel = null;
      this.editor = null;
      this.runtime = null;
      this.palette = null;
      this.activeView = 'split';
      this.currentProjectName = 'meu_projeto.rosi';
    }

    init() {
      this.frontPanel = new FrontPanelManager('front-panel-container', this);
      this.editor = new BlockDiagramEditor({
        containerId: 'diagram-container',
        graph: this.graph,
        app: this
      });

      this.runtime = new RosiViewRuntime({
        graph: this.graph,
        daqDevice: this.currentDAQ,
        frontPanel: this.frontPanel
      });

      this.palette = new PaletteManager({
        onAddNode: (kind) => this.addFunctionNode(kind),
        onAddWidget: (kind) => this.addFrontPanelWidget(kind)
      });

      this.setupToolbar();
      this.setupViewTabs();
      this.setupHardwareSelector();
      this.setupStatusBar();
      this.setupBeforeUnload();
      this.setupUpdateChecker();
      this.setupCollapsibleToolbar();
      this.setupMobileSplash();

      // Inicia com a área de trabalho 100% limpa
      this.clearAll();
    }


    setupCollapsibleToolbar() {
      const header = document.getElementById('app-header');
      const btnCollapse = document.getElementById('btn-collapse-toolbar');
      const btnExpand = document.getElementById('btn-expand-toolbar-floating');

      if (!header || !btnCollapse || !btnExpand) return;

      const collapseToolbar = () => {
        header.classList.add('collapsed');
        btnExpand.classList.add('visible');
      };

      const expandToolbar = () => {
        header.classList.remove('collapsed');
        btnExpand.classList.remove('visible');
      };

      btnCollapse.addEventListener('click', collapseToolbar);
      btnExpand.addEventListener('click', expandToolbar);
    }

    setupMobileSplash() {
      const splash = document.getElementById('mobile-splash-overlay');
      const dot = document.getElementById('mobile-splash-dot');
      const text = document.getElementById('mobile-splash-status-text');

      if (!splash) return;

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
      
      if (!isMobile) {
        splash.style.display = 'none';
        splash.style.pointerEvents = 'none';
        return;
      }

      const myVer = (window.AndroidBridge && typeof window.AndroidBridge.getVersion === 'function') 
        ? ('v' + window.AndroidBridge.getVersion()) 
        : 'v0.4.1';
      this.currentVersion = myVer;

      const badge = splash.querySelector('.mobile-splash-badge');
      if (badge) {
        badge.textContent = myVer;
      }

      // Exibe splash overlay no mobile
      splash.style.display = 'flex';
      splash.style.opacity = '1';
      splash.style.pointerEvents = 'auto';

      const setStatus = (msg, color = '#38bdf8') => {
        if (text) text.textContent = msg;
        if (dot) {
          dot.style.background = color;
          dot.style.boxShadow = `0 0 10px ${color}`;
        }
      };

      setStatus('Verificando atualizações no GitHub...', '#38bdf8');

      const VERSION_URL = 'https://raw.githubusercontent.com/rosirocha28/RosiView/main/version.json';
      const checkPromise = fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          const targetRemote = (isMobile && data.android && data.android.version) ? data.android.version : (data.desktop && data.desktop.version ? data.desktop.version : data.version);
          const parseVer = (v) => (v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
          const r = parseVer(targetRemote), l = parseVer(myVer);
          let hasNewer = false;
          for (let i = 0; i < Math.max(r.length, l.length); i++) {
            if ((r[i] || 0) > (l[i] || 0)) { hasNewer = true; break; }
            if ((r[i] || 0) < (l[i] || 0)) break;
          }

          if (hasNewer) {
            setStatus(`Nova versão ${targetRemote} disponível!`, '#f59e0b');
          } else {
            setStatus(`RosiView ${myVer} atualizado • Abrindo...`, '#22c55e');
          }
        })
        .catch(() => {
          const myVer = 'v0.4.1';
          setStatus(`Modo offline (${myVer}) • Abrindo...`, '#38bdf8');
        });

      // Aguarda e executa fade out suave
      setTimeout(async () => {
        try { await checkPromise; } catch (e) {}
        setTimeout(() => {
          splash.style.pointerEvents = 'none';
          splash.style.opacity = '0';
          setTimeout(() => {
            splash.style.display = 'none';
          }, 500);
        }, 700);
      }, 1200);
    }

    setupUpdateChecker() {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
      this.isAndroid = isMobile;
      this.currentVersion = (isMobile && window.AndroidBridge && typeof window.AndroidBridge.getVersion === 'function')
        ? ('v' + window.AndroidBridge.getVersion())
        : 'v0.4.1';
      const versionEl = document.getElementById('status-app-version');
      if (versionEl) {
        versionEl.textContent = isMobile ? `RosiView Android ${this.currentVersion} — IFES` : `RosiView ${this.currentVersion} — IFES`;
      }

      this.checkForUpdates();
    }

    async checkForUpdates() {
      const VERSION_URL = 'https://raw.githubusercontent.com/rosirocha28/RosiView/main/version.json';
      const REPO_URL = 'https://github.com/rosirocha28/RosiView';
      const ZIP_URL = 'https://github.com/rosirocha28/RosiView/archive/refs/heads/main.zip';

      const parseVer = (v) => (v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
      const isNewer = (remote, local) => {
        const r = parseVer(remote), l = parseVer(local);
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
          const rPart = r[i] || 0, lPart = l[i] || 0;
          if (rPart > lPart) return true;
          if (rPart < lPart) return false;
        }
        return false;
      };

      try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const remoteData = await res.json();
        const isAndroid = this.isAndroid || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
        this.isAndroid = isAndroid;

        // Separação estrita de dados remotos por plataforma (Android vs Desktop)
        const targetData = (isAndroid && remoteData.android) ? remoteData.android : ((remoteData.desktop) || remoteData);
        const remoteVersion = targetData.version;

        if (remoteVersion && isNewer(remoteVersion, this.currentVersion)) {
          const badge = document.getElementById('status-update-badge');
          const badgeText = document.getElementById('status-update-text');
          const modal = document.getElementById('update-modal');
          const curVerEl = document.getElementById('update-current-ver');
          const newVerEl = document.getElementById('update-new-ver');
          const notesEl = document.getElementById('update-notes-text');
          const btnDownload = document.getElementById('btn-update-download');
          const btnGithub = document.getElementById('btn-update-github');
          const btnClose = document.getElementById('btn-update-close');
          const btnDismiss = document.getElementById('btn-update-dismiss');

          if (badge) {
            if (badgeText) badgeText.textContent = `Nova versão ${remoteVersion} disponível!`;
            badge.style.display = 'inline-flex';
            badge.onclick = () => {
              if (modal) modal.style.display = 'flex';
            };
          }

          if (curVerEl) curVerEl.textContent = this.currentVersion;
          if (newVerEl) newVerEl.textContent = remoteVersion;
          if (notesEl) notesEl.textContent = targetData.notes || 'Atualizações, correções e novas melhorias disponíveis no GitHub.';

          const closeModal = () => { if (modal) modal.style.display = 'none'; };
          if (btnClose) btnClose.onclick = closeModal;
          if (btnDismiss) btnDismiss.onclick = closeModal;
          if (modal) {
            modal.onclick = (e) => {
              if (e.target === modal) closeModal();
            };
          }

          if (btnDownload) {
            if (isAndroid) {
              btnDownload.textContent = 'Baixar e Instalar APK';
              const cardTitle = btnDownload.closest('.update-option-card')?.querySelector('strong');
              if (cardTitle) cardTitle.textContent = 'Instalar Atualização (.APK)';
              const cardDesc = btnDownload.closest('.update-option-card')?.querySelector('p');
              if (cardDesc) cardDesc.textContent = 'Baixa e instala automaticamente o novo APK do RosiView Android.';

              btnDownload.onclick = () => {
                const tagStr = targetData.tag || `android-${remoteVersion}`;
                const apkUrl = targetData.apkUrl || `https://github.com/rosirocha28/RosiView/releases/download/${tagStr}/RosiView.apk`;
                if (window.AndroidBridge && typeof window.AndroidBridge.downloadAndInstallUpdate === 'function') {
                  window.AndroidBridge.downloadAndInstallUpdate(apkUrl);
                  closeModal();
                } else {
                  window.open(apkUrl, '_blank');
                }
              };
            } else {
              btnDownload.onclick = () => {
                const a = document.createElement('a');
                a.href = targetData.downloadUrl || ZIP_URL;
                a.download = `RosiView_${remoteVersion}.zip`;
                a.target = '_blank';
                a.click();
              };
            }
          }

          if (btnGithub) {
            btnGithub.onclick = () => {
              const releaseUrl = targetData.releaseUrl || (isAndroid
                ? `https://github.com/rosirocha28/RosiView/releases/tag/android-${remoteVersion}`
                : `${REPO_URL}/releases`);
              window.open(releaseUrl, '_blank');
            };
          }
        }
      } catch (err) {
        // Silencioso em caso de ausência de rede/offline
      }
    }

    setupBeforeUnload() {
      window.addEventListener('beforeunload', (e) => {
        if (this.hasContent()) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      });
    }

    hasContent() {
      return (this.graph && this.graph.nodes.size > 0) || (this.frontPanel && this.frontPanel.widgets.size > 0);
    }

    promptNewProject() {
      if (this.hasContent()) {
        const modal = document.getElementById('new-project-modal');
        if (modal) modal.style.display = 'flex';
      } else {
        this.clearAll();
      }
    }

    closeNewProjectModal() {
      const modal = document.getElementById('new-project-modal');
      if (modal) modal.style.display = 'none';
    }

    setupToolbar() {
      const btnRun = document.getElementById('btn-run');
      const btnContRun = document.getElementById('btn-cont-run');
      const btnStop = document.getElementById('btn-stop');
      const btnHighlight = document.getElementById('btn-highlight');
      const btnPalette = document.getElementById('btn-palette');
      const btnNew = document.getElementById('btn-new');
      const btnClear = document.getElementById('btn-clear');
      const btnHelp = document.getElementById('btn-help');
      const btnSave = document.getElementById('btn-save');
      const btnLoad = document.getElementById('btn-load');
      const fileInput = document.getElementById('file-input');

      // Botões do Modal de Confirmação (Novo Projeto)
      const modalClose = document.getElementById('btn-modal-close');
      const modalCancel = document.getElementById('btn-confirm-cancel');
      const modalDiscard = document.getElementById('btn-confirm-discard');
      const modalSave = document.getElementById('btn-confirm-save');

      if (btnRun) btnRun.addEventListener('click', () => this.runtime.runOnce());
      if (btnContRun) {
        btnContRun.addEventListener('click', () => {
          if (this.runtime.isRunning) this.runtime.stop();
          else this.runtime.startContinuous();
        });
      }
      if (btnStop) btnStop.addEventListener('click', () => this.runtime.stop());

      if (btnHighlight) {
        btnHighlight.addEventListener('click', () => {
          const active = !this.runtime.isHighlight;
          this.runtime.setHighlight(active);
          if (active) btnHighlight.classList.add('active');
          else btnHighlight.classList.remove('active');
        });
      }

      if (btnPalette) btnPalette.addEventListener('click', () => this.palette.toggle());
      if (btnNew) btnNew.addEventListener('click', () => this.promptNewProject());
      if (btnClear) btnClear.addEventListener('click', () => this.promptNewProject());
      if (btnHelp) btnHelp.addEventListener('click', () => this.openManualHelp());

      if (btnSave) btnSave.addEventListener('click', () => this.saveProject());
      if (btnLoad) {
        btnLoad.addEventListener('click', () => {
          if (window.AndroidBridge && typeof window.AndroidBridge.openProjectFile === 'function') {
            window.AndroidBridge.openProjectFile();
          } else if (fileInput) {
            fileInput.click();
          }
        });
      }
      if (fileInput) fileInput.addEventListener('change', (e) => this.loadProjectFile(e));

      // Listeners do Modal Novo Projeto
      if (modalClose) modalClose.addEventListener('click', () => this.closeNewProjectModal());
      if (modalCancel) modalCancel.addEventListener('click', () => this.closeNewProjectModal());
      if (modalDiscard) {
        modalDiscard.addEventListener('click', () => {
          this.closeNewProjectModal();
          this.clearAll();
        });
      }
      if (modalSave) {
        modalSave.addEventListener('click', () => {
          this.closeNewProjectModal();
          this.saveProject();
          this.clearAll();
        });
      }

      this.runtime.onStateChange = (running) => {
        const dot = document.getElementById('status-run-dot');
        const text = document.getElementById('status-run-text');
        if (running) {
          if (btnContRun) btnContRun.classList.add('btn-active');
          if (dot) dot.className = 'status-dot running';
          if (text) text.textContent = 'Executando (While Loop)';
        } else {
          if (btnContRun) btnContRun.classList.remove('btn-active');
          if (dot) dot.className = 'status-dot';
          if (text) text.textContent = 'Parado (Idle)';
        }
      };
    }

    setupViewTabs() {
      const tabs = document.querySelectorAll('.view-tab');
      const viewFront = document.getElementById('workspace-front');
      const viewDiagram = document.getElementById('workspace-diagram');
      const viewSplit = document.getElementById('workspace-split');
      const fpContainer = document.getElementById('front-panel-container');
      const diagContainer = document.getElementById('diagram-container');
      const splitFP = document.getElementById('split-front-panel');
      const splitDiag = document.getElementById('split-diagram');

      const switchView = (mode) => {
        this.activeView = mode;
        tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.view-tab[data-view="${mode}"]`);
        if (activeTab) activeTab.classList.add('active');

        if (viewFront) viewFront.classList.remove('active');
        if (viewDiagram) viewDiagram.classList.remove('active');
        if (viewSplit) viewSplit.classList.remove('active');

        if (mode === 'front') {
          if (viewFront) {
            viewFront.classList.add('active');
            viewFront.appendChild(fpContainer);
          }
        } else if (mode === 'diagram') {
          if (viewDiagram) {
            viewDiagram.classList.add('active');
            viewDiagram.appendChild(diagContainer);
          }
        } else {
          if (viewSplit) {
            viewSplit.classList.add('active');
            if (splitFP) splitFP.appendChild(fpContainer);
            if (splitDiag) splitDiag.appendChild(diagContainer);
          }
        }
        if (this.editor) this.editor.renderWires();
      };

      tabs.forEach(t => {
        t.addEventListener('click', () => {
          switchView(t.getAttribute('data-view'));
        });
      });

      switchView('split');
    }

    setupHardwareSelector() {
      const btnHardware = document.getElementById('btn-hardware');
      const menuHardware = document.getElementById('hardware-dropdown-menu');
      const hwItems = document.querySelectorAll('.hw-dropdown-item');
      const hwDot = document.getElementById('status-hw-dot');
      const hwText = document.getElementById('status-hw-text');

      // No ambiente Android / mobile, remove o seletor de Hardware para liberar espaço às abas
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
      if (isMobile) {
        document.body.classList.add('is-android');
        const hwDropdown = document.getElementById('dropdown-hardware');
        if (hwDropdown) hwDropdown.style.display = 'none';
        const hwStatusItem = document.getElementById('status-hw-item');
        if (hwStatusItem) hwStatusItem.style.display = 'none';
      }

      const updateActiveItem = (mode) => {
        hwItems.forEach(item => {
          if (item.getAttribute('data-value') === mode) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      };

      const applyMode = async (mode) => {
        updateActiveItem(mode);
        if (mode === 'virtual') {
          this.currentDAQ = this.virtualDAQ;
          this.runtime.setDAQDevice(this.virtualDAQ);
          if (hwDot) hwDot.className = 'status-dot connected';
          if (hwText) hwText.textContent = 'Hardware: Planta Virtual (Simulador)';
        } else if (mode === 'websocket') {
          try {
            if (hwText) hwText.textContent = 'Hardware: Conectando Bridge...';
            await this.wsBridge.connect();
            this.currentDAQ = this.wsBridge;
            this.runtime.setDAQDevice(this.wsBridge);
            if (hwDot) hwDot.className = 'status-dot connected';
            if (hwText) hwText.textContent = 'Hardware: NI USB-6009 (Bridge)';
          } catch (err) {
            alert('Não foi possível conectar ao Bridge WebSocket (ws://127.0.0.1:8765).\nCertifique-se de executar o arquivo "INICIAR_ROSIVIEW_BRIDGE.bat".');
            updateActiveItem('virtual');
            this.currentDAQ = this.virtualDAQ;
            this.runtime.setDAQDevice(this.virtualDAQ);
            if (hwDot) hwDot.className = 'status-dot connected';
            if (hwText) hwText.textContent = 'Hardware: Planta Virtual (Simulador)';
          }
        } else if (mode === 'webusb') {
          try {
            if (hwText) hwText.textContent = 'Hardware: Conectando WebUSB...';
            await this.webUSB.connect();
            this.currentDAQ = this.webUSB;
            this.runtime.setDAQDevice(this.webUSB);
            if (hwDot) hwDot.className = 'status-dot connected';
            if (hwText) hwText.textContent = 'Hardware: NI USB-6009 (WebUSB)';
          } catch (err) {
            alert('Erro ao conectar via WebUSB: ' + err.message);
            updateActiveItem('virtual');
            this.currentDAQ = this.virtualDAQ;
            this.runtime.setDAQDevice(this.virtualDAQ);
            if (hwDot) hwDot.className = 'status-dot connected';
            if (hwText) hwText.textContent = 'Hardware: Planta Virtual (Simulador)';
          }
        }
      };

      if (btnHardware && menuHardware) {
        btnHardware.addEventListener('click', (e) => {
          e.stopPropagation();
          const isVisible = menuHardware.style.display === 'flex';
          menuHardware.style.display = isVisible ? 'none' : 'flex';
        });

        document.addEventListener('click', (e) => {
          if (!menuHardware.contains(e.target) && e.target !== btnHardware) {
            menuHardware.style.display = 'none';
          }
        });

        hwItems.forEach(item => {
          item.addEventListener('click', async () => {
            const mode = item.getAttribute('data-value');
            menuHardware.style.display = 'none';
            await applyMode(mode);
          });
        });
      }

      // Auto-detecção inicial: se o Bridge estiver aberto, conecta automaticamente!
      setTimeout(async () => {
        try {
          const res = await fetch('http://127.0.0.1:8765/data', { cache: 'no-store' });
          if (res.ok) {
            updateActiveItem('websocket');
            await applyMode('websocket');
          }
        } catch (e) {}
      }, 300);

      if (hwDot) hwDot.className = 'status-dot connected';
      if (hwText) hwText.textContent = 'Hardware: Planta Virtual (Simulador)';
    }

    setupStatusBar() {
      const iterEl = document.getElementById('status-iteration');
      this.runtime.onStepCompleted = ({ iteration }) => {
        if (iterEl) iterEl.textContent = `Loop [i]: ${iteration}`;
      };
    }

    addFrontPanelWidget(kind) {
      const id = `item_${Date.now()}`;
      const fpX = 40 + (this.frontPanel.widgets.size % 4) * 160;
      const fpY = 40 + Math.floor(this.frontPanel.widgets.size / 4) * 200;

      const diagX = 60 + (this.graph.nodes.size % 5) * 150;
      const diagY = 80 + Math.floor(this.graph.nodes.size / 5) * 120;

      let widget = null;
      let node = null;

      switch (kind) {
        case 'knob':
          widget = new KnobWidget({ id, title: 'Tensão de Controle [V]', min: 0, max: 10, step: 0.1, initialValue: 5.0, unit: 'V', x: fpX, y: fpY });
          node = new FPControlTerminalNode({ id: `node_${id}`, title: 'Knob [V]', linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: 5.0, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: true });
          break;

        case 'slider':
          widget = new SliderWidget({ id, title: 'Slider Setpoint', initialValue: 100, x: fpX, y: fpY });
          node = new FPControlTerminalNode({ id: `node_${id}`, title: 'Slider (SP)', linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: 100, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: true });
          break;

        case 'num_ctrl':
          widget = new NumericControlWidget({ id, title: 'Controle Numérico', initialValue: 0, isIndicator: false, x: fpX, y: fpY });
          node = new FPControlTerminalNode({ id: `node_${id}`, title: 'Num Control', linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: 0, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: true });
          break;

        case 'switch':
          widget = new ToggleSwitchWidget({ id, title: 'Chave Toggle', initialState: false, x: fpX, y: fpY });
          node = new FPControlTerminalNode({ id: `node_${id}`, title: 'Toggle Switch', linkedWidgetId: id, dataType: DataTypes.BOOLEAN, initialValue: false, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: true });
          break;

        case 'gauge':
          widget = new GaugeWidget({ id, title: 'Tacômetro [RPM]', min: 0, max: 3000, unit: 'RPM', x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'Tacômetro (RPM)', linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;

        case 'tank':
          widget = new TankWidget({ id, title: 'Tanque de Nível', min: 0, max: 300, unit: 'mm', x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'Tanque (Indicador)', linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;

        case 'thermometer':
          widget = new ThermometerWidget({ id, title: 'Termômetro', min: 0, max: 200, unit: '°C', x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'Termômetro', linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;

        case 'chart':
          widget = new ChartWidget({ id, title: 'Waveform Chart', x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'Waveform Chart', linkedWidgetId: id, dataType: DataTypes.ANY, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;

        case 'led':
          widget = new LEDWidget({ id, title: 'LED Indicador', color: 'green', initialState: false, x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'LED Indicador', linkedWidgetId: id, dataType: DataTypes.BOOLEAN, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;

        case 'num_ind':
          widget = new NumericControlWidget({ id, title: 'Display Numérico', initialValue: 0, isIndicator: true, x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'Num Indicator', linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;
      }

      if (widget) {
        widget.kind = kind;
        this.frontPanel.addWidget(widget);
      }
      if (node) {
        this.graph.addNode(node);
        this.editor.render();
      }

      this.palette.toggle(false);
    }

    duplicateFrontPanelWidget(origWidget) {
      const kind = this.frontPanel.getWidgetKind(origWidget);
      const id = `widget_${Date.now()}`;
      const fpX = (origWidget.x || parseInt(origWidget.element.style.left, 10) || 50) + 30;
      const fpY = (origWidget.y || parseInt(origWidget.element.style.top, 10) || 50) + 30;
      const diagX = 80 + (this.graph.nodes.size % 5) * 160;
      const diagY = 80 + Math.floor(this.graph.nodes.size / 5) * 120;

      const origBinding = this.frontPanel.bindings.find(b => b.widgetId === origWidget.id);
      const isInput = origBinding ? origBinding.isInputToDiagram : false;

      let widget = null;
      let node = null;

      const config = {
        id,
        title: origWidget.title ? `${origWidget.title} (Cópia)` : 'Instrumento',
        min: origWidget.min !== undefined ? origWidget.min : 0,
        max: origWidget.max !== undefined ? origWidget.max : 100,
        step: origWidget.step !== undefined ? origWidget.step : 1,
        unit: origWidget.unit || '',
        initialValue: origWidget.value !== undefined ? origWidget.value : (origWidget.state !== undefined ? origWidget.state : 0),
        isIndicator: origWidget.isIndicator,
        color: origWidget.color || 'green',
        x: fpX,
        y: fpY
      };

      switch (kind) {
        case 'knob':
          widget = new KnobWidget(config);
          node = new FPControlTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: config.initialValue, x: diagX, y: diagY });
          break;
        case 'slider':
          widget = new SliderWidget(config);
          node = new FPControlTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: config.initialValue, x: diagX, y: diagY });
          break;
        case 'num_ctrl':
          widget = new NumericControlWidget({ ...config, isIndicator: false });
          node = new FPControlTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: config.initialValue, x: diagX, y: diagY });
          break;
        case 'switch':
          widget = new ToggleSwitchWidget({ ...config, initialState: !!config.initialValue });
          node = new FPControlTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.BOOLEAN, initialValue: !!config.initialValue, x: diagX, y: diagY });
          break;
        case 'gauge':
          widget = new GaugeWidget(config);
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          break;
        case 'tank':
          widget = new TankWidget(config);
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          break;
        case 'thermometer':
          widget = new ThermometerWidget(config);
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          break;
        case 'chart':
          widget = new ChartWidget(config);
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.ANY, x: diagX, y: diagY });
          break;
        case 'led':
          widget = new LEDWidget({ ...config, initialState: !!config.initialValue });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.BOOLEAN, x: diagX, y: diagY });
          break;
        case 'num_ind':
          widget = new NumericControlWidget({ ...config, isIndicator: true });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          break;
        default:
          widget = new KnobWidget(config);
          node = new FPControlTerminalNode({ id: `node_${id}`, title: config.title, linkedWidgetId: id, dataType: DataTypes.DOUBLE, initialValue: 0, x: diagX, y: diagY });
          break;
      }

      if (widget) {
        widget.kind = kind;
        this.frontPanel.addWidget(widget);
        this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: isInput });
      }
      if (node) {
        this.graph.addNode(node);
        this.editor.render();
      }
      this.frontPanel.selectWidget(id);
      this.showToast(`Instrumento '${config.title}' duplicado!`);
    }

    addFunctionNode(kind) {
      const diagX = 80 + (this.graph.nodes.size % 5) * 140;
      const diagY = 80 + Math.floor(this.graph.nodes.size / 5) * 120;

      let node = null;
      switch (kind) {
        case 'ctrl_onoff': node = new OnOffControllerNode({ x: diagX, y: diagY }); break;
        case 'ctrl_pid': node = new PIDControllerNode({ x: diagX, y: diagY }); break;
        case 'plant_tf': node = new TransferFunctionNode({ x: diagX, y: diagY }); break;
        case 'formula_node': node = new FormulaNode({ x: diagX, y: diagY }); break;
        case 'daq_ai': node = new DAQAssistantAINode({ x: diagX, y: diagY }); break;
        case 'daq_ao': node = new DAQAssistantAONode({ x: diagX, y: diagY }); break;
        case 'math_add': node = new AddNode({ x: diagX, y: diagY }); break;
        case 'math_sub': node = new SubtractNode({ x: diagX, y: diagY }); break;
        case 'math_mul': node = new MultiplyNode({ x: diagX, y: diagY }); break;
        case 'math_div': node = new DivideNode({ x: diagX, y: diagY }); break;
        case 'math_gain': node = new GainNode({ x: diagX, y: diagY }); break;
        case 'math_sat': node = new SaturationNode({ x: diagX, y: diagY }); break;
        case 'logic_gt': node = new GreaterNode({ x: diagX, y: diagY }); break;
        case 'logic_lt': node = new LessNode({ x: diagX, y: diagY }); break;
        case 'logic_eq': node = new EqualNode({ x: diagX, y: diagY }); break;
        case 'logic_and': node = new AndNode({ x: diagX, y: diagY }); break;
        case 'logic_or': node = new OrNode({ x: diagX, y: diagY }); break;
        case 'logic_not': node = new NotNode({ x: diagX, y: diagY }); break;
        case 'logic_select': node = new SelectNode({ x: diagX, y: diagY }); break;
        case 'sig_random': node = new RandomNumberNode({ x: diagX, y: diagY }); break;
        case 'sig_sine': node = new SineNode({ x: diagX, y: diagY }); break;
        case 'sig_const': node = new ConstantNode({ x: diagX, y: diagY }); break;
        case 'cluster_bundle': node = new BundleNode({ x: diagX, y: diagY }); break;
        case 'array_build': node = new BuildArrayNode({ x: diagX, y: diagY }); break;
        case 'array_subset': node = new ArraySubsetNode({ x: diagX, y: diagY }); break;
      }

      if (node) {
        this.graph.addNode(node);
        this.editor.render();
        this.palette.toggle(false);
      }
    }

    clearAll() {
      this.runtime.stop();
      this.graph.clear();
      this.frontPanel.clear();
      this.editor.render();
    }

    showToast(msg, duration = 3200) {
      const existing = document.querySelector('.toast-notification');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'toast-notification';
      toast.innerHTML = `<span style="color:#38bdf8;">✓</span> <span>${msg}</span>`;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    async saveProject() {
      const data = {
        version: '2.0',
        app: 'RosiView',
        savedAt: new Date().toISOString(),
        graph: this.graph.toJSON(),
        frontPanel: this.frontPanel.toJSON()
      };
      const jsonStr = JSON.stringify(data, null, 2);

      // 0. Suporte nativo para Android (SAF - Storage Access Framework)
      if (window.AndroidBridge) {
        const defaultName = (this.currentProjectName || 'meu_projeto.rosi').replace(/\.(rosi|json)$/i, '') + '.rosi';
        if (typeof window.AndroidBridge.launchSaveProjectPicker === 'function') {
          window.AndroidBridge.launchSaveProjectPicker(defaultName, jsonStr);
          return;
        }
        if (typeof window.AndroidBridge.saveProjectFile === 'function') {
          window.AndroidBridge.saveProjectFile(defaultName, jsonStr);
          return;
        }
      }

      // 1. Tenta a API nativa do Windows showSaveFilePicker (Salvar Como)
      if (window.isSecureContext && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: this.currentProjectName || 'meu_projeto.rosi',
            types: [
              {
                description: 'Projeto RosiView (*.rosi)',
                accept: { 'application/json': ['.rosi', '.json'] }
              }
            ]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonStr);
          await writable.close();
          this.currentProjectName = handle.name;
          this.showToast(`Projeto '${handle.name}' salvo com sucesso!`);
          return;
        } catch (err) {
          if (err.name === 'AbortError') {
            // Usuário cancelou a janela nativa do Windows
            return;
          }
          console.warn('showSaveFilePicker não disponível no contexto atual:', err);
        }
      }

      // 2. Abre a janela modal integrada do RosiView para digitar nome e salvar
      this.openSaveProjectDialog(jsonStr);
    }

    openSaveProjectDialog(jsonStr) {
      const existing = document.querySelector('.save-project-modal');
      if (existing) existing.remove();

      const nodeCount = this.graph ? this.graph.nodes.size : 0;
      const wireCount = this.graph ? (this.graph.wires ? this.graph.wires.length : (this.graph.connections ? this.graph.connections.size : 0)) : 0;
      const widgetCount = this.frontPanel && this.frontPanel.widgets ? this.frontPanel.widgets.size : 0;
      const defaultName = (this.currentProjectName || 'meu_projeto.rosi').replace(/\.(rosi|json)$/i, '');

      const modal = document.createElement('div');
      modal.className = 'save-project-modal';
      modal.innerHTML = `
        <div class="save-project-box">
          <div class="save-project-header">
            <div class="save-project-title">
              <span style="font-size: 15px;">💾</span>
              <span>Salvar Projeto RosiView</span>
            </div>
            <button class="palette-close-btn" id="save_close_btn" title="Fechar">✕</button>
          </div>
          <div class="save-project-body">
            <div class="save-field">
              <label for="save_filename_input">Nome do Arquivo:</label>
              <div class="save-input-wrapper">
                <input type="text" id="save_filename_input" value="${defaultName}" placeholder="nome_do_projeto" spellcheck="false" autocomplete="off">
                <span class="save-input-ext">.rosi</span>
              </div>
              <span class="save-field-hint">O projeto será salvo com a extensão <code>.rosi</code> (compatível com JSON).</span>
            </div>

            <div class="save-summary-card">
              <div class="save-summary-title">Resumo do Projeto:</div>
              <div class="save-summary-item">📊 Diagrama de Blocos: <strong>${nodeCount} blocos</strong>, <strong>${wireCount} conexões</strong></div>
              <div class="save-summary-item">🎛️ Painel Frontal: <strong>${widgetCount} instrumentos</strong></div>
            </div>

            <div class="save-info-note">
              <span class="save-info-icon">📁</span>
              <div class="save-info-text">
                <strong>Local de Salvamento:</strong> O arquivo será salvo na sua pasta de Downloads. Para que o navegador pergunte a pasta desejada a cada salvamento, ative <em>"Perguntar onde salvar cada arquivo"</em> nas configurações do navegador.
              </div>
            </div>
          </div>
          <div class="save-project-footer">
            <button class="config-btn config-btn-cancel" id="save_cancel_btn">Cancelar</button>
            <button class="config-btn config-btn-save" id="save_confirm_btn" style="display:inline-flex;align-items:center;gap:6px;">
              <span>💾</span> Salvar Arquivo
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#save_filename_input');
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
      if (!isMobile) {
        input.focus();
        input.select();
      }

      const close = () => modal.remove();
      modal.querySelector('#save_close_btn').onclick = close;
      modal.querySelector('#save_cancel_btn').onclick = close;

      const executeSave = () => {
        let rawName = input.value.trim();
        if (!rawName) rawName = 'meu_projeto';
        if (!rawName.toLowerCase().endsWith('.rosi') && !rawName.toLowerCase().endsWith('.json')) {
          rawName += '.rosi';
        }
        this.currentProjectName = rawName;

        // Suporte nativo para ambiente Android
        if (window.AndroidBridge) {
          if (typeof window.AndroidBridge.launchSaveProjectPicker === 'function') {
            window.AndroidBridge.launchSaveProjectPicker(rawName, jsonStr);
            close();
            return;
          }
          if (typeof window.AndroidBridge.saveProjectFile === 'function') {
            window.AndroidBridge.saveProjectFile(rawName, jsonStr);
            this.showToast(`Projeto '${rawName}' salvo com sucesso!`);
            close();
            return;
          }
        }

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = rawName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`Projeto '${rawName}' salvo com sucesso!`);
        close();
      };

      modal.querySelector('#save_confirm_btn').onclick = executeSave;

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      });

      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      });
    }

    openManualHelp() {
      // Se estiver no ambiente nativo Android, delega a abertura ao leitor do sistema
      if (window.AndroidBridge && typeof window.AndroidBridge.openManual === 'function') {
        window.AndroidBridge.openManual();
        this.showToast('Abrindo Manual do Usuário...', 2500);
        return;
      }

      const manualPdf = 'docs/manual_aluno/manual_rosiview_aluno.pdf#page=2';
      try {
        const win = window.open(manualPdf, '_blank');
        if (!win) {
          const a = document.createElement('a');
          a.href = manualPdf;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        this.showToast('Abrindo Manual do Usuário (Sumário)...', 'info');
      } catch (err) {
        console.error('Erro ao abrir o manual:', err);
        window.location.href = manualPdf;
      }
    }

    loadProjectFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        this.loadProjectJson(event.target.result, file.name);
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    loadProjectJson(jsonOrStr, fileName) {
      try {
        const json = typeof jsonOrStr === 'string' ? JSON.parse(jsonOrStr) : jsonOrStr;
        this.currentProjectName = fileName || 'meu_projeto.rosi';
        this.clearAll();

          // 1. Restaura widgets do Painel Frontal
          if (json.frontPanel && Array.isArray(json.frontPanel.widgets)) {
            for (const w of json.frontPanel.widgets) {
              let widget = null;
              switch (w.kind) {
                case 'slider':
                  widget = new SliderWidget({ id: w.id, title: w.title, min: w.min, max: w.max, step: w.step, initialValue: w.initialValue, x: w.x, y: w.y });
                  break;
                case 'tank':
                  widget = new TankWidget({ id: w.id, title: w.title, min: w.min, max: w.max, unit: w.unit, x: w.x, y: w.y });
                  if (w.initialValue !== undefined) widget.setValue(w.initialValue);
                  break;
                case 'thermometer':
                  widget = new ThermometerWidget({ id: w.id, title: w.title, min: w.min, max: w.max, unit: w.unit, x: w.x, y: w.y });
                  if (w.initialValue !== undefined) widget.setValue(w.initialValue);
                  break;
                case 'chart':
                  widget = new ChartWidget({ id: w.id, title: w.title, maxPoints: w.maxPoints || 200, plots: w.plots, x: w.x, y: w.y });
                  break;
                case 'knob':
                  widget = new KnobWidget({ id: w.id, title: w.title, min: w.min, max: w.max, step: w.step, initialValue: w.initialValue, unit: w.unit, x: w.x, y: w.y });
                  break;
                case 'gauge':
                  widget = new GaugeWidget({ id: w.id, title: w.title, min: w.min, max: w.max, unit: w.unit, initialValue: w.initialValue, x: w.x, y: w.y });
                  break;
                case 'switch':
                  widget = new ToggleSwitchWidget({ id: w.id, title: w.title, labelOn: w.labelOn || 'ON', labelOff: w.labelOff || 'OFF', initialState: Boolean(w.initialValue), x: w.x, y: w.y });
                  break;
                case 'led':
                  widget = new LEDWidget({ id: w.id, title: w.title, color: w.color || 'green', initialState: Boolean(w.initialValue), x: w.x, y: w.y });
                  break;
                case 'num_ctrl':
                  widget = new NumericControlWidget({ id: w.id, title: w.title, initialValue: w.initialValue, isIndicator: false, x: w.x, y: w.y });
                  break;
                case 'num_ind':
                  widget = new NumericControlWidget({ id: w.id, title: w.title, initialValue: w.initialValue, isIndicator: true, x: w.x, y: w.y });
                  break;
              }
              if (widget) this.frontPanel.addWidget(widget);
            }
          }

          // 2. Restaura nós do Diagrama de Blocos
          if (json.graph && Array.isArray(json.graph.nodes)) {
            for (const n of json.graph.nodes) {
              let node = null;
              switch (n.type) {
                case 'fp_control':
                  node = new FPControlTerminalNode({ id: n.id, title: n.title, linkedWidgetId: n.linkedWidgetId, dataType: n.dataType, initialValue: n.constantValue || 0, x: n.x, y: n.y });
                  break;
                case 'fp_indicator':
                  node = new FPIndicatorTerminalNode({ id: n.id, title: n.title, linkedWidgetId: n.linkedWidgetId, dataType: n.dataType, x: n.x, y: n.y });
                  break;
                case 'math_add': node = new AddNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'math_sub': node = new SubtractNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'math_mul': node = new MultiplyNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'math_div': node = new DivideNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'math_gain': node = new GainNode({ id: n.id, gain: n.gain || 1, x: n.x, y: n.y }); break;
                case 'math_sat': node = new SaturationNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_gt': node = new GreaterNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_lt': node = new LessNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_eq': node = new EqualNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_and': node = new AndNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_or': node = new OrNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_not': node = new NotNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'logic_select': node = new SelectNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'sig_const':
                  node = new ConstantNode({ id: n.id, constantValue: n.constantValue !== undefined ? n.constantValue : 0, x: n.x, y: n.y });
                  break;
                case 'sig_sine': node = new SineNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'sig_random': node = new RandomNumberNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'sig_timestep': node = new TimeStepNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'daq_ai': node = new DAQAssistantAINode({ id: n.id, channel: n.channel !== undefined ? n.channel : 0, x: n.x, y: n.y }); break;
                case 'daq_ao': node = new DAQAssistantAONode({ id: n.id, channel: n.channel !== undefined ? n.channel : 0, x: n.x, y: n.y }); break;
                case 'ctrl_onoff': node = new OnOffControllerNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'ctrl_pid': node = new PIDControllerNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'plant_tf': node = new TransferFunctionNode({ id: n.id, kp: n.kp, tau: n.tau, theta: n.theta, x: n.x, y: n.y }); break;
                case 'formula_node':
                  node = new FormulaNode({
                    id: n.id,
                    title: n.title,
                    code: n.code,
                    inputNames: n.inputNames,
                    outputNames: n.outputNames,
                    x: n.x,
                    y: n.y
                  });
                  break;
                case 'cluster_bundle': node = new BundleNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'array_build': node = new BuildArrayNode({ id: n.id, x: n.x, y: n.y }); break;
                case 'array_subset': node = new ArraySubsetNode({ id: n.id, x: n.x, y: n.y }); break;
              }

              if (node) {
                if (n.title) node.title = n.title;
                if (n.inputs && Array.isArray(n.inputs)) {
                  for (const iv of n.inputs) {
                    const inTerm = node.getInput(iv.name);
                    if (inTerm && iv.value !== undefined) inTerm.value = iv.value;
                  }
                }
                this.graph.addNode(node);
              }
            }
          }

          // 3. Restaura conexões (Fios)
          if (json.graph && Array.isArray(json.graph.connections)) {
            for (const c of json.graph.connections) {
              this.graph.addConnection({
                fromNodeId: c.fromNodeId,
                fromTerminalId: c.fromTerminalId,
                toNodeId: c.toNodeId,
                toTerminalId: c.toTerminalId,
                type: c.type
              });
            }
          }

          // 4. Restaura vínculos bidirecionais
          if (json.frontPanel && Array.isArray(json.frontPanel.bindings)) {
            for (const b of json.frontPanel.bindings) {
              this.frontPanel.bindWidgetToNode(b);
            }
          }

          this.editor.render();
        this.showToast(`Projeto '${this.currentProjectName}' carregado com sucesso!`);
      } catch (err) {
        console.error('Erro ao carregar o arquivo .rosi:', err);
        alert('Erro ao abrir o arquivo .rosi: ' + err.message);
      }
    }
  }

  // Ponte global para carregar projeto a partir do Android nativo
  window.loadProjectFromAndroid = (jsonStr, fileName) => {
    if (window.rosiViewApp && typeof window.rosiViewApp.loadProjectJson === 'function') {
      window.rosiViewApp.loadProjectJson(jsonStr, fileName);
    }
  };

  // Inicialização no carregamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.rosiViewApp = new RosiViewApp();
      window.rosiViewApp.init();
    });
  } else {
    window.rosiViewApp = new RosiViewApp();
    window.rosiViewApp.init();
  }

})();
