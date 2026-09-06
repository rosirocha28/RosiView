/**
 * RosiView — Palette Manager (Paleta de Funções e Controles)
 * Interface flutuante estilo LabVIEW para seleção e adição de blocos e instrumentos
 */

export class PaletteManager {
  constructor({ onAddNode, onAddWidget }) {
    this.onAddNode = onAddNode;
    this.onAddWidget = onAddWidget;

    this.paletteEl = null;
    this.isOpen = false;

    this.init();
  }

  init() {
    const el = document.createElement('div');
    el.className = 'floating-palette';
    el.id = 'palette-drawer';
    el.style.display = 'none';

    el.innerHTML = `
      <div class="palette-header">
        <span>Paleta de Funções & Controles</span>
        <button class="palette-close-btn" id="palette-close">✕</button>
      </div>
      <div class="palette-search">
        <input type="text" class="palette-search-input" id="palette-search-input" placeholder="Buscar função ou instrumento...">
      </div>
      <div class="palette-categories" id="palette-list">
        
        <!-- Categoria 1: Controle de Processos -->
        <div class="palette-category">
          <div class="category-title">Controle de Processos</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="ctrl_onoff">
              <span class="palette-item-icon">⎍</span>
              <span>Controle ON-OFF</span>
            </div>
            <div class="palette-item" data-type="node" data-kind="ctrl_pid">
              <span class="palette-item-icon">PID</span>
              <span>Controlador PID</span>
            </div>
            <div class="palette-item" data-type="node" data-kind="plant_tf">
              <span class="palette-item-icon">G(s)</span>
              <span>Processo G(s)</span>
            </div>
            <div class="palette-item" data-type="node" data-kind="formula_node">
              <span class="palette-item-icon">fx</span>
              <span>Formula Node</span>
            </div>
          </div>
        </div>

        <!-- Categoria 2: Aquisição de Dados (NI-DAQmx) -->
        <div class="palette-category">
          <div class="category-title">Aquisição (NI USB-6009)</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="daq_ai">
              <span class="palette-item-icon" style="background:#38bdf8;color:#0369a1;">AI</span>
              <span>DAQ Assist (AI)</span>
            </div>
            <div class="palette-item" data-type="node" data-kind="daq_ao">
              <span class="palette-item-icon" style="background:#f87171;color:#991b1b;">AO</span>
              <span>DAQ Assist (AO)</span>
            </div>
          </div>
        </div>

        <!-- Categoria 3: Aritmética & Matemática -->
        <div class="palette-category">
          <div class="category-title">Matemática</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="math_add"><span class="palette-item-icon">+</span><span>Add</span></div>
            <div class="palette-item" data-type="node" data-kind="math_sub"><span class="palette-item-icon">−</span><span>Subtract</span></div>
            <div class="palette-item" data-type="node" data-kind="math_mul"><span class="palette-item-icon">×</span><span>Multiply</span></div>
            <div class="palette-item" data-type="node" data-kind="math_div"><span class="palette-item-icon">÷</span><span>Divide</span></div>
            <div class="palette-item" data-type="node" data-kind="math_gain"><span class="palette-item-icon">K</span><span>Gain (Kp)</span></div>
            <div class="palette-item" data-type="node" data-kind="math_sat"><span class="palette-item-icon">⫰</span><span>Saturation</span></div>
          </div>
        </div>

        <!-- Categoria 4: Sinais e Arranjos -->
        <div class="palette-category">
          <div class="category-title">Sinais & Arranjos</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="sig_random"><span class="palette-item-icon">🎲</span><span>Random (0-1)</span></div>
            <div class="palette-item" data-type="node" data-kind="sig_sine"><span class="palette-item-icon">∿</span><span>Sine Wave</span></div>
            <div class="palette-item" data-type="node" data-kind="sig_const"><span class="palette-item-icon">#</span><span>Constant</span></div>
            <div class="palette-item" data-type="node" data-kind="cluster_bundle"><span class="palette-item-icon">📦</span><span>Bundle</span></div>
            <div class="palette-item" data-type="node" data-kind="array_build"><span class="palette-item-icon">[+]</span><span>Build Array</span></div>
            <div class="palette-item" data-type="node" data-kind="array_subset"><span class="palette-item-icon">[..]</span><span>Array Subset</span></div>
          </div>
        </div>

        <!-- Categoria 5: Instrumentos do Painel Frontal -->
        <div class="palette-category">
          <div class="category-title">Painel Frontal (IHM)</div>
          <div class="category-grid">
            <div class="palette-item" data-type="widget" data-kind="tank">
              <span class="palette-item-icon" style="background:#0284c7;color:#fff;">🛢</span>
              <span>Tanque Nível</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="thermometer">
              <span class="palette-item-icon" style="background:#dc2626;color:#fff;">🌡</span>
              <span>Termômetro</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="chart">
              <span class="palette-item-icon" style="background:#0f172a;color:#38bdf8;">📈</span>
              <span>Waveform Chart</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="slider">
              <span class="palette-item-icon" style="background:#475569;color:#fff;">🎚</span>
              <span>Slider Setpoint</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="switch">
              <span class="palette-item-icon" style="background:#334155;color:#fff;">🔘</span>
              <span>Chave Toggle</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="led">
              <span class="palette-item-icon" style="background:#16a34a;color:#fff;">💡</span>
              <span>LED Status</span>
            </div>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(el);
    this.paletteEl = el;

    el.querySelector('#palette-close').addEventListener('click', () => this.toggle(false));

    // Clique nos itens
    const items = el.querySelectorAll('.palette-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const type = item.getAttribute('data-type');
        const kind = item.getAttribute('data-kind');

        if (type === 'node' && this.onAddNode) {
          this.onAddNode(kind);
        } else if (type === 'widget' && this.onAddWidget) {
          this.onAddWidget(kind);
        }
      });
    });

    // Filtro de busca na paleta
    const searchInput = el.querySelector('#palette-search-input');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      items.forEach(it => {
        const text = it.textContent.toLowerCase();
        if (text.includes(q)) it.style.display = 'flex';
        else it.style.display = 'none';
      });
    });
  }

  toggle(forceState) {
    this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
    this.paletteEl.style.display = this.isOpen ? 'flex' : 'none';
  }
}
