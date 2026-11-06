#![windows_subsystem = "windows"]
use std::fs;
use std::io::Read;
use std::thread;
use tiny_http::{Header, Response, Server};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

fn main() {
    let exe = std::env::current_exe().unwrap_or_default();
    let root = exe.parent().unwrap_or(std::path::Path::new(".")).join("out");
    let server = match Server::http("127.0.0.1:0") {
        Ok(s) => s,
        Err(_) => return,
    };
    let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
    thread::spawn(move || {
        for req in server.incoming_requests() {
            let url = req.url().split('?').next().unwrap_or("/");
            let mut path = if url == "/" { root.join("index.html") } else { root.join(url.trim_start_matches('/')) };
            if path.is_dir() { path = path.join("index.html"); }
            if !path.exists() && path.extension().is_none() { path.set_extension("html"); }
            let (status, body) = if let Ok(mut f) = fs::File::open(&path) {
                let mut buf = Vec::new();
                if f.read_to_end(&mut buf).is_ok() { (200, buf) } else { (500, b"Read error".to_vec()) }
            } else if path.file_name().and_then(|n| n.to_str()) == Some("index.html") {
                (404, b"<h1>Missing out/index.html</h1><p>Build with: pnpm build</p>".to_vec())
            } else {
                let fallback = root.join("index.html");
                if let Ok(mut f) = fs::File::open(&fallback) {
                    let mut buf = Vec::new();
                    let _ = f.read_to_end(&mut buf);
                    (200, buf)
                } else {
                    (404, b"Not found".to_vec())
                }
            };
            let ct = match path.extension().and_then(|e| e.to_str()) {
                Some("html") => "text/html; charset=utf-8",
                Some("js") => "application/javascript",
                Some("css") => "text/css",
                Some("json") => "application/json",
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("svg") => "image/svg+xml",
                Some("ico") => "image/x-icon",
                Some("woff2") => "font/woff2",
                _ => "application/octet-stream",
            };
            let resp = Response::from_data(body)
                .with_status_code(status)
                .with_header(Header::from_bytes("Content-Type", ct).unwrap());
            let _ = req.respond(resp);
        }
    });

    let event_loop = EventLoop::new();
    let window = match WindowBuilder::new()
        .with_title("ArgTrail")
        .with_inner_size(tao::dpi::LogicalSize::new(1200.0, 800.0))
        .build(&event_loop) {
        Ok(w) => w,
        Err(_) => return,
    };
    let _webview = match WebViewBuilder::new()
        .with_url(format!("http://127.0.0.1:{}/", port))
        .with_initialization_script("document.addEventListener('contextmenu', e => e.preventDefault());")
        .build(&window) {
        Ok(w) => w,
        Err(_) => return,
    };
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent { event: WindowEvent::CloseRequested, .. } = event {
            *control_flow = ControlFlow::Exit;
        }
    });
}
