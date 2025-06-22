pub mod api;
pub mod config;
pub mod models;
pub mod osm;
pub mod quality;
pub mod storage;

pub use models::*;

/// Common result type used throughout the application
pub type Result<T> = anyhow::Result<T>;

/// Application-wide error types
#[derive(thiserror::Error, Debug)]
pub enum RiemapError {
    #[error("OSM processing error: {0}")]
    OsmProcessing(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Quality analysis error: {0}")]
    Quality(String),

    #[error("Configuration error: {0}")]
    Config(String),
}
