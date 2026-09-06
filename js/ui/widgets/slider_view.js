/**
 * RosiView — Slider Widget (Painel Frontal)
 * Controles de Slider Vertical e Horizontal com mostrador de valor e limites
 */

export class SliderWidget {
  constructor({ id, title = 'Setpoint (SP)', min = 0, max = 300, step = 1, initialValue = 100, x = 60, y = 280, isVertical = false }) {
    this.id = id;
    this.title = title;
    this.min = min;
    this.max = max;
    this.step = step;
    this.value = initialValue;
    this.isVertical = isVertical;
    this.x = x;
    this.y = y;

    this.element = null;
    this.inputEl = null;
    this.displayValEl = null;
    this.onChangeCallback = null;

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
        <div class="slider-container">
          <input type="range" class="${this.isVertical ? 'slider-input-v' : 'slider-input-h'}" 
                 id="slider_${this.id}" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.value}">
          <div class="numeric-box">
            <input type="number" class="numeric-input" id="num_${this.id}" value="${this.value}">
          </div>
        </div>
      </div>
    `;

    this.element = el;
    this.inputEl = el.querySelector(`#slider_${this.id}`);
    this.displayValEl = el.querySelector(`#num_${this.id}`);

    this.inputEl.addEventListener('input', (e) => {
      this.setValue(e.target.value);
    });

    this.displayValEl.addEventListener('change', (e) => {
      this.setValue(e.target.value);
    });

    this.setupDrag();
  }

  setValue(val) {
    this.value = Number(val) || 0;
    if (this.inputEl) this.inputEl.value = this.value;
    if (this.displayValEl) this.displayValEl.value = this.value;

    if (this.onChangeCallback) {
      this.onChangeCallback(this.value);
    }
  }

  getValue() {
    return this.value;
  }

  setupDrag() {
    let isDragging = false;
    let startX, startY, origX, origY;

    this.element.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT') return;
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
