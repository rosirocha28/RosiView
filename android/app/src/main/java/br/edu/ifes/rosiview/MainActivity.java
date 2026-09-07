package br.edu.ifes.rosiview;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "RosiViewApp";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configuração de tela cheia imersiva permanente
        hideSystemUI();

        // Evita que a tela apague durante simulações e experimentos de controle
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Inicializa o WebView com aceleração de hardware e fundo escuro profissional
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0b0f19"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Log de depuração do JavaScript integrado ao Logcat
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[JS] " + consoleMessage.message() + " (Line "
                        + consoleMessage.lineNumber() + ")");
                return true;
            }
        });

        // Intercepta links externos (como GitHub ou links do manual) para abrir no navegador padrão
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    try {
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(browserIntent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Erro ao abrir link externo: " + e.getMessage());
                    }
                }
                return false;
            }
        });

        // Bridge Nativo para permitir que o JavaScript detecte e interaja com o Android
        webView.addJavascriptInterface(new RosiViewNativeBridge(this), "AndroidBridge");

        // Carrega a aplicação web incorporada
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this)
            .setTitle("RosiView")
            .setMessage("Deseja sair do aplicativo RosiView?")
            .setPositiveButton("Sair", (dialog, which) -> finish())
            .setNegativeButton("Continuar", null)
            .show();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    /**
     * Ponte de comunicação Javascript <-> Android
     */
    public static class RosiViewNativeBridge {
        private final Context context;

        public RosiViewNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "Android";
        }

        @JavascriptInterface
        public String getVersion() {
            return "0.3.0";
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }

        @JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void openManual() {
            try {
                // Tenta extrair o PDF dos assets para a pasta de cache se ainda não existir
                File docsDir = new File(context.getCacheDir(), "docs");
                if (!docsDir.exists()) {
                    docsDir.mkdirs();
                }
                File pdfFile = new File(docsDir, "Manual_RosiView_Aluno.pdf");

                if (!pdfFile.exists() || pdfFile.length() == 0) {
                    try (InputStream in = context.getAssets().open("www/docs/Manual_RosiView_Aluno.pdf");
                         FileOutputStream out = new FileOutputStream(pdfFile)) {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            out.write(buffer, 0, read);
                        }
                    }
                }

                if (pdfFile.exists() && pdfFile.length() > 0) {
                    Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".provider",
                        pdfFile
                    );

                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(contentUri, "application/pdf");
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    return;
                }
            } catch (Exception e) {
                Log.w(TAG, "Falha ao abrir PDF local via FileProvider: " + e.getMessage());
            }

            // Fallback online confiável via navegador padrão
            try {
                String onlineUrl = "https://github.com/rosirocha28/RosiView/raw/main/Manual_RosiView_Aluno.pdf";
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(onlineUrl));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(browserIntent);
            } catch (Exception err) {
                Log.e(TAG, "Erro ao tentar abrir manual online: " + err.getMessage());
            }
        }

        @JavascriptInterface
        public void downloadAndInstallUpdate(final String apkUrl) {
            if (apkUrl == null || apkUrl.trim().isEmpty()) {
                showToast("URL de atualização inválida.");
                return;
            }

            new Thread(() -> {
                try {
                    new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                        Toast.makeText(context, "Baixando atualização do RosiView...", Toast.LENGTH_LONG).show();
                    });

                    File apkDir = new File(context.getCacheDir(), "apk");
                    if (!apkDir.exists()) {
                        apkDir.mkdirs();
                    }
                    File apkFile = new File(apkDir, "RosiView_Update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }

                    // Baixa seguindo redirects (suporta redirecionamentos de GitHub releases)
                    String currentUrl = apkUrl;
                    InputStream in = null;
                    int maxRedirects = 6;
                    int redirectCount = 0;

                    while (redirectCount < maxRedirects) {
                        java.net.URL url = new java.net.URL(currentUrl);
                        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                        conn.setInstanceFollowRedirects(true);
                        conn.setConnectTimeout(20000);
                        conn.setReadTimeout(45000);
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; RosiViewUpdater)");
                        conn.connect();

                        int responseCode = conn.getResponseCode();
                        if (responseCode == java.net.HttpURLConnection.HTTP_MOVED_TEMP ||
                            responseCode == java.net.HttpURLConnection.HTTP_MOVED_PERM ||
                            responseCode == 307 || responseCode == 308) {
                            currentUrl = conn.getHeaderField("Location");
                            redirectCount++;
                            continue;
                        }

                        if (responseCode == java.net.HttpURLConnection.HTTP_OK) {
                            in = conn.getInputStream();
                            break;
                        } else {
                            throw new Exception("Servidor respondeu com código HTTP " + responseCode);
                        }
                    }

                    if (in == null) {
                        throw new Exception("Não foi possível estabelecer conexão para download.");
                    }

                    try (FileOutputStream out = new FileOutputStream(apkFile)) {
                        byte[] buffer = new byte[16384];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                        in.close();
                    }

                    if (apkFile.exists() && apkFile.length() > 50000) {
                        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                            try {
                                Toast.makeText(context, "Download concluído! Iniciando atualização...", Toast.LENGTH_SHORT).show();
                                Uri apkUri = androidx.core.content.FileProvider.getUriForFile(
                                    context,
                                    context.getPackageName() + ".provider",
                                    apkFile
                                );
                                Intent intent = new Intent(Intent.ACTION_VIEW);
                                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                context.startActivity(intent);
                            } catch (Exception e) {
                                Log.e(TAG, "Erro ao disparar instalador do APK: " + e.getMessage());
                                Toast.makeText(context, "Erro ao abrir instalador: " + e.getMessage(), Toast.LENGTH_LONG).show();
                            }
                        });
                    } else {
                        throw new Exception("Arquivo APK baixado parece incompleto.");
                    }

                } catch (final Exception err) {
                    Log.e(TAG, "Falha no download da atualização: " + err.getMessage(), err);
                    new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                        Toast.makeText(context, "Falha ao baixar atualização: " + err.getMessage(), Toast.LENGTH_LONG).show();
                    });
                }
            }).start();
        }
    }
}
