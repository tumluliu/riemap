use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub storage: StorageConfig,
    pub processing: ProcessingConfig,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
}

/// Storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub data_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub max_file_size: u64,
}

/// Processing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingConfig {
    pub max_concurrent_jobs: usize,
    pub cleanup_interval_hours: u64,
    pub keep_versions: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 3001,
                workers: 4,
            },
            storage: StorageConfig {
                data_dir: PathBuf::from("./data"),
                temp_dir: PathBuf::from("./temp"),
                max_file_size: 1_073_741_824, // 1GB
            },
            processing: ProcessingConfig {
                max_concurrent_jobs: 2,
                cleanup_interval_hours: 24,
                keep_versions: 10,
            },
        }
    }
}

impl Config {
    /// Load configuration from environment variables and defaults
    pub fn from_env() -> Self {
        let mut config = Config::default();

        if let Ok(host) = std::env::var("RIEMAP_HOST") {
            config.server.host = host;
        }

        if let Ok(port) = std::env::var("RIEMAP_PORT") {
            if let Ok(port) = port.parse() {
                config.server.port = port;
            }
        }

        if let Ok(data_dir) = std::env::var("RIEMAP_DATA_DIR") {
            config.storage.data_dir = PathBuf::from(data_dir);
        }

        if let Ok(temp_dir) = std::env::var("RIEMAP_TEMP_DIR") {
            config.storage.temp_dir = PathBuf::from(temp_dir);
        }

        config
    }

    /// Validate configuration
    pub fn validate(&self) -> crate::Result<()> {
        if self.server.port == 0 {
            return Err(crate::RiemapError::Config("Invalid port number".to_string()).into());
        }

        if self.server.workers == 0 {
            return Err(
                crate::RiemapError::Config("Workers must be greater than 0".to_string()).into(),
            );
        }

        Ok(())
    }
}
