package com.quranvocab.app;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private long backPressedTime = 0;
    private Toast exitToast;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark emerald green status bar matching Quran hero (#093928)
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#093928"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.setNavigationBarColor(Color.parseColor("#101e18"));
        }

        webView = new WebView(this);
        setContentView(webView);

        // Modern WebViewAssetLoader (official Google Jetpack library)
        // Serves local assets via https://appassets.androidplatform.net/assets/
        // enabling IndexedDB, CORS-free fetch, and offline storage.
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Custom WebViewClient routing requests through WebViewAssetLoader
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }
        });

        // WebChromeClient for console logging and JS dialogs
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });

        // Handle hardware Back button via modern OnBackPressedCallback
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Check if web app can handle the back action (e.g. closing modals or navigating screens)
                webView.evaluateJavascript(
                    "(function() { " +
                    "  if (window.app && typeof window.app.handleBackAction === 'function') { " +
                    "    var openModals = document.querySelectorAll('.modal-overlay[style*=\"display: flex\"], .modal-overlay[style*=\"display: block\"]'); " +
                    "    if (openModals.length > 0) { window.app.handleBackAction(); return true; } " +
                    "    if (window.app.currentScreen && window.app.currentScreen !== 'home') { window.app.handleBackAction(); return true; } " +
                    "  } " +
                    "  return false; " +
                    "})()",
                    value -> {
                        if ("true".equals(value)) {
                            // Handled by web app
                            return;
                        }

                        if (webView.canGoBack()) {
                            webView.goBack();
                            return;
                        }

                        // Double tap back to exit application
                        if (backPressedTime + 2000 > System.currentTimeMillis()) {
                            if (exitToast != null) exitToast.cancel();
                            finish();
                        } else {
                            exitToast = Toast.makeText(getBaseContext(), "প্রস্থান করতে পুনরায় ব্যাক বাটন চাপুন", Toast.LENGTH_SHORT);
                            exitToast.show();
                            backPressedTime = System.currentTimeMillis();
                        }
                    }
                );
            }
        });

        // Load the local Quran Vocab application
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
