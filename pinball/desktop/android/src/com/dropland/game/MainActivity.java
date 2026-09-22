package com.dropland.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.WindowInsets;
import android.view.DisplayCutout;
import android.widget.FrameLayout;
import android.webkit.*;
import java.io.*;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST="appassets.androidplatform.net";
    private static final String HOME="https://"+HOST+"/assets/index.html";
    private WebView web;
    private FrameLayout viewport;
    private final Handler screenHandler=new Handler(Looper.getMainLooper());
    private boolean foreground=false;
    private int screenGeneration=0;
    private final Runnable screenCheck=new Runnable(){@Override public void run(){
        final WebView current=web;final int generation=screenGeneration;
        if(!foreground||current==null)return;
        // Read local game state without exposing a JavaScript/native bridge.
        current.evaluateJavascript("['mixing','countdown','racing'].includes(document.body.dataset.state)",value->{
            if(foreground&&web==current&&screenGeneration==generation)setScreenAwake("true".equals(value));
        });
        screenHandler.postDelayed(this,400);
    }};
    private void setScreenAwake(boolean keep){
        if(keep)getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    private void stopScreenCheck(){foreground=false;screenGeneration++;screenHandler.removeCallbacks(screenCheck);setScreenAwake(false);}
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        // Android 15+ enforces edge-to-edge. Reserve system space in a native
        // parent so CSS fixed elements and 100dvh use the unobscured WebView bounds.
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        viewport=new FrameLayout(this);viewport.setBackgroundColor(Color.rgb(249,245,233));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(249,245,233));
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !local(request.getUrl());}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri url=request.getUrl();String p=url.getPath();
                if(!local(url)||p==null||!p.startsWith("/assets/")||p.contains("..")||p.contains("\\"))return error(403,"Forbidden");
                String file=p.substring(8);if(file.isEmpty())file="index.html";
                try{return new WebResourceResponse(mime(file),"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),getAssets().open("game/"+file));}
                catch(IOException e){return error(404,"Not found");}
            }
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){
                stopScreenCheck();view.destroy();web=null;new AlertDialog.Builder(MainActivity.this).setTitle("게임 화면을 다시 열까요?").setMessage("그래픽 연결이 종료됐어요. 진행 중 경기는 복구할 수 없어요.").setPositiveButton("다시 열기",(d,w)->recreate()).setNegativeButton("종료",(d,w)->finish()).show();return true;
            }
        });
        viewport.addView(web,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        viewport.setOnApplyWindowInsetsListener((v,insets)->applySafeViewport(insets));
        setContentView(viewport);viewport.post(()->viewport.requestApplyInsets());web.loadUrl(HOME);
    }
    private WindowInsets applySafeViewport(WindowInsets insets){
        if(Build.VERSION.SDK_INT>=30){
            int bars=WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout();
            int handled=bars|WindowInsets.Type.ime();
            Insets safe=insets.getInsets(handled);
            viewport.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            // Zero handled types, but keep dispatching updates to WebView. Returning
            // unmodified insets can double-pad; consuming them can leave stale IME space.
            return new WindowInsets.Builder(insets).setInsets(handled,Insets.NONE)
                .setInsetsIgnoringVisibility(bars,Insets.NONE).setDisplayCutout(null).build();
        }
        int left=insets.getSystemWindowInsetLeft(),top=insets.getSystemWindowInsetTop();
        int right=insets.getSystemWindowInsetRight(),bottom=insets.getSystemWindowInsetBottom();
        if(Build.VERSION.SDK_INT>=28){
            DisplayCutout cutout=insets.getDisplayCutout();
            if(cutout!=null){left=Math.max(left,cutout.getSafeInsetLeft());top=Math.max(top,cutout.getSafeInsetTop());right=Math.max(right,cutout.getSafeInsetRight());bottom=Math.max(bottom,cutout.getSafeInsetBottom());}
        }
        viewport.setPadding(left,top,right,bottom);
        WindowInsets remaining=insets.replaceSystemWindowInsets(0,0,0,0);
        return Build.VERSION.SDK_INT>=28?remaining.consumeDisplayCutout():remaining;
    }
    @Override public void onConfigurationChanged(Configuration configuration){
        super.onConfigurationChanged(configuration);
        // Folding, rotation and density changes resize the existing game, never reload it.
        if(viewport!=null){viewport.requestLayout();viewport.requestApplyInsets();}
        if(web!=null)web.requestLayout();
    }
    private static boolean local(Uri url){return "https".equals(url.getScheme())&&HOST.equals(url.getHost());}
    private static String mime(String p){if(p.endsWith(".html"))return "text/html";if(p.endsWith(".js")||p.endsWith(".mjs"))return "text/javascript";if(p.endsWith(".css"))return "text/css";if(p.endsWith(".json"))return "application/json";if(p.endsWith(".svg"))return "image/svg+xml";if(p.endsWith(".png"))return "image/png";return "text/plain";}
    private static WebResourceResponse error(int status,String message){return new WebResourceResponse("text/plain","UTF-8",status,message,Collections.emptyMap(),new ByteArrayInputStream(message.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
    @Override protected void onPause(){stopScreenCheck();if(web!=null){web.evaluateJavascript("document.dispatchEvent(new Event('visibilitychange')); if(window.pinball && ['mixing','countdown','racing'].includes(window.pinball.snapshot()?.state)) document.getElementById('pause').click();",null);web.onPause();web.pauseTimers();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.resumeTimers();web.onResume();}foreground=true;screenGeneration++;screenHandler.removeCallbacks(screenCheck);screenHandler.post(screenCheck);}
    @Override public void onBackPressed(){
        if(web==null){finish();return;}
        web.evaluateJavascript("(()=>{if(document.body.classList.contains('play-focus')){document.getElementById('focus-mode').click();return 'view';}const running=window.pinball&&['mixing','countdown','racing'].includes(window.pinball.snapshot()?.state);if(running)document.getElementById('pause').click();return running?'paused':'idle';})()",state->{
            if("\"view\"".equals(state))return;
            new AlertDialog.Builder(this).setTitle("놀이공원을 나갈까요?").setMessage("종료하면 현재 경기 기록이 사라져요.").setNegativeButton("계속하기",(d,w)->{if(web!=null&&"\"paused\"".equals(state))web.evaluateJavascript("if(window.pinball?.snapshot()?.state==='paused')document.getElementById('pause').click();",null);}).setPositiveButton("종료",(d,w)->finish()).show();
        });
    }
    @Override protected void onDestroy(){stopScreenCheck();if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
