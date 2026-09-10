/**
 * RosiView — Graph Model & Dataflow Engine
 * Gerencia a estrutura de dados de nós, terminais, fios e ordem de execução
 */

export const DataTypes = {
  DOUBLE: 'double',     // Número de ponto flutuante (Laranja)
  INTEGER: 'integer',   // Número inteiro (Azul)
  BOOLEAN: 'boolean',   // Booleano True/False (Verde)
  ARRAY: 'array',       // Vetor de valores (Amarelo/Marrom)
  CLUSTER: 'cluster',   // Pacote de múltiplos sinais (Roxo)
  ANY: 'any'            // Genérico
};

export class Terminal {
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

export class Connection {
  constructor({ id, fromNodeId, fromTerminalId, toNodeId, toTerminalId, type = DataTypes.DOUBLE, color = null }) {
    this.id = id;
    this.fromNodeId = fromNodeId;
    this.fromTerminalId = fromTerminalId;
    this.toNodeId = toNodeId;
    this.toTerminalId = toTerminalId;
    this.type = type;
    this.color = color || null;
  }
}

export class DiagramGraph {
  constructor() {
    this.nodes = new Map();         // nodeId -> NodeInstance
    this.connections = new Map();   // connectionId -> Connection
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return node;
  }

  removeNode(nodeId) {
    // Remove all connections associated with this node
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

  addConnection({ fromNodeId, fromTerminalId, toNodeId, toTerminalId, type, color }) {
    // Check if input terminal already has a connection (LabVIEW inputs accept only 1 driver)
    for (const [id, conn] of this.connections) {
      if (conn.toNodeId === toNodeId && conn.toTerminalId === toTerminalId) {
        this.connections.delete(id); // Replace existing connection
      }
    }

    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const conn = new Connection({ id, fromNodeId, fromTerminalId, toNodeId, toTerminalId, type, color });
    this.connections.set(id, conn);
    return conn;
  }

  removeConnection(connectionId) {
    this.connections.delete(connectionId);
  }

  /**
   * Ordenação Topológica para execução dos blocos no fluxo de dados
   */
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

    // Se houver ciclos ou nós restantes, adiciona-os ao final
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

    const connsData = [];
    for (const [, conn] of this.connections) {
      connsData.push({
        id: conn.id,
        fromNodeId: conn.fromNodeId,
        fromTerminalId: conn.fromTerminalId,
        toNodeId: conn.toNodeId,
        toTerminalId: conn.toTerminalId,
        type: conn.type,
        color: conn.color || null
      });
    }

    return {
      nodes: nodesData,
      connections: connsData
    };
  }
}
