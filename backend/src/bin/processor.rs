use chrono::Utc;
use clap::{Parser, Subcommand};
use riemap_backend::{
    config::Config, osm::OsmProcessor, quality::QualityAnalyzer, storage::Storage,
};
use tracing::info;
use tracing_subscriber;

#[derive(Parser)]
#[command(name = "riemap-processor")]
#[command(about = "RieMap OSM data processor")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Download OSM data for a region
    Download {
        /// Region ID to download
        region: String,
    },
    /// Process OSM data and generate quality reports
    Process {
        /// Region ID to process
        region: String,
        /// Optional specific version to process
        #[arg(long)]
        version: Option<String>,
    },
    /// Initialize the data directory with sample data
    Init,
    /// List available regions
    List,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    // Load configuration
    let config = Config::from_env();

    // Initialize components
    let storage = Storage::new(&config.storage.data_dir)?;
    let processor = OsmProcessor::new(&config.storage.data_dir, &config.storage.temp_dir)?;
    let analyzer = QualityAnalyzer;

    match cli.command {
        Commands::Download { region } => {
            info!("Downloading data for region: {}", region);

            // Load region info
            let regions = storage.load_regions().await?;
            let region_info = regions
                .into_iter()
                .find(|r| r.id == region)
                .ok_or_else(|| format!("Region '{}' not found", region))?;

            // Download the data
            let file_path = processor.download_region(&region_info).await?;
            info!("Downloaded data to: {:?}", file_path);

            // Process the file
            let metrics = processor.process_osm_file(&file_path).await?;
            info!(
                "Processing complete: {} nodes, {} ways, {} relations",
                metrics.total_nodes, metrics.total_ways, metrics.total_relations
            );

            // Generate quality report
            let issues = processor.validate_file(&file_path).await?;
            let completeness_issues = analyzer.analyze_completeness(&metrics);
            let pattern_issues = analyzer.analyze_patterns(&metrics);

            let mut all_issues = issues;
            all_issues.extend(completeness_issues);
            all_issues.extend(pattern_issues);

            let data_file_id = format!("{}_{}", region, Utc::now().format("%Y-%m-%d"));
            let report = analyzer
                .generate_report(&data_file_id, &region, &metrics, all_issues)
                .await?;

            storage.save_quality_report(&report).await?;

            info!("Quality report saved: {}", report.id);
            info!("Summary: {}", report.summary);
        }

        Commands::Process { region, version } => {
            info!(
                "Processing data for region: {} (version: {:?})",
                region, version
            );

            // Find the file to process
            let file_path = if let Some(version) = version {
                storage
                    .get_file_path(&region, &version)
                    .await?
                    .ok_or_else(|| {
                        format!(
                            "File not found for region '{}' version '{}'",
                            region, version
                        )
                    })?
            } else {
                storage
                    .get_file_path(&region, "latest")
                    .await?
                    .ok_or_else(|| format!("No latest file found for region '{}'", region))?
            };

            // Process the file
            let metrics = processor.process_osm_file(&file_path).await?;

            // Generate quality report
            let issues = processor.validate_file(&file_path).await?;
            let completeness_issues = analyzer.analyze_completeness(&metrics);
            let pattern_issues = analyzer.analyze_patterns(&metrics);

            let mut all_issues = issues;
            all_issues.extend(completeness_issues);
            all_issues.extend(pattern_issues);

            let data_file_id = format!("{}_{}", region, Utc::now().format("%Y-%m-%d"));
            let report = analyzer
                .generate_report(&data_file_id, &region, &metrics, all_issues)
                .await?;

            storage.save_quality_report(&report).await?;

            info!("Processing complete!");
            info!(
                "Quality score: {:.1}",
                analyzer.calculate_quality_score(&metrics, &report.issues)
            );
            info!("Report saved: {}", report.id);
        }

        Commands::Init => {
            info!("Initializing data directory with sample data");
            storage.initialize_with_sample_data().await?;
            info!("Initialization complete");
        }

        Commands::List => {
            info!("Available regions:");
            let regions = storage.load_regions().await?;

            if regions.is_empty() {
                info!("No regions found. Run 'riemap-processor init' to initialize sample data.");
            } else {
                for region in regions {
                    info!(
                        "- {} ({}): {:.4}°N-{:.4}°N, {:.4}°E-{:.4}°E",
                        region.id,
                        region.name,
                        region.bounding_box.min_lat,
                        region.bounding_box.max_lat,
                        region.bounding_box.min_lon,
                        region.bounding_box.max_lon
                    );
                }
            }
        }
    }

    Ok(())
}
