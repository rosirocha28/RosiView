/**
 * RosiView — Main Application Controller
 * Orquestrador principal da interface, abas, menus, hardware e motor de execução
 */

import { DiagramGraph, DataTypes } from './core/graph.js';
import { RosiViewRuntime } from './core/runtime.js';
import { FrontPanelManager } from './ui/front_panel.js';
import { BlockDiagramEditor } from './ui/block_diagram.js';
import { PaletteManager } from './ui/palette.js';
import { UndoManager } from './core/undo_manager.js';

// Drivers de Hardware
import { VirtualDAQDriver } from './hardware/virtual_daq.js';
import { WSBridgeClient } from './hardware/ws_bridge_client.js';
import { NIUSB6009WebUSBDriver } from './hardware/ni_usb6009_driver.js';

// Biblioteca de Nós
import { AddNode, SubtractNode, MultiplyNode, DivideNode, GainNode, SaturationNode } from './nodes/math_nodes.js';
import { FormulaNode } from './nodes/formula_node.js';
import { GreaterNode, LessNode, EqualNode, AndNode, OrNode, NotNode, SelectNode } from './nodes/logic_nodes.js';
import { BuildArrayNode, ArraySubsetNode, BundleNode } from './nodes/array_nodes.js';
import { OnOffControllerNode, PIDControllerNode } from './nodes/control_nodes.js';
import { SineNode, RandomNumberNode, ConstantNode, TimeStepNode } from './nodes/signal_nodes.js';
import { DAQAssistantAINode, DAQAssistantAONode } from './nodes/daq_nodes.js';
import { TransferFunctionNode } from './nodes/plant_nodes.js';

// Widgets do Painel Frontal
import { ThermometerWidget } from './ui/widgets/thermometer_view.js';
import { TankWidget } from './ui/widgets/tank_view.js';
import { ChartWidget } from './ui/widgets/chart_view.js';
import { SliderWidget } from './ui/widgets/slider_view.js';
import { KnobWidget } from './ui/widgets/knob_view.js';
import { GaugeWidget } from './ui/widgets/gauge_view.js';
import { ToggleSwitchWidget, LEDWidget } from './ui/widgets/led_switch.js';
import { NumericControlWidget } from './ui/widgets/numeric_view.js';

class RosiViewApp {
  constructor() {
    this.graph = new DiagramGraph();
    this.virtualDAQ = new VirtualDAQDriver();
    this.wsBridge = new WSBridgeClient();
    this.webUSB = new NIUSB6009WebUSBDriver();
    
    this.currentDAQ = this.virtualDAQ;

    this.frontPanel = null;
    this.editor = null;
    this.runtime = null;
    this.palette = null;
    this.activeView = 'split'; // 'front', 'diagram', 'split'
    this.currentProjectName = 'meu_projeto.rosi';
  }

  init() {
    // 1. Inicializa Painel Frontal e Diagrama de Blocos
    this.frontPanel = new FrontPanelManager('front-panel-container', this);
    this.editor = new BlockDiagramEditor({
      containerId: 'diagram-container',
      graph: this.graph,
      app: this,
      onNodeSelect: (nodeId) => {},
      onWireCreated: () => {
        if (this.undoManager) this.undoManager.pushState();
      }
    });
    this.undoManager = new UndoManager(this);

    // 2. Inicializa Motor de Execução
    this.runtime = new RosiViewRuntime({
      graph: this.graph,
      daqDevice: this.currentDAQ,
      frontPanel: this.frontPanel
    });

    // 3. Inicializa Gerenciador de Paleta
    this.palette = new PaletteManager({
      onAddNode: (kind) => this.addNodeFromPalette(kind),
      onAddWidget: (kind) => this.addWidgetFromPalette(kind)
    });

    // 4. Configura Listeners de Toolbar, Menus e Fechamento de Janela
    this.setupToolbar();
    this.setupViewTabs();
    this.setupHardwareSelector();
    this.setupStatusBar();
    this.setupBeforeUnload();
    this.setupUpdateChecker();

    // 5. Inicia com a área de trabalho 100% limpa
    this.clearAll();
  }

  setupUpdateChecker() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
    this.isAndroid = isMobile;
    this.currentVersion = (isMobile && window.AndroidBridge && typeof window.AndroidBridge.getVersion === 'function')
      ? ('v' + window.AndroidBridge.getVersion())
      : 'v0.4.1';
    const versionEl = document.getElementById('status-app-version');
    if (versionEl) {
      versionEl.textContent = isMobile ? `RosiView Android ${this.currentVersion} — IFES` : `RosiView ${this.currentVersion} — IFES`;
    }

