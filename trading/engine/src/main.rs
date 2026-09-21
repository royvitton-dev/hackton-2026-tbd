use axum::{
    Json, Router,
    extract::{
        DefaultBodyLimit, Path, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::Response,
    routing::{get, post},
};
use crossbeam_channel::{Sender, TrySendError};
use leave_exchange::{model::*, storage::Store};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::sync::{RwLock, broadcast, oneshot, watch};
use tower_http::{
    cors::CorsLayer,
    timeout::{RequestBodyTimeoutLayer, TimeoutLayer},
};

const QUEUE_CAPACITY: usize = 2048;
const EVENT_CAPACITY: usize = 32;
type ApiError = (StatusCode, Json<Value>);
type Reply<T> = oneshot::Sender<Result<T, String>>;

enum Work {
    Command(Command, Reply<CommandResult>),
    Snapshot(Reply<MarketSnapshot>),
    Lookup(String, String, Reply<Option<CommandResult>>),
    Checkpoint(Reply<()>),
    Shutdown(Reply<()>),
}

#[derive(Clone)]
struct App {
    writer: Sender<Work>,
    events: broadcast::Sender<Arc<MarketSnapshot>>,
    bots: Arc<RwLock<BTreeMap<String, BotStatus>>>,
    origins: Arc<Vec<String>>,
    shutdown: watch::Sender<bool>,
    local_admin: bool,
}

#[derive(Clone, Serialize)]
struct BotStatus {
    bot_id: String,
    account_id: String,
    strategy: String,
    seed: u64,
    connected: bool,
    last_heartbeat_ms: u64,
    orders_sent: u64,
    trades_count: u64,
    orders_accepted: u64,
    last_error: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CommandBody {
    request_id: String,
    action: Action,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Heartbeat {
    strategy: String,
    seed: u64,
    orders_sent: u64,
    #[serde(default)]
    last_error: Option<String>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"status":"error","code":code,"message":message.into(),"durable":false})),
    )
}

fn check_origin(app: &App, headers: &HeaderMap) -> Result<(), ApiError> {
    if let Some(origin) = headers.get("origin") {
        let origin = origin
            .to_str()
            .map_err(|_| error(StatusCode::FORBIDDEN, "ORIGIN_DENIED", "Invalid origin"))?;
        if !app.origins.iter().any(|allowed| allowed == origin) {
            return Err(error(
                StatusCode::FORBIDDEN,
                "ORIGIN_DENIED",
                "Origin is not allowed",
            ));
        }
    }
    Ok(())
}

fn session(headers: &HeaderMap) -> Result<String, ApiError> {
    let token = headers
        .get("x-session-token")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| {
            error(
                StatusCode::UNAUTHORIZED,
                "SESSION_REQUIRED",
                "Choose a local mock session",
            )
        })?;
    for kind in ["user", "bot"] {
        let limit = if kind == "user" { 3 } else { 12 };
        for index in 1..=limit {
            let account = format!("{kind}-{index:02}");
            if token == format!("demo-{account}") {
                return Ok(account);
            }
        }
    }
    Err(error(
        StatusCode::UNAUTHORIZED,
        "SESSION_INVALID",
        "Unknown local mock session",
    ))
}

fn enqueue(app: &App, work: Work) -> Result<(), ApiError> {
    app.writer.try_send(work).map_err(|err| match err {
        TrySendError::Full(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "QUEUE_FULL",
            "Not admitted; retry the same request ID",
        ),
        TrySendError::Disconnected(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "ENGINE_STOPPED",
            "Engine writer is unavailable",
        ),
    })
}

async fn receive<T>(receiver: oneshot::Receiver<Result<T, String>>) -> Result<T, ApiError> {
    match tokio::time::timeout(Duration::from_secs(15), receiver).await {
        Ok(Ok(Ok(result))) => Ok(result),
        Ok(Ok(Err(message))) => Err(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DURABILITY_FAILED",
            message,
        )),
        Ok(Err(_)) | Err(_) => Err(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "OUTCOME_UNKNOWN",
            "Enqueued result is unknown; query or retry the SAME request ID",
        )),
    }
}

