/**
 * RosiView — UndoManager
 * Sistema ilimitado de Desfazer (Undo) e Refazer (Redo)
 * Suporta atalhos de teclado Ctrl+Z / Ctrl+Y e controle de botões na toolbar
 */
export class UndoManager {
  constructor(app) {
    this.app = app;
    this.undoStack = [];
    this.redoStack = [];
    this.lastState = null;
    this.isApplying = false;
    this.initKeyboardShortcuts();
    setTimeout(() => {
      this.lastState = this.getCurrentSnapshot();
      this.updateButtons();
    }, 100);
  }

  getCurrentSnapshot() {
    try {
      return JSON.stringify({
        graph: this.app && this.app.graph ? this.app.graph.toJSON() : {},
        frontPanel: this.app && this.app.frontPanel ? this.app.frontPanel.toJSON() : {}
      });
    } catch (e) {
      console.warn('Erro ao obter snapshot para undo:', e);
      return '{}';
    }
  }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastState = this.getCurrentSnapshot();
    this.updateButtons();
  }

  pushState() {
    if (this.isApplying) return;
    if (!this.lastState) {
      this.lastState = this.getCurrentSnapshot();
      return;
    }
    const current = this.getCurrentSnapshot();
    if (this.lastState === current) {
      return;
    }
    this.undoStack.push(this.lastState);
    this.lastState = current;
    this.redoStack = [];
    this.updateButtons();
  }

  undo() {
    if (this.undoStack.length === 0 || this.isApplying) return;
    const previousState = this.undoStack.pop();
    if (this.lastState) {
      this.redoStack.push(this.lastState);
    }

    this.isApplying = true;
    try {
      this.app.loadProjectJson(previousState, null, true);
      this.lastState = previousState;
    } catch (e) {
      console.error('Erro ao desfazer:', e);
    } finally {
      this.isApplying = false;
    }
    this.updateButtons();
    if (typeof this.app.showToast === 'function') {
      this.app.showToast('Ação desfeita (Desfazer)');
    }
  }

  redo() {
    if (this.redoStack.length === 0 || this.isApplying) return;
    const nextState = this.redoStack.pop();
    if (this.lastState) {
      this.undoStack.push(this.lastState);
    }

    this.isApplying = true;
    try {
      this.app.loadProjectJson(nextState, null, true);
      this.lastState = nextState;
    } catch (e) {
      console.error('Erro ao refazer:', e);
    } finally {
      this.isApplying = false;
    }
    this.updateButtons();
    if (typeof this.app.showToast === 'function') {
      this.app.showToast('Ação refeita (Refazer)');
    }
  }

  updateButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = this.undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      } else if (isCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        this.redo();
      }
    });
  }
}