    this.checkForUpdates();
  }

  async checkForUpdates() {
    const VERSION_URL = 'https://raw.githubusercontent.com/rosirocha28/RosiView/main/version.json';
    const REPO_URL = 'https://github.com/rosirocha28/RosiView';
    const ZIP_URL = 'https://github.com/rosirocha28/RosiView/archive/refs/heads/main.zip';

    const parseVer = (v) => (v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const isNewer = (remote, local) => {
      const r = parseVer(remote), l = parseVer(local);
      for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rPart = r[i] || 0, lPart = l[i] || 0;
        if (rPart > lPart) return true;
        if (rPart < lPart) return false;
      }
      return false;
    };

    try {
      const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const remoteData = await res.json();
      const isAndroid = this.isAndroid || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
      this.isAndroid = isAndroid;

      // Separação estrita de dados remotos por plataforma (Android vs Desktop)
      const targetData = (isAndroid && remoteData.android) ? remoteData.android : ((remoteData.desktop) || remoteData);
      const remoteVersion = targetData.version;

      if (remoteVersion && isNewer(remoteVersion, this.currentVersion)) {
        const badge = document.getElementById('status-update-badge');
        const badgeText = document.getElementById('status-update-text');
        const modal = document.getElementById('update-modal');
        const curVerEl = document.getElementById('update-current-ver');
        const newVerEl = document.getElementById('update-new-ver');
        const notesEl = document.getElementById('update-notes-text');
        const btnDownload = document.getElementById('btn-update-download');
        const btnGithub = document.getElementById('btn-update-github');
        const btnClose = document.getElementById('btn-update-close');
        const btnDismiss = document.getElementById('btn-update-dismiss');

        if (badge) {
          if (badgeText) badgeText.textContent = `Nova versão ${remoteVersion} disponível!`;
          badge.style.display = 'inline-flex';
          badge.onclick = () => {
            if (modal) modal.style.display = 'flex';
          };
        }

        if (curVerEl) curVerEl.textContent = this.currentVersion;
        if (newVerEl) newVerEl.textContent = remoteVersion;
        if (notesEl) notesEl.textContent = targetData.notes || 'Atualizações, correções e novas melhorias disponíveis no GitHub.';

        const closeModal = () => { if (modal) modal.style.display = 'none'; };
        if (btnClose) btnClose.onclick = closeModal;
        if (btnDismiss) btnDismiss.onclick = closeModal;
        if (modal) {
          modal.onclick = (e) => {
            if (e.target === modal) closeModal();
          };
        }

        if (btnDownload) {
          if (isAndroid) {
            btnDownload.textContent = 'Baixar e Instalar APK';
            const cardTitle = btnDownload.closest('.update-option-card')?.querySelector('strong');
            if (cardTitle) cardTitle.textContent = 'Instalar Atualização (.APK)';
            const cardDesc = btnDownload.closest('.update-option-card')?.querySelector('p');
            if (cardDesc) cardDesc.textContent = 'Baixa e instala automaticamente o novo APK do RosiView Android.';

            btnDownload.onclick = () => {
              const tagStr = targetData.tag || `android-${remoteVersion}`;
              const apkUrl = targetData.apkUrl || `https://github.com/rosirocha28/RosiView/releases/download/${tagStr}/RosiView.apk`;
              if (window.AndroidBridge && typeof window.AndroidBridge.downloadAndInstallUpdate === 'function') {
                window.AndroidBridge.downloadAndInstallUpdate(apkUrl);
                closeModal();
              } else {
                window.open(apkUrl, '_blank');
              }
            };
          } else {
            btnDownload.onclick = () => {
              const a = document.createElement('a');
              a.href = targetData.downloadUrl || ZIP_URL;
              a.download = `RosiView_${remoteVersion}.zip`;
              a.target = '_blank';
              a.click();
            };
          }
        }

        if (btnGithub) {
          btnGithub.onclick = () => {
            const releaseUrl = targetData.releaseUrl || (isAndroid
              ? `https://github.com/rosirocha28/RosiView/releases/tag/android-${remoteVersion}`
              : `${REPO_URL}/releases`);
            window.open(releaseUrl, '_blank');
          };
        }
      }
    } catch (err) {
      // Silencioso em caso de ausência de rede/offline
    }
  }

  setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasContent()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });
  }

  hasContent() {
    return (this.graph && this.graph.nodes.size > 0) || (this.frontPanel && this.frontPanel.widgets.size > 0);
  }

  promptNewProject() {
    if (this.hasContent()) {
      const modal = document.getElementById('new-project-modal');
      if (modal) modal.style.display = 'flex';
    } else {
      this.clearAll();
    }
  }

  closeNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) modal.style.display = 'none';
  }

  setupToolbar() {
    const btnRun = document.getElementById('btn-run');
    const btnContRun = document.getElementById('btn-cont-run');
    const btnStop = document.getElementById('btn-stop');
    const btnHighlight = document.getElementById('btn-highlight');
    const btnPalette = document.getElementById('btn-palette');
    const btnNew = document.getElementById('btn-new');
    const btnClear = document.getElementById('btn-clear');
    const btnHelp = document.getElementById('btn-help');
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const fileInput = document.getElementById('file-input');

    // Botões do Modal de Confirmação (Novo Projeto)
    const modalClose = document.getElementById('btn-modal-close');
    const modalCancel = document.getElementById('btn-confirm-cancel');
    const modalDiscard = document.getElementById('btn-confirm-discard');
    const modalSave = document.getElementById('btn-confirm-save');

    if (btnRun) btnRun.addEventListener('click', () => this.runtime.runOnce());
    if (btnContRun) {
      btnContRun.addEventListener('click', () => {
        if (this.runtime.isRunning) {
          this.runtime.stop();
        } else {
          this.runtime.startContinuous();
        }
      });
    }
    if (btnStop) btnStop.addEventListener('click', () => this.runtime.stop());

    this.runtime.onStateChange = (running) => {
      if (btnContRun) {
        if (running && this.runtime.isContinuous) {
          btnContRun.classList.add('running');
        } else {
          btnContRun.classList.remove('running');
        }
      }
      if (btnRun) {
        if (running && !this.runtime.isContinuous) {
          btnRun.classList.add('running');
        } else {
          btnRun.classList.remove('running');
        }
      }
    };

    if (btnHighlight) {
      btnHighlight.addEventListener('click', () => {
        const active = !this.runtime.isHighlight;
        this.runtime.setHighlight(active);
        if (active) btnHighlight.classList.add('active');
        else btnHighlight.classList.remove('active');
      });
    }

    if (btnPalette) btnPalette.addEventListener('click', () => this.palette.toggle());

    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.addEventListener('click', () => { if (this.undoManager) this.undoManager.undo(); });
    if (btnRedo) btnRedo.addEventListener('click', () => { if (this.undoManager) this.undoManager.redo(); });

    if (btnNew) btnNew.addEventListener('click', () => this.promptNewProject());
    if (btnClear) btnClear.addEventListener('click', () => this.promptNewProject());
    if (btnHelp) btnHelp.addEventListener('click', () => this.openManualHelp());

    // Salvar e Abrir Projeto
    if (btnSave) btnSave.addEventListener('click', () => this.saveProject());
    if (btnLoad) {
      btnLoad.addEventListener('click', () => {
        if (window.AndroidBridge && typeof window.AndroidBridge.openProjectFile === 'function') {
          window.AndroidBridge.openProjectFile();
        } else {
          fileInput.click();
        }
      });
    }
    if (fileInput) fileInput.addEventListener('change', (e) => this.loadProjectFile(e));


    // Listeners do Modal Novo Projeto
    if (modalClose) modalClose.addEventListener('click', () => this.closeNewProjectModal());
    if (modalCancel) modalCancel.addEventListener('click', () => this.closeNewProjectModal());
    if (modalDiscard) {
      modalDiscard.addEventListener('click', () => {
        this.closeNewProjectModal();
        this.clearAll();
      });
    }
    if (modalSave) {
      modalSave.addEventListener('click', () => {
        this.closeNewProjectModal();
        this.saveProject();
        this.clearAll();
      });
    }

    // Atualização visual do estado do Runtime
    this.runtime.onStateChange = (running) => {
      const dot = document.getElementById('status-run-dot');
      const text = document.getElementById('status-run-text');

      if (running) {
        btnContRun.classList.add('btn-active');
        if (dot) dot.className = 'status-dot running';
        if (text) text.textContent = 'Executando (While Loop)';
      } else {
        btnContRun.classList.remove('btn-active');
        if (dot) dot.className = 'status-dot';
        if (text) text.textContent = 'Parado (Idle)';
      }
    };
  }

  setupViewTabs() {
    const tabs = document.querySelectorAll('.view-tab');
    const viewFront = document.getElementById('workspace-front');
    const viewDiagram = document.getElementById('workspace-diagram');
    const viewSplit = document.getElementById('workspace-split');

    const fpContainer = document.getElementById('front-panel-container');
    const diagContainer = document.getElementById('diagram-container');

    const splitFP = document.getElementById('split-front-panel');
    const splitDiag = document.getElementById('split-diagram');

    const switchView = (mode) => {
      this.activeView = mode;
      tabs.forEach(t => t.classList.remove('active'));
      const activeTab = document.querySelector(`.view-tab[data-view="${mode}"]`);
      if (activeTab) activeTab.classList.add('active');

      viewFront.classList.remove('active');
      viewDiagram.classList.remove('active');
      viewSplit.classList.remove('active');

      if (mode === 'front') {
        viewFront.classList.add('active');
        viewFront.appendChild(fpContainer);
      } else if (mode === 'diagram') {
        viewDiagram.classList.add('active');
        viewDiagram.appendChild(diagContainer);
      } else {
        viewSplit.classList.add('active');
        splitFP.appendChild(fpContainer);
        splitDiag.appendChild(diagContainer);
      }

      this.editor.renderWires();
    };

    tabs.forEach(t => {
      t.addEventListener('click', () => {
        const mode = t.getAttribute('data-view');
        switchView(mode);
      });
    });

    // Inicia no modo split
    switchView('split');
  }

  setupHardwareSelector() {
    const btnHardware = document.getElementById('btn-hardware');
    const menuHardware = document.getElementById('hardware-dropdown-menu');
    const hwItems = document.querySelectorAll('.hw-dropdown-item');
    const hwDot = document.getElementById('status-hw-dot');
    const hwText = document.getElementById('status-hw-text');
    const btnConnectHw = document.getElementById('btn-connect-hw');

    // No ambiente Android / mobile, remove o seletor de Hardware para liberar espaço às abas
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.AndroidBridge !== undefined;
    if (isMobile) {
      document.body.classList.add('is-android');
      const hwDropdown = document.getElementById('dropdown-hardware');
      if (hwDropdown) hwDropdown.style.display = 'none';
      if (btnConnectHw) btnConnectHw.style.display = 'none';
      const hwStatusItem = document.getElementById('status-hw-item');
      if (hwStatusItem) hwStatusItem.style.display = 'none';
    }

    const updateActiveItem = (mode) => {
      hwItems.forEach(item => {
        if (item.getAttribute('data-value') === mode) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    };

    const updateConnectBtn = (mode, isConnected = false) => {
      if (!btnConnectHw) return;
      if (mode === 'virtual') {
        btnConnectHw.disabled = true;
        btnConnectHw.classList.add('disabled');
        btnConnectHw.classList.remove('connected');
        btnConnectHw.title = "O modo Planta Virtual está ativo. Selecione a placa NI USB-6009 no menu Hardware para conectar.";
      } else {
        btnConnectHw.disabled = false;
        btnConnectHw.classList.remove('disabled');
        if (isConnected) {
          btnConnectHw.classList.add('connected');
          btnConnectHw.title = "Bancada física conectada! Clique para verificar ou reconectar.";
        } else {
          btnConnectHw.classList.remove('connected');
          btnConnectHw.title = "Clique para conectar à bancada física NI USB-6009";
        }
      }
    };

    this.currentHardwareMode = 'virtual';

    const applyMode = async (mode) => {
      updateActiveItem(mode);
      this.currentHardwareMode = mode;
      if (mode === 'virtual') {
        updateConnectBtn('virtual', false);
        try { await this.wsBridge.disconnect(); } catch (_) {}
        this.currentDAQ = this.virtualDAQ;
        this.runtime.setDAQDevice(this.virtualDAQ);
        if (hwDot) hwDot.className = 'status-dot connected';
        if (hwText) hwText.textContent = 'Hardware: Planta Virtual (Simulador)';
      } else if (mode === 'websocket') {
        updateConnectBtn('websocket', false);
        try {
          if (hwText) hwText.textContent = 'Hardware: Conectando Bridge...';
          await this.wsBridge.connect();
          this.currentDAQ = this.wsBridge;
          this.runtime.setDAQDevice(this.wsBridge);
          if (hwDot) hwDot.className = 'status-dot connected';
          const devTitle = this.wsBridge.deviceName ? `NI USB-6009 [${this.wsBridge.deviceName}] (Bridge NI-DAQmx)` : 'NI USB-6009 (Bridge NI-DAQmx)';
          if (hwText) hwText.textContent = `Hardware: ${devTitle}`;
          updateConnectBtn('websocket', true);
        } catch (err) {
          updateConnectBtn('websocket', false);
          if (hwDot) hwDot.className = 'status-dot disconnected';
          if (hwText) hwText.textContent = 'Hardware: NI USB-6009 (Aguardando conexão - Clique em Conectar)';
          alert(
            (err && err.message) ? err.message :
            'Não foi possível conectar ao Bridge da NI USB-6009 (127.0.0.1:8765).\n\n' +
            'Para operar a placa física no Windows:\n' +
            '1. Certifique-se de que o cabo USB está plugado no computador.\n' +
            '2. Se o Bridge não estiver ativo, execute o arquivo "INICIAR_ROSIVIEW_BRIDGE.bat" na pasta do RosiView.\n' +
            '3. Clique no botão "Conectar" ao lado de Hardware.'
          );
        }
      }
    };

    // Monitoramento em tempo real do status físico de conexão/desconexão
    this.wsBridge.onStatusChange = (isConnected, devName) => {
      if (this.currentHardwareMode !== 'websocket') return;
      if (isConnected) {
        if (hwDot) hwDot.className = 'status-dot connected';
        const devTitle = devName ? `NI USB-6009 [${devName}] (Bridge NI-DAQmx)` : 'NI USB-6009 (Bridge NI-DAQmx)';
        if (hwText) hwText.textContent = `Hardware: ${devTitle}`;
        updateConnectBtn('websocket', true);
      } else {
        if (hwDot) hwDot.className = 'status-dot disconnected';
        if (hwText) hwText.textContent = 'Hardware: NI USB-6009 (Planta Desconectada)';
        updateConnectBtn('websocket', false);
      }
    };

    if (btnHardware && menuHardware) {
      btnHardware.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = menuHardware.style.display === 'flex';
        menuHardware.style.display = isVisible ? 'none' : 'flex';
      });

      document.addEventListener('click', (e) => {
        if (!menuHardware.contains(e.target) && e.target !== btnHardware) {
          menuHardware.style.display = 'none';
        }
      });

      hwItems.forEach(item => {
        item.addEventListener('click', async () => {
          const mode = item.getAttribute('data-value');
          menuHardware.style.display = 'none';
          await applyMode(mode);
        });
      });
    }

    if (btnConnectHw) {
      btnConnectHw.addEventListener('click', async () => {
        if (btnConnectHw.disabled) return;
        btnConnectHw.disabled = true;
        btnConnectHw.innerHTML = '<span>⏳</span> <span class="btn-text">Conectando...</span>';

        try {
          await this.wsBridge.connect();
          this.currentDAQ = this.wsBridge;
          this.runtime.setDAQDevice(this.wsBridge);
          if (hwDot) hwDot.className = 'status-dot connected';
          const devTitle = this.wsBridge.deviceName ? `NI USB-6009 [${this.wsBridge.deviceName}] (Bridge NI-DAQmx)` : 'NI USB-6009 (Bridge NI-DAQmx)';
          if (hwText) hwText.textContent = `Hardware: ${devTitle}`;
          updateActiveItem('websocket');
          updateConnectBtn('websocket', true);
          btnConnectHw.innerHTML = '<span>⚡</span> <span class="btn-text">Conectado</span>';
          setTimeout(() => {
            btnConnectHw.innerHTML = '<span>⚡</span> <span class="btn-text">Conectar</span>';
            btnConnectHw.disabled = false;
          }, 1800);
        } catch (err) {
          updateConnectBtn('websocket', false);
          btnConnectHw.innerHTML = '<span>⚡</span> <span class="btn-text">Conectar</span>';
          btnConnectHw.disabled = false;
          if (hwDot) hwDot.className = 'status-dot disconnected';
          if (hwText) hwText.textContent = 'Hardware: NI USB-6009 (Desconectado)';
          alert(
            (err && err.message) ? err.message :
            'Não foi possível conectar à bancada física NI USB-6009 (127.0.0.1:8765).\n\n' +
            'Passo a passo para conectar:\n' +
            '1. Verifique se o cabo USB da placa NI está conectado ao computador.\n' +
            '2. Se o Bridge não estiver rodando, abra o arquivo "INICIAR_ROSIVIEW_BRIDGE.bat" na pasta do RosiView.\n' +
            '3. Clique em "Conectar" novamente.'
          );
        }
      });
    }

    // Padrão obrigatório ao iniciar: Planta Virtual (Simulador)
    updateActiveItem('virtual');
    if (hwDot) hwDot.className = 'status-dot connected';
    if (hwText) hwText.textContent = 'Hardware: Planta Virtual (Simulador)';
    updateConnectBtn('virtual', false);
  }

  setupStatusBar() {
    const iterEl = document.getElementById('status-iteration');
    this.runtime.onStepCompleted = ({ iteration }) => {
      if (iterEl) iterEl.textContent = `Loop [i]: ${iteration}`;
    };
  }

  addNodeFromPalette(kind) {
    let node = null;
    let x = 120 + Math.random() * 80;
    let y = 80 + Math.random() * 80;
    if (this.editor) {
      const bdCanvas = this.editor.canvas || document.getElementById('diagram-canvas');
      const w = bdCanvas ? bdCanvas.clientWidth : 800;
      const h = bdCanvas ? bdCanvas.clientHeight : 600;
      const center = this.editor.screenToWorld(
        (bdCanvas ? bdCanvas.getBoundingClientRect().left : 0) + w / 2,
        (bdCanvas ? bdCanvas.getBoundingClientRect().top : 0) + h / 2
      );
      x = Math.round(center.x - 50 + (Math.random() * 40 - 20));
      y = Math.round(center.y - 30 + (Math.random() * 40 - 20));
    }

    switch (kind) {
      case 'ctrl_onoff': node = new OnOffControllerNode({ x, y }); break;
      case 'ctrl_pid': node = new PIDControllerNode({ x, y }); break;
      case 'plant_tf': node = new TransferFunctionNode({ x, y }); break;
      case 'formula_node': node = new FormulaNode({ x, y }); break;
      case 'daq_ai': node = new DAQAssistantAINode({ x, y }); break;
      case 'daq_ao': node = new DAQAssistantAONode({ x, y }); break;
      case 'math_add': node = new AddNode({ x, y }); break;
      case 'math_sub': node = new SubtractNode({ x, y }); break;
      case 'math_mul': node = new MultiplyNode({ x, y }); break;
      case 'math_div': node = new DivideNode({ x, y }); break;
      case 'math_gain': node = new GainNode({ x, y }); break;
      case 'math_sat': node = new SaturationNode({ x, y }); break;
      case 'sig_random': node = new RandomNumberNode({ x, y }); break;
      case 'sig_sine': node = new SineNode({ x, y }); break;
      case 'sig_const': node = new ConstantNode({ x, y }); break;
      case 'cluster_bundle': node = new BundleNode({ x, y }); break;
      case 'array_build': node = new BuildArrayNode({ x, y }); break;
      case 'array_subset': node = new ArraySubsetNode({ x, y }); break;
    }

    if (node) {
      this.graph.addNode(node);
      this.editor.render();
      this.palette.toggle(false);
      if (this.undoManager) this.undoManager.pushState();
    }
  }

  addWidgetFromPalette(kind) {
    let widget = null;
    const id = `widget_${Date.now()}`;
    let x = 50 + Math.random() * 50;
    let y = 50 + Math.random() * 50;
    if (this.frontPanel) {
      const fpCanvas = this.frontPanel.container;
      const w = fpCanvas ? fpCanvas.clientWidth : 800;
      const h = fpCanvas ? fpCanvas.clientHeight : 600;
      const center = this.frontPanel.screenToWorld(
        (fpCanvas ? fpCanvas.getBoundingClientRect().left : 0) + w / 2,
        (fpCanvas ? fpCanvas.getBoundingClientRect().top : 0) + h / 2
      );
      x = Math.round(center.x - 60 + (Math.random() * 40 - 20));
      y = Math.round(center.y - 60 + (Math.random() * 40 - 20));
    }

    switch (kind) {
      case 'knob': widget = new KnobWidget({ id, x, y }); break;
      case 'gauge': widget = new GaugeWidget({ id, x, y }); break;
      case 'tank': widget = new TankWidget({ id, x, y }); break;
      case 'thermometer': widget = new ThermometerWidget({ id, x, y }); break;
      case 'chart': widget = new ChartWidget({ id, x, y }); break;
      case 'slider': widget = new SliderWidget({ id, x, y }); break;
      case 'switch': widget = new ToggleSwitchWidget({ id, x, y }); break;
      case 'led': widget = new LEDWidget({ id, x, y }); break;
      case 'num_ctrl': widget = new NumericControlWidget({ id, isIndicator: false, x, y }); break;
      case 'num_ind': widget = new NumericControlWidget({ id, isIndicator: true, x, y }); break;
    }

    if (widget) {
      widget.kind = kind;
      this.frontPanel.addWidget(widget);
      this.palette.toggle(false);
      if (this.undoManager) this.undoManager.pushState();
    }
  }

  duplicateFrontPanelWidget(origWidget) {
    const kind = this.frontPanel.getWidgetKind(origWidget);
    const id = `widget_${Date.now()}`;
    const fpX = (origWidget.x || parseInt(origWidget.element.style.left, 10) || 50) + 30;
    const fpY = (origWidget.y || parseInt(origWidget.element.style.top, 10) || 50) + 30;

    const origBinding = this.frontPanel.bindings.find(b => b.widgetId === origWidget.id);
    const isInput = origBinding ? origBinding.isInputToDiagram : false;

    let dupTitle = origWidget.title ? `${origWidget.title} (Cópia)` : 'Instrumento';
    if (kind === 'num_ind' || kind === 'num_ctrl' || kind === 'switch') {
      dupTitle = origWidget.title || 'Instrumento';
    }

    let widget = null;

    const config = {
      id,
      title: dupTitle,
      min: origWidget.min !== undefined ? origWidget.min : 0,
      max: origWidget.max !== undefined ? origWidget.max : 100,
      step: origWidget.step !== undefined ? origWidget.step : 1,
      unit: origWidget.unit || '',
      initialValue: origWidget.value !== undefined ? origWidget.value : (origWidget.state !== undefined ? origWidget.state : 0),
      isIndicator: origWidget.isIndicator,
      color: origWidget.color || 'green',
      x: fpX,
      y: fpY
    };

    switch (kind) {
      case 'knob':
        widget = new KnobWidget(config);
        break;
      case 'slider':
        widget = new SliderWidget(config);
        break;
      case 'num_ctrl':
        widget = new NumericControlWidget({ ...config, isIndicator: false });
        break;
      case 'switch':
        widget = new ToggleSwitchWidget({ ...config, initialState: !!config.initialValue });
        break;
      case 'gauge':
        widget = new GaugeWidget(config);
        break;
      case 'tank':
        widget = new TankWidget(config);
        break;
      case 'thermometer':
        widget = new ThermometerWidget(config);
        break;
      case 'chart':
        widget = new ChartWidget(config);
        break;
      case 'led':
        widget = new LEDWidget({ ...config, initialState: !!config.initialValue });
        break;
      case 'num_ind':
        widget = new NumericControlWidget({ ...config, isIndicator: true });
        break;
      default:
        widget = new KnobWidget(config);
        break;
    }

    if (widget) {
      widget.kind = kind;
      this.frontPanel.addWidget(widget);
      if (origBinding) {
        this.frontPanel.bindWidgetToNode({ widgetId: id, nodeId: `node_${id}`, terminalName: origBinding.terminalName, isInputToDiagram: isInput });
      }
    }
    this.frontPanel.selectWidget(id);
    if (this.undoManager) this.undoManager.pushState();
    this.showToast(`Instrumento '${config.title}' duplicado!`);
  }

  clearAll() {
    this.runtime.stop();
    this.graph.clear();
    this.frontPanel.clear();
    this.editor.render();
    if (this.undoManager) this.undoManager.reset();
  }

  showToast(msg, duration = 3200) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<span style="color:#38bdf8;">✓</span> <span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  async saveProject() {
    const data = {
      version: '2.0',
      app: 'RosiView',
      savedAt: new Date().toISOString(),
      graph: this.graph.toJSON(),
      frontPanel: this.frontPanel.toJSON()
    };
    const jsonStr = JSON.stringify(data, null, 2);

    // 0. Suporte nativo para Android (SAF - Storage Access Framework)
    if (window.AndroidBridge) {
      const defaultName = (this.currentProjectName || 'meu_projeto.rosi').replace(/\.(rosi|json)$/i, '') + '.rosi';
      if (typeof window.AndroidBridge.launchSaveProjectPicker === 'function') {
        window.AndroidBridge.launchSaveProjectPicker(defaultName, jsonStr);
        return;
      }
      if (typeof window.AndroidBridge.saveProjectFile === 'function') {
        window.AndroidBridge.saveProjectFile(defaultName, jsonStr);
        return;
      }
    }

    // 1. Tenta a API nativa do Windows showSaveFilePicker (Salvar Como)
    if (window.isSecureContext && typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: this.currentProjectName || 'meu_projeto.rosi',
          types: [
            {
              description: 'Projeto RosiView (*.rosi)',
              accept: { 'application/json': ['.rosi', '.json'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        this.currentProjectName = handle.name;
        this.showToast(`Projeto '${handle.name}' salvo com sucesso!`);
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          // Usuário cancelou a janela nativa do Windows
          return;
        }
        console.warn('showSaveFilePicker não disponível no contexto atual:', err);
      }
    }

    // 2. Abre a janela modal integrada do RosiView para digitar nome e salvar
    this.openSaveProjectDialog(jsonStr);
  }

  openSaveProjectDialog(jsonStr) {
    const existing = document.querySelector('.save-project-modal');
    if (existing) existing.remove();

    const nodeCount = this.graph ? this.graph.nodes.size : 0;
    const wireCount = this.graph ? this.graph.wires.length : 0;
    const widgetCount = this.frontPanel && this.frontPanel.widgets ? this.frontPanel.widgets.size : 0;
    const defaultName = (this.currentProjectName || 'meu_projeto.rosi').replace(/\.(rosi|json)$/i, '');

    const modal = document.createElement('div');
    modal.className = 'save-project-modal';
    modal.innerHTML = `
      <div class="save-project-box">
        <div class="save-project-header">
          <div class="save-project-title">
            <span style="font-size: 15px;">💾</span>
            <span>Salvar Projeto RosiView</span>
          </div>
          <button class="palette-close-btn" id="save_close_btn" title="Fechar">✕</button>
        </div>
        <div class="save-project-body">
          <div class="save-field">
            <label for="save_filename_input">Nome do Arquivo:</label>
            <div class="save-input-wrapper">
              <input type="text" id="save_filename_input" value="${defaultName}" placeholder="nome_do_projeto" spellcheck="false" autocomplete="off">
              <span class="save-input-ext">.rosi</span>
            </div>
            <span class="save-field-hint">O projeto será salvo com a extensão <code>.rosi</code> (compatível com JSON).</span>
          </div>

          <div class="save-summary-card">
            <div class="save-summary-title">Resumo do Projeto:</div>
            <div class="save-summary-item">📊 Diagrama de Blocos: <strong>${nodeCount} blocos</strong>, <strong>${wireCount} conexões</strong></div>
            <div class="save-summary-item">🎛️ Painel Frontal: <strong>${widgetCount} instrumentos</strong></div>
          </div>

          <div class="save-info-note">
            <span class="save-info-icon">📁</span>
            <div class="save-info-text">
              <strong>Local de Salvamento:</strong> O arquivo será salvo na sua pasta de Downloads. Para que o navegador pergunte a pasta desejada a cada salvamento, ative <em>"Perguntar onde salvar cada arquivo"</em> nas configurações do navegador.
            </div>
          </div>
        </div>
        <div class="save-project-footer">
          <button class="config-btn config-btn-cancel" id="save_cancel_btn">Cancelar</button>
          <button class="config-btn config-btn-save" id="save_confirm_btn" style="display:inline-flex;align-items:center;gap:6px;">
            <span>💾</span> Salvar Arquivo
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#save_filename_input');
    if (!this.isAndroid) {
      input.focus();
      input.select();
    }

    const close = () => modal.remove();
    modal.querySelector('#save_close_btn').onclick = close;
    modal.querySelector('#save_cancel_btn').onclick = close;

    const executeSave = () => {
      let rawName = input.value.trim();
      if (!rawName) rawName = 'meu_projeto';
      if (!rawName.toLowerCase().endsWith('.rosi') && !rawName.toLowerCase().endsWith('.json')) {
        rawName += '.rosi';
      }
      this.currentProjectName = rawName;

      // Suporte nativo para ambiente Android
      if (window.AndroidBridge) {
        if (typeof window.AndroidBridge.launchSaveProjectPicker === 'function') {
          window.AndroidBridge.launchSaveProjectPicker(rawName, jsonStr);
          close();
          return;
        }
        if (typeof window.AndroidBridge.saveProjectFile === 'function') {
          window.AndroidBridge.saveProjectFile(rawName, jsonStr);
          this.showToast(`Projeto '${rawName}' salvo com sucesso!`);
          close();
          return;
        }
      }

      // Download no navegador Desktop
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rawName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast(`Projeto '${rawName}' salvo com sucesso!`);
      close();
    };


    modal.querySelector('#save_confirm_btn').onclick = executeSave;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
  }

  openManualHelp() {
    // Se estiver no ambiente nativo Android, delega a abertura ao leitor do sistema
    if (window.AndroidBridge && typeof window.AndroidBridge.openManual === 'function') {
      window.AndroidBridge.openManual();
      this.showToast('Abrindo Manual do Usuário...', 2500);
      return;
    }

    const manualPdf = 'docs/manual_aluno/manual_rosiview_aluno.pdf#page=2';
    try {
      const win = window.open(manualPdf, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = manualPdf;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      this.showToast('Abrindo Manual do Usuário (Sumário)...', 'info');
    } catch (err) {
      console.error('Erro ao abrir o manual:', err);
      window.location.href = manualPdf;
    }
  }

  loadProjectFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      this.loadProjectJson(event.target.result, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  loadProjectJson(jsonOrStr, fileName = null, isUndo = false) {
    try {
      const json = typeof jsonOrStr === 'string' ? JSON.parse(jsonOrStr) : jsonOrStr;
      if (!isUndo) {
        this.currentProjectName = fileName || 'meu_projeto.rosi';
      }

      this.runtime.stop();
      this.graph.clear();
      this.frontPanel.clear();
      if (!isUndo && this.undoManager) {
        this.undoManager.reset();
      }

      if (json.frontPanel && Array.isArray(json.frontPanel.widgets)) {
        for (const w of json.frontPanel.widgets) {
          let widget = null;
          switch (w.kind) {
            case 'slider':
              widget = new SliderWidget({ id: w.id, title: w.title, min: w.min, max: w.max, step: w.step, initialValue: w.initialValue, unit: w.unit, x: w.x, y: w.y });
              break;
            case 'tank':
              widget = new TankWidget({ id: w.id, title: w.title, min: w.min, max: w.max, unit: w.unit, x: w.x, y: w.y });
              if (w.initialValue !== undefined) widget.setValue(w.initialValue);
              break;
            case 'thermometer':
              widget = new ThermometerWidget({ id: w.id, title: w.title, min: w.min, max: w.max, unit: w.unit, x: w.x, y: w.y });
              if (w.initialValue !== undefined) widget.setValue(w.initialValue);
              break;
            case 'chart':
              widget = new ChartWidget({ id: w.id, title: w.title, maxPoints: w.maxPoints || 200, plots: w.plots, x: w.x, y: w.y });
              break;
            case 'knob':
              widget = new KnobWidget({ id: w.id, title: w.title, min: w.min, max: w.max, step: w.step, initialValue: w.initialValue, unit: w.unit, x: w.x, y: w.y });
              break;
            case 'gauge':
              widget = new GaugeWidget({ id: w.id, title: w.title, min: w.min, max: w.max, unit: w.unit, initialValue: w.initialValue, x: w.x, y: w.y });
              break;
            case 'switch':
              widget = new ToggleSwitchWidget({ id: w.id, title: w.title, labelOn: w.labelOn || 'ON', labelOff: w.labelOff || 'OFF', initialState: Boolean(w.initialValue), x: w.x, y: w.y });
              break;
            case 'led':
              widget = new LEDWidget({ id: w.id, title: w.title, color: w.color || 'green', initialState: Boolean(w.initialValue), x: w.x, y: w.y });
              break;
            case 'num_ctrl':
              widget = new NumericControlWidget({ id: w.id, title: w.title, initialValue: w.initialValue, isIndicator: false, x: w.x, y: w.y });
              break;
            case 'num_ind':
              widget = new NumericControlWidget({ id: w.id, title: w.title, initialValue: w.initialValue, isIndicator: true, x: w.x, y: w.y });
              break;
          }
          if (widget) this.frontPanel.addWidget(widget);
        }
      }

      if (json.graph && Array.isArray(json.graph.nodes)) {
        for (const n of json.graph.nodes) {
          let node = null;
          switch (n.type) {
            case 'math_add': node = new AddNode({ id: n.id, title: n.title, inputCount: n.inputCount, x: n.x, y: n.y }); break;
            case 'math_sub': node = new SubtractNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'math_mul': node = new MultiplyNode({ id: n.id, title: n.title, inputCount: n.inputCount, x: n.x, y: n.y }); break;
            case 'math_div': node = new DivideNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'math_gain': node = new GainNode({ id: n.id, title: n.title, gain: n.gain || 1, x: n.x, y: n.y }); break;
            case 'math_sat': node = new SaturationNode({ id: n.id, title: n.title, min: n.min, max: n.max, x: n.x, y: n.y }); break;
            case 'logic_gt': node = new GreaterNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'logic_lt': node = new LessNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'logic_eq': node = new EqualNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'logic_and': node = new AndNode({ id: n.id, title: n.title, inputCount: n.inputCount, x: n.x, y: n.y }); break;
            case 'logic_or': node = new OrNode({ id: n.id, title: n.title, inputCount: n.inputCount, x: n.x, y: n.y }); break;
            case 'logic_not': node = new NotNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'logic_select': node = new SelectNode({ id: n.id, title: n.title, x: n.x, y: n.y }); break;
            case 'sig_const':
              node = new ConstantNode({ id: n.id, constantValue: n.constantValue !== undefined ? n.constantValue : 0, x: n.x, y: n.y });
              break;
            case 'sig_sine': node = new SineNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'sig_random': node = new RandomNumberNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'sig_timestep': node = new TimeStepNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'daq_ai': node = new DAQAssistantAINode({ id: n.id, channel: n.channel !== undefined ? n.channel : 0, x: n.x, y: n.y }); break;
            case 'daq_ao': node = new DAQAssistantAONode({ id: n.id, channel: n.channel !== undefined ? n.channel : 0, x: n.x, y: n.y }); break;
            case 'ctrl_onoff': node = new OnOffControllerNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'ctrl_pid': node = new PIDControllerNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'plant_tf': node = new TransferFunctionNode({ id: n.id, kp: n.kp, tau: n.tau, theta: n.theta, x: n.x, y: n.y }); break;
            case 'formula_node':
              node = new FormulaNode({
                id: n.id,
                title: n.title,
                code: n.code,
                inputNames: n.inputNames,
                outputNames: n.outputNames,
                x: n.x,
                y: n.y
              });
              break;
            case 'cluster_bundle': node = new BundleNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'array_build': node = new BuildArrayNode({ id: n.id, x: n.x, y: n.y }); break;
            case 'array_subset': node = new ArraySubsetNode({ id: n.id, x: n.x, y: n.y }); break;
          }

          if (node) {
            if (n.title) node.title = n.title;
            if (n.inputs && Array.isArray(n.inputs)) {
              for (const iv of n.inputs) {
                const inTerm = node.getInput(iv.name);
                if (inTerm && iv.value !== undefined) inTerm.value = iv.value;
              }
            }
            this.graph.addNode(node);
          }
        }
      }

      if (json.graph && Array.isArray(json.graph.connections)) {
        for (const c of json.graph.connections) {
          this.graph.addConnection({
            fromNodeId: c.fromNodeId,
            fromTerminalId: c.fromTerminalId,
            toNodeId: c.toNodeId,
            toTerminalId: c.toTerminalId,
            type: c.type,
            color: c.color
          });
        }
      }

      if (json.frontPanel && Array.isArray(json.frontPanel.bindings)) {
        for (const b of json.frontPanel.bindings) {
          this.frontPanel.bindWidgetToNode(b);
        }
      }

      this.editor.render();
      if (!isUndo) {
        this.showToast(`Projeto '${this.currentProjectName}' carregado com sucesso!`);
      }
    } catch (err) {
      console.error('Erro ao carregar o arquivo .rosi:', err);
      alert('Erro ao carregar o arquivo .rosi: ' + err.message);
    }
  }
}

// Ponte global para carregar projeto a partir do Android nativo
window.loadProjectFromAndroid = (jsonStr, fileName) => {
  if (window.rosiViewApp && typeof window.rosiViewApp.loadProjectJson === 'function') {
    window.rosiViewApp.loadProjectJson(jsonStr, fileName);
  }
};

// Inicializa quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  window.rosiViewApp = new RosiViewApp();
  window.rosiViewApp.init();
});

