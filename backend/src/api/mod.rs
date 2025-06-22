pub mod handlers;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;

use crate::storage::Storage;

/// API query parameters for version comparison
#[derive(serde::Deserialize)]
pub struct CompareQuery {
    pub from: String,
    pub to: String,
}

/// Create the API router with all endpoints
pub fn create_router(storage: Storage) -> Router {
    let api_routes = Router::new()
        // Health check
        .route("/health", get(handlers::health_check))
        // Region endpoints
        .route("/regions", get(handlers::get_regions))
        .route("/regions/search", get(handlers::search_regions))
        .route("/regions/:region_id", get(handlers::get_region))
        .route("/regions/:region_id/files", get(handlers::get_region_files))
        .route(
            "/regions/:region_id/boundaries",
            get(handlers::get_region_boundaries),
        )
        .route(
            "/regions/:region_id/compare",
            get(handlers::compare_versions),
        )
        .route(
            "/regions/:region_id/process",
            post(handlers::trigger_processing),
        )
        // Quality reports
        .route("/reports/:report_id", get(handlers::get_quality_report))
        // Processing jobs
        .route("/jobs/:job_id", get(handlers::get_processing_status))
        // Statistics
        .route("/stats", get(handlers::get_stats))
        // Map tiles (placeholder)
        .route("/tiles/:z/:x/:y", get(handlers::get_map_tiles));

    Router::new()
        // Mount API routes under /api prefix
        .nest("/api", api_routes)
        // Download endpoints (not under /api prefix to match Next.js config)
        .route(
            "/download/:region_id/:version",
            get(handlers::download_file),
        )
        // Add CORS middleware
        .layer(CorsLayer::permissive())
        // Add storage state
        .with_state(storage)
}
