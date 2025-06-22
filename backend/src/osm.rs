use crate::{models::*, Result};
use chrono::Utc;
use osmpbf::{Element, ElementReader};
use reqwest;
use std::fs;
use std::path::{Path, PathBuf};

use tracing::{info, warn};

/// OSM data processor for downloading and filtering regional data
#[derive(Clone)]
pub struct OsmProcessor {
    pub data_dir: PathBuf,
    pub temp_dir: PathBuf,
}

impl OsmProcessor {
    /// Create a new OSM processor
    pub fn new<P: AsRef<Path>>(data_dir: P, temp_dir: P) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        let temp_dir = temp_dir.as_ref().to_path_buf();

        // Create directories if they don't exist
        fs::create_dir_all(&data_dir)?;
        fs::create_dir_all(&temp_dir)?;

        Ok(Self { data_dir, temp_dir })
    }

    /// Download OSM data for a specific region
    pub async fn download_region(&self, region: &Region) -> Result<PathBuf> {
        info!("Downloading OSM data for region: {}", region.name);

        // For Liechtenstein, we'll use a specific URL
        let url = match region.id.as_str() {
            "liechtenstein" => "https://download.geofabrik.de/europe/liechtenstein-latest.osm.pbf",
            _ => {
                return Err(crate::RiemapError::OsmProcessing(format!(
                    "No download URL configured for region: {}",
                    region.id
                ))
                .into())
            }
        };

        let response = reqwest::get(url).await?;
        if !response.status().is_success() {
            return Err(crate::RiemapError::Network(format!(
                "Failed to download OSM data: {}",
                response.status()
            ))
            .into());
        }

        // Create region directory
        let region_dir = self.data_dir.join("europe").join(&region.id);
        fs::create_dir_all(&region_dir)?;

        // Save to timestamped file
        let timestamp = Utc::now().format("%Y-%m-%d").to_string();
        let filename = format!("{}.osm.pbf", timestamp);
        let file_path = region_dir.join(&filename);

        let bytes = response.bytes().await?;
        tokio::fs::write(&file_path, bytes).await?;

        // Also create a "latest" symlink
        let latest_path = region_dir.join("latest.osm.pbf");
        if latest_path.exists() {
            fs::remove_file(&latest_path)?;
        }

        #[cfg(unix)]
        std::os::unix::fs::symlink(&filename, &latest_path)?;

        #[cfg(windows)]
        fs::copy(&file_path, &latest_path)?;

        info!("Downloaded OSM data to: {:?}", file_path);
        Ok(file_path)
    }

    /// Process OSM data and extract basic statistics
    pub async fn process_osm_file(&self, file_path: &Path) -> Result<QualityMetrics> {
        info!("Processing OSM file: {:?}", file_path);

        let mut metrics = QualityMetrics {
            total_nodes: 0,
            total_ways: 0,
            total_relations: 0,
            tagged_nodes: 0,
            tagged_ways: 0,
            tagged_relations: 0,
            completeness_score: 0.0,
            geometry_errors: 0,
            tag_errors: 0,
            topology_errors: 0,
            feature_distribution: FeatureDistribution::default(),
            custom_metrics: std::collections::HashMap::new(),
        };

        let reader = ElementReader::from_path(file_path)?;

        reader.for_each(|element| {
            match element {
                Element::Node(node) => {
                    metrics.total_nodes += 1;
                    if node.tags().count() > 0 {
                        metrics.tagged_nodes += 1;
                    }
                    // Basic validation
                    if node.lat().abs() > 90.0 || node.lon().abs() > 180.0 {
                        metrics.geometry_errors += 1;
                    }
                }
                Element::Way(way) => {
                    metrics.total_ways += 1;
                    if way.tags().count() > 0 {
                        metrics.tagged_ways += 1;
                    }
                    // Check for valid way structure
                    if way.refs().count() < 2 {
                        metrics.topology_errors += 1;
                    }
                }
                Element::Relation(relation) => {
                    metrics.total_relations += 1;
                    if relation.tags().count() > 0 {
                        metrics.tagged_relations += 1;
                    }
                }
                Element::DenseNode(node) => {
                    metrics.total_nodes += 1;
                    if node.tags().count() > 0 {
                        metrics.tagged_nodes += 1;
                    }
                    // Basic validation
                    if node.lat().abs() > 90.0 || node.lon().abs() > 180.0 {
                        metrics.geometry_errors += 1;
                    }
                }
            }
        })?;

        // Calculate completeness score (simplified)
        let total_elements = metrics.total_nodes + metrics.total_ways + metrics.total_relations;
        let tagged_elements = metrics.tagged_nodes + metrics.tagged_ways + metrics.tagged_relations;

        if total_elements > 0 {
            metrics.completeness_score = (tagged_elements as f64 / total_elements as f64) * 100.0;
        }

        info!(
            "Processing complete. Nodes: {}, Ways: {}, Relations: {}",
            metrics.total_nodes, metrics.total_ways, metrics.total_relations
        );

        Ok(metrics)
    }

    /// Filter OSM data by bounding box (placeholder for more advanced filtering)
    pub async fn filter_by_bounds(
        &self,
        input_path: &Path,
        bounds: &BoundingBox,
        output_path: &Path,
    ) -> Result<()> {
        info!("Filtering OSM data by bounds: {:?}", bounds);

        // For now, we'll just copy the file as filtering requires more complex logic
        // In a production system, you'd implement proper spatial filtering here
        fs::copy(input_path, output_path)?;

        warn!("Spatial filtering not yet implemented - copied file as-is");
        Ok(())
    }

    /// Validate OSM data file integrity
    pub async fn validate_file(&self, file_path: &Path) -> Result<Vec<QualityIssue>> {
        info!("Validating OSM file: {:?}", file_path);

        let mut issues = Vec::new();

        // Check if file exists and is readable
        if !file_path.exists() {
            issues.push(QualityIssue {
                issue_type: "file_missing".to_string(),
                severity: IssueSeverity::Critical,
                description: "OSM data file does not exist".to_string(),
                location: None,
                osm_id: None,
                osm_type: None,
                fix_suggestion: Some(
                    "Ensure the OSM data file has been downloaded properly".to_string(),
                ),
            });
            return Ok(issues);
        }

        // Check file size
        let metadata = fs::metadata(file_path)?;
        if metadata.len() == 0 {
            issues.push(QualityIssue {
                issue_type: "empty_file".to_string(),
                severity: IssueSeverity::Critical,
                description: "OSM data file is empty".to_string(),
                location: None,
                osm_id: None,
                osm_type: None,
                fix_suggestion: Some("Re-download the OSM data file".to_string()),
            });
        }

        // Try to read the PBF header
        match ElementReader::from_path(file_path) {
            Ok(reader) => {
                let mut element_count = 0;
                let result = reader.for_each(|_| {
                    element_count += 1;
                    if element_count > 1000 {
                        // Stop after checking first 1000 elements for validation
                        return;
                    }
                });

                if let Err(e) = result {
                    issues.push(QualityIssue {
                        issue_type: "parsing_error".to_string(),
                        severity: IssueSeverity::High,
                        description: format!("Error parsing OSM data: {}", e),
                        location: None,
                        osm_id: None,
                        osm_type: None,
                        fix_suggestion: Some(
                            "Check if the OSM file is corrupted and re-download if necessary"
                                .to_string(),
                        ),
                    });
                }
            }
            Err(e) => {
                issues.push(QualityIssue {
                    issue_type: "invalid_format".to_string(),
                    severity: IssueSeverity::Critical,
                    description: format!("Cannot read OSM PBF file: {}", e),
                    location: None,
                    osm_id: None,
                    osm_type: None,
                    fix_suggestion: Some(
                        "Ensure the file is a valid OSM PBF format and re-download if corrupted"
                            .to_string(),
                    ),
                });
            }
        }

        Ok(issues)
    }
}

