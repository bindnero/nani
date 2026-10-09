use serde::Serialize;

/// The event contract (architecture §6). Every variant is derived from a real
/// process lifecycle fact. Plain text is never converted into a fake tool event.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum SessionEvent {
    SessionStarted {
        session_id: String,
        seq: u64,
        at: String,
        pid: Option<u32>,
    },
    StdoutChunk {
        session_id: String,
        seq: u64,
        at: String,
        text: String,
    },
    StderrChunk {
        session_id: String,
        seq: u64,
        at: String,
        text: String,
    },
    StructuredCliEvent {
        session_id: String,
        seq: u64,
        at: String,
        event: serde_json::Value,
    },
    SessionStopping {
        session_id: String,
        seq: u64,
        at: String,
    },
    SessionExited {
        session_id: String,
        seq: u64,
        at: String,
        code: Option<i32>,
        signal: Option<i32>,
        ok: bool,
    },
    Diagnostic {
        session_id: String,
        seq: u64,
        at: String,
        level: String,
        message: String,
    },
}
