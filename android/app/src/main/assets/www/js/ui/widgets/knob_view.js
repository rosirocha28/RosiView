/**
 * RosiView — Knob Widget (Painel Frontal)
 * Botão giratório analógico contínuo com dial rotativo SVG, entrada numérica e escala configurável
 */

export class KnobWidget {
  constructor({ id, title = 'Knob', min = 0, max = 10, step = 0.1, initialValue = 0, unit = 'V', x = 60, y = 60 }) {
    this.id = id;
    this.kind = 'knob';
    this.title = title;
    this.min = Number(min);
    this.max = Number(max);
    this.step = Number(step);
    this.value = Number(initialValue);
    this.unit = unit;
    this.x = x;
    this.y = y;

    this.element = null;
    this.dialWrapper = null;
    this.needleEl = null;
    this.inputEl = null;
    this.minLabelEl = null;
    this.maxLabelEl = null;
    this.unitEl = null;
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
      <div class="fp-widget-header" title="Duplo clique para configurar limites">${this.title}</div>
      <div class="fp-widget-content">
        <div class="knob-container">
          <div class="knob-dial-wrapper" id="knob_dial_${this.id}" title="Arraste para cima/baixo ou use a roda do mouse">
            <svg class="knob-dial-svg" viewBox="0 0 78 78">
              <defs>
                <radialGradient id="knob_grad_${this.id}" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#475569" />
                  <stop offset="60%" stop-color="#1e293b" />
                  <stop offset="100%" stop-color="#0f172a" />
                </radialGradient>
                <filter id="knob_shadow_${this.id}" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/>
                </filter>
              </defs>
              <!-- Aro externo graduado -->
              <circle cx="39" cy="39" r="36" fill="#1e222d" stroke="#334155" stroke-width="2"/>
              <path d="M 13.5,64.5 A 36 36 0 1 1 64.5,64.5" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
              
              <!-- Corpo rotativo do botão -->
              <circle cx="39" cy="39" r="28" fill="url(#knob_grad_${this.id})" stroke="#64748b" stroke-width="1.5" filter="url(#knob_shadow_${this.id})"/>
              
              <!-- Marcador/Ponteiro -->
              <g id="knob_needle_${this.id}" style="transform-origin: 39px 39px;">
                <circle cx="39" cy="18" r="3.5" fill="#38bdf8" filter="drop-shadow(0 0 3px #38bdf8)"/>
                <line x1="39" y1="21" x2="39" y2="29" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
              </g>
              
              <!-- Tampa central -->
              <circle cx="39" cy="39" r="8" fill="#0f172a" stroke="#475569" stroke-width="1"/>
            </svg>
          </div>
          
          <div class="knob-scale-labels">
            <span id="knob_min_${this.id}">${this.min}</span>
            <span id="knob_max_${this.id}">${this.max}</span>
          </div>

          <div class="knob-bottom">
            <input type="number" class="knob-input" id="knob_num_${this.id}" 
                   step="${this.step}" min="${this.min}" max="${this.max}" value="${this.value}">
            <span class="knob-unit" id="knob_unit_${this.id}">${this.unit}</span>
          </div>
        </div>
      </div>
    `;

    this.element = el;
    this.dialWrapper = el.querySelector(`#knob_dial_${this.id}`);
    this.needleEl = el.querySelector(`#knob_needle_${this.id}`);
    this.inputEl = el.querySelector(`#knob_num_${this.id}`);
    this.minLabelEl = el.querySelector(`#knob_min_${this.id}`);
    this.maxLabelEl = el.querySelector(`#knob_max_${this.id}`);
    this.unitEl = el.querySelector(`#knob_unit_${this.id}`);

    this.setupInteractions();
    this.updateAngle();
    this.setupDrag();
  }

