/**
 * RosiView — Thermometer Widget (Painel Frontal)
 * Indicador de Termômetro com escala configurável (°C / °F) da Prática 1
 */

export class ThermometerWidget {
  constructor({ id, title = 'Temperatura', min = 0, max = 200, unit = '°C', step = 1, x = 50, y = 50 }) {
    this.id = id;
    this.kind = 'thermometer';
    this.title = title;
    this.min = (min !== undefined && min !== null) ? Number(min) : 0;
    this.max = (max !== undefined && max !== null) ? Number(max) : 200;
    this.unit = unit !== undefined ? unit : '°C';
    this.step = (step !== undefined && step !== null) ? Number(step) : 1;
    this.x = x;
    this.y = y;
    this.value = this.min;

    this.element = null;
    this.liquidEl = null;
    this.displayValEl = null;
    this.scaleEl = null;
    this.unitEl = null;

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
          <div class="thermometer-scale" id="scale_${this.id}">
            <!-- Marcas de Escala geradas dinamicamente -->
          </div>
          <div class="thermometer-body">
            <div class="thermometer-tube">
              <div class="thermometer-liquid" id="liquid_${this.id}"></div>
            </div>
            <div class="thermometer-bulb"></div>
          </div>
        </div>
        <div class="numeric-box" style="margin-top: 6px;">
          <div class="numeric-indicator-val" id="val_${this.id}">0.00</div>
          <span id="unit_${this.id}" style="padding: 0 4px; font-weight: bold; font-size: 11px; color: #64748b;">${this.unit}</span>
        </div>
      </div>
    `;

    this.element = el;
    this.liquidEl = el.querySelector(`#liquid_${this.id}`);
    this.displayValEl = el.querySelector(`#val_${this.id}`);
    this.scaleEl = el.querySelector(`#scale_${this.id}`);
    this.unitEl = el.querySelector(`#unit_${this.id}`) || el.querySelector('.numeric-box span');

    this.updateScale();
    this.setValue(this.value);
    this.setupDrag();
  }

  updateScale() {
    if (!this.scaleEl && this.element) {
      this.scaleEl = this.element.querySelector(`#scale_${this.id}`) || this.element.querySelector('.thermometer-scale');
    }
    if (!this.unitEl && this.element) {
      this.unitEl = this.element.querySelector(`#unit_${this.id}`) || this.element.querySelector('.numeric-box span');
    }
    const titleEl = this.element ? this.element.querySelector('.fp-widget-header') : null;
    if (titleEl && this.title !== undefined) {
      titleEl.textContent = this.title;
    }

    if (this.scaleEl) {
      this.scaleEl.innerHTML = '';
      const min = Number(this.min) || 0;
      const max = (this.max !== undefined && this.max !== null) ? Number(this.max) : 100;
      const range = max - min;
      const steps = 4;
      for (let i = steps; i >= 0; i--) {
        const val = min + range * (i / steps);
        const mark = document.createElement('div');
        mark.className = 'scale-mark';
        const formatted = (Math.abs(val) >= 100 || Number.isInteger(val)) ? Math.round(val) : val.toFixed(1);
        mark.innerHTML = `<span>${formatted}</span>`;
        this.scaleEl.appendChild(mark);
      }
    }

    if (this.unitEl) {
      this.unitEl.textContent = this.unit || '';
    }
  }

  updateTicks() {
    this.updateScale();
  }

  applyConfig(cfg = {}) {
    if (cfg.title !== undefined) this.title = cfg.title;
    if (cfg.min !== undefined) this.min = Number(cfg.min);
    if (cfg.max !== undefined) this.max = Number(cfg.max);
    if (cfg.unit !== undefined) this.unit = cfg.unit;
    if (cfg.step !== undefined) this.step = Number(cfg.step);

    this.updateScale();
    this.setValue(this.value);
  }

  setValue(val) {
    this.value = Number(val) || 0;
    const min = Number(this.min) || 0;
    const max = (this.max !== undefined && this.max !== null) ? Number(this.max) : 100;
    const clamped = Math.max(min, Math.min(max, this.value));
    const range = (max - min) || 1;
    const pct = Math.max(0, Math.min(100, ((clamped - min) / range) * 100));
    
    if (this.liquidEl) {
      this.liquidEl.style.height = `${pct}%`;
    }
    if (this.displayValEl) {
      this.displayValEl.textContent = this.value.toFixed(2);
    }
  }

  setUnit(unit, min, max) {
    this.unit = unit;
    if (min !== undefined) this.min = Number(min);
    if (max !== undefined) this.max = Number(max);
    this.updateScale();
    this.setValue(this.value);
  }

  setupDrag() {}
}