async fn snapshot(app: &App) -> Result<MarketSnapshot, ApiError> {
    let (tx, rx) = oneshot::channel();
    enqueue(app, Work::Snapshot(tx))?;
    receive(rx).await
}

async fn health(State(app): State<App>) -> Result<Json<Value>, ApiError> {
    let market = snapshot(&app).await?;
    Ok(Json(
        json!({"status":market.engine_status,"command_seq":market.command_seq,"event_seq":market.event_seq,
        "queue_depth":app.writer.len(),"queue_capacity":QUEUE_CAPACITY,"mode":"synthetic-demo","durability":"journal-sync-all-before-apply"}),
    ))
}

async fn state(State(app): State<App>) -> Result<Json<MarketSnapshot>, ApiError> {
    snapshot(&app).await.map(Json)
}

async fn sessions(State(app): State<App>) -> Result<Json<Value>, ApiError> {
    let market = snapshot(&app).await?;
    Ok(Json(Value::Array(market.accounts.iter().filter(|a|a.kind == "user").map(|a|json!({
        "account_id":a.id,"token":format!("demo-{}",a.id),"name":a.name,"company":a.company,"kind":a.kind
    })).collect())))
}

async fn command(
    State(app): State<App>,
    headers: HeaderMap,
    payload: Result<Json<CommandBody>, axum::extract::rejection::JsonRejection>,
) -> Result<Json<CommandResult>, ApiError> {
    check_origin(&app, &headers)?;
    let account_id = session(&headers)?;
    let Json(body) = payload
        .map_err(|rejection| error(rejection.status(), "INVALID_BODY", rejection.body_text()))?;
    if body.request_id.is_empty()
        || body.request_id.len() > 128
        || !body
            .request_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
    {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "INVALID_REQUEST_ID",
            "Use 1–128 ASCII letters, numbers, -, _, ., or :",
        ));
    }
    let (tx, rx) = oneshot::channel();
    enqueue(
        &app,
        Work::Command(
            Command {
                account_id,
                request_id: body.request_id,
                action: body.action,
                timestamp_ms: now_ms(),
            },
            tx,
        ),
    )?;
    receive(rx).await.map(Json)
}

async fn lookup(
    State(app): State<App>,
    headers: HeaderMap,
    Path(request_id): Path<String>,
) -> Result<Json<CommandResult>, ApiError> {
    let account_id = session(&headers)?;
    let (tx, rx) = oneshot::channel();
    enqueue(&app, Work::Lookup(account_id, request_id, tx))?;
    receive(rx).await?.map(Json).ok_or_else(|| {
        error(
            StatusCode::NOT_FOUND,
            "REQUEST_NOT_FOUND",
            "No durable result recorded; safely retry the same request ID",
        )
    })
}

async fn checkpoint(State(app): State<App>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
    check_origin(&app, &headers)?;
    if !app.local_admin {
        return Err(error(
            StatusCode::FORBIDDEN,
            "LOCAL_ADMIN_ONLY",
            "Admin actions are only enabled for a loopback-bound engine",
        ));
    }
    if !session(&headers)?.starts_with("user-") {
        return Err(error(
            StatusCode::FORBIDDEN,
            "MANUAL_SESSION_REQUIRED",
            "Use a manual demo session",
        ));
    }
    let (tx, rx) = oneshot::channel();
    enqueue(&app, Work::Checkpoint(tx))?;
    receive(rx).await?;
    Ok(Json(json!({"status":"checkpoint_saved","durable":true})))
}

