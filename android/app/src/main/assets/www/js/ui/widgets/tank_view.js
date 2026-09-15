/**
 * RosiView — Water Tank Widget (Painel Frontal)
 * Indicador de Tanque de Nível com animação de líquido, régua métrica em mm e tubulações
 * das Práticas 4 e 5
 */

export class TankWidget {
  constructor({ id, title = 'Tanque de Nível', min = 0, max = 300, unit = 'mm', step = 1, x = 60, y = 60 }) {
    this.id = id;
    this.kind = 'tank';
    this.title = title;
    this.min = Number(min) || 0;
    this.max = Number(max) || 300;
    this.unit = unit || 'mm';
    this.step = Number(step) || 1;
    this.x = x;
    this.y = y;
    this.value = 30;

    this.element = null;
    this.waterEl = null;
    this.displayValEl = null;
    this.unitEl = null;
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
        <div class="tank-container">
          <div class="tank-scale" id="scale_${this.id}"></div>
          <div class="tank-vessel">
            <div class="tank-water" id="water_${this.id}">
              <div class="tank-wave"></div>
            </div>
          </div>
        </div>
        <div class="numeric-box" style="margin-top: 6px;">
          <div class="numeric-indicator-val" id="val_${this.id}">30.00</div>
          <span id="unit_${this.id}" style="padding: 0 4px; font-weight: bold; font-size: 11px; color: #64748b;">${this.unit}</span>
        </div>
      </div>
    `;

    this.element = el;
    this.waterEl = el.querySelector(`#water_${this.id}`);
    this.displayValEl = el.querySelector(`#val_${this.id}`);
    this.unitEl = el.querySelector(`#unit_${this.id}`);
    this.scaleEl = el.querySelector(`#scale_${this.id}`);

    this.updateTicks();
    this.setValue(this.value);
    this.setupDrag();
  }

  updateScale() {
    if (!this.element) return;
    const scaleEl = this.scaleEl || this.element.querySelector(`#scale_${this.id}`) || this.element.querySelector('.tank-scale');
    const unitEl = this.unitEl || this.element.querySelector(`#unit_${this.id}`) || this.element.querySelector('.numeric-box span');
    const titleEl = this.element.querySelector('.fp-widget-header');

    if (titleEl && this.title !== undefined) titleEl.textContent = this.title;

    if (scaleEl) {
      const min = Number(this.min) || 0;
      const max = (this.max !== undefined && this.max !== null) ? Number(this.max) : 300;
      const range = max - min;
      const steps = 3;

      const formatVal = (v) => {
        if (Math.abs(v) >= 100 || Number.isInteger(v)) return Math.round(v);
        return v.toFixed(1);
      };

      scaleEl.innerHTML = '';
      const unitStr = this.unit ? ` ${this.unit}` : '';
      for (let i = steps; i >= 0; i--) {
        const val = min + range * (i / steps);
        const div = document.createElement('div');
        div.textContent = `${formatVal(val)}${unitStr}`;
        scaleEl.appendChild(div);
      }
    }

    if (unitEl) {
      unitEl.textContent = this.unit || '';
    }

    this.setValue(this.value);
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
  }

  setValue(val) {
    this.value = Number(val) || 0;
    const min = Number(this.min) || 0;
    const max = (this.max !== undefined && this.max !== null) ? Number(this.max) : 300;
    const clamped = Math.max(min, Math.min(max, this.value));
    const range = (max - min) || 1;
    const pct = Math.max(0, Math.min(100, ((clamped - min) / range) * 100));

    if (this.waterEl) {
      this.waterEl.style.height = `${pct}%`;
    }
    if (this.displayValEl) {
      this.displayValEl.textContent = this.value.toFixed(2);
    }
  }

  setupDrag() {}
}
