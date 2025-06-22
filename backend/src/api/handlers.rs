use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Json},
};
use serde_json::json;
use std::collections::HashMap;
use tokio_util::io::ReaderStream;
use tracing::error;

use crate::{models::*, storage::Storage};

/// Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "version": env!("CARGO_PKG_VERSION")
    }))
}

/// Get all regions in hierarchical structure
pub async fn get_regions(State(storage): State<Storage>) -> impl IntoResponse {
    match storage.get_region_tree().await {
        Ok(tree) => Json(tree).into_response(),
        Err(e) => {
            error!("Failed to get regions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Get specific region with children and files
pub async fn get_region(
    Path(region_id): Path<String>,
    State(storage): State<Storage>,
) -> impl IntoResponse {
    match storage.get_region(&region_id).await {
        Ok(Some(region)) => Json(region).into_response(),
        Ok(None) => {
            error!("Region {} not found", region_id);
            StatusCode::NOT_FOUND.into_response()
        }
        Err(e) => {
            error!("Failed to get region {}: {}", region_id, e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Get files for a specific region
pub async fn get_region_files(
    Path(region_id): Path<String>,
    State(storage): State<Storage>,
) -> impl IntoResponse {
    match storage.get_region_files(&region_id).await {
        Ok(files) => Json(files).into_response(),
        Err(e) => {
            error!("Failed to get files for region {}: {}", region_id, e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Download a specific file
pub async fn download_file(
    Path((region_id, version)): Path<(String, String)>,
    State(storage): State<Storage>,
) -> impl IntoResponse {
    match storage.get_file_path(&region_id, &version).await {
        Ok(Some(path)) => match tokio::fs::File::open(&path).await {
            Ok(file) => {
                let stream = ReaderStream::new(file);
                let body = axum::body::Body::from_stream(stream);

                let filename = format!("{}-{}.osm.pbf", region_id, version);

                let headers = [
                    (
                        header::CONTENT_TYPE,
                        header::HeaderValue::from_static("application/octet-stream"),
                    ),
                    (
                        header::CONTENT_DISPOSITION,
                        header::HeaderValue::from_str(&format!(
                            "attachment; filename=\"{}\"",
                            filename
                        ))
                        .unwrap(),
                    ),
                ];

                (headers, body).into_response()
            }
            Err(e) => {
                error!("Failed to open file {:?}: {}", path, e);
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
        },
        Ok(None) => {
            error!(
                "File not found for region {} version {}",
                region_id, version
            );
            StatusCode::NOT_FOUND.into_response()
        }
        Err(e) => {
            error!("Failed to get file path: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Get quality report for a specific region/file
pub async fn get_quality_report(
    Path(report_id): Path<String>,
    State(_storage): State<Storage>,
) -> impl IntoResponse {
    // Mock quality report data
    let quality_report = json!({
        "id": report_id,
        "region_id": report_id,
        "report_date": chrono::Utc::now().to_rfc3339(),
        "completeness_score": 85,
        "accuracy_score": 92,
        "freshness_score": 78,
        "overall_score": 85,
        "issues": {
            "missing_tags": 42,
            "geometry_errors": 8,
            "topology_issues": 15,
            "outdated_data": 23
        },
        "recommendations": [
            "Consider updating road network tags to include more detailed information",
            "Review and fix geometry errors in building polygons",
            "Update outdated points of interest with current business information",
            "Add missing accessibility tags for public buildings"
        ]
    });

    Json(quality_report).into_response()
}

/// Search regions by name or criteria
#[derive(serde::Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
    admin_level: Option<u8>,
    continent: Option<String>,
    has_data: Option<bool>,
}

pub async fn search_regions(
    Query(query): Query<SearchQuery>,
    State(storage): State<Storage>,
) -> impl IntoResponse {
    match storage.load_regions().await {
        Ok(regions) => {
            let filtered_regions: Vec<_> = regions
                .into_iter()
                .filter(|region| {
                    if let Some(ref search_term) = query.q {
                        if !region
                            .name
                            .to_lowercase()
                            .contains(&search_term.to_lowercase())
                        {
                            return false;
                        }
                    }

                    if let Some(admin_level) = query.admin_level {
                        if region.admin_level_num() != admin_level {
                            return false;
                        }
                    }

                    if let Some(ref continent) = query.continent {
                        if region.parent_id.as_deref() != Some(continent) {
                            return false;
                        }
                    }

                    true
                })
                .collect();

            Json(filtered_regions).into_response()
        }
        Err(e) => {
            error!("Failed to search regions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Get statistics about the entire dataset
pub async fn get_stats(State(storage): State<Storage>) -> impl IntoResponse {
    match storage.load_regions().await {
        Ok(regions) => {
            let mut stats = HashMap::new();
            stats.insert("total_regions", json!(regions.len()));

            let by_level: HashMap<String, usize> =
                regions.iter().fold(HashMap::new(), |mut acc, region| {
                    let level = match region.admin_level {
                        AdminLevel::World => "world",
                        AdminLevel::Continent => "continents",
                        AdminLevel::Country => "countries",
                        AdminLevel::Region => "regions",
                        AdminLevel::Subregion => "subregions",
                    };
                    *acc.entry(level.to_string()).or_insert(0) += 1;
                    acc
                });

            stats.insert("by_level", json!(by_level));

            // Calculate total coverage area
            let total_area: f64 = regions.iter().filter_map(|r| r.area_km2).sum();
            stats.insert("total_area_km2", json!(total_area));

            // Calculate total population
            let total_population: u64 = regions.iter().filter_map(|r| r.population).sum();
            stats.insert("total_population", json!(total_population));

            Json(stats).into_response()
        }
        Err(e) => {
            error!("Failed to get stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Trigger processing for a specific region
pub async fn trigger_processing(
    Path(region_id): Path<String>,
    State(_storage): State<Storage>,
) -> impl IntoResponse {
    // This would normally trigger a background job
    // For now, just return a mock job status

    let job = ProcessingJob {
        id: uuid::Uuid::new_v4().to_string(),
        region_id: region_id.clone(),
        job_type: JobType::Process,
        status: JobStatus::Pending,
        progress: 0.0,
        message: Some("Processing queued".to_string()),
        created_at: chrono::Utc::now(),
        started_at: None,
        completed_at: None,
        error_message: None,
    };

    Json(job).into_response()
}

/// Get processing status
pub async fn get_processing_status(
    Path(job_id): Path<String>,
    State(_storage): State<Storage>,
) -> impl IntoResponse {
    // Mock implementation - in reality, you'd look up the actual job
    let job = ProcessingJob {
        id: job_id,
        region_id: "liechtenstein".to_string(),
        job_type: JobType::Process,
        status: JobStatus::Completed,
        progress: 100.0,
        message: Some("Processing completed successfully".to_string()),
        created_at: chrono::Utc::now(),
        started_at: Some(chrono::Utc::now()),
        completed_at: Some(chrono::Utc::now()),
        error_message: None,
    };

    Json(job).into_response()
}

/// Get region boundaries as GeoJSON for map display
pub async fn get_region_boundaries(
    Path(region_id): Path<String>,
    State(storage): State<Storage>,
) -> impl IntoResponse {
    match storage.get_region(&region_id).await {
        Ok(Some(region_tree)) => {
            let region = &region_tree.region;
            let bbox = &region.bounding_box;

            // Create a simple GeoJSON polygon from bounding box
            let geojson = json!({
                "type": "Feature",
                "properties": {
                    "id": region.id,
                    "name": region.name,
                    "admin_level": region.admin_level_num(),
                    "area_km2": region.area_km2,
                    "population": region.population
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [bbox.min_lon, bbox.min_lat],
                        [bbox.max_lon, bbox.min_lat],
                        [bbox.max_lon, bbox.max_lat],
                        [bbox.min_lon, bbox.max_lat],
                        [bbox.min_lon, bbox.min_lat]
                    ]]
                }
            });

            Json(geojson).into_response()
        }
        Ok(None) => {
            error!("Region {} not found", region_id);
            StatusCode::NOT_FOUND.into_response()
        }
        Err(e) => {
            error!("Failed to get region boundaries for {}: {}", region_id, e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Compare two versions of a region's data
pub async fn compare_versions(
    Path(region_id): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
    State(_storage): State<Storage>,
) -> impl IntoResponse {
    let from_version = params.get("from").cloned().unwrap_or_default();
    let to_version = params.get("to").cloned().unwrap_or_default();

    // Mock comparison data
    let comparison = json!({
        "region_id": region_id,
        "from_version": from_version,
        "to_version": to_version,
        "comparison_date": chrono::Utc::now().to_rfc3339(),
        "changes": {
            "added_features": 1247,
            "modified_features": 532,
            "deleted_features": 89,
            "total_features_from": 15420,
            "total_features_to": 16578
        },
        "change_details": [
            {
                "category": "Roads",
                "added": 423,
                "modified": 156,
                "deleted": 23
            },
            {
                "category": "Buildings",
                "added": 589,
                "modified": 234,
                "deleted": 45
            },
            {
                "category": "Points of Interest",
                "added": 167,
                "modified": 89,
                "deleted": 12
            },
            {
                "category": "Natural Features",
                "added": 68,
                "modified": 53,
                "deleted": 9
            }
        ],
        "file_size_change": 2457600,
        "data_quality_change": 3.2
    });

    Json(comparison).into_response()
}

/// Get map tiles endpoint (placeholder for future vector tile support)
pub async fn get_map_tiles(Path((z, x, y)): Path<(u8, u32, u32)>) -> impl IntoResponse {
    // This would serve vector tiles in MVT format
    // For now, return a placeholder
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "error": "Map tiles not implemented yet",
            "tile": format!("{}/{}/{}", z, x, y)
        })),
    )
        .into_response()
}
