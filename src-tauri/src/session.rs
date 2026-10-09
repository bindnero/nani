use crate::detector;
use crate::error::{NaniError, NaniResult};
use crate::events::SessionEvent;
use crate::process::{build_args, exit_ok, LaunchOptions};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

/// Event channel the frontend listens on. Must match `SESSION_EVENT_NAME` in the
/// frontend bridge.
pub const SESSION_EVENT_NAME: &str = "nani://session-event";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionRequest {
    pub project_path: String,
    pub prompt: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub output_format: Option<String>,
    #[serde(default)]
    pub add_dirs: Option<Vec<String>>,
    #[serde(default)]
    pub permission_mode: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionResult {
    pub session_id: String,
    pub started_at: String,
    pub pid: Option<u32>,
}

/// Owns running sessions and their lifecycle. Only pid-based termination is used
/// so the wait-thread can own the `Child` without contending on a lock.
#[derive(Default)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    seq: Arc<AtomicU64>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            seq: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn start(
        &self,
        app: AppHandle,
        request: StartSessionRequest,
    ) -> NaniResult<StartSessionResult> {
        // 1. The CLI must actually exist. Never pretend to launch.
        let detection = detector::detect(None)?;
        let Some(claude_path) = detection.path else {
            return Err(NaniError::NotFound(
                "Claude Code executable was not found".into(),
            ));
        };

        // 2. The project directory must be valid.
        let validation = crate::project::validate_project(&request.project_path);
        if !validation.valid {
            return Err(NaniError::InvalidInput(
                validation
                    .message
                    .unwrap_or_else(|| "Invalid project directory".into()),
            ));
        }

        let opts = LaunchOptions {
            prompt: request.prompt.clone(),
            model: request.model.clone(),
            output_format: request.output_format.clone(),
            add_dirs: request.add_dirs.clone().unwrap_or_default(),
            permission_mode: request.permission_mode.clone(),
        };
        let args = build_args(&opts);

        let mut command = Command::new(&claude_path);
        command
            .args(&args)
            .current_dir(&request.project_path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            // Own process group so the whole tree can be terminated together.
            command.process_group(0);
        }

        let mut child: Child = command.spawn().map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => NaniError::NotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => NaniError::PermissionDenied(e.to_string()),
            _ => NaniError::Other(format!("Failed to launch Claude Code: {e}")),
        })?;

        let pid = child.id();
        let session_id = generate_session_id();
        let started_at = Utc::now().to_rfc3339();

        self.sessions
            .lock()
            .expect("sessions mutex poisoned")
            .insert(session_id.clone(), pid);

        self.emit(
            &app,
            SessionEvent::SessionStarted {
                session_id: session_id.clone(),
                seq: self.next_seq(),
                at: Utc::now().to_rfc3339(),
                pid: Some(pid),
            },
        );

        // Reader threads for stdout / stderr.
        if let Some(stdout) = child.stdout.take() {
            let app = app.clone();
            let sid = session_id.clone();
            let seq = self.seq.clone();
            std::thread::spawn(move || {
                read_stream(app, sid, seq, BufReader::new(stdout), true);
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let app = app.clone();
            let sid = session_id.clone();
            let seq = self.seq.clone();
            std::thread::spawn(move || {
                read_stream(app, sid, seq, BufReader::new(stderr), false);
            });
        }

        // Waiter thread emits exactly one exit event and cleans up.
        {
            let app = app.clone();
            let sid = session_id.clone();
            let seq = self.seq.clone();
            let sessions = self.sessions.clone();
            std::thread::spawn(move || {
                let status = child.wait();
                let (code, signal) = match status {
                    Ok(status) => {
                        let code = status.code();
                        #[cfg(unix)]
                        let signal = {
                            use std::os::unix::process::ExitStatusExt;
                            status.signal()
                        };
                        #[cfg(not(unix))]
                        let signal: Option<i32> = None;
                        (code, signal)
                    }
                    Err(_) => (None, None),
                };
                emit(
                    &app,
                    SessionEvent::SessionExited {
                        session_id: sid.clone(),
                        seq: seq.fetch_add(1, Ordering::SeqCst) + 1,
                        at: Utc::now().to_rfc3339(),
                        code,
                        signal,
                        ok: exit_ok(code),
                    },
                );
                sessions.lock().expect("sessions mutex poisoned").remove(&sid);
            });
        }

        Ok(StartSessionResult {
            session_id,
            started_at,
            pid: Some(pid),
        })
    }

    pub fn stop(&self, app: &AppHandle, session_id: &str) -> NaniResult<()> {
        let pid = {
            let sessions = self.sessions.lock().expect("sessions mutex poisoned");
            sessions.get(session_id).copied()
        };
        let Some(pid) = pid else {
            return Err(NaniError::NotFound(format!("Session {session_id} is not running")));
        };

        self.emit(
            app,
            SessionEvent::SessionStopping {
                session_id: session_id.to_string(),
                seq: self.next_seq(),
                at: Utc::now().to_rfc3339(),
            },
        );

        terminate_tree(app.clone(), session_id.to_string(), pid);
        Ok(())
    }

    fn next_seq(&self) -> u64 {
        self.seq.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn emit(&self, app: &AppHandle, event: SessionEvent) {
        emit(app, event);
    }
}

/// Emit one event; failures to emit are ignored (the window may be closing).
pub fn emit(app: &AppHandle, event: SessionEvent) {
    let _ = app.emit(SESSION_EVENT_NAME, event);
}

fn read_stream<R: BufRead>(
    app: AppHandle,
    session_id: String,
    seq: Arc<AtomicU64>,
    mut reader: R,
    is_stdout: bool,
) {
    let mut buffer = Vec::new();
    loop {
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer) {
            Ok(0) => break,
            Ok(_) => {
                let text = String::from_utf8_lossy(&buffer).to_string();
                let next = || seq.fetch_add(1, Ordering::SeqCst) + 1;
                if is_stdout {
                    emit(
                        &app,
                        SessionEvent::StdoutChunk {
                            session_id: session_id.clone(),
                            seq: next(),
                            at: Utc::now().to_rfc3339(),
                            text: text.clone(),
                        },
                    );
                    // Structured events come only from parsing a documented
                    // structured output line. Plain text is left as text.
                    if let Some(value) = parse_stream_json(&text) {
                        emit(
                            &app,
                            SessionEvent::StructuredCliEvent {
                                session_id: session_id.clone(),
                                seq: next(),
                                at: Utc::now().to_rfc3339(),
                                event: value,
                            },
                        );
                    }
                } else {
                    emit(
                        &app,
                        SessionEvent::StderrChunk {
                            session_id: session_id.clone(),
                            seq: next(),
                            at: Utc::now().to_rfc3339(),
                            text,
                        },
                    );
                }
            }
            Err(_) => break,
        }
    }
}

