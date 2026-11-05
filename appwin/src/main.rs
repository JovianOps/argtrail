#![windows_subsystem = "windows"]
use std::fs;
use std::io::Read;
use std::net::TcpListener;
use std::path::PathBuf;
use std::thread;
use tiny_http::{Header, Response, Server};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

fn main() {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(std::path::Path::new(".")).join("out");
    let server = Server::http("127.0.0.1:0").unwrap();
    let port = server.server_addr().to_ip().unwrap().port();
    thread::spawn(move || {
        for req in server.incoming_requests() {
            let url = req.url().split('?').next().unwrap_or("/");
            let mut path = if url == "/" { dir.join("index.html") } else { dir.join(url.trim_start_matches('/')) };
            if path.is_dir() { path = path.join("index.html"); }
            if !path.exists() && path.extension().is_none() { path.set_extension("html"); }
            if !path.exists() { path = dir.join("404.html"); if !path.exists() { path = dir.join("index.html"); } }
            let mut buf = Vec::new();
            let mut status = 200;
            if let Ok(mut f) = fs::File::open(&path) { let _ = f.read_to_end(&mut buf); } else { status = 404; buf = b"Not found".to_vec(); }
            let ct = match path.extension().and_then(|e| e.to_str()) {
                Some("html") => "text/html; charset=utf-8",
                Some("js") => "application/javascript",
                Some("css") => "text/css",
                Some("json") => "application/json",
                Some("png") => "image/png",
                Some("jpg")|Some("jpeg") => "image/jpeg",
                Some("svg") => "image/svg+xml",
                Some("ico") => "image/x-icon",
                Some("woff2") => "font/woff2",
                _ => "application/octet-stream",
            };
            let resp = Response::from_data(buf).with_status_code(status).with_header(Header::from_bytes("Content-Type", ct).unwrap());
            let _ = req.respond(resp);
        }
    });

    let event_loop = EventLoop::new();
    let window = WindowBuilder::new().with_title("ArgTrail").build(&event_loop).unwrap();
    let _webview = WebViewBuilder::new()
        .with_url(format!("http://127.0.0.1:{}/", port))
        .with_initialization_script("document.addEventListener('contextmenu', e => e.preventDefault());")
        .build(&window)
        .unwrap();
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent { event: WindowEvent::CloseRequested, .. } = event {
            *control_flow = ControlFlow::Exit;
        }
    });
}
