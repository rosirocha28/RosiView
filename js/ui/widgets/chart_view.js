/**
 * RosiView — Waveform Chart & Graph Widget (Painel Frontal)
 * Gráfico temporal multi-plot estilo osciloscópio LabVIEW com buffer histórico e legendas
 * das Práticas 2, 3, 4 e 5
 */

export class ChartWidget {
  constructor({ id, title = 'Waveform Chart', maxPoints = 200, x = 200, y = 50, plots = ['Plot 0'] }) {
    this.id = id;
    this.kind = 'chart';
    this.title = title;
    this.maxPoints = maxPoints;
    this.x = x;
    this.y = y;
    
    // Cores dos traços (Estilo LabVIEW Moderno)
    this.plotColors = [
      '#38bdf8', // Plot 0: Azul Cyan (SP)
      '#4ade80', // Plot 1: Verde (PV / Nível)
      '#f87171', // Plot 2: Vermelho (MV / Bomba)
      '#fde047', // Plot 3: Amarelo
      '#c084fc'  // Plot 4: Roxo
    ];

    this.plotNames = plots || ['Plot 0'];
    this.dataBuffers = this.plotNames.map(() => []);

    this.element = null;
    this.canvas = null;
    this.ctx = null;
    this.legendEl = null;

    this.autoScaleY = true;
    this.yMin = 0;
    this.yMax = 100;

    this.render();
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fp-widget';
    el.id = `widget_${this.id}`;
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;
    el.style.padding = '4px';

    el.innerHTML = `
      <div class="fp-widget-header" style="margin-bottom: 2px;">${this.title}</div>
      <div class="chart-container">
        <div class="chart-header-bar">
          <div class="chart-legend" id="legend_${this.id}"></div>
          <button class="tool-btn" style="height: 20px; font-size: 10px; padding: 0 4px;" id="clear_${this.id}">Limpar</button>
        </div>
        <div class="chart-canvas-area">
          <canvas class="chart-canvas" id="canvas_${this.id}" width="420" height="210"></canvas>
        </div>
      </div>
    `;

    this.element = el;
    this.canvas = el.querySelector(`#canvas_${this.id}`);
    this.ctx = this.canvas.getContext('2d');
    this.legendEl = el.querySelector(`#legend_${this.id}`);

    el.querySelector(`#clear_${this.id}`).addEventListener('click', () => this.clear());

    this.updateLegend();
    this.draw();
    this.setupDrag();
  }

  updateLegend() {
    this.legendEl.innerHTML = '';
    this.plotNames.forEach((name, idx) => {
      const color = this.plotColors[idx % this.plotColors.length];
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<span class="legend-color" style="background: ${color};"></span><span>${name}</span>`;
      this.legendEl.appendChild(item);
    });
  }

  setPlotNames(names) {
    if (Array.isArray(names) && names.length > 0) {
      this.plotNames = names;
      while (this.dataBuffers.length < names.length) {
        this.dataBuffers.push([]);
      }
      this.updateLegend();
    }
  }

  /**
   * Adiciona novos pontos ao gráfico
   * @param {number|Array|Object} data - Ponto único ou array de valores para múltiplos plots
   */
  pushData(data) {
    if (typeof data === 'number') {
      if (this.dataBuffers[0]) {
        this.dataBuffers[0].push(data);
        if (this.dataBuffers[0].length > this.maxPoints) this.dataBuffers[0].shift();
      }
    } else if (Array.isArray(data)) {
      // Ajusta número de traços se necessário
      if (data.length !== this.plotNames.length) {
        const names = data.map((_, i) => (i === 0 ? 'SP' : i === 1 ? 'PV (Nível)' : 'MV (Bomba)'));
        this.setPlotNames(names);
      }

      data.forEach((val, idx) => {
        if (!this.dataBuffers[idx]) this.dataBuffers[idx] = [];
        this.dataBuffers[idx].push(Number(val) || 0);
        if (this.dataBuffers[idx].length > this.maxPoints) this.dataBuffers[idx].shift();
      });
    } else if (data && typeof data === 'object' && Array.isArray(data.plots)) {
      this.pushData(data.plots);
      return;
    }

    this.draw();
  }

  clear() {
    this.dataBuffers = this.plotNames.map(() => []);
    this.draw();
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fundo do gráfico
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Determina limites Min e Max
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const buf of this.dataBuffers) {
      for (const val of buf) {
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    if (minVal === Infinity || maxVal === -Infinity || minVal === maxVal) {
      minVal = 0;
      maxVal = 100;
    } else {
      const margin = (maxVal - minVal) * 0.1 || 5;
      minVal -= margin;
      maxVal += margin;
    }

    // Desenha Grid de fundo
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Linhas horizontais do grid
    const numGridY = 5;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    for (let i = 0; i <= numGridY; i++) {
      const y = (h / numGridY) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const labelVal = maxVal - (maxVal - minVal) * (i / numGridY);
      ctx.fillText(labelVal.toFixed(1), 4, y - 2);
    }

    // Linhas verticais do grid
    const numGridX = 8;
    for (let i = 0; i <= numGridX; i++) {
      const x = (w / numGridX) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Plota as curvas
    this.dataBuffers.forEach((buf, plotIdx) => {
      if (buf.length < 2) return;
      const color = this.plotColors[plotIdx % this.plotColors.length];
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const stepX = w / (this.maxPoints - 1);
      const startXOffset = w - (buf.length - 1) * stepX;

      buf.forEach((val, i) => {
        const x = startXOffset + i * stepX;
        const normalizedY = (val - minVal) / (maxVal - minVal);
        const y = h - normalizedY * h;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    });
  }

  setupDrag() {}
}
