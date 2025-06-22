use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a geographic region with hierarchical organization matching Geofabrik structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub id: String,
    pub name: String,
    pub admin_level: AdminLevel,
    pub parent_id: Option<String>,
    pub bounding_box: BoundingBox,
    pub area_km2: Option<f64>,
    pub population: Option<u64>,
    pub country_code: Option<String>,
    pub geofabrik_url: Option<String>, // URL to Geofabrik download
    pub has_children: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Administrative levels matching Geofabrik hierarchy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AdminLevel {
    World = 0,
    Continent = 1,
    Country = 2,
    Region = 3,
    Subregion = 4,
}

/// Geographic bounding box
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min_lat: f64,
    pub min_lon: f64,
    pub max_lat: f64,
    pub max_lon: f64,
}

/// Represents a processed OSM data file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataFile {
    pub id: String,
    pub region_id: String,
    pub version: String,
    pub file_path: String,
    pub file_size: u64,
    pub format: DataFormat,
    pub created_at: DateTime<Utc>,
    pub is_latest: bool,
    pub quality_report_id: Option<String>,
    pub download_url: String,     // Direct download URL
    pub checksum: Option<String>, // MD5/SHA256 checksum
}

/// Supported data formats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataFormat {
    OsmPbf,
    OsmXml,
    GeoJson,
    Shapefile,
}

/// Quality analysis report for a data file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityReport {
    pub id: String,
    pub data_file_id: String,
    pub region_id: String,
    pub created_at: DateTime<Utc>,
    pub metrics: QualityMetrics,
    pub issues: Vec<QualityIssue>,
    pub summary: String,
    pub recommendations: Vec<String>,
}

/// Quality metrics for OSM data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityMetrics {
    pub total_nodes: u64,
    pub total_ways: u64,
    pub total_relations: u64,
    pub tagged_nodes: u64,
    pub tagged_ways: u64,
    pub tagged_relations: u64,
    pub completeness_score: f64,
    pub geometry_errors: u64,
    pub tag_errors: u64,
    pub topology_errors: u64,
    pub feature_distribution: FeatureDistribution,
    pub custom_metrics: HashMap<String, serde_json::Value>,
}

/// Distribution of different feature types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureDistribution {
    pub highways: u64,
    pub buildings: u64,
    pub natural_features: u64,
    pub amenities: u64,
    pub water_features: u64,
    pub boundaries: u64,
}

/// Specific quality issue found in data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityIssue {
    pub issue_type: String,
    pub severity: IssueSeverity,
    pub description: String,
    pub location: Option<(f64, f64)>, // lat, lon
    pub osm_id: Option<i64>,
    pub osm_type: Option<String>,
    pub fix_suggestion: Option<String>,
}

/// Severity levels for quality issues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Processing job status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingJob {
    pub id: String,
    pub region_id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub progress: f64,
    pub message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

/// Types of processing jobs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    Download,
    Process,
    QualityAnalysis,
    Cleanup,
    UpdateIndex,
}

/// Job execution status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// API response for region hierarchy
#[derive(Debug, Serialize, Deserialize)]
pub struct RegionTree {
    pub region: Region,
    pub children: Vec<RegionTree>,
    pub data_files: Vec<DataFile>,
    pub download_stats: DownloadStats,
}

/// Download statistics for a region
#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadStats {
    pub total_downloads: u64,
    pub last_updated: DateTime<Utc>,
    pub file_count: usize,
    pub total_size_mb: f64,
}

/// API response for region comparison
#[derive(Debug, Serialize, Deserialize)]
pub struct RegionComparison {
    pub region_id: String,
    pub from_version: String,
    pub to_version: String,
    pub comparison_date: DateTime<Utc>,
    pub metrics_diff: QualityMetricsDiff,
    pub summary: String,
    pub change_details: Vec<ChangeDetail>,
}

/// Specific change between versions
#[derive(Debug, Serialize, Deserialize)]
pub struct ChangeDetail {
    pub change_type: String,
    pub description: String,
    pub impact: String,
    pub location: Option<(f64, f64)>,
}

/// Difference between quality metrics
#[derive(Debug, Serialize, Deserialize)]
pub struct QualityMetricsDiff {
    pub nodes_diff: i64,
    pub ways_diff: i64,
    pub relations_diff: i64,
    pub completeness_diff: f64,
    pub errors_diff: i64,
    pub feature_changes: HashMap<String, i64>,
}

impl BoundingBox {
    /// Create a new bounding box
    pub fn new(min_lat: f64, min_lon: f64, max_lat: f64, max_lon: f64) -> Self {
        Self {
            min_lat,
            min_lon,
            max_lat,
            max_lon,
        }
    }

    /// Calculate area in square kilometers (approximate)
    pub fn area_km2(&self) -> f64 {
        let lat_diff = self.max_lat - self.min_lat;
        let lon_diff = self.max_lon - self.min_lon;

        // Rough approximation: 1 degree ≈ 111 km
        let lat_km = lat_diff * 111.0;
        let lon_km = lon_diff * 111.0 * (self.min_lat + self.max_lat).to_radians().cos() / 2.0;

        lat_km * lon_km
    }

    /// Get center point of bounding box
    pub fn center(&self) -> (f64, f64) {
        (
            (self.min_lat + self.max_lat) / 2.0,
            (self.min_lon + self.max_lon) / 2.0,
        )
    }

    /// Check if this bounding box contains a point
    pub fn contains(&self, lat: f64, lon: f64) -> bool {
        lat >= self.min_lat && lat <= self.max_lat && lon >= self.min_lon && lon <= self.max_lon
    }
}

impl Region {
    /// Create a new region
    pub fn new(
        id: String,
        name: String,
        admin_level: AdminLevel,
        bounding_box: BoundingBox,
    ) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            admin_level,
            parent_id: None,
            bounding_box,
            area_km2: None,
            population: None,
            country_code: None,
            geofabrik_url: None,
            has_children: false,
            created_at: now,
            updated_at: now,
        }
    }

    /// Get the admin level as a number for ordering
    pub fn admin_level_num(&self) -> u8 {
        match self.admin_level {
            AdminLevel::World => 0,
            AdminLevel::Continent => 1,
            AdminLevel::Country => 2,
            AdminLevel::Region => 3,
            AdminLevel::Subregion => 4,
        }
    }
}

impl Default for FeatureDistribution {
    fn default() -> Self {
        Self {
            highways: 0,
            buildings: 0,
            natural_features: 0,
            amenities: 0,
            water_features: 0,
            boundaries: 0,
        }
    }
}

impl Default for DownloadStats {
    fn default() -> Self {
        Self {
            total_downloads: 0,
            last_updated: Utc::now(),
            file_count: 0,
            total_size_mb: 0.0,
        }
    }
}
