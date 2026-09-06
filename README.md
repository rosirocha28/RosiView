# RosiView — Ambiente de Instrumentação Virtual e Controle de Processos Web

O **RosiView** é uma plataforma educacional e profissional de instrumentação virtual e controle de processos executada diretamente no navegador. Inspirado na linguagem G e em ambientes de fluxo de dados (como o National Instruments LabVIEW™), o RosiView permite criar diagramas de blocos, desenhar interfaces de operação (Painel Frontal), sintonizar controladores e interagir tanto com plantas virtuais simuladas quanto com bancadas físicas reais via placas de aquisição de dados (DAQ).

Desenvolvido para apoio às aulas de **Sistemas de Controle Integrado** do **IFES (Instituto Federal do Espírito Santo)**.

---

## 🚀 Principais Recursos

* **Painel Frontal Interativo:**
  * Indicadores dinâmicos: Tanques animados com nível em tempo real, termômetros virtuais e LEDs de status.
  * Controles de operação: Sliders de Setpoint e ganhos, chaves toggle (Power, Modo, Dreno) e controles numéricos.
  * Gráficos em tempo real (*Waveform Chart*): Suporte a múltiplas plotagens simultâneas (SP, PV e MV).

* **Diagrama de Blocos Baseado em Dataflow:**
  * **Sinais & Fontes:** Constantes numéricas, gerador senoidal, gerador de números aleatórios e passo de tempo (*TimeStep*).
  * **Operações Matemáticas:** Soma, subtração, multiplicação, divisão, ganho e saturação.
  * **Lógica & Comparadores:** Maior que, menor que, igual, AND, OR, NOT e chave seletora (*Select*).
  * **Controle de Processos:** Controlador ON-OFF com banda de histerese ajustável e controlador PID completo com algoritmo Anti-Windup.
  * **Modelagem de Plantas:** Bloco de Função de Transferência de 1ª Ordem com Atraso de Transporte $G(s) = \frac{K}{\tau s + 1} e^{-\theta s}$.
  * **Formula Node:** Execução de equações e lógica condicional personalizada com sintaxe simples.
  * **Agrupamento de Dados:** Bloco *Bundle* (Cluster) para sobreposição de sinais gráficos e operações com arrays.

* **Conectividade de Hardware:**
  * **Bancada Física:** Integração de alto desempenho com a placa de aquisição de dados **National Instruments (NI USB-6009)** para leitura de sensores (canais AI) e atuação em bombas/válvulas (canais AO) via WebSocket Bridge de baixa latência.
  * **Planta Virtual Integrada:** Simulação matemática realista de tanques de nível e processo térmico diretamente no navegador, dispensando hardware para aprendizado e desenvolvimento prévio.

* **Gerenciamento de Projetos (.rosi):**
  * Salve e carregue seus projetos no formato aberto `.rosi` (JSON estruturado), preservando a disposição espacial, ligações de fios, configurações e vínculos entre o diagrama e o painel frontal.
  * Proteção contra fechamento acidental da janela e diálogo de confirmação para novos projetos.

---

## 💻 Como Executar

### 1. Execução Standalone (Apenas Simulação / Planta Virtual)
Não requer nenhuma instalação de dependências ou servidores:
1. Faça o clone ou baixe este repositório.
2. Dê um duplo clique no arquivo **`index.html`** no seu navegador preferido (Google Chrome, Microsoft Edge, Firefox).
3. O RosiView estará pronto para desenhar diagramas e rodar simulações!

*(Opcional: você também pode servir via servidor local, executando `npx serve .` na pasta raiz).*

### 2. Execução com Hardware Físico (Placa NI USB-6009)
Para comunicar com a placa física conectada à porta USB:
1. Certifique-se de ter os drivers **NI-DAQmx** e o **Python 3** instalados no computador.
2. Dê um duplo clique no arquivo:
   ```bash
   INICIAR_ROSIVIEW_BRIDGE.bat
   ```
3. O bridge Python iniciará o servidor WebSocket local na porta `8765`.
4. Abra o **`index.html`** no navegador e selecione **"Hardware: NI USB-6009 (WebSocket Bridge)"** na barra superior.

---

## 📁 Estrutura do Projeto

```text
ROSIVIEW/
├── index.html                    # Interface principal da aplicação
├── manifest.json                 # Metadados de PWA / Web App
├── INICIAR_ROSIVIEW_BRIDGE.bat   # Inicializador do bridge de hardware para Windows
├── bridge/                       # Servidor WebSocket em Python para NI-DAQmx
│   ├── daq_bridge.py
│   └── requirements.txt
├── css/                          # Folhas de estilo modularizadas
│   ├── main.css
│   ├── components.css
│   └── responsive.css
└── js/                           # Motores e lógica do RosiView
    ├── rosiview_bundle.js        # Bundle standalone otimizado para carregamento direto
    ├── app.js                    # Inicialização e orquestração do sistema
    ├── core/                     # Modelos de dados (Graph, Dataflow, Runtime)
    ├── nodes/                    # Blocos do Diagrama de Blocos (Math, Logic, Control, DAQ)
    ├── ui/                       # Gerenciador do Painel Frontal e Editor
    └── hardware/                 # Drivers de comunicação (Virtual e WebUSB/WebSocket)
```

---

## 👩‍🏫 Autoria & Instituição

* **Autora:** Profª. Rosiane Rocha
* **Instituição:** Instituto Federal do Espírito Santo (IFES) — Campus Serra / Vitória
* **Disciplina:** Sistemas de Controle Integrado
