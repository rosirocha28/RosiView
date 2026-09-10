using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;

namespace RosiView {
    public class NIDriver {
        [DllImport("nicaiu.dll", EntryPoint = "DAQmxGetSysDevNames")]
        public static extern int DAQmxGetSysDevNames(StringBuilder data, uint bufferSize);

        [DllImport("nicaiu.dll", EntryPoint = "DAQmxCreateTask")]
        public static extern int CreateTask(string taskName, out IntPtr taskHandle);

        [DllImport("nicaiu.dll", EntryPoint = "DAQmxCreateAIVoltageChan")]
        public static extern int CreateAIVoltageChan(IntPtr taskHandle, string physicalChannel, string nameToAssignToChannel, int terminalConfig, double minVal, double maxVal, int units, string customScaleName);

        [DllImport("nicaiu.dll", EntryPoint = "DAQmxReadAnalogF64")]
        public static extern int ReadAnalogF64(IntPtr taskHandle, int numSampsPerChan, double timeout, int fillMode, [Out] double[] readArray, uint arraySizeInSamples, out int sampsPerChanRead, IntPtr reserved);

        [DllImport("nicaiu.dll", EntryPoint = "DAQmxCreateAOVoltageChan")]
        public static extern int CreateAOVoltageChan(IntPtr taskHandle, string physicalChannel, string nameToAssignToChannel, double minVal, double maxVal, int units, string customScaleName);

        [DllImport("nicaiu.dll", EntryPoint = "DAQmxWriteAnalogF64")]
        public static extern int WriteAnalogF64(IntPtr taskHandle, int numSampsPerChan, int autoStart, double timeout, int dataLayout, double[] writeArray, out int sampsPerChanWritten, IntPtr reserved);

        [DllImport("nicaiu.dll", EntryPoint = "DAQmxClearTask")]
        public static extern int ClearTask(IntPtr taskHandle);

        public static string DetectDeviceName() {
            try {
                StringBuilder sb = new StringBuilder(1024);
                int err = DAQmxGetSysDevNames(sb, 1024);
                if (err == 0 && sb.Length > 0) {
                    string s = sb.ToString();
                    string[] parts = s.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var p in parts) {
                        string trimmed = p.Trim();
                        if (!string.IsNullOrEmpty(trimmed)) {
                            return trimmed;
                        }
                    }
                }
            } catch { }
            return null;
        }

        public static bool ReadAllAnalogInputs(string devName, double[] outArray) {
            if (string.IsNullOrEmpty(devName)) return false;
            IntPtr task = IntPtr.Zero;
            try {
                int err = CreateTask("", out task);
                if (err != 0) return false;
                // TerminalConfig: -1 (default RSE no NI USB-6009)
                err = CreateAIVoltageChan(task, devName + "/ai0:7", "", -1, 0.0, 5.0, 10348, null);
                if (err != 0) { ClearTask(task); return false; }
                int read = 0;
                err = ReadAnalogF64(task, 1, 0.15, 0, outArray, 8, out read, IntPtr.Zero);
                ClearTask(task);
                return (err == 0 && read > 0);
            } catch {
                if (task != IntPtr.Zero) ClearTask(task);
            }
            return false;
        }

        public static double ReadAnalogInput(string channelName) {
            if (string.IsNullOrEmpty(channelName)) return 0.0;
            IntPtr task = IntPtr.Zero;
            try {
                int err = CreateTask("", out task);
                if (err != 0) return 0.0;
                err = CreateAIVoltageChan(task, channelName, "", -1, 0.0, 5.0, 10348, null);
                if (err != 0) { ClearTask(task); return 0.0; }
                double[] data = new double[1];
                int read = 0;
                err = ReadAnalogF64(task, 1, 0.15, 0, data, 1, out read, IntPtr.Zero);
                ClearTask(task);
                if (err == 0 && read > 0) return data[0];
            } catch {
                if (task != IntPtr.Zero) ClearTask(task);
            }
            return 0.0;
        }

