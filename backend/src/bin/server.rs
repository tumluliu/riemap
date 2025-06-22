use riemap_backend::{api::create_router, config::Config, storage::Storage};
use tracing::{error, info};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("Starting RieMap backend server");

    // Load configuration
    let config = Config::from_env();
    config.validate()?;

    info!("Configuration loaded: {:?}", config);

    // Initialize storage
    let storage = Storage::new(&config.storage.data_dir)?;

    // Initialize region data from Geofabrik if not exists
    if let Err(e) = storage.initialize_with_geofabrik_data().await {
        error!("Failed to initialize Geofabrik data: {}", e);
        info!("Falling back to sample data initialization");
        if let Err(e2) = storage.initialize_with_sample_data().await {
            error!("Failed to initialize sample data as fallback: {}", e2);
        }
    }

    // Create router
    let app = create_router(storage);

    // Create listener
    let listener =
        tokio::net::TcpListener::bind(format!("{}:{}", config.server.host, config.server.port))
            .await?;

    info!(
        "Server listening on {}:{}",
        config.server.host, config.server.port
    );
    info!(
        "Health check: http://{}:{}/api/health",
        config.server.host, config.server.port
    );
    info!(
        "API docs: http://{}:{}/api/regions",
        config.server.host, config.server.port
    );

    // Start server
    axum::serve(listener, app).await?;

    Ok(())
}
