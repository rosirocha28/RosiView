/**
 * RosiView — Switch & LED Widgets (Painel Frontal)
 * Interruptor Vertical (Chave Toggle), Botão de Pressão e Lâmpadas LED
 * das Práticas 1, 2 e 5
 */

export class ToggleSwitchWidget {
  constructor({ id, title = 'Interruptor', labelOn = 'ON', labelOff = 'OFF', initialState = false, x = 50, y = 50 }) {
    this.id = id;
    this.title = title;
    this.labelOn = labelOn;
    this.labelOff = labelOff;
    this.state = initialState;
    this.x = x;
    this.y = y;

    this.element = null;
    this.switchEl = null;
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
        <div class="toggle-switch-box">
          <div style="font-size: 10px; font-weight: 700; color: #475569;">${this.labelOn}</div>
          <div class="toggle-switch ${this.state ? 'active' : ''}" id="switch_${this.id}">
            <div class="toggle-handle"></div>
          </div>
          <div style="font-size: 10px; font-weight: 700; color: #475569;">${this.labelOff}</div>
        </div>
      </div>
    `;

    this.element = el;
    this.switchEl = el.querySelector(`#switch_${this.id}`);

    this.switchEl.addEventListener('click', () => {
      this.setState(!this.state);
    });

    this.setupDrag();
  }

  setState(newState) {
    this.state = Boolean(newState);
    if (this.switchEl) {
      if (this.state) this.switchEl.classList.add('active');
      else this.switchEl.classList.remove('active');
    }

    if (this.onChangeCallback) {
      this.onChangeCallback(this.state);
    }
  }

  getState() {
    return this.state;
  }

  setupDrag() {
    let isDragging = false;
    let startX, startY, origX, origY;

    this.element.addEventListener('mousedown', (e) => {
      if (e.target.closest('.toggle-switch')) return;
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

export class LEDWidget {
  constructor({ id, title = 'LED Indicador', color = 'green', initialState = false, x = 120, y = 50 }) {
    this.id = id;
    this.title = title;
    this.color = color;
    this.state = initialState;
    this.x = x;
    this.y = y;

    this.element = null;
    this.ledEl = null;

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
      <div class="fp-widget-content" style="padding: 10px;">
        <div class="led-indicator ${this.state ? `on-${this.color}` : ''}" id="led_${this.id}"></div>
      </div>
    `;

    this.element = el;
    this.ledEl = el.querySelector(`#led_${this.id}`);

    this.setupDrag();
  }

  setState(newState) {
    this.state = Boolean(newState);
    if (this.ledEl) {
      if (this.state) this.ledEl.classList.add(`on-${this.color}`);
      else this.ledEl.classList.remove(`on-${this.color}`);
    }
  }

  setupDrag() {
    let isDragging = false;
    let startX, startY, origX, origY;

    this.element.addEventListener('mousedown', () => {
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
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
