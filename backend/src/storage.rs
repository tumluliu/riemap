use crate::{models::*, Result};
use chrono::Utc;
use serde_json;

use std::path::{Path, PathBuf};
use tracing::{info, warn};
use walkdir::WalkDir;

/// Storage layer for managing regions, files, and metadata
#[derive(Clone)]
pub struct Storage {
    pub data_dir: PathBuf,
    pub metadata_file: PathBuf,
}

impl Storage {
    /// Create a new storage instance
    pub fn new<P: AsRef<Path>>(data_dir: P) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        let metadata_file = data_dir.join("metadata.json");

        std::fs::create_dir_all(&data_dir)?;

        Ok(Self {
            data_dir,
            metadata_file,
        })
    }

    /// Initialize storage with Geofabrik region hierarchy from their official JSON index
    pub async fn initialize_with_geofabrik_data(&self) -> Result<()> {
        info!("Fetching Geofabrik region hierarchy from official JSON index with geometries");

        // Use the full geometry version to get actual bounding boxes
        let geofabrik_url = "https://download.geofabrik.de/index-v1.json";

        let client = reqwest::Client::new();
        let response = client
            .get(geofabrik_url)
            .timeout(std::time::Duration::from_secs(60)) // Increased timeout for larger file
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to fetch Geofabrik index: HTTP {}",
                response.status()
            ));
        }

        let geofabrik_index: GeofabrikIndex = response.json().await?;
        info!(
            "Successfully fetched {} regions from Geofabrik",
            geofabrik_index.features.len()
        );

        // Convert Geofabrik features to our Region structure
        let regions = self.convert_geofabrik_to_regions(geofabrik_index).await?;

        self.save_regions(&regions).await?;
        info!(
            "Successfully initialized {} regions from Geofabrik index",
            regions.len()
        );
        Ok(())
    }

    /// Convert Geofabrik index to our Region structure
    async fn convert_geofabrik_to_regions(&self, index: GeofabrikIndex) -> Result<Vec<Region>> {
        let mut regions = Vec::new();

        // First pass: collect all region IDs that have children
        let mut parent_ids = std::collections::HashSet::new();
        for feature in &index.features {
            if let Some(ref parent) = feature.properties.parent {
                parent_ids.insert(parent.clone());
            }
        }

        // Build a map of all regions for easier lookup
        let mut region_map: std::collections::HashMap<String, GeofabrikProperties> =
            std::collections::HashMap::new();
        for feature in &index.features {
            region_map.insert(feature.properties.id.clone(), feature.properties.clone());
        }

        // Multi-pass admin level determination
        let admin_levels = self.determine_admin_levels_multi_pass(&region_map);

        for feature in index.features {
            let props = feature.properties;

            // Get admin level from our multi-pass analysis
            let admin_level = admin_levels
                .get(&props.id)
                .cloned()
                .unwrap_or(AdminLevel::Subregion);

            // Extract bounding box from geometry if available, otherwise use fallback
            let bounding_box = if let Some(ref geometry) = feature.geometry {
                self.extract_bounding_box_from_geometry(geometry)
                    .unwrap_or_else(|| self.estimate_bounding_box(&props.id, &props.parent))
            } else {
                self.estimate_bounding_box(&props.id, &props.parent)
            };

            // Determine if this region provides data services
            let provides_data_services = props
                .urls
                .as_ref()
                .map(|urls| urls.pbf.is_some())
                .unwrap_or(false);

            // Check if this region has children
            let has_children = parent_ids.contains(&props.id);

            let mut region = Region::new(
                props.id.clone(),
                props.name.clone(),
                admin_level,
                bounding_box,
            );

            region.parent_id = props.parent;
            region.has_children = has_children;
            region.provides_data_services = provides_data_services;
            region.iso3166_1 = props.iso3166_1_alpha2;
            region.iso3166_2 = props.iso3166_2;
            region.urls = props.urls;
            region.geofabrik_url = region
                .urls
                .as_ref()
                .and_then(|urls| urls.pbf.as_ref())
                .map(|url| url.clone());

            // Set country codes from ISO codes
            if let Some(ref iso_codes) = region.iso3166_1 {
                if let Some(first_code) = iso_codes.first() {
                    region.country_code = Some(first_code.clone());
                }
            }

            regions.push(region);
        }

        info!("Converted {} Geofabrik features to regions", regions.len());
        Ok(regions)
    }

    /// Determine admin levels using multi-pass analysis of the actual hierarchy
    fn determine_admin_levels_multi_pass(
        &self,
        region_map: &std::collections::HashMap<String, GeofabrikProperties>,
    ) -> std::collections::HashMap<String, AdminLevel> {
        let mut admin_levels = std::collections::HashMap::new();

        // Step 1: Find continents (regions with no parent)
        for (id, props) in region_map {
            if props.parent.is_none() {
                admin_levels.insert(id.clone(), AdminLevel::Continent);
            }
        }

        // Step 2: Find countries (regions whose parent is a continent)
        for (id, props) in region_map {
            if let Some(ref parent_id) = props.parent {
                if admin_levels.get(parent_id) == Some(&AdminLevel::Continent) {
                    admin_levels.insert(id.clone(), AdminLevel::Country);
                }
            }
        }

        // Step 3: Find regions (regions whose parent is a country)
        for (id, props) in region_map {
            if let Some(ref parent_id) = props.parent {
                if admin_levels.get(parent_id) == Some(&AdminLevel::Country) {
                    admin_levels.insert(id.clone(), AdminLevel::Region);
                }
            }
        }

        // Step 4: Find subregions (regions whose parent is a region)
        for (id, props) in region_map {
            if let Some(ref parent_id) = props.parent {
                if admin_levels.get(parent_id) == Some(&AdminLevel::Region) {
                    admin_levels.insert(id.clone(), AdminLevel::Subregion);
                }
            }
        }

        // Any remaining regions without assigned levels get the deepest level
        for (id, _) in region_map {
            if !admin_levels.contains_key(id) {
                admin_levels.insert(id.clone(), AdminLevel::Subregion);
            }
        }

        admin_levels
    }

    /// Estimate bounding box for regions (since we're using the no-geometry version)
    fn estimate_bounding_box(&self, id: &str, parent: &Option<String>) -> BoundingBox {
        // These are rough estimates - in a production system you'd want to either:
        // 1. Use the full geometry version of the index
        // 2. Store known bounding boxes
        // 3. Calculate them from OSM data

        match id {
            // World
            "world" => BoundingBox::new(-90.0, -180.0, 90.0, 180.0),

            // Continents
            "africa" => BoundingBox::new(-35.0, -20.0, 38.0, 55.0),
            "antarctica" => BoundingBox::new(-90.0, -180.0, -60.0, 180.0),
            "asia" => BoundingBox::new(-11.0, 25.0, 82.0, 180.0),
            "australia-oceania" => BoundingBox::new(-55.0, 110.0, 0.0, 180.0),
            "central-america" => BoundingBox::new(7.0, -92.0, 22.0, -77.0),
            "europe" => BoundingBox::new(35.0, -25.0, 72.0, 45.0),
            "north-america" => BoundingBox::new(15.0, -180.0, 85.0, -50.0),
            "south-america" => BoundingBox::new(-60.0, -85.0, 15.0, -30.0),

            // Some specific countries
            "germany" => BoundingBox::new(47.3, 5.9, 55.0, 15.0),
            "france" => BoundingBox::new(41.3, -5.1, 51.1, 9.6),
            "great-britain" => BoundingBox::new(49.9, -8.2, 60.8, 1.8),
            "united-states" | "us" => BoundingBox::new(18.9, -179.1, 71.4, -66.9),
            "canada" => BoundingBox::new(41.7, -141.0, 83.1, -52.6),

            // Default fallback
            _ => {
                match parent.as_deref() {
                    Some("europe") => BoundingBox::new(35.0, -25.0, 72.0, 45.0),
                    Some("asia") => BoundingBox::new(-11.0, 25.0, 82.0, 180.0),
                    Some("africa") => BoundingBox::new(-35.0, -20.0, 38.0, 55.0),
                    Some("north-america") => BoundingBox::new(15.0, -180.0, 85.0, -50.0),
                    Some("south-america") => BoundingBox::new(-60.0, -85.0, 15.0, -30.0),
                    Some("australia-oceania") => BoundingBox::new(-55.0, 110.0, 0.0, 180.0),
                    Some("central-america") => BoundingBox::new(7.0, -92.0, 22.0, -77.0),
                    _ => BoundingBox::new(-90.0, -180.0, 90.0, 180.0), // World as fallback
                }
            }
        }
    }

    /// Initialize storage with comprehensive Geofabrik-like region hierarchy
    pub async fn initialize_with_sample_data(&self) -> Result<()> {
        warn!("Using deprecated sample data initialization. Consider using initialize_with_geofabrik_data() instead.");

        // Keep the old method for backward compatibility, but recommend the new one
        self.initialize_with_geofabrik_data().await
    }

    /// Save regions to metadata file
    pub async fn save_regions(&self, regions: &[Region]) -> Result<()> {
        let json = serde_json::to_string_pretty(regions)?;
        tokio::fs::write(&self.metadata_file, json).await?;
        Ok(())
    }

    /// Load regions from metadata file
    pub async fn load_regions(&self) -> Result<Vec<Region>> {
        if !self.metadata_file.exists() {
            return Ok(Vec::new());
        }

        let contents = tokio::fs::read_to_string(&self.metadata_file).await?;
        let regions: Vec<Region> = serde_json::from_str(&contents)?;
        Ok(regions)
    }

    /// Get region hierarchy tree
    pub async fn get_region_tree(&self) -> Result<Vec<RegionTree>> {
        let regions = self.load_regions().await?;
        let tree = self.build_hierarchy(&regions, None).await?;
        Ok(tree)
    }

    /// Build hierarchical tree from flat region list (complete recursive hierarchy)
    async fn build_hierarchy(
        &self,
        regions: &[Region],
        parent_id: Option<&str>,
    ) -> Result<Vec<RegionTree>> {
        // Build a map of region_id -> Region for fast lookup
        let region_map: std::collections::HashMap<String, &Region> =
            regions.iter().map(|r| (r.id.clone(), r)).collect();

        // Build a map of parent_id -> Vec<child_regions>
        let mut children_map: std::collections::HashMap<String, Vec<&Region>> =
            std::collections::HashMap::new();
        for region in regions {
            if let Some(ref parent) = region.parent_id {
                children_map
                    .entry(parent.clone())
                    .or_insert_with(Vec::new)
                    .push(region);
            }
        }

        // Build the hierarchy iteratively
        self.build_tree_iterative(&region_map, &children_map, parent_id)
            .await
    }

    /// Build tree iteratively to avoid async recursion issues
    fn build_tree_iterative<'a>(
        &'a self,
        region_map: &'a std::collections::HashMap<String, &'a Region>,
        children_map: &'a std::collections::HashMap<String, Vec<&'a Region>>,
        parent_id: Option<&'a str>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<RegionTree>>> + 'a + Send>>
    {
        Box::pin(async move {
            let mut result = Vec::new();

            // Get direct children
            let direct_children = if let Some(parent) = parent_id {
                children_map.get(parent).cloned().unwrap_or_default()
            } else {
                // Root level - find regions with no parent
                region_map
                    .values()
                    .filter(|r| r.parent_id.is_none())
                    .cloned()
                    .collect()
            };

            for &region in &direct_children {
                let data_files = self.get_region_files(&region.id).await?;

                // Recursively build children
                let children = self
                    .build_tree_iterative(region_map, children_map, Some(&region.id))
                    .await?;

                let download_stats = DownloadStats {
                    total_downloads: 0,
                    last_updated: region.updated_at,
                    file_count: data_files.len(),
                    total_size_mb: data_files
                        .iter()
                        .map(|f| f.file_size as f64 / 1_048_576.0)
                        .sum(),
                };

                result.push(RegionTree {
                    region: region.clone(),
                    children,
                    data_files,
                    download_stats,
                });
            }

            // Sort by admin level and then by name
            result.sort_by(|a, b| {
                a.region
                    .admin_level_num()
                    .cmp(&b.region.admin_level_num())
                    .then_with(|| a.region.name.cmp(&b.region.name))
            });

            Ok(result)
        })
    }

    /// Get specific region
    pub async fn get_region(&self, region_id: &str) -> Result<Option<RegionTree>> {
        let regions = self.load_regions().await?;

        for region in &regions {
            if region.id == region_id {
                let data_files = self.get_region_files(&region.id).await?;
                let children = self.build_hierarchy(&regions, Some(&region.id)).await?;

                let download_stats = DownloadStats {
                    total_downloads: 0,
                    last_updated: region.updated_at,
                    file_count: data_files.len(),
                    total_size_mb: data_files
                        .iter()
                        .map(|f| f.file_size as f64 / 1_048_576.0)
                        .sum(),
                };

                return Ok(Some(RegionTree {
                    region: region.clone(),
                    children,
                    data_files,
                    download_stats,
                }));
            }
        }

        Ok(None)
    }

    /// Get data files for a region
    pub async fn get_region_files(&self, region_id: &str) -> Result<Vec<DataFile>> {
        let region_path = self.get_region_path(region_id);

        if !region_path.exists() {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();

        for entry in WalkDir::new(&region_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("pbf") {
                if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                    if filename == "latest.osm.pbf" {
                        continue; // Skip symlinks
                    }

                    let metadata = std::fs::metadata(path)?;
                    let version = crate::osm::utils::extract_timestamp_from_filename(filename)
                        .unwrap_or_else(|| "unknown".to_string());

                    files.push(DataFile {
                        id: format!("{}_{}", region_id, version),
                        region_id: region_id.to_string(),
                        version: version.clone(),
                        file_path: path.to_string_lossy().to_string(),
                        file_size: metadata.len(),
                        format: DataFormat::OsmPbf,
                        created_at: metadata
                            .created()
                            .map(|t| t.into())
                            .unwrap_or_else(|_| Utc::now()),
                        is_latest: false,
                        quality_report_id: None,
                        download_url: format!("/api/download/{}/{}", region_id, version),
                        checksum: None,
                    });
                }
            }
        }

        // Sort by creation date and mark the latest
        files.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        if let Some(latest) = files.first_mut() {
            latest.is_latest = true;
        }

        Ok(files)
    }

    /// Get the filesystem path for a region
    fn get_region_path(&self, region_id: &str) -> PathBuf {
        // Create path based on region hierarchy
        if region_id.contains('-') {
            let parts: Vec<&str> = region_id.split('-').collect();
            if parts.len() == 2 {
                // Handle cases like "germany-bayern"
                self.data_dir.join(&parts[0]).join(&parts[1])
            } else {
                self.data_dir.join(region_id)
            }
        } else {
            // Single level regions
            match region_id {
                "liechtenstein" => self.data_dir.join("europe").join("liechtenstein"),
                "germany" => self.data_dir.join("europe").join("germany"),
                "france" => self.data_dir.join("europe").join("france"),
                _ => self.data_dir.join(region_id),
            }
        }
    }

    /// Compare two versions of region data
    pub async fn compare_versions(
        &self,
        region_id: &str,
        from_version: &str,
        to_version: &str,
    ) -> Result<RegionComparison> {
        // This is a placeholder implementation
        // In a real system, you'd load and compare the actual quality metrics

        let metrics_diff = QualityMetricsDiff {
            nodes_diff: 42, // Example values
            ways_diff: -3,
            relations_diff: 1,
            completeness_diff: 0.5,
            errors_diff: -2,
            feature_changes: std::collections::HashMap::new(),
        };

        let change_details = vec![ChangeDetail {
            change_type: "highway".to_string(),
            description: "New residential roads added".to_string(),
            impact: "Improved navigation coverage".to_string(),
            location: Some((47.16, 9.52)),
        }];

        let summary = format!(
            "Comparison between {} and {}: +{} nodes, {} ways, +{} relations",
            from_version,
            to_version,
            metrics_diff.nodes_diff,
            metrics_diff.ways_diff,
            metrics_diff.relations_diff
        );

        Ok(RegionComparison {
            region_id: region_id.to_string(),
            from_version: from_version.to_string(),
            to_version: to_version.to_string(),
            comparison_date: Utc::now(),
            metrics_diff,
            summary,
            change_details,
        })
    }

    /// Save processing job
    pub async fn save_processing_job(&self, job: &ProcessingJob) -> Result<()> {
        let jobs_dir = self.data_dir.join("jobs");
        std::fs::create_dir_all(&jobs_dir)?;

        let job_file = jobs_dir.join(format!("{}.json", job.id));
        let json = serde_json::to_string_pretty(job)?;
        tokio::fs::write(job_file, json).await?;

        Ok(())
    }

    /// Get quality report
    pub async fn get_quality_report(&self, report_id: &str) -> Result<Option<QualityReport>> {
        let reports_dir = self.data_dir.join("reports");
        let report_file = reports_dir.join(format!("{}.json", report_id));

        if !report_file.exists() {
            return Ok(None);
        }

        let contents = tokio::fs::read_to_string(report_file).await?;
        let report: QualityReport = serde_json::from_str(&contents)?;
        Ok(Some(report))
    }

    /// Save quality report
    pub async fn save_quality_report(&self, report: &QualityReport) -> Result<()> {
        let reports_dir = self.data_dir.join("reports");
        std::fs::create_dir_all(&reports_dir)?;

        let report_file = reports_dir.join(format!("{}.json", report.id));
        let json = serde_json::to_string_pretty(report)?;
        tokio::fs::write(report_file, json).await?;

        Ok(())
    }

    /// Get file path for download
    pub async fn get_file_path(&self, region_id: &str, version: &str) -> Result<Option<PathBuf>> {
        let region_path = self.get_region_path(region_id);

        if version == "latest" {
            let latest_path = region_path.join("latest.osm.pbf");
            if latest_path.exists() {
                return Ok(Some(latest_path));
            }
        }

        // Look for specific version
        for entry in WalkDir::new(&region_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                if filename.contains(version) && filename.ends_with(".osm.pbf") {
                    return Ok(Some(path.to_path_buf()));
                }
            }
        }

        Ok(None)
    }

    /// Extract bounding box from GeoJSON geometry
    fn extract_bounding_box_from_geometry(
        &self,
        geometry: &serde_json::Value,
    ) -> Option<BoundingBox> {
        match geometry.get("type")?.as_str()? {
            "Polygon" => {
                let coordinates = geometry.get("coordinates")?.as_array()?;
                if let Some(outer_ring) = coordinates.get(0)?.as_array() {
                    self.calculate_bbox_from_coordinates(outer_ring)
                } else {
                    None
                }
            }
            "MultiPolygon" => {
                let coordinates = geometry.get("coordinates")?.as_array()?;
                let mut all_coords = Vec::new();

                for polygon in coordinates {
                    if let Some(rings) = polygon.as_array() {
                        if let Some(outer_ring) = rings.get(0)?.as_array() {
                            all_coords.extend(outer_ring.iter().cloned());
                        }
                    }
                }

                self.calculate_bbox_from_coordinates(&all_coords)
            }
            "Point" => {
                let coordinates = geometry.get("coordinates")?.as_array()?;
                if coordinates.len() >= 2 {
                    let lon = coordinates[0].as_f64()?;
                    let lat = coordinates[1].as_f64()?;
                    // For points, create a small bounding box
                    Some(BoundingBox::new(
                        lat - 0.001,
                        lon - 0.001,
                        lat + 0.001,
                        lon + 0.001,
                    ))
                } else {
                    None
                }
            }
            _ => None, // Other geometry types not supported yet
        }
    }

    /// Calculate bounding box from coordinate array
    fn calculate_bbox_from_coordinates(
        &self,
        coordinates: &[serde_json::Value],
    ) -> Option<BoundingBox> {
        let mut min_lat = f64::INFINITY;
        let mut max_lat = f64::NEG_INFINITY;
        let mut min_lon = f64::INFINITY;
        let mut max_lon = f64::NEG_INFINITY;

        for coord in coordinates {
            if let Some(coord_array) = coord.as_array() {
                if coord_array.len() >= 2 {
                    if let (Some(lon), Some(lat)) =
                        (coord_array[0].as_f64(), coord_array[1].as_f64())
                    {
                        min_lat = min_lat.min(lat);
                        max_lat = max_lat.max(lat);
                        min_lon = min_lon.min(lon);
                        max_lon = max_lon.max(lon);
                    }
                }
            }
        }

        if min_lat != f64::INFINITY
            && max_lat != f64::NEG_INFINITY
            && min_lon != f64::INFINITY
            && max_lon != f64::NEG_INFINITY
        {
            Some(BoundingBox::new(min_lat, min_lon, max_lat, max_lon))
        } else {
            None
        }
    }
}
