/**
 * RosiView — Palette Manager (Paleta de Funções e Controles)
 * Interface flutuante estilo LabVIEW para seleção e adição de blocos e instrumentos
 * Totalmente em Português com suporte a arrastar na tela (draggable) e rolagem
 */

export class PaletteManager {
  constructor({ onAddNode, onAddWidget }) {
    this.onAddNode = onAddNode;
    this.onAddWidget = onAddWidget;

    this.paletteEl = null;
    this.isOpen = false;
    this.hasBeenMoved = false;

    this.init();
  }

  init() {
    const el = document.createElement('div');
    el.className = 'floating-palette';
    el.id = 'palette-drawer';
    el.style.display = 'none';

    el.innerHTML = `
      <div class="palette-header" title="Clique e arraste para mover a paleta na tela">
        <span>Paleta de Funções & Controles</span>
        <button class="palette-close-btn" id="palette-close" title="Fechar">✕</button>
      </div>
      <div class="palette-search">
        <input type="text" class="palette-search-input" id="palette-search-input" placeholder="Buscar função ou instrumento...">
      </div>
      <div class="palette-categories" id="palette-list">
        
        <!-- Categoria 1: Controles do Painel Frontal (Entradas) -->
        <div class="palette-category">
          <div class="category-title">🎛 Controles (Entradas)</div>
          <div class="category-grid">
            <div class="palette-item" data-type="widget" data-kind="knob">
              <span class="palette-item-icon" style="background:#0284c7;color:#fff;">🎛</span>
              <span>Knob (Giratório)</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="slider">
              <span class="palette-item-icon" style="background:#475569;color:#fff;">🎚</span>
              <span>Slider (Deslizador)</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="num_ctrl">
              <span class="palette-item-icon" style="background:#0284c7;color:#fff;">123</span>
              <span>Entrada Numérica</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="switch">
              <span class="palette-item-icon" style="background:#334155;color:#fff;">🔘</span>
              <span>Chave Liga/Desliga</span>
            </div>
          </div>
        </div>

        <!-- Categoria 2: Indicadores do Painel Frontal (Saídas) -->
        <div class="palette-category">
          <div class="category-title">📊 Indicadores (Saídas)</div>
          <div class="category-grid">
            <div class="palette-item" data-type="widget" data-kind="gauge">
              <span class="palette-item-icon" style="background:#f97316;color:#fff;">⏱</span>
              <span>Gauge (Tacômetro)</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="chart">
              <span class="palette-item-icon" style="background:#0f172a;color:#38bdf8;">📈</span>
              <span>Gráfico Temporal</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="led">
              <span class="palette-item-icon" style="background:#16a34a;color:#fff;">💡</span>
              <span>LED Indicador</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="tank">
              <span class="palette-item-icon" style="background:#0284c7;color:#fff;">🛢</span>
              <span>Tanque de Nível</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="thermometer">
              <span class="palette-item-icon" style="background:#dc2626;color:#fff;">🌡</span>
              <span>Termômetro</span>
            </div>
            <div class="palette-item" data-type="widget" data-kind="num_ind">
              <span class="palette-item-icon" style="background:#64748b;color:#fff;">[123]</span>
              <span>Display Numérico</span>
            </div>
          </div>
        </div>

        <!-- Categoria 3: Aritmética & Matemática -->
        <div class="palette-category">
          <div class="category-title">➕ Matemática</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="sig_const">
              <span class="palette-item-icon" style="background:#3b82f6;color:#fff;">#</span>
              <span>Constante Numérica</span>
            </div>
            <div class="palette-item" data-type="node" data-kind="math_add"><span class="palette-item-icon">+</span><span>Soma (+)</span></div>
            <div class="palette-item" data-type="node" data-kind="math_sub"><span class="palette-item-icon">−</span><span>Subtração (−)</span></div>
            <div class="palette-item" data-type="node" data-kind="math_mul"><span class="palette-item-icon">×</span><span>Multiplicação (×)</span></div>
            <div class="palette-item" data-type="node" data-kind="math_div"><span class="palette-item-icon">÷</span><span>Divisão (÷)</span></div>
            <div class="palette-item" data-type="node" data-kind="math_gain"><span class="palette-item-icon">K</span><span>Ganho (Kp)</span></div>
            <div class="palette-item" data-type="node" data-kind="math_sat"><span class="palette-item-icon">⫰</span><span>Saturação</span></div>
          </div>
        </div>

        <!-- Categoria 4: Lógica & Comparação -->
        <div class="palette-category">
          <div class="category-title">⚖ Lógica & Comparação</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="logic_gt"><span class="palette-item-icon">&gt;</span><span>Maior que? (&gt;)</span></div>
            <div class="palette-item" data-type="node" data-kind="logic_lt"><span class="palette-item-icon">&lt;</span><span>Menor que? (&lt;)</span></div>
            <div class="palette-item" data-type="node" data-kind="logic_eq"><span class="palette-item-icon">=</span><span>Igual a? (=)</span></div>
            <div class="palette-item" data-type="node" data-kind="logic_and"><span class="palette-item-icon">&amp;</span><span>Porta E (AND)</span></div>
            <div class="palette-item" data-type="node" data-kind="logic_or"><span class="palette-item-icon">≥1</span><span>Porta OU (OR)</span></div>
            <div class="palette-item" data-type="node" data-kind="logic_not"><span class="palette-item-icon">!</span><span>Inversor (NOT)</span></div>
            <div class="palette-item" data-type="node" data-kind="logic_select"><span class="palette-item-icon">?</span><span>Seletor (?)</span></div>
          </div>
        </div>

        <!-- Categoria 5: Controle de Processos -->
        <div class="palette-category">
          <div class="category-title">⚙ Controle de Processos</div>
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
              <span>Nó de Fórmula</span>
            </div>
          </div>
        </div>

        <!-- Categoria 6: Aquisição de Dados (NI-DAQmx) -->
        <div class="palette-category">
          <div class="category-title">🔌 Aquisição (NI USB-6009)</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="daq_ai">
              <span class="palette-item-icon" style="background:#38bdf8;color:#0369a1;">AI</span>
              <span>Entrada Analógica (AI)</span>
            </div>
            <div class="palette-item" data-type="node" data-kind="daq_ao">
              <span class="palette-item-icon" style="background:#f87171;color:#991b1b;">AO</span>
              <span>Saída Analógica (AO)</span>
            </div>
          </div>
        </div>

        <!-- Categoria 7: Sinais e Arranjos -->
        <div class="palette-category">
          <div class="category-title">📦 Sinais & Arranjos</div>
          <div class="category-grid">
            <div class="palette-item" data-type="node" data-kind="sig_const"><span class="palette-item-icon">#</span><span>Constante Numérica</span></div>
            <div class="palette-item" data-type="node" data-kind="sig_random"><span class="palette-item-icon">🎲</span><span>Gerador Aleatório (0-1)</span></div>
            <div class="palette-item" data-type="node" data-kind="sig_sine"><span class="palette-item-icon">∿</span><span>Onda Senoidal</span></div>
            <div class="palette-item" data-type="node" data-kind="cluster_bundle"><span class="palette-item-icon">📦</span><span>Agrupar (Bundle)</span></div>
            <div class="palette-item" data-type="node" data-kind="array_build"><span class="palette-item-icon">[+]</span><span>Criar Arranjo</span></div>
            <div class="palette-item" data-type="node" data-kind="array_subset"><span class="palette-item-icon">[..]</span><span>Subconjunto</span></div>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(el);
    this.paletteEl = el;

    el.querySelector('#palette-close').addEventListener('click', () => this.toggle(false));

    // Arraste da janela pelo cabeçalho (Draggable)
    this.setupPaletteDrag(el);

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

  setupPaletteDrag(el) {
    const header = el.querySelector('.palette-header');
    let isDragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.palette-close-btn')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;

      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = `${origX}px`;
      el.style.top = `${origY}px`;
      el.style.zIndex = '1100';
      this.hasBeenMoved = true;

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        const maxLeft = window.innerWidth - el.offsetWidth - 10;
        const maxTop = window.innerHeight - 80;
        const newX = Math.max(10, Math.min(maxLeft, origX + dx));
        const newY = Math.max(10, Math.min(maxTop, origY + dy));

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  openAt(clientX, clientY) {
    const w = this.paletteEl.offsetWidth || 265;
    const h = this.paletteEl.offsetHeight || 420;
    const posX = Math.max(10, Math.min(window.innerWidth - w - 20, clientX));
    const posY = Math.max(10, Math.min(window.innerHeight - h - 20, clientY));

    this.paletteEl.style.left = `${posX}px`;
    this.paletteEl.style.top = `${posY}px`;
    this.paletteEl.style.right = 'auto';
    this.hasBeenMoved = true;
    this.toggle(true);
  }

  toggle(forceState) {
    this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
    this.paletteEl.style.display = this.isOpen ? 'flex' : 'none';

    if (this.isOpen) {
      if (!this.hasBeenMoved) {
        // Posicionamento inicial padrão na lateral superior direita
        const w = 265;
        this.paletteEl.style.left = `${Math.max(10, window.innerWidth - w - 25)}px`;
        this.paletteEl.style.top = '55px';
        this.paletteEl.style.right = 'auto';
      }

      const search = this.paletteEl.querySelector('#palette-search-input');
      if (search) {
        search.value = '';
        const items = this.paletteEl.querySelectorAll('.palette-item');
        items.forEach(it => it.style.display = 'flex');
        search.focus();
      }
    }
  }
}
