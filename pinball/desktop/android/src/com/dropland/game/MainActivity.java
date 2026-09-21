package com.dropland.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.webkit.*;
import java.io.*;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST="appassets.androidplatform.net";
    private static final String HOME="https://"+HOST+"/assets/index.html";
    private WebView web;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.rgb(249,245,233));getWindow().setNavigationBarColor(Color.rgb(249,245,233));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        web=new WebView(this);web.setBackgroundColor(Color.rgb(249,245,233));
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
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
                view.destroy();web=null;new AlertDialog.Builder(MainActivity.this).setTitle("게임 화면을 다시 열까요?").setMessage("그래픽 연결이 종료됐어요. 진행 중 경기는 복구할 수 없어요.").setPositiveButton("다시 열기",(d,w)->recreate()).setNegativeButton("종료",(d,w)->finish()).show();return true;
            }
        });
        // Keep page controls clear of Android status/navigation bars, including edge-to-edge devices.
        web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        setContentView(web);web.loadUrl(HOME);
    }
    private static boolean local(Uri url){return "https".equals(url.getScheme())&&HOST.equals(url.getHost());}
    private static String mime(String p){if(p.endsWith(".html"))return "text/html";if(p.endsWith(".js")||p.endsWith(".mjs"))return "text/javascript";if(p.endsWith(".css"))return "text/css";if(p.endsWith(".json"))return "application/json";if(p.endsWith(".svg"))return "image/svg+xml";if(p.endsWith(".png"))return "image/png";return "text/plain";}
    private static WebResourceResponse error(int status,String message){return new WebResourceResponse("text/plain","UTF-8",status,message,Collections.emptyMap(),new ByteArrayInputStream(message.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
    @Override protected void onPause(){if(web!=null){web.evaluateJavascript("document.dispatchEvent(new Event('visibilitychange')); if(window.pinball && ['mixing','countdown','racing'].includes(window.pinball.snapshot()?.state)) document.getElementById('pause').click();",null);web.onPause();web.pauseTimers();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.resumeTimers();web.onResume();}}
    @Override public void onBackPressed(){
        if(web==null){finish();return;}
        web.evaluateJavascript("(()=>{if(document.body.classList.contains('play-focus')){document.getElementById('focus-mode').click();return 'view';}const running=window.pinball&&['mixing','countdown','racing'].includes(window.pinball.snapshot()?.state);if(running)document.getElementById('pause').click();return running?'paused':'idle';})()",state->{
            if("\"view\"".equals(state))return;
            new AlertDialog.Builder(this).setTitle("놀이공원을 나갈까요?").setMessage("종료하면 현재 경기 기록이 사라져요.").setNegativeButton("계속하기",(d,w)->{if(web!=null&&"\"paused\"".equals(state))web.evaluateJavascript("if(window.pinball?.snapshot()?.state==='paused')document.getElementById('pause').click();",null);}).setPositiveButton("종료",(d,w)->finish()).show();
        });
    }
    @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
