/**
 * RosiView — Front Panel Manager (Painel Frontal)
 * Gerencia os instrumentos virtuais, sliders, mostradores e a sincronização bidirecional
 * com o Diagrama de Blocos
 */

import { ThermometerWidget } from './widgets/thermometer_view.js';
import { TankWidget } from './widgets/tank_view.js';
import { ChartWidget } from './widgets/chart_view.js';
import { SliderWidget } from './widgets/slider_view.js';
import { ToggleSwitchWidget, LEDWidget } from './widgets/led_switch.js';
import { NumericControlWidget } from './widgets/numeric_view.js';

export class FrontPanelManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.widgets = new Map(); // widgetId -> WidgetInstance
    this.bindings = [];       // { widgetId, nodeId, terminalName, isInputToDiagram }
    
    this.init();
  }

  init() {
    this.container.className = 'front-panel-canvas';
  }

  addWidget(widget) {
    this.widgets.set(widget.id, widget);
    this.container.appendChild(widget.element);
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
    this.container.innerHTML = '';
    this.widgets.clear();
    this.bindings = [];
  }

  toJSON() {
    const widgetsData = [];
    for (const [, widget] of this.widgets) {
      let kind = 'tank';
      if (widget.constructor.name === 'SliderWidget') kind = 'slider';
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
