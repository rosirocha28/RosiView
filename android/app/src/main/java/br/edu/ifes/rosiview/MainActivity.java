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

import android.content.ContentValues;
import android.database.Cursor;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.ValueCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "RosiViewApp";
    private static final int REQUEST_FILE_CHOOSER = 2001;
    private static final int REQUEST_OPEN_PROJECT = 2002;
    private static final int REQUEST_SAVE_PROJECT = 2003;

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private String pendingSaveContent = null;
    private String pendingSaveFileName = null;

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

        // WebChromeClient com suporte a depuração e seleção de arquivos nativos
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[JS] " + consoleMessage.message() + " (Line "
                        + consoleMessage.lineNumber() + ")");
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
                fileUploadCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Selecionar Projeto RosiView (*.rosi)"), REQUEST_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Erro no onShowFileChooser: " + e.getMessage());
                    if (fileUploadCallback != null) {
                        fileUploadCallback.onReceiveValue(null);
                        fileUploadCallback = null;
                    }
                    return false;
                }
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

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        } else if (requestCode == REQUEST_OPEN_PROJECT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                handleProjectFileUri(data.getData());
            }
        } else if (requestCode == REQUEST_SAVE_PROJECT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                handleSaveProjectUri(data.getData());
            } else {
                pendingSaveContent = null;
                pendingSaveFileName = null;
            }
        }
    }

    private void handleSaveProjectUri(Uri uri) {
        try {
            if (pendingSaveContent == null) return;
            try (OutputStream os = getContentResolver().openOutputStream(uri, "wt")) {
                if (os != null) {
                    os.write(pendingSaveContent.getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }
            }
            final String savedName = pendingSaveFileName != null ? pendingSaveFileName : "projeto.rosi";
            runOnUiThread(() -> {
                Toast.makeText(this, "💾 Projeto '" + savedName + "' salvo com sucesso!", Toast.LENGTH_SHORT).show();
            });
        } catch (Exception e) {
            Log.e(TAG, "Erro ao salvar via SAF: " + e.getMessage(), e);
            runOnUiThread(() -> {
                Toast.makeText(this, "Falha ao salvar arquivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
            });
        } finally {
            pendingSaveContent = null;
            pendingSaveFileName = null;
        }
    }

    private void handleProjectFileUri(Uri uri) {
        try {
            String fileName = "projeto.rosi";
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex >= 0) {
                        String name = cursor.getString(nameIndex);
                        if (name != null && !name.isEmpty()) {
                            fileName = name;
                        }
                    }
                }
            } catch (Exception ignored) {}

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) {
                    throw new Exception("Não foi possível acessar o arquivo selecionado.");
                }
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    baos.write(buffer, 0, read);
                }
            }
            final String jsonContent = baos.toString("UTF-8");
            final String finalFileName = fileName;

            webView.post(() -> {
                String js = "if (window.loadProjectFromAndroid) { window.loadProjectFromAndroid(" 
                            + org.json.JSONObject.quote(jsonContent) + ", " 
                            + org.json.JSONObject.quote(finalFileName) + "); }";
                webView.evaluateJavascript(js, null);
            });

        } catch (Exception e) {
            Log.e(TAG, "Erro ao abrir projeto: " + e.getMessage(), e);
            Toast.makeText(this, "Falha ao abrir arquivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    public void showProjectSavedDialog(String fileName, File fileToShare) {
        new AlertDialog.Builder(this)
            .setTitle("💾 Projeto Salvo!")
            .setMessage("O arquivo '" + fileName + "' foi salvo com sucesso na pasta Downloads do seu dispositivo.\n\nDeseja compartilhar este projeto?")
            .setPositiveButton("Compartilhar", (dialog, which) -> shareProjectFile(fileName, fileToShare))
            .setNegativeButton("OK", null)
            .show();
    }

    public void shareProjectFile(String fileName, File file) {
        try {
            if (file == null || !file.exists()) return;
            Uri fileUri = androidx.core.content.FileProvider.getUriForFile(
                this,
                getPackageName() + ".provider",
                file
            );
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("application/json");
            sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, "Projeto RosiView: " + fileName);
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(sendIntent, "Compartilhar Projeto RosiView"));
        } catch (Exception e) {
            Log.e(TAG, "Erro ao compartilhar arquivo: " + e.getMessage());
            Toast.makeText(this, "Não foi possível compartilhar: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Ponte de comunicação Javascript <-> Android
     */
    public static class RosiViewNativeBridge {
        private final MainActivity activity;
        private final Context context;

        public RosiViewNativeBridge(MainActivity activity) {
            this.activity = activity;
            this.context = activity;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "Android";
        }

        @JavascriptInterface
        public String getVersion() {
            return "0.4.0";
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

        @JavascriptInterface
        public void openProjectFile() {
            activity.runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    activity.startActivityForResult(Intent.createChooser(intent, "Abrir Projeto RosiView (*.rosi)"), REQUEST_OPEN_PROJECT);
                } catch (Exception e) {
                    Toast.makeText(activity, "Erro ao abrir seletor: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void launchSaveProjectPicker(final String fileName, final String jsonContent) {
            activity.runOnUiThread(() -> {
                try {
                    activity.pendingSaveContent = jsonContent;
                    activity.pendingSaveFileName = (fileName != null && !fileName.isEmpty()) ? fileName : "projeto.rosi";
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, activity.pendingSaveFileName);
                    activity.startActivityForResult(intent, REQUEST_SAVE_PROJECT);
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao abrir seletor SAF de salvamento: " + e.getMessage());
                    saveProjectFile(fileName, jsonContent);
                }
            });
        }

        @JavascriptInterface
        public void saveProjectFile(final String fileName, final String jsonContent) {
            if (fileName == null || jsonContent == null) return;

            new Thread(() -> {
                try {
                    boolean saved = false;
                    File savedFile = null;

                    // 1. Android 10+ (API 29+): Salva via MediaStore na pasta Downloads pública (sem exigir permissão de storage)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/RosiView");

                        Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream os = activity.getContentResolver().openOutputStream(uri)) {
                                if (os != null) {
                                    os.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                                    os.flush();
                                    saved = true;
                                }
                            }
                        }
                    }

                    // 2. Fallback para Android 9 ou se MediaStore falhar: pasta Downloads pública direta
                    if (!saved) {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        File rosiDir = new File(downloadsDir, "RosiView");
                        if (!rosiDir.exists()) rosiDir.mkdirs();
                        File file = new File(rosiDir, fileName);
                        try (FileOutputStream fos = new FileOutputStream(file)) {
                            fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                            fos.flush();
                            saved = true;
                            savedFile = file;
                        }
                    }

                    // 3. Salva também cópia nos arquivos locais do app para compartilhamento imediato via FileProvider
                    File backupDir = new File(activity.getCacheDir(), "projects");
                    if (!backupDir.exists()) backupDir.mkdirs();
                    File shareableFile = new File(backupDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(shareableFile)) {
                        fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }

                    final File fileToShare = shareableFile;
                    activity.runOnUiThread(() -> {
                        activity.showProjectSavedDialog(fileName, fileToShare);
                    });

                } catch (Exception e) {
                    Log.e(TAG, "Erro ao salvar projeto: " + e.getMessage(), e);
                    activity.runOnUiThread(() -> {
                        Toast.makeText(activity, "Erro ao salvar projeto: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    });
                }
            }).start();
        }
    }
}
