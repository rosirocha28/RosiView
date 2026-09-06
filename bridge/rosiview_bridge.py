#!/usr/bin/env python3
"""
==========================================================================
RosiView — Micro-Bridge Universal WebSocket Server para NI USB-6009
Compatível com todos os navegadores (Firefox, Google Chrome e Microsoft Edge)
==========================================================================

Este script permite que o RosiView no navegador comunique-se diretamente com a
placa de aquisição de dados National Instruments USB-6009 via WebSocket local (ws://127.0.0.1:8765).

Requisitos:
- Python 3.7+
- (Opcional) nidaqmx ou pyusb caso a placa física esteja conectada.

Como executar no laboratório (sem instalação pesada):
    python rosiview_bridge.py
"""

import asyncio
import json
import math
import sys
import time

try:
    import websockets
except ImportError:
    print("[RosiView Bridge] O pacote 'websockets' não está instalado.")
    print("Tentando instalar rapidamente via pip...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

# Tenta carregar biblioteca nativa da NI
NI_DAQ_AVAILABLE = False
try:
    import nidaqmx
    from nidaqmx.constants import AcquisitionType, VoltageUnits
    NI_DAQ_AVAILABLE = True
    print("[RosiView Bridge] Suíte NI-DAQmx detectada com sucesso!")
except Exception:
    print("[RosiView Bridge] NI-DAQmx não instalado ou placa não detectada.")
    print("[RosiView Bridge] Operando em modo de emulação de hardware de alta precisão.")

# Estados dos canais
analog_inputs = [0.0] * 8
analog_outputs = [0.0] * 2
digital_inputs = [False] * 8
digital_outputs = [False] * 8

# Simulação da planta de nível interna caso não haja placa física conectada
tank_level = 30.0  # mm
pump_v = 0.0

async def hardware_loop():
    global analog_inputs, analog_outputs, tank_level, pump_v
    
    # Se houver placa real conectada com NI-DAQmx
    if NI_DAQ_AVAILABLE:
        try:
            with nidaqmx.Task() as task_ai, nidaqmx.Task() as task_ao:
                # Configura ai0
                task_ai.ai_channels.add_ai_voltage_chan("Dev1/ai0", min_val=0.0, max_val=5.0)
                # Configura ao1 (Bomba)
                task_ao.ao_channels.add_ao_voltage_chan("Dev1/ao1", min_val=0.0, max_val=5.0)
                
                while True:
                    # Leitura real do sensor em ai0
                    analog_inputs[0] = float(task_ai.read())
                    # Escrita real na bomba em ao1
                    task_ao.write(float(analog_outputs[1]))
                    await asyncio.sleep(0.04)
        except Exception as e:
            print(f"[RosiView Bridge] Aviso no acesso ao hardware físico: {e}")
            print("[RosiView Bridge] Alternando para emulação virtual.")
    
    # Loop de emulação contínua
    while True:
        # Dinâmica de nível da bancada
        pump_v = analog_outputs[1]
        q_in = (pump_v / 5.0) * 35.0
        q_out = 1.2 * math.sqrt(max(0, tank_level))
        dh = (q_in - q_out) * 0.04
        tank_level = max(0.0, min(300.0, tank_level + dh))
        
        # Converte nível (30 a 280mm) para tensão em ai0 (0 a 5V)
        analog_inputs[0] = ((tank_level - 30.0) / 250.0) * 5.0
        await asyncio.sleep(0.04)

async def handle_client(websocket):
    print(f"[RosiView Bridge] Cliente conectado: {websocket.remote_address}")
    
    async def send_updates():
        while True:
            try:
                payload = {
                    "type": "ai_data",
                    "values": analog_inputs
                }
                await websocket.send(json.dumps(payload))
                await asyncio.sleep(0.04)  # 25 Hz
            except websockets.exceptions.ConnectionClosed:
                break

    async def receive_commands():
        global analog_outputs, digital_outputs
        async for message in websocket:
            try:
                data = json.loads(message)
                cmd = data.get("cmd")
                if cmd == "write_ao":
                    ch = int(data.get("channel", 0))
                    val = float(data.get("value", 0.0))
                    if 0 <= ch < 2:
                        analog_outputs[ch] = max(0.0, min(5.0, val))
                elif cmd == "write_do":
                    line = int(data.get("line", 0))
                    val = bool(data.get("value", False))
                    if 0 <= line < 8:
                        digital_outputs[line] = val
            except Exception as e:
                print(f"[RosiView Bridge] Erro ao processar comando: {e}")

    await asyncio.gather(send_updates(), receive_commands())
    print(f"[RosiView Bridge] Cliente desconectado.")

async def main():
    port = 8765
    print("=" * 65)
    print("      RosiView — NI USB-6009 Universal WebSocket Bridge")
    print(f"      Servidor ativo em: ws://127.0.0.1:{port}")
    print("      Compatível com Firefox, Google Chrome e Microsoft Edge")
    print("=" * 65)
    
    asyncio.create_task(hardware_loop())
    async with websockets.serve(handle_client, "127.0.0.1", port):
        await asyncio.Future()  # roda indefinidamente

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[RosiView Bridge] Encerrado pelo usuário.")
