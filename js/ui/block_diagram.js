/**
 * RosiView — Block Diagram Editor (UI)
 * Editor interativo do diagrama de blocos com canvas SVG para fiação, arrasto de blocos e conexões
 */

import { WireRouter } from '../core/wire_router.js';
import { DataTypes } from '../core/graph.js';

export class BlockDiagramEditor {
  constructor({ containerId, graph, onNodeSelect, onWireCreated, app = null }) {
    this.container = document.getElementById(containerId);
    this.graph = graph;
    this.app = app;
    this.onNodeSelect = onNodeSelect;
    this.onWireCreated = onWireCreated;

    this.nodesContainer = null;
    this.svgLayer = null;

    // Estado da ferramenta de fiação (Wiring Tool)
    this.pendingWire = null; // { fromNodeId, fromTerminalId, type, startX, startY }
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

  setupEventListeners() {
    const canvas = this.canvas || this.container.querySelector('#diagram-canvas');

    // Movimento do mouse para fiação temporária
    canvas.addEventListener('mousemove', (e) => {
      if (this.pendingWire && this.previewPathEl) {
        const endPos = this.screenToWorld(e.clientX, e.clientY);
        const pathD = WireRouter.getCubicBezierPath(
          this.pendingWire.startX,
          this.pendingWire.startY,
          endPos.x,
          endPos.y
        );
        this.previewPathEl.setAttribute('d', pathD);
      }
    });

    // Pan com botão esquerdo na área vazia e desseleção imediata
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

    // Tecla Delete para excluir nó ou fio selecionado
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (this.selectedWireId) {
          e.preventDefault();
          this.graph.removeConnection(this.selectedWireId);
          this.selectedWireId = null;
          this.renderWires();
          if (this.app && this.app.undoManager) this.app.undoManager.pushState();
        } else if (this.selectedNodeId) {
          e.preventDefault();
          this.deleteNode(this.selectedNodeId);
        }
      }
    });
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

  duplicateNode(node) {
    if (!node) return;
    if (this.app && this.app.frontPanel) {
      const binding = this.app.frontPanel.bindings.find(b => b.nodeId === node.id);
      if (binding) {
        const widget = this.app.frontPanel.widgets.get(binding.widgetId);
        if (widget) {
          this.app.duplicateFrontPanelWidget(widget);
          return;
        }
      }
    }

    let newNode = null;
    const x = (node.x || 100) + 30;
    const y = (node.y || 100) + 30;

    if (typeof node.constructor === 'function') {
      try {
        newNode = new node.constructor({
          x,
          y,
          title: node.title,
          inputCount: node.inputCount,
          gain: node.gain,
          min: node.min,
          max: node.max,
          code: node.code,
          numerator: node.numerator,
          denominator: node.denominator,
          kp: node.kp,
          ki: node.ki,
          kd: node.kd,
          constantValue: node.constantValue
        });
      } catch (e) {
        console.warn('Erro ao duplicar nó:', e);
      }
    }

    if (newNode) {
      this.graph.addNode(newNode);
      this.selectNode(newNode.id);
      this.render();
      if (this.app && this.app.undoManager) {
        this.app.undoManager.pushState();
      }
      if (this.app && typeof this.app.showToast === 'function') {
        this.app.showToast(`Bloco '${newNode.title}' duplicado!`);
      }
    }
  }

  openNodeContextMenu(node, clientX, clientY) {
    this.closeContextMenu();
    this.selectNode(node.id);

    const isLinked = this.app && this.app.frontPanel && this.app.frontPanel.bindings.some(b => b.nodeId === node.id);
    const isNInput = ['math_add', 'math_mul', 'logic_and', 'logic_or'].includes(node.type);
    const hasConfig = isLinked || ['plant_tf', 'ctrl_pid', 'math_gain', 'math_sat', 'sig_const'].includes(node.type);

    const menu = document.createElement('div');
    menu.className = 'fp-context-menu';

    let html = '';
    if (hasConfig) {
      html += `
        <div class="fp-context-item" data-action="config">
          <span class="fp-context-icon">⚙️</span>
          <span>Configurações</span>
        </div>
      `;
    }

    if (isNInput) {
      const curCount = node.inputCount || node.inputs.size || 2;
      html += `
        <div class="fp-context-item has-submenu" id="item-inputs">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="fp-context-icon">🔢</span>
            <span>Entradas (${curCount})</span>
          </div>
          <span style="font-size: 11px; opacity: 0.6;">▶</span>
          <div class="fp-submenu">
            <div class="fp-context-item ${curCount === 2 ? 'selected' : ''}" data-inputs="2">2 Entradas</div>
            <div class="fp-context-item ${curCount === 3 ? 'selected' : ''}" data-inputs="3">3 Entradas</div>
            <div class="fp-context-item ${curCount === 4 ? 'selected' : ''}" data-inputs="4">4 Entradas</div>
            <div class="fp-context-item ${curCount === 5 ? 'selected' : ''}" data-inputs="5">5 Entradas</div>
            <div class="fp-context-item ${curCount === 6 ? 'selected' : ''}" data-inputs="6">6 Entradas</div>
            <div class="fp-context-item ${curCount === 8 ? 'selected' : ''}" data-inputs="8">8 Entradas</div>
          </div>
        </div>
      `;
    }

    html += `
      <div class="fp-context-item" data-action="duplicate">
        <span class="fp-context-icon">📋</span>
        <span>Duplicar</span>
      </div>
      <div class="fp-context-divider"></div>
      <div class="fp-context-item item-delete" data-action="delete">
        <span class="fp-context-icon">🗑️</span>
        <span>Deletar</span>
      </div>
    `;

    menu.innerHTML = html;
    document.body.appendChild(menu);
    this.contextMenuEl = menu;

    // Posicionamento com proteção de bordas da tela
    const rect = menu.getBoundingClientRect();
    let posX = clientX;
    let posY = clientY;
    if (posX + rect.width > window.innerWidth - 10) posX = window.innerWidth - rect.width - 10;
    if (posY + rect.height > window.innerHeight - 10) posY = window.innerHeight - rect.height - 10;
    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;

    // Ações
    const cfgBtn = menu.querySelector('[data-action="config"]');
    if (cfgBtn) {
      cfgBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeContextMenu();
        if (isLinked) {
          const binding = this.app.frontPanel.bindings.find(b => b.nodeId === node.id);
          const widget = this.app.frontPanel.widgets.get(binding.widgetId);
          if (widget) this.app.frontPanel.handleWidgetConfigure(widget);
        } else if (node.type === 'math_gain') {
          const val = prompt('Ganho (Kp):', node.gain !== undefined ? node.gain : 1);
          if (val !== null) {
            node.gain = Number(val) || 1;
            this.render();
            if (this.app && this.app.undoManager) this.app.undoManager.pushState();
          }
        } else if (node.type === 'math_sat') {
          const minVal = prompt('Limite Mínimo:', node.min !== undefined ? node.min : 0);
          if (minVal !== null) {
            const maxVal = prompt('Limite Máximo:', node.max !== undefined ? node.max : 5);
            if (maxVal !== null) {
              node.min = Number(minVal) || 0;
              node.max = Number(maxVal) || 5;
              this.render();
              if (this.app && this.app.undoManager) this.app.undoManager.pushState();
            }
          }
        } else if (node.type === 'sig_const') {
          const input = document.getElementById(`const_${node.id}`);
          if (input) input.focus();
        }
      });
    }

    if (isNInput) {
      menu.querySelectorAll('[data-inputs]').forEach(item => {
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const count = Number(item.getAttribute('data-inputs')) || 2;
          this.closeContextMenu();
          if (typeof node.setInputCount === 'function') {
            node.setInputCount(count, this.graph);
            this.render();
            if (this.app && this.app.undoManager) this.app.undoManager.pushState();
            if (this.app && typeof this.app.showToast === 'function') {
              this.app.showToast(`${node.title}: configurado com ${count} entradas`);
            }
          }
        });
      });
    }

    menu.querySelector('[data-action="duplicate"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.closeContextMenu();
      this.duplicateNode(node);
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.closeContextMenu();
      this.deleteNode(node.id);
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

  openWireContextMenu(conn, clientX, clientY) {
    this.closeContextMenu();
    this.selectWire(conn.id);

    const menu = document.createElement('div');
    menu.className = 'fp-context-menu';
    menu.innerHTML = `
      <div class="fp-context-item has-submenu" id="wire-color-item">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="fp-context-icon">🎨</span>
          <span>Cor da Linha</span>
        </div>
        <span style="font-size: 11px; opacity: 0.6;">▶</span>
        <div class="fp-submenu" style="min-width: 150px;">
          <div class="wire-color-swatches">
            <div class="wire-color-circle" data-color="" title="Padrão (Tipo de Dado)" style="background: linear-gradient(135deg, #f97316 50%, #22c55e 50%);"></div>
            <div class="wire-color-circle" data-color="#38bdf8" title="Azul" style="background: #38bdf8;"></div>
            <div class="wire-color-circle" data-color="#22c55e" title="Verde" style="background: #22c55e;"></div>
            <div class="wire-color-circle" data-color="#eab308" title="Amarelo" style="background: #eab308;"></div>
            <div class="wire-color-circle" data-color="#ef4444" title="Vermelho" style="background: #ef4444;"></div>
            <div class="wire-color-circle" data-color="#f97316" title="Laranja" style="background: #f97316;"></div>
            <div class="wire-color-circle" data-color="#a855f7" title="Roxo" style="background: #a855f7;"></div>
            <div class="wire-color-circle" data-color="#000000" title="Preto" style="background: #000000; border: 2px solid #64748b;"></div>
          </div>
          <div class="fp-context-divider"></div>
          <div class="fp-context-item" data-color="" style="font-size: 12px;">Padrão</div>
          <div class="fp-context-item" data-color="#38bdf8" style="font-size: 12px; color: #38bdf8;">Azul</div>
          <div class="fp-context-item" data-color="#22c55e" style="font-size: 12px; color: #22c55e;">Verde</div>
          <div class="fp-context-item" data-color="#eab308" style="font-size: 12px; color: #eab308;">Amarelo</div>
          <div class="fp-context-item" data-color="#ef4444" style="font-size: 12px; color: #ef4444;">Vermelho</div>
          <div class="fp-context-item" data-color="#f97316" style="font-size: 12px; color: #f97316;">Laranja</div>
          <div class="fp-context-item" data-color="#a855f7" style="font-size: 12px; color: #a855f7;">Roxo</div>
          <div class="fp-context-item" data-color="#000000" style="font-size: 12px; color: #f8fafc;">Preto</div>
        </div>
      </div>
      <div class="fp-context-divider"></div>
      <div class="fp-context-item item-delete" data-action="delete">
        <span class="fp-context-icon">🗑️</span>
        <span>Deletar Conexão</span>
      </div>
    `;

    document.body.appendChild(menu);
    this.contextMenuEl = menu;

    const rect = menu.getBoundingClientRect();
    let posX = clientX;
    let posY = clientY;
    if (posX + rect.width > window.innerWidth - 10) posX = window.innerWidth - rect.width - 10;
    if (posY + rect.height > window.innerHeight - 10) posY = window.innerHeight - rect.height - 10;
    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;

    // Seleção de cor do fio
    menu.querySelectorAll('[data-color]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const color = el.getAttribute('data-color');
        if (color) {
          conn.color = color;
        } else {
          delete conn.color;
        }
        this.closeContextMenu();
        this.renderWires();
        if (this.app && this.app.undoManager) this.app.undoManager.pushState();
        if (this.app && typeof this.app.showToast === 'function') {
          this.app.showToast('Cor da linha atualizada!');
        }
      });
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.closeContextMenu();
      this.graph.removeConnection(conn.id);
      if (this.selectedWireId === conn.id) this.selectedWireId = null;
      this.renderWires();
      if (this.app && this.app.undoManager) this.app.undoManager.pushState();
      if (this.app && typeof this.app.showToast === 'function') {
        this.app.showToast('Conexão excluída!');
      }
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

    // Se for Constante Numérica, renderiza campo de edição direta no diagrama
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

    // Listener para a Constante Numérica (edição direta)
    if (node.type === 'sig_const') {
      const constInput = el.querySelector(`#const_${node.id}`);
      if (constInput) {
        const updateVal = (e) => {
          node.setValue(e.target.value);
          if (this.app && this.app.undoManager) this.app.undoManager.pushState();
        };
        constInput.addEventListener('input', updateVal);
        constInput.addEventListener('change', updateVal);
        constInput.addEventListener('mousedown', (e) => e.stopPropagation());
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
        this.closeContextMenu();
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

    // 2. Menu de Contexto no Desktop (Right-click)
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openNodeContextMenu(node, e.clientX, e.clientY);
    });

    // 3. Arraste do Bloco (Drag & Drop com compensação de escala de Zoom)
    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.terminal-dot') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
        e.stopPropagation();
        this.selectNode(node.id);
        return;
      }
      e.stopPropagation();
      this.selectNode(node.id);
      this.closeContextMenu();

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = node.x;
      const origY = node.y;
      const scale = this.getCurrentScale();
      let hasMoved = false;

      const onMouseMove = (ev) => {
        hasMoved = true;
        node.x = origX + (ev.clientX - startX) / scale;
        node.y = origY + (ev.clientY - startY) / scale;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        this.renderWires();
      };

      const onMouseUp = () => {
        if (hasMoved && (node.x !== origX || node.y !== origY)) {
          if (this.app && this.app.undoManager) this.app.undoManager.pushState();
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // 4. Arraste Touch & Long-Press 500ms no Android
    let longPressTimer = null;
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
      let longPressFired = false;

      longPressTimer = setTimeout(() => {
        if (!isDragging) {
          longPressFired = true;
          this.openNodeContextMenu(node, startTouchX, startTouchY);
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

          if (!isDragging) {
            isDragging = true;
            this.selectNode(node.id);
            this.closeContextMenu();
          }
          ev.preventDefault();
          node.x = origX + dx / scale;
          node.y = origY + dy / scale;
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
          this.renderWires();
        }
      };

      const onTouchEnd = () => {
        clearTimeout(longPressTimer);
        if (isDragging && (node.x !== origX || node.y !== origY)) {
          if (this.app && this.app.undoManager) this.app.undoManager.pushState();
        }
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };

      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }, { passive: true });
  }


  startPendingWire(fromNodeId, fromTerminalId, dotEl) {
    const dotRect = dotEl.getBoundingClientRect();
    const startPos = this.screenToWorld(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
    const startX = startPos.x;
    const startY = startPos.y;

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

    if (this.app && this.app.undoManager) this.app.undoManager.pushState();
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
          const x1 = p1.x;
          const y1 = p1.y;
          const x2 = p2.x;
          const y2 = p2.y;

          const pathD = WireRouter.getCubicBezierPath(x1, y1, x2, y2);
          const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pathEl.setAttribute('d', pathD);
          pathEl.setAttribute('class', `wire-path wire-${conn.type} ${this.selectedWireId === conn.id ? 'selected' : ''}`);
          
          if (conn.color) {
            pathEl.style.stroke = conn.color;
          }
          pathEl.style.pointerEvents = 'stroke';
          pathEl.style.cursor = 'pointer';

          // Clique seleciona fio
          pathEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeContextMenu();
            this.selectWire(conn.id);
          });

          // Botão direito abre menu de contexto do fio
          pathEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openWireContextMenu(conn, e.clientX, e.clientY);
          });

          // Touch long-press para mobile
          let wireTouchTimer = null;
          pathEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            const startX = t.clientX;
            const startY = t.clientY;

            wireTouchTimer = setTimeout(() => {
              this.openWireContextMenu(conn, startX, startY);
              if (navigator.vibrate) {
                try { navigator.vibrate(40); } catch (vErr) {}
              }
            }, 500);

            const onTouchEndWire = () => {
              clearTimeout(wireTouchTimer);
              pathEl.removeEventListener('touchend', onTouchEndWire);
              pathEl.removeEventListener('touchmove', onTouchMoveWire);
            };

            const onTouchMoveWire = (mEv) => {
              if (mEv.touches.length === 1) {
                const mt = mEv.touches[0];
                if (Math.hypot(mt.clientX - startX, mt.clientY - startY) > 8) {
                  clearTimeout(wireTouchTimer);
                }
              }
            };

            pathEl.addEventListener('touchend', onTouchEndWire);
            pathEl.addEventListener('touchmove', onTouchMoveWire);
          }, { passive: true });

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

  clear() {
    this.pan = { x: 0, y: 0 };
    this.zoom = 1.0;
    this.updateTransform();
    this.cancelPendingWire();
    this.selectNode(null);
    this.selectWire(null);
    this.closeContextMenu();
    this.render();
  }
}