/// Utility functions for OSM data
pub mod utils {
    use super::*;

    /// Get file size in MB
    pub fn get_file_size_mb(path: &Path) -> Result<f64> {
        let metadata = std::fs::metadata(path)?;
        Ok(metadata.len() as f64 / 1_048_576.0) // Convert bytes to MB
    }

    /// Extract timestamp from filename
    pub fn extract_timestamp_from_filename(filename: &str) -> Option<String> {
        // Extract YYYY-MM-DD pattern from filename
        let re = regex::Regex::new(r"\d{4}-\d{2}-\d{2}").ok()?;
        re.find(filename).map(|m| m.as_str().to_string())
    }

    /// Generate quality report summary
    pub fn generate_summary(metrics: &QualityMetrics, issues: &[QualityIssue]) -> String {
        let total_elements = metrics.total_nodes + metrics.total_ways + metrics.total_relations;
        let critical_issues = issues
            .iter()
            .filter(|i| matches!(i.severity, IssueSeverity::Critical))
            .count();

        format!(
            "Data contains {} elements ({} nodes, {} ways, {} relations) with {:.1}% completeness. {} critical issues found.",
            total_elements,
            metrics.total_nodes,
            metrics.total_ways,
            metrics.total_relations,
            metrics.completeness_score,
            critical_issues
        )
    }
}
