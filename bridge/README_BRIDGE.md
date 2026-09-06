# RosiView — Instruções do Bridge de Hardware (NI USB-6009)

Este micro-servidor é uma ponte leve que permite ao **RosiView** ler e escrever na placa física **NI USB-6009** a partir de qualquer navegador web (**Firefox**, **Chrome** ou **Edge**), sem depender de plugins.

## Como Executar no Laboratório de Informática:

1. Conecte a placa **NI USB-6009** na porta USB do computador.
2. Abra o terminal ou Prompt de Comando na pasta `ROSIVIEW/bridge` e execute:
   ```bash
   python rosiview_bridge.py
   ```
3. Abra o `index.html` do RosiView em qualquer navegador (Firefox, Chrome ou Edge).
4. No topo da tela do RosiView, selecione no menu **Modo: Placa Real (NI USB-6009)**.
5. Pronto! O RosiView passará a ler os canais analógicos e atuar na bomba em tempo real.
