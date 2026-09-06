/**
 * RosiView — Water Tank Widget (Painel Frontal)
 * Indicador de Tanque de Nível com animação de líquido, régua métrica em mm e tubulações
 * das Práticas 4 e 5
 */

export class TankWidget {
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
      <div class="fp-widget-header">${this.title}</div>
      <div class="fp-widget-content">
        <div class="tank-container">
          <div class="tank-scale" id="scale_${this.id}">
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

    if (this.waterEl) {
      this.waterEl.style.height = `${pct}%`;
    }
    if (this.displayValEl) {
      this.displayValEl.textContent = this.value.toFixed(2);
    }
  }

  setupDrag() {
    let isDragging = false;
    let startX, startY, origX, origY;

    this.element.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = this.x;
      origY = this.y;
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