  setupInteractions() {
    // 1. Digitação direta no input
    this.inputEl.addEventListener('input', (e) => {
      this.setValue(e.target.value);
    });
    this.inputEl.addEventListener('change', (e) => {
      this.setValue(e.target.value);
    });

    // 2. Roda do mouse no dial
    this.dialWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? this.step : -this.step;
      this.setValue(this.value + delta);
    });

    // 3. Arraste do dial (movimento vertical)
    let isDraggingDial = false;
    let startY = 0;
    let startVal = 0;

    this.dialWrapper.addEventListener('mousedown', (e) => {
      isDraggingDial = true;
      startY = e.clientY;
      startVal = this.value;
      document.body.style.cursor = 'grabbing';

      const onMouseMove = (ev) => {
        if (!isDraggingDial) return;
        const dy = startY - ev.clientY; // Subir aumenta, descer diminui
        const range = this.max - this.min;
        const change = (dy / 150) * range;
        this.setValue(startVal + change);
      };

      const onMouseUp = () => {
        isDraggingDial = false;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // 4. Duplo clique para configurar limites e título
    this.element.addEventListener('dblclick', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.openConfigDialog();
    });
  }

  setValue(val) {
    let num = Number(val);
    if (isNaN(num)) num = this.min;
    num = Math.max(this.min, Math.min(this.max, num));
    
    // Arredonda para casas decimais do passo
    const decimals = (this.step.toString().split('.')[1] || '').length;
    this.value = Number(num.toFixed(Math.max(decimals, 1)));

    if (this.inputEl && document.activeElement !== this.inputEl) {
      this.inputEl.value = this.value;
    }

    this.updateAngle();

    if (this.onChangeCallback) {
      this.onChangeCallback(this.value);
    }
  }

  updateAngle() {
    if (!this.needleEl) return;
    const range = this.max - this.min || 1;
    const pct = Math.max(0, Math.min(1, (this.value - this.min) / range));
    // Ângulo de -135° (mínimo) a +135° (máximo)
    const angle = -135 + pct * 270;
    this.needleEl.style.transform = `rotate(${angle}deg)`;
  }

  getValue() {
    return this.value;
  }

  openConfigDialog() {
    const existing = document.querySelector('.widget-config-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'widget-config-modal';
    modal.innerHTML = `
      <div class="widget-config-box">
        <div class="widget-config-header">
          <span>Configuração do Knob</span>
          <button class="palette-close-btn" id="cfg_close">✕</button>
        </div>
        <div class="widget-config-body">
          <div class="config-field">
            <label>Rótulo / Título:</label>
            <input type="text" id="cfg_title" value="${this.title}">
          </div>
          <div class="config-field">
            <label>Escala Mínima:</label>
            <input type="number" id="cfg_min" value="${this.min}" step="any">
          </div>
          <div class="config-field">
            <label>Escala Máxima:</label>
            <input type="number" id="cfg_max" value="${this.max}" step="any">
          </div>
          <div class="config-field">
            <label>Passo (Incremento):</label>
            <input type="number" id="cfg_step" value="${this.step}" step="any">
          </div>
          <div class="config-field">
            <label>Unidade de Medida:</label>
            <input type="text" id="cfg_unit" value="${this.unit}">
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
      const newTitle = modal.querySelector('#cfg_title').value.trim() || 'Knob';
      const newMin = Number(modal.querySelector('#cfg_min').value) || 0;
      const newMax = Number(modal.querySelector('#cfg_max').value) || 10;
      const newStep = Number(modal.querySelector('#cfg_step').value) || 0.1;
      const newUnit = modal.querySelector('#cfg_unit').value.trim();

      this.title = newTitle;
      this.min = newMin;
      this.max = newMax;
      this.step = newStep;
      this.unit = newUnit;

      const header = this.element.querySelector('.fp-widget-header');
      if (header) header.textContent = this.title;
      if (this.minLabelEl) this.minLabelEl.textContent = this.min;
      if (this.maxLabelEl) this.maxLabelEl.textContent = this.max;
      if (this.unitEl) this.unitEl.textContent = this.unit;
      if (this.inputEl) {
        this.inputEl.min = this.min;
        this.inputEl.max = this.max;
        this.inputEl.step = this.step;
      }

      this.setValue(this.value);
      close();
    };
  }

  setupDrag() {}
}
