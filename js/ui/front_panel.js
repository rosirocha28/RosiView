/**
 * RosiView — Front Panel Manager (Painel Frontal)
 * Gerencia os instrumentos virtuais, sliders, mostradores e a sincronização bidirecional
 * com o Diagrama de Blocos
 */

import { ThermometerWidget } from './widgets/thermometer_view.js';
import { TankWidget } from './widgets/tank_view.js';
import { ChartWidget } from './widgets/chart_view.js';
import { SliderWidget } from './widgets/slider_view.js';
import { KnobWidget } from './widgets/knob_view.js';
import { GaugeWidget } from './widgets/gauge_view.js';
import { ToggleSwitchWidget, LEDWidget } from './widgets/led_switch.js';
import { NumericControlWidget } from './widgets/numeric_view.js';

export class FrontPanelManager {
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

    // Pan com botão esquerdo na área vazia (navegação de câmera)
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
      if (e.target.closest('.fp-widget')) return; // Tratado pelo menu de contexto do widget
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

    // Posicionamento com proteção de bordas da tela
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

  startInlineTitleEdit(widget) {
    if (!widget || !widget.element) return;
    const header = widget.element.querySelector('.fp-widget-header, .widget-title, .switch-title, .num-title, h4');
    if (!header) return;

    header.contentEditable = 'true';
    header.focus();
    try {
      const range = document.createRange();
      range.selectNodeContents(header);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    let finished = false;
    const finishEdit = () => {
      if (finished) return;
      finished = true;
      header.contentEditable = 'false';
      header.removeEventListener('blur', finishEdit);
      header.removeEventListener('keydown', onKey);
      const newTitle = header.textContent.trim() || widget.title || 'Instrumento';
      widget.title = newTitle;
      this.applyWidgetConfig(widget);
      if (this.app && this.app.undoManager) {
        this.app.undoManager.pushState();
      }
      if (this.app && typeof this.app.showToast === 'function') {
        this.app.showToast(`Título atualizado: '${newTitle}'`);
      }
    };

    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        header.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        header.textContent = widget.title;
        header.blur();
      }
    };

    header.addEventListener('blur', finishEdit);
    header.addEventListener('keydown', onKey);
  }

  openLedConfig(widget) {
    const existing = document.querySelector('.widget-config-modal');
    if (existing) existing.remove();

    const titleVal = widget.title || 'LED';
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
      const newTitle = modal.querySelector('#cfg_title').value.trim() || 'LED';
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
      if (this.app && this.app.undoManager) {
        this.app.undoManager.pushState();
      }
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

    if (widget.color && typeof widget.setColor === 'function') {
      widget.setColor(widget.color);
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
    if (this.app && this.app.undoManager) {
      this.app.undoManager.pushState();
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
    if (this.app && this.app.undoManager) {
      this.app.undoManager.pushState();
    }
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

    // 2. Duplo clique abre Configurações ou edição inline
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
          widget.x = Math.round(origX + dx / scale);
          widget.y = Math.round(origY + dy / scale);
          el.style.left = `${widget.x}px`;
          el.style.top = `${widget.y}px`;
        }
      };

      const onMouseUp = () => {
        if (isDragging) {
          el.style.zIndex = '10';
          if (this.app && this.app.undoManager) {
            this.app.undoManager.pushState();
          }
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
          widget.x = Math.round(origX + dx / scale);
          widget.y = Math.round(origY + dy / scale);
          el.style.left = `${widget.x}px`;
          el.style.top = `${widget.y}px`;
        }
      };

      const onTouchEnd = () => {
        clearTimeout(longPressTimer);
        if (isDragging) {
          el.style.zIndex = '10';
          if (this.app && this.app.undoManager) {
            this.app.undoManager.pushState();
          }
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
    if (this.zoomWrapper && !this.container.contains(this.zoomWrapper)) {
      this.container.appendChild(this.zoomWrapper);
    }
    if (widget.element) {
      widget.element.style.pointerEvents = 'auto';
    }
    (this.zoomWrapper || this.container).appendChild(widget.element);
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

  getWidget(widgetId) {
    return this.widgets.get(widgetId);
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

  /**
   * Sincroniza valores dos controles do Painel Frontal para as entradas dos blocos
   */
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

  /**
   * Sincroniza saídas calculadas dos blocos para os instrumentos e gráficos do Painel Frontal
   */
  syncDiagramToIndicators(graph = null) {
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
    this.pan = { x: 0, y: 0 };
    this.zoom = 1.0;
    this.updateTransform();
    if (this.zoomWrapper) {
      this.zoomWrapper.innerHTML = '';
    } else {
      this.container.innerHTML = '';
    }
    this.widgets.clear();
    this.bindings = [];
  }

  toJSON() {
    const widgetsData = [];
    for (const [, widget] of this.widgets) {
      let kind = 'tank';
      if (widget.constructor.name === 'SliderWidget') kind = 'slider';
      else if (widget.constructor.name === 'KnobWidget') kind = 'knob';
      else if (widget.constructor.name === 'GaugeWidget') kind = 'gauge';
      else if (widget.constructor.name === 'TankWidget') kind = 'tank';
      else if (widget.constructor.name === 'ThermometerWidget') kind = 'thermometer';
      else if (widget.constructor.name === 'ChartWidget') kind = 'chart';
      else if (widget.constructor.name === 'ToggleSwitchWidget') kind = 'switch';
      else if (widget.constructor.name === 'LEDWidget') kind = 'led';
      else if (widget.constructor.name === 'NumericControlWidget') kind = widget.isIndicator ? 'num_ind' : 'num_ctrl';

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
