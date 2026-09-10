/**
 * RosiView — Numeric Control & Indicator Widgets (Painel Frontal)
 * Controles numéricos de entrada e displays indicadores de saída
 */

export class NumericControlWidget {
  constructor({ id, title = 'Controle Numérico', initialValue = 0, isIndicator = false, x = 50, y = 50 }) {
    this.id = id;
    this.kind = isIndicator ? 'num_ind' : 'num_ctrl';
    this.title = title;
    this.value = initialValue;
    this.isIndicator = isIndicator;
    this.x = x;
    this.y = y;

    this.element = null;
    this.inputEl = null;
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
        <div class="numeric-box">
          ${this.isIndicator 
            ? `<div class="numeric-indicator-val" id="num_${this.id}">0.00</div>` 
            : `<input type="number" class="numeric-input" id="num_${this.id}" value="${this.value}">`
          }
        </div>
      </div>
    `;

    this.element = el;
    this.inputEl = el.querySelector(`#num_${this.id}`);

    if (!this.isIndicator && this.inputEl) {
      this.inputEl.addEventListener('change', (e) => {
        this.setValue(e.target.value);
      });
      this.inputEl.addEventListener('input', (e) => {
        this.setValue(e.target.value);
      });
    }

    this.setupDrag();
  }

  setValue(val) {
    this.value = Number(val) || 0;
    if (this.inputEl) {
      if (this.isIndicator) {
        this.inputEl.textContent = this.value.toFixed(2);
      } else {
        this.inputEl.value = this.value;
      }
    }

    if (this.onChangeCallback) {
      this.onChangeCallback(this.value);
    }
  }

  getValue() {
    return this.value;
  }

  setupDrag() {}
}
