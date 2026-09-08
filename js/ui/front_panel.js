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
  constructor(containerId, app = null) {
    this.container = document.getElementById(containerId);
    this.app = app;
    this.widgets = new Map(); // widgetId -> WidgetInstance
    this.bindings = [];       // { widgetId, nodeId, terminalName, isInputToDiagram }
    this.selectedWidgetId = null;
    this.contextMenuEl = null;
    
    this.init();
  }

  init() {
    this.container.className = 'front-panel-canvas';
    if (!this.zoomWrapper) {
      this.zoomWrapper = document.createElement('div');
      this.zoomWrapper.id = 'front-panel-zoom-wrapper';
      this.zoomWrapper.style.cssText = 'width: 3000px; height: 3000px; position: relative; transform-origin: 0 0;';
      this.container.appendChild(this.zoomWrapper);
    }

    // Clique no fundo vazio desseleciona elemento e fecha menu de contexto
    this.container.addEventListener('click', (e) => {
      if (!e.target.closest('.fp-widget') && !e.target.closest('.fp-context-menu') && !e.target.closest('.widget-config-modal')) {
        this.selectWidget(null);
        this.closeContextMenu();
      }
    });

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

  getCurrentScale() {
    if (!this.zoomWrapper) return 1;
    const rect = this.zoomWrapper.getBoundingClientRect();
    const scale = rect.width / 3000;
    return (scale > 0.05 && scale < 50) ? scale : 1;
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
      this.openWidgetConfig(widget);
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
    if (widget.kind) return widget.kind;
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
      this.selectWidget(widget.id);
    });

    // 2. Duplo clique abre Configurações com os 5 campos universais
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openWidgetConfig(widget);
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
      if (e.target.closest('.knob-dial-wrapper, input, button, select, textarea, [contenteditable="true"], .fp-context-menu, .widget-config-modal')) {
        this.selectWidget(widget.id);
        return;
      }

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
    if (this.zoomWrapper && !this.container.contains(this.zoomWrapper)) {
      this.container.appendChild(this.zoomWrapper);
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
          const val = widget.getValue ? widget.getValue() : (widget.getState ? widget.getState() : widget.value);
          
          if (node.type === 'sig_const') {
            node.setValue(val);
          } else {
            const inTerm = node.getInput(binding.terminalName);
            if (inTerm) inTerm.value = val;
          }
        }
      }
    }
  }

  /**
   * Sincroniza saídas calculadas dos blocos para os instrumentos e gráficos do Painel Frontal
   */
  syncDiagramToIndicators(graph) {
    if (!graph) return;
    for (const binding of this.bindings) {
      if (!binding.isInputToDiagram) {
        const widget = this.widgets.get(binding.widgetId);
        const node = graph.getNode(binding.nodeId);
        if (widget && node) {
          const outTerm = node.getOutput(binding.terminalName);
          if (outTerm && outTerm.value !== undefined) {
            if (widget instanceof ChartWidget) {
              widget.pushData(outTerm.value);
            } else if (widget instanceof LEDWidget) {
              widget.setState(outTerm.value);
            } else if (widget.setValue) {
              widget.setValue(outTerm.value);
            }
          }
        }
      }
    }
  }

  clear() {
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
