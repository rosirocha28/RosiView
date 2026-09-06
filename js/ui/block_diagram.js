/**
 * RosiView — Block Diagram Editor (UI)
 * Editor interativo do diagrama de blocos com canvas SVG para fiação, arrasto de blocos e conexões
 */

import { WireRouter } from '../core/wire_router.js';
import { DataTypes } from '../core/graph.js';

export class BlockDiagramEditor {
  constructor({ containerId, graph, onNodeSelect, onWireCreated }) {
    this.container = document.getElementById(containerId);
    this.graph = graph;
    this.onNodeSelect = onNodeSelect;
    this.onWireCreated = onWireCreated;

    this.nodesContainer = null;
    this.svgLayer = null;

    // Estado da ferramenta de fiação (Wiring Tool)
    this.pendingWire = null; // { fromNodeId, fromTerminalId, type, startX, startY }
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

    // Movimento do mouse para fiação temporária
    canvas.addEventListener('mousemove', (e) => {
      if (this.pendingWire && this.previewPathEl) {
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left + canvas.scrollLeft;
        const endY = e.clientY - rect.top + canvas.scrollTop;

        const pathD = WireRouter.getCubicBezierPath(
          this.pendingWire.startX,
          this.pendingWire.startY,
          endX,
          endY
        );
        this.previewPathEl.setAttribute('d', pathD);
      }
    });

    // Clique no canvas vazio cancela seleção ou fiação pendente
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas || e.target === this.svgLayer) {
        this.cancelPendingWire();
        this.selectNode(null);
        this.selectWire(null);
      }
    });

    // Tecla Delete para excluir nó ou fio selecionado
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (this.selectedWireId) {
          this.graph.removeConnection(this.selectedWireId);
          this.selectedWireId = null;
          this.renderWires();
        } else if (this.selectedNodeId) {
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

    // Renderiza Cabeçalho
    let bodyContent = '';

    // Se for Formula Node, renderiza caixa de edição de código
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
        <div class="node-title">${node.title}</div>
      </div>
      <div class="node-body">
        <div class="terminals-col terminals-left" id="inputs_${node.id}"></div>
        ${bodyContent}
        <div class="terminals-col terminals-right" id="outputs_${node.id}"></div>
      </div>
    `;

    const inputsCol = el.querySelector(`#inputs_${node.id}`);
    const outputsCol = el.querySelector(`#outputs_${node.id}`);

    // Renderiza Terminais de Entrada (Esquerda)
    for (const [, term] of node.inputs) {
      const termEl = document.createElement('div');
      termEl.className = 'terminal-item';
      termEl.innerHTML = `
        <div class="terminal-dot dot-${term.type}" data-node-id="${node.id}" data-term-id="${term.id}" data-is-output="false" title="${term.name} (${term.type})"></div>
        <span>${term.name}</span>
      `;
      inputsCol.appendChild(termEl);
    }

    // Renderiza Terminais de Saída (Direita)
    for (const [, term] of node.outputs) {
      const termEl = document.createElement('div');
      termEl.className = 'terminal-item';
      termEl.innerHTML = `
        <span>${term.name}</span>
        <div class="terminal-dot dot-${term.type}" data-node-id="${node.id}" data-term-id="${term.id}" data-is-output="true" title="${term.name} (${term.type})"></div>
      `;
      outputsCol.appendChild(termEl);
    }

    // Listener para o Formula Node
    if (node.type === 'formula_node') {
      const textarea = el.querySelector(`#code_${node.id}`);
      if (textarea) {
        textarea.addEventListener('input', (e) => {
          node.setCode(e.target.value);
        });
      }
    }

    this.nodesContainer.appendChild(el);
    this.setupNodeInteraction(node, el);
  }

  setupNodeInteraction(node, el) {
    // 1. Clique nos terminais (Wiring Tool)
    const dots = el.querySelectorAll('.terminal-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOutput = dot.getAttribute('data-is-output') === 'true';
        const nodeId = dot.getAttribute('data-node-id');
        const termId = dot.getAttribute('data-term-id');

        if (!this.pendingWire) {
          // Inicia ligação a partir de uma saída
          if (isOutput) {
            this.startPendingWire(nodeId, termId, dot);
          }
        } else {
          // Conclui ligação em uma entrada
          if (!isOutput && this.pendingWire.fromNodeId !== nodeId) {
            this.completePendingWire(nodeId, termId);
          } else {
            this.cancelPendingWire();
          }
        }
      });
    });

    // 2. Arraste do Bloco (Drag & Drop)
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.terminal-dot') || e.target.tagName === 'TEXTAREA') return;
      this.selectNode(node.id);

      const canvas = this.container.querySelector('#diagram-canvas');
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = node.x;
      const origY = node.y;

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

    if (this.onWireCreated) this.onWireCreated();
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
    if (this.onNodeSelect) this.onNodeSelect(nodeId);
  }

  selectWire(wireId) {
    this.selectedWireId = wireId;
    this.selectedNodeId = null;
    this.renderWires();
  }
}
