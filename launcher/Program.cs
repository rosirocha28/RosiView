using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;

[assembly: AssemblyTitle("RosiView")]
[assembly: AssemblyDescription("RosiView - Instrumentação Virtual e Controle (IFES)")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("IFES")]
[assembly: AssemblyProduct("RosiView")]
[assembly: AssemblyCopyright("Copyright © IFES 2026")]
[assembly: AssemblyTrademark("RosiView")]
[assembly: AssemblyCulture("")]
[assembly: ComVisible(false)]
[assembly: AssemblyVersion("0.1.0.0")]
[assembly: AssemblyFileVersion("0.1.0.0")]

namespace RosiViewLauncher
{
    static class Program
    {
        [DllImport("shell32.dll", SetLastError = true)]
        private static extern void SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                // Registra ID do aplicativo no Windows para vinculação na barra de tarefas e menu iniciar
                SetCurrentProcessExplicitAppUserModelID("IFES.RosiView.App");

                string exeDir = AppDomain.CurrentDomain.BaseDirectory;
                string splashScript = Path.Combine(exeDir, "scripts", "splash.ps1");

                if (File.Exists(splashScript))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "powershell.exe";
                    psi.Arguments = "-STA -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + splashScript + "\"";
                    psi.WorkingDirectory = exeDir;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;

                    Process.Start(psi);
                }
                else
                {
                    string indexHtml = Path.Combine(exeDir, "index.html");
                    if (File.Exists(indexHtml))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo(indexHtml);
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                }
            }
            catch
            {
                try
                {
                    string indexHtml = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "index.html");
                    Process.Start(new ProcessStartInfo(indexHtml) { UseShellExecute = true });
                }
                catch { }
            }
        }
    }
}