async fn shutdown(State(app): State<App>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
    check_origin(&app, &headers)?;
    if !app.local_admin || !session(&headers)?.starts_with("user-") {
        return Err(error(
            StatusCode::FORBIDDEN,
            "LOCAL_ADMIN_ONLY",
            "Use a manual session on a loopback-bound engine",
        ));
    }
    let _ = app.shutdown.send(true);
    Ok(Json(json!({"status":"shutting_down"})))
}

async fn bots(State(app): State<App>) -> Result<Json<Vec<BotStatus>>, ApiError> {
    let market = snapshot(&app).await?;
    let mut items: Vec<_> = app.bots.read().await.values().cloned().collect();
    for item in &mut items {
        item.connected =
            item.last_heartbeat_ms > 0 && now_ms().saturating_sub(item.last_heartbeat_ms) < 15_000;
        if let Some(account) = market.accounts.iter().find(|a| a.id == item.account_id) {
            item.orders_accepted = account.orders_count;
            item.trades_count = account.trades_count;
        }
    }
    Ok(Json(items))
}

async fn heartbeat(
    State(app): State<App>,
    headers: HeaderMap,
    Path(bot_id): Path<String>,
    payload: Result<Json<Heartbeat>, axum::extract::rejection::JsonRejection>,
) -> Result<Json<Value>, ApiError> {
    check_origin(&app, &headers)?;
    let Json(body) = payload
        .map_err(|rejection| error(rejection.status(), "INVALID_BODY", rejection.body_text()))?;
    if session(&headers)? != bot_id || !bot_id.starts_with("bot-") {
        return Err(error(
            StatusCode::FORBIDDEN,
            "BOT_SESSION_MISMATCH",
            "Bot can update only its own heartbeat",
        ));
    }
    let mut items = app.bots.write().await;
    let item = items
        .get_mut(&bot_id)
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "BOT_NOT_FOUND", "Unknown bot"))?;
    if body.strategy != item.strategy
        || body.seed != item.seed
        || body.last_error.as_ref().is_some_and(|e| e.len() > 512)
    {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "INVALID_HEARTBEAT",
            "Strategy, seed or error length is invalid",
        ));
    }
    item.last_heartbeat_ms = now_ms();
    item.connected = true;
    item.orders_sent = body.orders_sent;
    item.last_error = body.last_error;
    Ok(Json(json!({"status":"ok"})))
}

async fn websocket(
    State(app): State<App>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    check_origin(&app, &headers)?;
    // Subscribe BEFORE writer snapshot: events racing the snapshot are deduplicated by sequence.
    let rx = app.events.subscribe();
    let shutdown = app.shutdown.subscribe();
    let initial = snapshot(&app).await?;
    Ok(ws
        .max_message_size(16_384)
        .on_upgrade(move |socket| stream(socket, rx, initial, shutdown)))
}

async fn send_state(socket: &mut WebSocket, market: &MarketSnapshot) -> bool {
    let Ok(payload) = serde_json::to_string(&json!({"type":"state","state":market})) else {
        return false;
    };
    matches!(
        tokio::time::timeout(
            Duration::from_secs(3),
            socket.send(Message::Text(payload.into()))
        )
        .await,
        Ok(Ok(()))
    )
}

