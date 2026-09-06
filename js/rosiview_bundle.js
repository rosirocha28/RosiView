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
      super({ ...opts, type: 'math_add', title: 'Add', icon: '+' });
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
      super({ ...opts, type: 'math_sub', title: 'Subtract', icon: '−' });
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
      super({ ...opts, type: 'math_mul', title: 'Multiply', icon: '×' });
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
      super({ ...opts, type: 'math_div', title: 'Divide', icon: '÷' });
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
      super({ ...opts, type: 'math_gain', title: 'Gain (Kp)', icon: 'K' });
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
      super({ ...opts, type: 'math_sat', title: 'Saturation', icon: '⫰' });
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
      super({ ...opts, type: 'logic_gt', title: 'Greater?', icon: '>' });
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
      super({ ...opts, type: 'logic_lt', title: 'Less?', icon: '<' });
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
      super({ ...opts, type: 'logic_eq', title: 'Equal?', icon: '=' });
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
      super({ ...opts, type: 'logic_and', title: 'And', icon: '&' });
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
      super({ ...opts, type: 'logic_or', title: 'Or', icon: '≥1' });
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
      super({ ...opts, type: 'logic_not', title: 'Not', icon: '!' });
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
      super({ ...opts, type: 'sig_const', title: 'Numeric Constant', icon: '#' });
      this.constantValue = opts.constantValue !== undefined ? opts.constantValue : 0;
      this.addOutput('value', DataTypes.DOUBLE, this.constantValue);
    }
    setValue(v) {
      this.constantValue = Number(v) || 0;
      this.getOutput('value').value = this.constantValue;
    }
    execute() { this.getOutput('value').value = this.constantValue; }
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
        <div class="fp-widget-header" contenteditable="true" title="Clique duas vezes para renomear">${this.title}</div>
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

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  class TankWidget {
    constructor({ id, title = 'Tanque de Nível', min = 0, max = 300, unit = 'mm', x = 60, y = 60 }) {
      this.id = id;
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
        <div class="fp-widget-header" contenteditable="true" title="Clique para renomear">${this.title}</div>
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

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  class ChartWidget {
    constructor({ id, title = 'Waveform Chart', maxPoints = 200, x = 200, y = 50, plots = ['Plot 0'] }) {
      this.id = id;
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
        <div class="fp-widget-header" contenteditable="true" style="margin-bottom: 2px;">${this.title}</div>
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

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'CANVAS' || e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  class SliderWidget {
    constructor({ id, title = 'Slider (Setpoint)', min = 0, max = 300, step = 1, initialValue = 100, x = 60, y = 280, isVertical = false }) {
      this.id = id;
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
        <div class="fp-widget-header" contenteditable="true" title="Clique para renomear">${this.title}</div>
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

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  class ToggleSwitchWidget {
    constructor({ id, title = 'Interruptor', labelOn = 'ON', labelOff = 'OFF', initialState = false, x = 50, y = 50 }) {
      this.id = id;
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
        <div class="fp-widget-header" contenteditable="true" title="Clique para renomear">${this.title}</div>
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

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.closest('.toggle-switch') || e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  class LEDWidget {
    constructor({ id, title = 'LED Status', color = 'green', initialState = false, x = 120, y = 50 }) {
      this.id = id;
      this.title = title;
      this.color = color;
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
        <div class="fp-widget-header" contenteditable="true" title="Clique para renomear">${this.title}</div>
        <div class="fp-widget-content" style="padding: 10px;">
          <div class="led-indicator ${this.state ? `on-${this.color}` : ''}" id="led_${this.id}"></div>
        </div>
      `;

      this.element = el;
      this.ledEl = el.querySelector(`#led_${this.id}`);
      this.setupDrag();
    }

    setState(newState) {
      this.state = Boolean(newState);
      if (this.ledEl) {
        if (this.state) this.ledEl.classList.add(`on-${this.color}`);
        else this.ledEl.classList.remove(`on-${this.color}`);
      }
    }

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  class NumericControlWidget {
    constructor({ id, title = 'Controle Numérico', initialValue = 0, isIndicator = false, x = 50, y = 50 }) {
      this.id = id;
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
        <div class="fp-widget-header" contenteditable="true" title="Clique para renomear">${this.title}</div>
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

    setupDrag() {
      let isDragging = false, startX, startY, origX, origY;
      this.element.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.getAttribute('contenteditable') === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY; origX = this.x; origY = this.y;
        this.element.style.zIndex = 100;
        const onMouseMove = (ev) => {
          if (!isDragging) return;
          this.x = origX + (ev.clientX - startX);
          this.y = origY + (ev.clientY - startY);
          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
        };
        const onMouseUp = () => {
          isDragging = false;
          this.element.style.zIndex = 10;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  // ==========================================================================
  // 8. MANAGERS (FRONT PANEL, BLOCK DIAGRAM, RUNTIME)
  // ==========================================================================
  class FrontPanelManager {
    constructor(containerId, app) {
      this.container = document.getElementById(containerId);
      this.app = app;
      this.widgets = new Map();
      this.bindings = [];
      this.init();
    }

    init() {
      this.container.className = 'front-panel-canvas';
      
      // Right-click abre a paleta no local
      this.container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.app && this.app.palette) {
          this.app.palette.openAt(e.clientX, e.clientY);
        }
      });
    }

    addWidget(widget) {
      this.widgets.set(widget.id, widget);
      this.container.appendChild(widget.element);

      const header = widget.element.querySelector('.fp-widget-header');
      if (header) {
        header.addEventListener('input', () => {
          widget.title = header.textContent.trim();
          if (this.app && this.app.graph) {
            const node = this.app.graph.getNode(`node_${widget.id}`);
            if (node) {
              node.title = widget.title;
              const nodeTitleEl = document.querySelector(`#node_${node.id} .node-title`);
              if (nodeTitleEl) nodeTitleEl.textContent = widget.title;
            }
          }
        });
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            header.blur();
          }
        });
      }

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
    }

    syncControlsToDiagram(graph) {
      if (!graph) return;
      for (const binding of this.bindings) {
        if (binding.isInputToDiagram) {
          const widget = this.widgets.get(binding.widgetId);
          const node = graph.getNode(binding.nodeId);
          if (widget && node) {
            const val = widget.getValue ? widget.getValue() : (widget.getState ? widget.getState() : widget.value);
            if (node.setValue) {
              node.setValue(val);
            } else {
              const inTerm = node.getInput(binding.terminalName);
              if (inTerm) inTerm.value = val;
            }
          }
        }
      }
    }

    syncDiagramToIndicators(graph) {
      if (!graph) return;
      for (const binding of this.bindings) {
        if (!binding.isInputToDiagram) {
          const widget = this.widgets.get(binding.widgetId);
          const node = graph.getNode(binding.nodeId);
          if (widget && node) {
            let val = undefined;
            if (node.type === 'fp_indicator') {
              for (const [, inTerm] of node.inputs) {
                val = inTerm.value;
                break;
              }
            } else {
              const outTerm = node.getOutput(binding.terminalName);
              if (outTerm && outTerm.value !== undefined) {
                val = outTerm.value;
              } else {
                for (const [, outT] of node.outputs) {
                  val = outT.value;
                  break;
                }
              }
            }

            if (val !== undefined) {
              if (widget instanceof ChartWidget) {
                widget.pushData(val);
              } else if (widget instanceof LEDWidget) {
                widget.setState(val);
              } else if (widget.setValue) {
                widget.setValue(val);
              }
            }
          }
        }
      }
    }

    clear() {
      this.container.innerHTML = '';
      this.widgets.clear();
      this.bindings = [];
    }

    toJSON() {
      const widgetsData = [];
      for (const [, widget] of this.widgets) {
        let kind = 'tank';
        if (widget instanceof SliderWidget) kind = 'slider';
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
    constructor({ containerId, graph, app }) {
      this.container = document.getElementById(containerId);
      this.graph = graph;
      this.app = app;
      this.nodesContainer = null;
      this.svgLayer = null;
      this.pendingWire = null;
      this.previewPathEl = null;
      this.selectedNodeId = null;
      this.selectedWireId = null;
      this.init();
    }

    init() {
      this.container.innerHTML = `
        <div class="diagram-canvas-container" id="diagram-canvas">
          <svg class="diagram-wire-layer" id="diagram-wires"></svg>
          <div id="diagram-nodes-layer"></div>
        </div>
      `;
      this.nodesContainer = this.container.querySelector('#diagram-nodes-layer');
      this.svgLayer = this.container.querySelector('#diagram-wires');
      this.setupEventListeners();
    }

    setupEventListeners() {
      const canvas = this.container.querySelector('#diagram-canvas');
      
      canvas.addEventListener('mousemove', (e) => {
        if (this.pendingWire && this.previewPathEl) {
          const rect = canvas.getBoundingClientRect();
          const endX = e.clientX - rect.left + canvas.scrollLeft;
          const endY = e.clientY - rect.top + canvas.scrollTop;
          const pathD = WireRouter.getCubicBezierPath(this.pendingWire.startX, this.pendingWire.startY, endX, endY);
          this.previewPathEl.setAttribute('d', pathD);
        }
      });

      canvas.addEventListener('click', (e) => {
        if (e.target === canvas || e.target === this.svgLayer) {
          this.cancelPendingWire();
          this.selectNode(null);
          this.selectWire(null);
        }
      });

      // Right-click no diagrama abre a paleta de funções
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.app && this.app.palette) {
          this.app.palette.openAt(e.clientX, e.clientY);
        }
      });

      window.addEventListener('keydown', (e) => {
        // Ignora se estiver editando qualquer campo de texto ou elemento editável
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('[contenteditable="true"]')) {
          return;
        }

        if (e.key === 'Delete') {
          if (this.selectedWireId) {
            this.graph.removeConnection(this.selectedWireId);
            this.selectedWireId = null;
            this.renderWires();
          } else if (this.selectedNodeId) {
            const node = this.graph.getNode(this.selectedNodeId);
            if (node && node.linkedWidgetId) {
              this.app.frontPanel.removeWidget(node.linkedWidgetId);
            }
            this.graph.removeNode(this.selectedNodeId);
            this.selectedNodeId = null;
            this.render();
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

      el.addEventListener('mousedown', (e) => {
        if (e.target.closest('.terminal-dot') || e.target.tagName === 'TEXTAREA') return;
        this.selectNode(node.id);
        const startX = e.clientX, startY = e.clientY, origX = node.x, origY = node.y;
        const onMouseMove = (ev) => {
          node.x = origX + (ev.clientX - startX);
          node.y = origY + (ev.clientY - startY);
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
    }

    startPendingWire(fromNodeId, fromTerminalId, dotEl) {
      const canvas = this.container.querySelector('#diagram-canvas');
      const dotRect = dotEl.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      const startX = dotRect.left - canvasRect.left + dotRect.width / 2 + canvas.scrollLeft;
      const startY = dotRect.top - canvasRect.top + dotRect.height / 2 + canvas.scrollTop;

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
      const canvas = this.container.querySelector('#diagram-canvas');
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();

      for (const [, conn] of this.graph.connections) {
        const fromNodeEl = this.container.querySelector(`#node_${conn.fromNodeId}`);
        const toNodeEl = this.container.querySelector(`#node_${conn.toNodeId}`);

        if (fromNodeEl && toNodeEl) {
          const fromDot = fromNodeEl.querySelector(`[data-term-id="${conn.fromTerminalId}"]`);
          const toDot = toNodeEl.querySelector(`[data-term-id="${conn.toTerminalId}"]`);

          if (fromDot && toDot) {
            const fromRect = fromDot.getBoundingClientRect();
            const toRect = toDot.getBoundingClientRect();

            const x1 = fromRect.left - canvasRect.left + fromRect.width / 2 + canvas.scrollLeft;
            const y1 = fromRect.top - canvasRect.top + fromRect.height / 2 + canvas.scrollTop;
            const x2 = toRect.left - canvasRect.left + toRect.width / 2 + canvas.scrollLeft;
            const y2 = toRect.top - canvasRect.top + toRect.height / 2 + canvas.scrollTop;

            const pathD = WireRouter.getCubicBezierPath(x1, y1, x2, y2);
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
      this.init();
    }

    init() {
      const el = document.createElement('div');
      el.className = 'floating-palette';
      el.id = 'palette-drawer';
      el.style.display = 'none';

      el.innerHTML = `
        <div class="palette-header">
          <span>Paleta de Funções & Controles</span>
          <button class="palette-close-btn" id="palette-close">✕</button>
        </div>
        <div class="palette-search">
          <input type="text" class="palette-search-input" id="palette-search-input" placeholder="Buscar função ou instrumento...">
        </div>
        <div class="palette-categories" id="palette-list">
          
          <!-- Controles do Painel Frontal (Entradas) -->
          <div class="palette-category">
            <div class="category-title">🎛 Controles (Entradas)</div>
            <div class="category-grid">
              <div class="palette-item" data-type="widget" data-kind="slider"><span class="palette-item-icon" style="background:#475569;color:#fff;">🎚</span><span>Slider Setpoint</span></div>
              <div class="palette-item" data-type="widget" data-kind="num_ctrl"><span class="palette-item-icon" style="background:#0284c7;color:#fff;">123</span><span>Controle Numérico</span></div>
              <div class="palette-item" data-type="widget" data-kind="switch"><span class="palette-item-icon" style="background:#334155;color:#fff;">🔘</span><span>Chave Toggle</span></div>
            </div>
          </div>

          <!-- Indicadores do Painel Frontal (Saídas) -->
          <div class="palette-category">
            <div class="category-title">📊 Indicadores (Saídas)</div>
            <div class="category-grid">
              <div class="palette-item" data-type="widget" data-kind="tank"><span class="palette-item-icon" style="background:#0284c7;color:#fff;">🛢</span><span>Tanque de Nível</span></div>
              <div class="palette-item" data-type="widget" data-kind="thermometer"><span class="palette-item-icon" style="background:#dc2626;color:#fff;">🌡</span><span>Termômetro</span></div>
              <div class="palette-item" data-type="widget" data-kind="chart"><span class="palette-item-icon" style="background:#0f172a;color:#38bdf8;">📈</span><span>Waveform Chart</span></div>
              <div class="palette-item" data-type="widget" data-kind="led"><span class="palette-item-icon" style="background:#16a34a;color:#fff;">💡</span><span>LED Status</span></div>
              <div class="palette-item" data-type="widget" data-kind="num_ind"><span class="palette-item-icon" style="background:#64748b;color:#fff;">[123]</span><span>Display Numérico</span></div>
            </div>
          </div>

          <!-- Controle de Processos -->
          <div class="palette-category">
            <div class="category-title">⚙ Controle de Processos</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="ctrl_onoff"><span class="palette-item-icon">⎍</span><span>Controle ON-OFF</span></div>
              <div class="palette-item" data-type="node" data-kind="ctrl_pid"><span class="palette-item-icon">PID</span><span>Controlador PID</span></div>
              <div class="palette-item" data-type="node" data-kind="plant_tf"><span class="palette-item-icon">G(s)</span><span>Processo G(s)</span></div>
              <div class="palette-item" data-type="node" data-kind="formula_node"><span class="palette-item-icon">fx</span><span>Formula Node</span></div>
            </div>
          </div>

          <!-- Aquisição (NI USB-6009) -->
          <div class="palette-category">
            <div class="category-title">🔌 Aquisição (NI USB-6009)</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="daq_ai"><span class="palette-item-icon" style="background:#38bdf8;color:#0369a1;">AI</span><span>DAQ Assist (AI)</span></div>
              <div class="palette-item" data-type="node" data-kind="daq_ao"><span class="palette-item-icon" style="background:#f87171;color:#991b1b;">AO</span><span>DAQ Assist (AO)</span></div>
            </div>
          </div>

          <!-- Matemática -->
          <div class="palette-category">
            <div class="category-title">➕ Matemática</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="math_add"><span class="palette-item-icon">+</span><span>Add</span></div>
              <div class="palette-item" data-type="node" data-kind="math_sub"><span class="palette-item-icon">−</span><span>Subtract</span></div>
              <div class="palette-item" data-type="node" data-kind="math_mul"><span class="palette-item-icon">×</span><span>Multiply</span></div>
              <div class="palette-item" data-type="node" data-kind="math_div"><span class="palette-item-icon">÷</span><span>Divide</span></div>
              <div class="palette-item" data-type="node" data-kind="math_gain"><span class="palette-item-icon">K</span><span>Gain (Kp)</span></div>
              <div class="palette-item" data-type="node" data-kind="math_sat"><span class="palette-item-icon">⫰</span><span>Saturation</span></div>
            </div>
          </div>

          <!-- Lógica & Comparação -->
          <div class="palette-category">
            <div class="category-title">⚖ Lógica & Comparação</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="logic_gt"><span class="palette-item-icon">></span><span>Greater?</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_lt"><span class="palette-item-icon"><</span><span>Less?</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_eq"><span class="palette-item-icon">=</span><span>Equal?</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_and"><span class="palette-item-icon">&</span><span>And</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_or"><span class="palette-item-icon">≥1</span><span>Or</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_not"><span class="palette-item-icon">!</span><span>Not</span></div>
              <div class="palette-item" data-type="node" data-kind="logic_select"><span class="palette-item-icon">?</span><span>Select</span></div>
            </div>
          </div>

          <!-- Sinais & Arranjos -->
          <div class="palette-category">
            <div class="category-title">📦 Sinais & Arranjos</div>
            <div class="category-grid">
              <div class="palette-item" data-type="node" data-kind="sig_random"><span class="palette-item-icon">🎲</span><span>Random (0-1)</span></div>
              <div class="palette-item" data-type="node" data-kind="sig_sine"><span class="palette-item-icon">∿</span><span>Sine Wave</span></div>
              <div class="palette-item" data-type="node" data-kind="sig_const"><span class="palette-item-icon">#</span><span>Constant</span></div>
              <div class="palette-item" data-type="node" data-kind="cluster_bundle"><span class="palette-item-icon">📦</span><span>Bundle</span></div>
              <div class="palette-item" data-type="node" data-kind="array_build"><span class="palette-item-icon">[+]</span><span>Build Array</span></div>
              <div class="palette-item" data-type="node" data-kind="array_subset"><span class="palette-item-icon">[..]</span><span>Array Subset</span></div>
            </div>
          </div>

        </div>
      `;

      document.body.appendChild(el);
      this.paletteEl = el;

      el.querySelector('#palette-close').addEventListener('click', () => this.toggle(false));
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

    openAt(clientX, clientY) {
      this.paletteEl.style.left = `${Math.min(window.innerWidth - 260, clientX)}px`;
      this.paletteEl.style.top = `${Math.min(window.innerHeight - 380, clientY)}px`;
      this.paletteEl.style.right = 'auto';
      this.toggle(true);
    }

    toggle(forceState) {
      this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
      this.paletteEl.style.display = this.isOpen ? 'flex' : 'none';
      if (this.isOpen) {
        const search = this.paletteEl.querySelector('#palette-search-input');
        if (search) {
          search.value = '';
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

      // Inicia com a área de trabalho 100% limpa
      this.clearAll();
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

      if (btnSave) btnSave.addEventListener('click', () => this.saveProject());
      if (btnLoad) btnLoad.addEventListener('click', () => fileInput.click());
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
      const selector = document.getElementById('mode-selector');
      const hwDot = document.getElementById('status-hw-dot');
      const hwText = document.getElementById('status-hw-text');

      const applyMode = async (mode) => {
        if (mode === 'virtual') {
          this.currentDAQ = this.virtualDAQ;
          this.runtime.setDAQDevice(this.virtualDAQ);
          if (hwDot) hwDot.className = 'status-dot connected';
          if (hwText) hwText.textContent = 'Planta Virtual (Ativa)';
        } else if (mode === 'websocket') {
          try {
            if (hwText) hwText.textContent = 'Conectando ao Bridge...';
            await this.wsBridge.connect();
            this.currentDAQ = this.wsBridge;
            this.runtime.setDAQDevice(this.wsBridge);
            if (hwDot) hwDot.className = 'status-dot connected';
            if (hwText) hwText.textContent = 'NI USB-6009 (Bridge Conectado)';
          } catch (err) {
            alert('Não foi possível conectar ao Bridge WebSocket (ws://127.0.0.1:8765).\nCertifique-se de executar o arquivo "INICIAR_ROSIVIEW_BRIDGE.bat".');
            if (selector) selector.value = 'virtual';
            this.currentDAQ = this.virtualDAQ;
            this.runtime.setDAQDevice(this.virtualDAQ);
            if (hwText) hwText.textContent = 'Planta Virtual (Ativa)';
          }
        } else if (mode === 'webusb') {
          try {
            await this.webUSB.connect();
            this.currentDAQ = this.webUSB;
            this.runtime.setDAQDevice(this.webUSB);
            if (hwDot) hwDot.className = 'status-dot connected';
            if (hwText) hwText.textContent = 'NI USB-6009 (WebUSB Conectado)';
          } catch (err) {
            alert('Erro ao conectar via WebUSB: ' + err.message);
            if (selector) selector.value = 'virtual';
            this.currentDAQ = this.virtualDAQ;
            this.runtime.setDAQDevice(this.virtualDAQ);
            if (hwText) hwText.textContent = 'Planta Virtual (Ativa)';
          }
        }
      };

      if (selector) {
        selector.addEventListener('change', async (e) => {
          await applyMode(e.target.value);
        });
      }

      // Auto-detecção inicial: se o Bridge estiver aberto, conecta automaticamente!
      setTimeout(async () => {
        try {
          const res = await fetch('http://127.0.0.1:8765/data', { cache: 'no-store' });
          if (res.ok && selector) {
            selector.value = 'websocket';
            await applyMode('websocket');
          }
        } catch (e) {}
      }, 300);
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
          widget = new LEDWidget({ id, title: 'LED Status', color: 'green', initialState: false, x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'LED Status', linkedWidgetId: id, dataType: DataTypes.BOOLEAN, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;

        case 'num_ind':
          widget = new NumericControlWidget({ id, title: 'Display Numérico', initialValue: 0, isIndicator: true, x: fpX, y: fpY });
          node = new FPIndicatorTerminalNode({ id: `node_${id}`, title: 'Num Indicator', linkedWidgetId: id, dataType: DataTypes.DOUBLE, x: diagX, y: diagY });
          this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: node.id, terminalName: 'value', isInputToDiagram: false });
          break;
      }

      if (widget) this.frontPanel.addWidget(widget);
      if (node) {
        this.graph.addNode(node);
        this.editor.render();
      }

      this.palette.toggle(false);
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

    saveProject() {
      const data = {
        version: '2.0',
        app: 'RosiView',
        savedAt: new Date().toISOString(),
        graph: this.graph.toJSON(),
        frontPanel: this.frontPanel.toJSON()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rosiview_projeto_${Date.now()}.rosi`;
      a.click();
      URL.revokeObjectURL(url);
    }

    loadProjectFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
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
        } catch (err) {
          alert('Erro ao abrir o arquivo .rosi: ' + err.message);
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    }
  }

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
