use crate::{models::*, Result};
use chrono::Utc;
use serde_json;

use std::path::{Path, PathBuf};
use tracing::info;
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

    /// Initialize storage with comprehensive Geofabrik-like region hierarchy
    pub async fn initialize_with_sample_data(&self) -> Result<()> {
        info!("Initializing storage with Geofabrik-like region hierarchy");

        let mut regions = Vec::new();

        // World (root level)
        let world = Region::new(
            "world".to_string(),
            "World".to_string(),
            AdminLevel::World,
            BoundingBox::new(-90.0, -180.0, 90.0, 180.0),
        );
        regions.push(world);

        // Continents
        let continents = vec![
            (
                "africa",
                "Africa",
                BoundingBox::new(-35.0, -20.0, 38.0, 55.0),
            ),
            (
                "antarctica",
                "Antarctica",
                BoundingBox::new(-90.0, -180.0, -60.0, 180.0),
            ),
            ("asia", "Asia", BoundingBox::new(-11.0, 25.0, 82.0, 180.0)),
            (
                "australia-oceania",
                "Australia and Oceania",
                BoundingBox::new(-55.0, 110.0, 0.0, 180.0),
            ),
            (
                "europe",
                "Europe",
                BoundingBox::new(35.0, -25.0, 72.0, 45.0),
            ),
            (
                "north-america",
                "North America",
                BoundingBox::new(15.0, -180.0, 85.0, -50.0),
            ),
            (
                "south-america",
                "South America",
                BoundingBox::new(-60.0, -85.0, 15.0, -30.0),
            ),
        ];

        for (id, name, bbox) in continents {
            let mut continent = Region::new(
                id.to_string(),
                name.to_string(),
                AdminLevel::Continent,
                bbox,
            );
            continent.parent_id = Some("world".to_string());
            continent.has_children = true;
            regions.push(continent);
        }

        // European countries (focusing on Europe for the demo)
        let european_countries = vec![
            (
                "germany",
                "Germany",
                BoundingBox::new(47.2, 5.8, 55.1, 15.0),
            ),
            ("france", "France", BoundingBox::new(41.3, -5.5, 51.1, 9.6)),
            ("spain", "Spain", BoundingBox::new(35.9, -9.3, 43.8, 4.3)),
            ("italy", "Italy", BoundingBox::new(36.6, 6.6, 47.1, 18.5)),
            (
                "united-kingdom",
                "United Kingdom",
                BoundingBox::new(49.9, -8.6, 60.9, 1.8),
            ),
            ("poland", "Poland", BoundingBox::new(49.0, 14.1, 54.8, 24.1)),
            (
                "austria",
                "Austria",
                BoundingBox::new(46.4, 9.5, 49.0, 17.2),
            ),
            (
                "switzerland",
                "Switzerland",
                BoundingBox::new(45.8, 5.9, 47.8, 10.5),
            ),
            (
                "liechtenstein",
                "Liechtenstein",
                BoundingBox::new(47.048, 9.471, 47.270, 9.636),
            ),
        ];

        for (id, name, bbox) in european_countries {
            let area_km2 = bbox.area_km2();
            let mut country =
                Region::new(id.to_string(), name.to_string(), AdminLevel::Country, bbox);
            country.parent_id = Some("europe".to_string());
            country.has_children = id != "liechtenstein";
            country.geofabrik_url = Some(format!(
                "https://download.geofabrik.de/europe/{}-latest.osm.pbf",
                id
            ));
            country.area_km2 = Some(area_km2);

            // Add population data
            country.population = match id {
                "germany" => Some(83_200_000),
                "france" => Some(67_800_000),
                "spain" => Some(47_400_000),
                "italy" => Some(59_100_000),
                "united-kingdom" => Some(67_500_000),
                "poland" => Some(38_000_000),
                "austria" => Some(9_000_000),
                "switzerland" => Some(8_700_000),
                "liechtenstein" => Some(39_000),
                _ => None,
            };

            regions.push(country);
        }

        // German states (as an example of subregions)
        let german_states = vec![
            (
                "baden-wuerttemberg",
                "Baden-Württemberg",
                BoundingBox::new(47.5, 7.5, 49.8, 10.5),
            ),
            ("bayern", "Bayern", BoundingBox::new(47.3, 8.9, 50.6, 13.8)),
            ("berlin", "Berlin", BoundingBox::new(52.3, 13.1, 52.7, 13.8)),
            (
                "brandenburg",
                "Brandenburg",
                BoundingBox::new(51.4, 11.2, 53.6, 14.8),
            ),
            (
                "hamburg",
                "Hamburg",
                BoundingBox::new(53.4, 9.7, 53.8, 10.3),
            ),
        ];

        for (id, name, bbox) in german_states {
            let area_km2 = bbox.area_km2();
            let mut state = Region::new(
                format!("germany-{}", id),
                name.to_string(),
                AdminLevel::Region,
                bbox,
            );
            state.parent_id = Some("germany".to_string());
            state.has_children = false;
            state.geofabrik_url = Some(format!(
                "https://download.geofabrik.de/europe/germany/{}-latest.osm.pbf",
                id
            ));
            state.area_km2 = Some(area_km2);
            state.country_code = Some("DE".to_string());
            regions.push(state);
        }

        // Save all regions
        self.save_regions(&regions).await?;

        info!(
            "Initialized {} regions in Geofabrik-like hierarchy",
            regions.len()
        );
        Ok(())
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

    /// Build hierarchical tree from flat region list using iterative approach
    async fn build_hierarchy(
        &self,
        regions: &[Region],
        parent_id: Option<&str>,
    ) -> Result<Vec<RegionTree>> {
        let mut tree = Vec::new();

        // Find direct children first
        for region in regions {
            if region.parent_id.as_deref() == parent_id {
                let data_files = self.get_region_files(&region.id).await?;

                let download_stats = DownloadStats {
                    total_downloads: 0,
                    last_updated: region.updated_at,
                    file_count: data_files.len(),
                    total_size_mb: data_files
                        .iter()
                        .map(|f| f.file_size as f64 / 1_048_576.0)
                        .sum(),
                };

                tree.push(RegionTree {
                    region: region.clone(),
                    children: Vec::new(), // Will be filled in next step
                    data_files,
                    download_stats,
                });
            }
        }

        // Build children for each node (2 levels deep max to avoid deep recursion)
        for tree_node in &mut tree {
            // Level 1: Direct children
            for region in regions {
                if region.parent_id.as_deref() == Some(&tree_node.region.id) {
                    let data_files = self.get_region_files(&region.id).await?;

                    // Level 2: Grandchildren
                    let mut grandchildren = Vec::new();
                    for grandchild_region in regions {
                        if grandchild_region.parent_id.as_deref() == Some(&region.id) {
                            let grandchild_data_files =
                                self.get_region_files(&grandchild_region.id).await?;

                            let grandchild_download_stats = DownloadStats {
                                total_downloads: 0,
                                last_updated: grandchild_region.updated_at,
                                file_count: grandchild_data_files.len(),
                                total_size_mb: grandchild_data_files
                                    .iter()
                                    .map(|f| f.file_size as f64 / 1_048_576.0)
                                    .sum(),
                            };

                            grandchildren.push(RegionTree {
                                region: grandchild_region.clone(),
                                children: Vec::new(), // Stop at 3 levels deep
                                data_files: grandchild_data_files,
                                download_stats: grandchild_download_stats,
                            });
                        }
                    }

                    let child_download_stats = DownloadStats {
                        total_downloads: 0,
                        last_updated: region.updated_at,
                        file_count: data_files.len(),
                        total_size_mb: data_files
                            .iter()
                            .map(|f| f.file_size as f64 / 1_048_576.0)
                            .sum(),
                    };

                    tree_node.children.push(RegionTree {
                        region: region.clone(),
                        children: grandchildren,
                        data_files,
                        download_stats: child_download_stats,
                    });
                }
            }

            // Sort children
            tree_node.children.sort_by(|a, b| {
                a.region
                    .admin_level_num()
                    .cmp(&b.region.admin_level_num())
                    .then_with(|| a.region.name.cmp(&b.region.name))
            });
        }

        // Sort by admin level and then by name
        tree.sort_by(|a, b| {
            a.region
                .admin_level_num()
                .cmp(&b.region.admin_level_num())
                .then_with(|| a.region.name.cmp(&b.region.name))
        });

        Ok(tree)
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
}
