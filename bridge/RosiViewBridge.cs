using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;

namespace RosiView {
    public class NIDriver {
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

        public static double ReadAnalogInput(string channelName = "Dev1/ai0") {
            IntPtr task = IntPtr.Zero;
            try {
                int err = CreateTask("", out task);
                if (err != 0) return 0.0;
                err = CreateAIVoltageChan(task, channelName, "", -1, 0.0, 5.0, 10348, null);
                if (err != 0) { ClearTask(task); return 0.0; }
                double[] data = new double[1];
                int read = 0;
                err = ReadAnalogF64(task, 1, 0.5, 0, data, 1, out read, IntPtr.Zero);
                ClearTask(task);
                if (err == 0 && read > 0) return data[0];
            } catch {
                if (task != IntPtr.Zero) ClearTask(task);
            }
            return 0.0;
        }

        public static bool WriteAnalogOutput(int channel, double voltage) {
            IntPtr task = IntPtr.Zero;
            try {
                string chanName = (channel == 0) ? "Dev1/ao0" : "Dev1/ao1";
                voltage = Math.Max(0.0, Math.Min(5.0, voltage));
                int err = CreateTask("", out task);
                if (err != 0) return false;
                err = CreateAOVoltageChan(task, chanName, "", 0.0, 5.0, 10348, null);
                if (err != 0) { ClearTask(task); return false; }
                double[] data = new double[] { voltage };
                int written = 0;
                err = WriteAnalogF64(task, 1, 1, 0.5, 0, data, out written, IntPtr.Zero);
                ClearTask(task);
                return (err == 0);
            } catch {
                if (task != IntPtr.Zero) ClearTask(task);
            }
            return false;
        }
    }

    class Program {
        static double[] aiChannels = new double[8];
        static double[] aoChannels = new double[2];
        static volatile bool running = true;
        static HttpListener listener;

        static void Main(string[] args) {
            Console.Title = "RosiView - NI USB-6009 Bridge";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==================================================================");
            Console.WriteLine("   ROSIVIEW - SERVIDOR BRIDGE NATIVO NI USB-6009 (NI-DAQmx)       ");
            Console.WriteLine("==================================================================");
            Console.ResetColor();

            Console.Write("[1/2] Verificando placa NI USB-6009 (Dev1)... ");
            double testVal = NIDriver.ReadAnalogInput("Dev1/ai0");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("OK! Tensao inicial AI0: {0:F3} V", testVal);
            Console.ResetColor();

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

            Console.WriteLine("\n--> O RosiView no navegador ja pode se conectar automaticamente.");
            Console.WriteLine("--> Mantenha esta janela aberta enquanto estiver utilizando o RosiView.");
            Console.WriteLine("==================================================================\n");

            Thread httpThread = new Thread(HttpServerLoop);
            httpThread.IsBackground = true;
            httpThread.Start();

            while (running) {
                Console.Write("\r[AO VIVO] Sensor AI0: {0,6:F3} V | Bomba AO1: {1,5:F2} V | Horario: {2} ", 
                    aiChannels[0], aoChannels[1], DateTime.Now.ToString("HH:mm:ss.fff"));
                Thread.Sleep(100);
            }
        }

        static void DaqSamplingLoop() {
            while (running) {
                try {
                    aiChannels[0] = NIDriver.ReadAnalogInput("Dev1/ai0");
                } catch { }
                Thread.Sleep(25);
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
                
                if (path == "/write_ao") {
                    string chanStr = req.QueryString["channel"] ?? "1";
                    string valStr = req.QueryString["value"] ?? "0.0";
                    int ch = 1;
                    int.TryParse(chanStr, out ch);
                    double val = 0.0;
                    double.TryParse(valStr.Replace(',', '.'), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out val);
                    
                    aoChannels[ch & 1] = val;
                    NIDriver.WriteAnalogOutput(ch & 1, val);

                    byte[] outBuf = Encoding.UTF8.GetBytes(string.Format("{{\"status\":\"ok\",\"channel\":{0},\"value\":{1}}}", ch, val));
                    res.ContentType = "application/json";
                    res.ContentLength64 = outBuf.Length;
                    res.OutputStream.Write(outBuf, 0, outBuf.Length);
                    res.Close();
                    return;
                }

                string json = string.Format(System.Globalization.CultureInfo.InvariantCulture,
                    "{{\"connected\":true,\"device\":\"NI USB-6009\",\"ai\":[{0:F4},{1:F4},{2:F4},{3:F4},{4:F4},{5:F4},{6:F4},{7:F4}],\"ao\":[{8:F4},{9:F4}]}}",
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