        public static bool WriteAnalogOutput(string devName, int channel, double voltage) {
            if (string.IsNullOrEmpty(devName)) return false;
            IntPtr task = IntPtr.Zero;
            try {
                string chanName = string.Format("{0}/ao{1}", devName, channel & 1);
                voltage = Math.Max(0.0, Math.Min(5.0, voltage));
                int err = CreateTask("", out task);
                if (err != 0) return false;
                err = CreateAOVoltageChan(task, chanName, "", 0.0, 5.0, 10348, null);
                if (err != 0) { ClearTask(task); return false; }
                double[] data = new double[] { voltage };
                int written = 0;
                err = WriteAnalogF64(task, 1, 1, 0.15, 0, data, out written, IntPtr.Zero);
                ClearTask(task);
                return (err == 0);
            } catch {
                if (task != IntPtr.Zero) ClearTask(task);
            }
            return false;
        }
    }

    class Program {
        [DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        const int SW_HIDE = 0;
        const int SW_SHOW = 5;
        const int SW_SHOWNOACTIVATE = 4;

        static string deviceName = null;
        static double[] aiChannels = new double[8];
        static double[] aoChannels = new double[2];
        static volatile bool running = true;
        static volatile bool isDeviceConnected = false;
        static HttpListener listener;

        static void Main(string[] args) {
            Console.Title = "RosiView - NI USB-6009 Native Bridge (NI-DAQmx)";

            bool startHidden = false;
            foreach (var arg in args) {
                if (arg.Equals("--background", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("-background", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("-b", StringComparison.OrdinalIgnoreCase)) {
                    startHidden = true;
                    break;
                }
            }

            if (startHidden) {
                IntPtr hWnd = GetConsoleWindow();
                if (hWnd != IntPtr.Zero) ShowWindow(hWnd, SW_HIDE);
            }

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==================================================================");
            Console.WriteLine("   ROSIVIEW - SERVIDOR BRIDGE NATIVO NI USB-6009 (NI-DAQmx)       ");
            Console.WriteLine("   IFES • Engenharia de Controle e Automacao                     ");
            Console.WriteLine("==================================================================");
            Console.ResetColor();

            deviceName = NIDriver.DetectDeviceName();
            if (!string.IsNullOrEmpty(deviceName)) {
                Console.Write("[1/2] Verificando placa NI USB-6009 ({0})... ", deviceName);
                bool readOk = NIDriver.ReadAllAnalogInputs(deviceName, aiChannels);
                if (!readOk) {
                    aiChannels[0] = NIDriver.ReadAnalogInput(deviceName + "/ai0");
                    readOk = (aiChannels[0] != 0.0);
                }
                if (readOk) {
                    isDeviceConnected = true;
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("CONECTADA!");
                    Console.ResetColor();
                    Console.WriteLine("      Sensor AI0: {0:F3} V | Sensor AI1: {1:F3} V", aiChannels[0], aiChannels[1]);
                } else {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("DISPOSITIVO DETECTADO (Aguardando leitura)");
                    Console.ResetColor();
                }
            } else {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[1/2] Nenhuma placa NI USB detectada no momento (aguardando conexao)...");
                Console.ResetColor();
            }

            Thread daqThread = new Thread(DaqSamplingLoop);
            daqThread.IsBackground = true;
            daqThread.Start();

            Console.Write("[2/2] Iniciando Servidor Bridge em http://127.0.0.1:8765/ ... ");
            try {
                listener = new HttpListener();
                listener.Prefixes.Add("http://localhost:8765/");
                listener.Prefixes.Add("http://127.0.0.1:8765/");
                listener.Start();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("ONLINE!");
                Console.ResetColor();
            } catch (Exception ex) {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("ERRO: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("Pressione qualquer tecla para sair...");
                Console.ReadKey();
                return;
            }

            Console.WriteLine("\n--> Enquanto a planta estiver conectada, nao feche esta janela.");
            Console.WriteLine("--> O RosiView sincroniza leituras e comandos em tempo real.");
            Console.WriteLine("==================================================================\n");

            Thread httpThread = new Thread(HttpServerLoop);
            httpThread.IsBackground = true;
            httpThread.Start();

            while (running) {
                if (isDeviceConnected) {
                    Console.Write("\r[AO VIVO - CONECTADO] AI0 (Nivel): {0,5:F2} V | AI1: {1,5:F2} V | AO1 (Bomba): {2,5:F2} V | {3} ", 
                        aiChannels[0], aiChannels[1], aoChannels[1], DateTime.Now.ToString("HH:mm:ss.fff"));
                } else {
                    Console.Write("\r[DESCONECTADO] Aguardando conexao do cabo USB da placa NI USB-6009... ({0})   ", 
                        DateTime.Now.ToString("HH:mm:ss"));
                }
                Thread.Sleep(100);
            }
        }

        static void DaqSamplingLoop() {
            int failCount = 0;
            while (running) {
                try {
                    if (string.IsNullOrEmpty(deviceName)) {
                        deviceName = NIDriver.DetectDeviceName();
                    }

                    bool ok = false;
                    if (!string.IsNullOrEmpty(deviceName)) {
                        ok = NIDriver.ReadAllAnalogInputs(deviceName, aiChannels);
                        if (!ok) {
                            double singleVal = NIDriver.ReadAnalogInput(deviceName + "/ai0");
                            if (singleVal != 0.0) {
                                aiChannels[0] = singleVal;
                                ok = true;
                            }
                        }
                    }

                    if (ok) {
                        failCount = 0;
                        isDeviceConnected = true;
                    } else {
                        failCount++;
                        if (failCount >= 2) {
                            isDeviceConnected = false;
                            for (int i = 0; i < 8; i++) aiChannels[i] = 0.0;
                            if (failCount % 30 == 0) {
                                deviceName = NIDriver.DetectDeviceName();
                            }
                        }
                    }
                } catch {
                    isDeviceConnected = false;
                }
                Thread.Sleep(30);
            }
        }

        static void HttpServerLoop() {
            while (running) {
                try {
                    var context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((c) => ProcessRequest((HttpListenerContext)c), context);
                } catch {
                    if (!running) break;
                }
            }
        }

        static void ProcessRequest(HttpListenerContext context) {
            var req = context.Request;
            var res = context.Response;

            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS") {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            try {
                string path = req.Url.AbsolutePath.ToLower();
                
                if (path == "/show") {
                    IntPtr hWnd = GetConsoleWindow();
                    if (hWnd != IntPtr.Zero) ShowWindow(hWnd, SW_SHOWNOACTIVATE);
                    byte[] okBuf = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"window\":\"shown\"}");
                    res.ContentType = "application/json";
                    res.ContentLength64 = okBuf.Length;
                    res.OutputStream.Write(okBuf, 0, okBuf.Length);
                    res.Close();
                    return;
                }

                if (path == "/hide") {
                    IntPtr hWnd = GetConsoleWindow();
                    if (hWnd != IntPtr.Zero) ShowWindow(hWnd, SW_HIDE);
                    byte[] okBuf = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"window\":\"hidden\"}");
                    res.ContentType = "application/json";
                    res.ContentLength64 = okBuf.Length;
                    res.OutputStream.Write(okBuf, 0, okBuf.Length);
                    res.Close();
                    return;
                }

                if (path == "/write_ao") {
                    string chanStr = req.QueryString["channel"] ?? "1";
                    string valStr = req.QueryString["value"] ?? "0.0";
                    int ch = 1;
                    int.TryParse(chanStr, out ch);
                    double val = 0.0;
                    double.TryParse(valStr.Replace(',', '.'), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out val);
                    
                    aoChannels[ch & 1] = val;
                    if (isDeviceConnected && !string.IsNullOrEmpty(deviceName)) {
                        NIDriver.WriteAnalogOutput(deviceName, ch & 1, val);
                    }

                    byte[] outBuf = Encoding.UTF8.GetBytes(string.Format("{{\"status\":\"ok\",\"device\":\"{0}\",\"channel\":{1},\"value\":{2}}}", deviceName ?? "", ch, val));
                    res.ContentType = "application/json";
                    res.ContentLength64 = outBuf.Length;
                    res.OutputStream.Write(outBuf, 0, outBuf.Length);
                    res.Close();
                    return;
                }

                string devStr = (isDeviceConnected && !string.IsNullOrEmpty(deviceName)) ? ("\"" + deviceName + "\"") : "null";
                string json = string.Format(System.Globalization.CultureInfo.InvariantCulture,
                    "{{\"connected\":{0},\"device\":{1},\"ai\":[{2:F4},{3:F4},{4:F4},{5:F4},{6:F4},{7:F4},{8:F4},{9:F4}],\"ao\":[{10:F4},{11:F4}]}}",
                    isDeviceConnected ? "true" : "false",
                    devStr,
                    aiChannels[0], aiChannels[1], aiChannels[2], aiChannels[3], aiChannels[4], aiChannels[5], aiChannels[6], aiChannels[7],
                    aoChannels[0], aoChannels[1]);

                byte[] buf = Encoding.UTF8.GetBytes(json);
                res.ContentType = "application/json";
                res.ContentLength64 = buf.Length;
                res.OutputStream.Write(buf, 0, buf.Length);
                res.Close();
            } catch {
                try { res.Close(); } catch { }
            }
        }
    }
}
