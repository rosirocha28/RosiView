/**
 * RosiView — Thermometer Widget (Painel Frontal)
 * Indicador de Termômetro com escala configurável (°C / °F) da Prática 1
 */

export class ThermometerWidget {
  constructor({ id, title = 'Temperatura', min = 0, max = 200, unit = '°C', x = 50, y = 50 }) {
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
    
    if (this.liquidEl) {
      this.liquidEl.style.height = `${pct}%`;
    }
    if (this.displayValEl) {
      this.displayValEl.textContent = this.value.toFixed(2);
    }
  }

  setUnit(unit, min, max) {
    this.unit = unit;
    if (min !== undefined) this.min = min;
    if (max !== undefined) this.max = max;
    const unitSpan = this.element.querySelector('.numeric-box span');
    if (unitSpan) unitSpan.textContent = unit;
    this.updateScale();
    this.setValue(this.value);
  }

  setupDrag() {}
}