async fn stream(
    mut socket: WebSocket,
    mut rx: broadcast::Receiver<Arc<MarketSnapshot>>,
    initial: MarketSnapshot,
    mut shutdown: watch::Receiver<bool>,
) {
    if *shutdown.borrow() {
        return;
    }
    let mut last_seq = initial.event_seq;
    if !send_state(&mut socket, &initial).await {
        return;
    }
    let mut ping = tokio::time::interval(Duration::from_secs(10));
    loop {
        if *shutdown.borrow() {
            break;
        }
        tokio::select! {
            _=shutdown.changed()=>break,
            event=rx.recv()=>match event {
                Ok(market)=>{if market.event_seq>last_seq || (market.event_seq==last_seq && market.engine_status!="ready") {last_seq=market.event_seq;if !send_state(&mut socket,&market).await{break;}}},
                // Lagged consumers reconnect and get a new authoritative snapshot.
                Err(_)=>{let _=tokio::time::timeout(Duration::from_secs(1),socket.send(Message::Close(None))).await;break;},
            },
            incoming=socket.recv()=>match incoming {Some(Ok(Message::Close(_)))|None|Some(Err(_))=>break,_=>{}},
            _=ping.tick()=>{if !matches!(tokio::time::timeout(Duration::from_secs(3),socket.send(Message::Ping(Vec::new().into()))).await,Ok(Ok(()))){break;}},
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let bind: SocketAddr = std::env::var("ENGINE_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8787".into())
        .parse()?;
    let origins:Vec<String>=std::env::var("ALLOWED_ORIGINS").unwrap_or_else(|_|"http://127.0.0.1:5175,http://localhost:5175,http://127.0.0.1:4175,http://localhost:4175".into())
        .split(',').map(str::trim).filter(|s|!s.is_empty()).map(String::from).collect();
    if !bind.ip().is_loopback()
        && (std::env::var("ALLOW_REMOTE_DEMO").as_deref() != Ok("true")
            || origins.iter().any(|o| !o.starts_with("https://")))
    {
        return Err(
            "Remote demo requires ALLOW_REMOTE_DEMO=true and explicit HTTPS ALLOWED_ORIGINS".into(),
        );
    }
    if origins.is_empty() || origins.iter().any(|o| o == "*") {
        return Err("Explicit ALLOWED_ORIGINS required".into());
    }
    let data = std::env::var("ENGINE_DATA_DIR").unwrap_or_else(|_| "../data/default".into());
    eprintln!(
        "{}",
        json!({"event":"recovering","timestamp_ms":now_ms(),"data_dir":data})
    );
    let mut store = Store::open(&data, Config::default())?;
    eprintln!(
        "{}",
        json!({"event":"recovery_complete","timestamp_ms":now_ms(),"report":store.recovery_report()})
    );
    store
        .core()
        .check_invariants()
        .map_err(|e| format!("Startup invariant failure: {e}"))?;
    let (writer, receiver) = crossbeam_channel::bounded(QUEUE_CAPACITY);
    let (events, _) = broadcast::channel::<Arc<MarketSnapshot>>(EVENT_CAPACITY);
    let event_sender = events.clone();
    let writer_thread=std::thread::Builder::new().name("durable-engine-writer".into()).spawn(move||{
        let mut last_checkpoint=std::time::Instant::now();
        while let Ok(work)=receiver.recv() {
            match work {
                Work::Command(command,reply)=>{
                    let previous=store.core().event_seq;
                    let result=store.process(command).map_err(|e|e.to_string());
                    if result.is_err() {eprintln!("{}",json!({"event":"durability_error","timestamp_ms":now_ms(),"error":result.as_ref().err()}));}
                    if (store.core().event_seq!=previous || result.is_err()) && event_sender.receiver_count()>0 {
                        let _=event_sender.send(Arc::new(store.snapshot()));
                    }
                    let _=reply.send(result);
                },
                Work::Snapshot(reply)=>{let _=reply.send(Ok(store.snapshot()));},
                Work::Lookup(account,request,reply)=>{
                    let found=store.lookup(&account,&request);
                    let result=if found.is_none() && store.is_failed(){Err("OUTCOME_UNKNOWN: restart required before resolving this request".into())}else{Ok(found)};
                    let _=reply.send(result);
                },
                Work::Checkpoint(reply)=>{let _=reply.send(store.checkpoint().map_err(|e|e.to_string()));},
                Work::Shutdown(reply)=>{let result=store.checkpoint().map_err(|e|e.to_string());let _=reply.send(result);break;},
            }
            if last_checkpoint.elapsed()>Duration::from_secs(1800) && !store.is_failed() {
                if let Err(err)=store.checkpoint(){eprintln!("{}",json!({"event":"checkpoint_error","error":err.to_string(),"timestamp_ms":now_ms()}));}
                last_checkpoint=std::time::Instant::now();
            }
        }
    })?;
    let mut bot_map = BTreeMap::new();
    for index in 1..=12 {
        let id = format!("bot-{index:02}");
        let strategy = match index {
            1..=4 => "market_maker",
            5..=8 => "liquidity_taker",
            _ => "trend_following",
        };
        bot_map.insert(
            id.clone(),
            BotStatus {
                bot_id: id.clone(),
                account_id: id,
                strategy: strategy.into(),
                seed: 2_026_092_200 + index,
                connected: false,
                last_heartbeat_ms: 0,
                orders_sent: 0,
                trades_count: 0,
                orders_accepted: 0,
                last_error: None,
            },
        );
    }
    let origin_headers: Vec<HeaderValue> = origins
        .iter()
        .map(|o| o.parse())
        .collect::<Result<_, _>>()?;
    let cors = CorsLayer::new()
        .allow_origin(origin_headers)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("x-session-token"),
        ]);
    let (shutdown_sender, mut shutdown_receiver) = watch::channel(false);
    let app_state = App {
        writer: writer.clone(),
        events,
        bots: Arc::new(RwLock::new(bot_map)),
        origins: Arc::new(origins),
        shutdown: shutdown_sender.clone(),
        local_admin: bind.ip().is_loopback(),
    };
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/state", get(state))
        .route("/api/sessions", get(sessions))
        .route("/api/commands", post(command))
        .route("/api/requests/{request_id}", get(lookup))
        .route("/api/bots", get(bots))
        .route("/api/bots/{bot_id}/heartbeat", post(heartbeat))
        .route("/api/admin/checkpoint", post(checkpoint))
        .route("/api/admin/shutdown", post(shutdown))
        .route("/ws", get(websocket))
        .layer(DefaultBodyLimit::max(16_384))
        .layer(RequestBodyTimeoutLayer::new(Duration::from_secs(5)))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(20),
        ))
        .layer(cors)
        .with_state(app_state);
    let listener = tokio::net::TcpListener::bind(bind).await?;
    eprintln!(
        "{}",
        json!({"event":"ready","timestamp_ms":now_ms(),"bind":bind.to_string(),"data_dir":data,"queue_capacity":QUEUE_CAPACITY})
    );
    let mut shutdown_observer = shutdown_sender.subscribe();
    let server=axum::serve(listener,app).with_graceful_shutdown(async move {
        tokio::select! { _=shutdown_signal()=>{let _=shutdown_sender.send(true);},_=shutdown_receiver.changed()=>{} }
    });
    use std::future::IntoFuture;
    let server = server.into_future();
    tokio::pin!(server);
    tokio::select! {
        result=&mut server=>{result?;},
        _=shutdown_observer.changed()=>{
            match tokio::time::timeout(Duration::from_secs(25),&mut server).await {
                Ok(result)=>result?,
                Err(_)=>eprintln!("{}",json!({"event":"http_drain_deadline","timestamp_ms":now_ms(),"message":"Closing network processing; writer will drain already admitted commands before checkpoint"})),
            }
        }
    }
    let (tx, rx) = oneshot::channel();
    writer.send(Work::Shutdown(tx))?;
    let checkpoint_result = receive(rx).await;
    writer_thread.join().map_err(|_| "Writer panicked")?;
    if let Err((status, Json(body))) = checkpoint_result {
        eprintln!(
            "{}",
            json!({"event":"shutdown_checkpoint_error","timestamp_ms":now_ms(),"http_status":status.as_u16(),"error":body})
        );
        return Err(format!("Shutdown checkpoint was not confirmed: {body}").into());
    }
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("Install SIGTERM listener");
        tokio::select! {_=tokio::signal::ctrl_c()=>{},_=terminate.recv()=>{}}
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
