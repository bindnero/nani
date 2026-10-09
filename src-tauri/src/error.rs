use serde::{Serialize, Serializer};

/// Errors returned to the frontend. They are serialized as a plain string so the
/// UI can display the actual failure instead of a fabricated success.
#[derive(Debug, thiserror::Error)]
pub enum NaniError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("unsafe path rejected: {0}")]
    UnsafePath(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

impl Serialize for NaniError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type NaniResult<T> = Result<T, NaniError>;