/// Parse a single line as a documented stream-json message. Returns None for
/// non-JSON lines or JSON without a recognised `type`, so nothing is fabricated.
pub fn parse_stream_json(line: &str) -> Option<serde_json::Value> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let obj = value.as_object()?;
    let ty = obj.get("type")?.as_str()?;
    match ty {
        "system" | "assistant" | "user" | "result" | "stream_event" => Some(value),
        _ => None,
    }
}

fn generate_session_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("nani-{nanos}")
}

#[cfg(windows)]
fn terminate_tree(app: AppHandle, session_id: String, pid: u32) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
    // If the process is somehow still alive shortly after, emit a diagnostic.
    let _ = app;
    let _ = session_id;
}

#[cfg(unix)]
fn terminate_tree(app: AppHandle, session_id: String, pid: u32) {
    unsafe {
        // Signal the whole process group (negative pid).
        libc::kill(-(pid as i32), libc::SIGTERM);
    }
    // Escalate to SIGKILL if it has not exited shortly.
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        unsafe {
            libc::kill(-(pid as i32), libc::SIGKILL);
        }
        let _ = app;
        let _ = session_id;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_documented_messages_only() {
        assert!(parse_stream_json("{\"type\":\"system\"}").is_some());
        assert!(parse_stream_json("{\"type\":\"result\"}").is_some());
        assert!(parse_stream_json("{\"type\":\"mystery\"}").is_none());
        assert!(parse_stream_json("plain text").is_none());
        assert!(parse_stream_json("").is_none());
        assert!(parse_stream_json("[1,2,3]").is_none());
    }

    #[test]
    fn session_ids_are_unique() {
        let a = generate_session_id();
        std::thread::sleep(std::time::Duration::from_millis(1));
        let b = generate_session_id();
        assert_ne!(a, b);
    }
}
