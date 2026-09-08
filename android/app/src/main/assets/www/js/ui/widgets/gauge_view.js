/**
 * RosiView — Gauge Widget (Painel Frontal)
 * Mostrador radial analógico (Tacômetro/Velocímetro) com agulha indicadora, faixas de alarme e display LCD
 */

export class GaugeWidget {
  constructor({ id, title = 'Tacômetro', min = 0, max = 3000, initialValue = 0, unit = 'RPM', x = 60, y = 60 }) {
    this.id = id;
    this.title = title;
    this.min = Number(min);
    this.max = Number(max);
    this.value = Number(initialValue);
    this.unit = unit;
    this.x = x;
    this.y = y;

    this.element = null;
    this.needleEl = null;
    this.valEl = null;
    this.unitEl = null;
    this.minTextEl = null;
    this.maxTextEl = null;
    this.midTextEl = null;

    this.render();
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fp-widget';
    el.id = `widget_${this.id}`;
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;

    const midVal = Math.round((this.min + this.max) / 2);

    el.innerHTML = `
      <div class="fp-widget-header" title="Duplo clique para configurar limites">${this.title}</div>
      <div class="fp-widget-content">
        <div class="gauge-container">
          <svg class="gauge-svg" viewBox="0 0 180 128">
            <defs>
              <linearGradient id="gauge_safe_${this.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="60%" stop-color="#22c55e"/>
                <stop offset="100%" stop-color="#eab308"/>
              </linearGradient>
            </defs>

            <!-- Fundo da escala (Arco escuro de 240 graus) -->
            <path d="M 38.04,115 A 60 60 0 1 1 141.96,115" fill="none" stroke="#1e293b" stroke-width="9" stroke-linecap="round"/>
            
            <!-- Faixa Normal / Segura (0 a 80%) -->
            <path d="M 38.04,115 A 60 60 0 1 1 147.06,66.46" fill="none" stroke="url(#gauge_safe_${this.id})" stroke-width="6" stroke-linecap="round"/>
            
            <!-- Faixa de Alarme / Sobrerotação (80% a 100%) -->
            <path d="M 147.06,66.46 A 60 60 0 0 1 141.96,115" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>

            <!-- Marcas de Graduação Principais (a cada 20%) -->
            <line x1="34.57" y1="117" x2="28.51" y2="120.5" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="29.13" y1="65.22" x2="22.47" y2="63.06" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="63.97" y1="26.53" x2="61.12" y2="20.14" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="116.03" y1="26.53" x2="118.88" y2="20.14" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="150.87" y1="65.22" x2="157.53" y2="63.06" stroke="#f87171" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="145.43" y1="117" x2="151.49" y2="120.5" stroke="#f87171" stroke-width="1.8" stroke-linecap="round"/>

            <!-- Marcas de Graduação Secundárias (a cada 10%) -->
            <line x1="26.35" y1="91.69" x2="22.87" y2="92.06" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
            <line x1="42.44" y1="42.18" x2="39.84" y2="39.83" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
            <line x1="90" y1="21" x2="90" y2="17.5" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
            <line x1="137.56" y1="42.18" x2="140.16" y2="39.83" stroke="#475569" stroke-width="1" stroke-linecap="round"/>
            <line x1="153.65" y1="91.69" x2="157.13" y2="92.06" stroke="#f87171" stroke-width="1" stroke-linecap="round"/>

            <!-- Rótulos Numéricos Internos -->
            <text x="52.8" y="106.5" fill="#94a3b8" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" id="gauge_min_${this.id}">${this.min}</text>
            <text x="90" y="44" fill="#94a3b8" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" id="gauge_mid_${this.id}">${midVal}</text>
            <text x="127.2" y="106.5" fill="#f87171" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" id="gauge_max_${this.id}">${this.max}</text>

            <!-- Agulha Indicadora (Pivô exato fixado em cx=90, cy=85) -->
            <g transform="translate(90, 85)">
              <g id="gauge_needle_${this.id}" class="gauge-needle" transform="rotate(-120)">
                <polygon points="-2,2 2,2 0.8,-52 -0.8,-52" fill="#ef4444" filter="drop-shadow(0 0 2px rgba(239,68,68,0.8))"/>
                <circle cx="0" cy="0" r="9" fill="#0f172a" stroke="#cbd5e1" stroke-width="2"/>
                <circle cx="0" cy="0" r="3.5" fill="#ef4444"/>
              </g>
            </g>
          </svg>

          <!-- Mostrador LCD Inferior -->
          <div class="gauge-lcd">
            <span class="gauge-lcd-val" id="gauge_val_${this.id}">${this.value.toFixed(1)}</span>
            <span class="gauge-lcd-unit" id="gauge_unit_${this.id}">${this.unit}</span>
          </div>
        </div>
      </div>
    `;

    this.element = el;
    this.needleEl = el.querySelector(`#gauge_needle_${this.id}`);
    this.valEl = el.querySelector(`#gauge_val_${this.id}`);
    this.unitEl = el.querySelector(`#gauge_unit_${this.id}`);
    this.minTextEl = el.querySelector(`#gauge_min_${this.id}`);
    this.maxTextEl = el.querySelector(`#gauge_max_${this.id}`);
    this.midTextEl = el.querySelector(`#gauge_mid_${this.id}`);

    this.setValue(this.value);

    // Duplo clique para configurar limites e título
    this.element.addEventListener('dblclick', () => {
      this.openConfigDialog();
    });

    this.setupDrag();
  }

  setValue(val) {
    let num = Number(val);
    if (isNaN(num)) num = this.min;
    this.value = num;

    if (this.valEl) {
      this.valEl.textContent = this.value.toFixed(1);
    }

    if (this.needleEl) {
      const range = this.max - this.min || 1;
      const pct = Math.max(0, Math.min(1.05, (this.value - this.min) / range));
      // Ângulo de -120° (mínimo) a +120° (máximo) girando no centro (0, 0)
      const angle = -120 + pct * 240;
      this.needleEl.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
    }
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
          <span>Configuração do Mostrador (Gauge)</span>
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
      const newTitle = modal.querySelector('#cfg_title').value.trim() || 'Tacômetro';
      const newMin = Number(modal.querySelector('#cfg_min').value) || 0;
      const newMax = Number(modal.querySelector('#cfg_max').value) || 3000;
      const newUnit = modal.querySelector('#cfg_unit').value.trim();

      this.title = newTitle;
      this.min = newMin;
      this.max = newMax;
      this.unit = newUnit;

      const header = this.element.querySelector('.fp-widget-header');
      if (header) header.textContent = this.title;
      if (this.minTextEl) this.minTextEl.textContent = this.min;
      if (this.maxTextEl) this.maxTextEl.textContent = this.max;
      if (this.midTextEl) this.midTextEl.textContent = Math.round((this.min + this.max) / 2);
      if (this.unitEl) this.unitEl.textContent = this.unit;

      this.setValue(this.value);
      close();
    };
  }

  setupDrag() {}
}
