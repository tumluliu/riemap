use crate::{models::*, Result};
use chrono::Utc;
use std::collections::HashMap;
use tracing::info;
use uuid::Uuid;

/// Quality analyzer for OSM data
pub struct QualityAnalyzer;

impl QualityAnalyzer {
    /// Generate a comprehensive quality report for metrics
    pub async fn generate_report(
        &self,
        data_file_id: &str,
        region_id: &str,
        metrics: &QualityMetrics,
        issues: Vec<QualityIssue>,
    ) -> Result<QualityReport> {
        info!("Generating quality report for file: {}", data_file_id);

        let summary = crate::osm::utils::generate_summary(metrics, &issues);

        let recommendations = self.generate_recommendations(metrics, &issues);

        let report = QualityReport {
            id: Uuid::new_v4().to_string(),
            data_file_id: data_file_id.to_string(),
            region_id: region_id.to_string(),
            created_at: Utc::now(),
            metrics: metrics.clone(),
            issues,
            summary,
            recommendations,
        };

        Ok(report)
    }

    /// Analyze completeness of OSM data
    pub fn analyze_completeness(&self, metrics: &QualityMetrics) -> Vec<QualityIssue> {
        let mut issues = Vec::new();

        // Check for very low tagging rates
        let total_elements = metrics.total_nodes + metrics.total_ways + metrics.total_relations;
        if total_elements > 0 {
            let tagging_rate =
                (metrics.tagged_nodes + metrics.tagged_ways + metrics.tagged_relations) as f64
                    / total_elements as f64;

            if tagging_rate < 0.1 {
                issues.push(QualityIssue {
                    issue_type: "low_tagging_rate".to_string(),
                    severity: IssueSeverity::High,
                    description: format!("Very low tagging rate: {:.1}%", tagging_rate * 100.0),
                    location: None,
                    osm_id: None,
                    osm_type: None,
                    fix_suggestion: Some(
                        "Add more descriptive tags to features to improve data usability"
                            .to_string(),
                    ),
                });
            }
        }

        // Check for missing key feature types
        if metrics.total_ways < metrics.total_nodes / 100 {
            issues.push(QualityIssue {
                issue_type: "low_way_density".to_string(),
                severity: IssueSeverity::Medium,
                description: "Unusually low number of ways compared to nodes".to_string(),
                location: None,
                osm_id: None,
                osm_type: None,
                fix_suggestion: Some(
                    "Verify that linear features (roads, paths) are properly mapped".to_string(),
                ),
            });
        }

        issues
    }

    /// Analyze data quality patterns
    pub fn analyze_patterns(&self, metrics: &QualityMetrics) -> Vec<QualityIssue> {
        let mut issues = Vec::new();

        // Check for suspicious ratios
        if metrics.total_relations > metrics.total_ways {
            issues.push(QualityIssue {
                issue_type: "high_relation_ratio".to_string(),
                severity: IssueSeverity::Medium,
                description: "More relations than ways, which is unusual".to_string(),
                location: None,
                osm_id: None,
                osm_type: None,
                fix_suggestion: Some(
                    "Review relation usage and ensure they are necessary".to_string(),
                ),
            });
        }

        // Check error counts
        if metrics.geometry_errors > 0 {
            issues.push(QualityIssue {
                issue_type: "geometry_errors".to_string(),
                severity: IssueSeverity::High,
                description: format!("{} geometry errors found", metrics.geometry_errors),
                location: None,
                osm_id: None,
                osm_type: None,
                fix_suggestion: Some(
                    "Review and fix geometry errors, particularly invalid coordinates".to_string(),
                ),
            });
        }

        if metrics.topology_errors > 0 {
            issues.push(QualityIssue {
                issue_type: "topology_errors".to_string(),
                severity: IssueSeverity::High,
                description: format!("{} topology errors found", metrics.topology_errors),
                location: None,
                osm_id: None,
                osm_type: None,
                fix_suggestion: Some(
                    "Check way topology - ensure ways have at least 2 nodes".to_string(),
                ),
            });
        }

        issues
    }

    /// Generate quality score (0-100)
    pub fn calculate_quality_score(
        &self,
        metrics: &QualityMetrics,
        issues: &[QualityIssue],
    ) -> f64 {
        let mut score = 100.0;

        // Deduct points for errors
        score -= metrics.geometry_errors as f64 * 2.0;
        score -= metrics.topology_errors as f64 * 1.5;
        score -= metrics.tag_errors as f64 * 1.0;

        // Deduct points for issues
        for issue in issues {
            let deduction = match issue.severity {
                IssueSeverity::Critical => 20.0,
                IssueSeverity::High => 10.0,
                IssueSeverity::Medium => 5.0,
                IssueSeverity::Low => 1.0,
            };
            score -= deduction;
        }

        // Add points for completeness
        score += metrics.completeness_score * 0.3;

        // Ensure score is between 0 and 100
        score.max(0.0).min(100.0)
    }

    /// Generate recommendations based on quality analysis
    pub fn generate_recommendations(
        &self,
        metrics: &QualityMetrics,
        issues: &[QualityIssue],
    ) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Completeness recommendations
        if metrics.completeness_score < 50.0 {
            recommendations.push("Consider improving tagging completeness by adding more descriptive tags to features".to_string());
        }

        // Error-specific recommendations
        if metrics.geometry_errors > 0 {
            recommendations.push(
                "Review and fix geometry errors, particularly invalid coordinates".to_string(),
            );
        }

        if metrics.topology_errors > 0 {
            recommendations
                .push("Check way topology - ensure ways have at least 2 nodes".to_string());
        }

        // Issue-based recommendations
        for issue in issues {
            match issue.issue_type.as_str() {
                "low_tagging_rate" => {
                    recommendations
                        .push("Increase feature tagging to improve data usability".to_string());
                }
                "low_way_density" => {
                    recommendations.push(
                        "Verify that linear features (roads, paths) are properly mapped"
                            .to_string(),
                    );
                }
                _ => {}
            }
        }

        if recommendations.is_empty() {
            recommendations.push(
                "Data quality looks good! Continue maintaining current standards.".to_string(),
            );
        }

        recommendations
    }
}

/// Utility functions for quality analysis
pub mod utils {
    use super::*;

    /// Compare quality metrics between two versions
    pub fn compare_metrics(old: &QualityMetrics, new: &QualityMetrics) -> QualityMetricsDiff {
        let mut feature_changes = std::collections::HashMap::new();

        // Calculate feature distribution changes
        feature_changes.insert(
            "highways".to_string(),
            new.feature_distribution.highways as i64 - old.feature_distribution.highways as i64,
        );
        feature_changes.insert(
            "buildings".to_string(),
            new.feature_distribution.buildings as i64 - old.feature_distribution.buildings as i64,
        );
        feature_changes.insert(
            "natural_features".to_string(),
            new.feature_distribution.natural_features as i64
                - old.feature_distribution.natural_features as i64,
        );
        feature_changes.insert(
            "amenities".to_string(),
            new.feature_distribution.amenities as i64 - old.feature_distribution.amenities as i64,
        );
        feature_changes.insert(
            "water_features".to_string(),
            new.feature_distribution.water_features as i64
                - old.feature_distribution.water_features as i64,
        );
        feature_changes.insert(
            "boundaries".to_string(),
            new.feature_distribution.boundaries as i64 - old.feature_distribution.boundaries as i64,
        );

        QualityMetricsDiff {
            nodes_diff: new.total_nodes as i64 - old.total_nodes as i64,
            ways_diff: new.total_ways as i64 - old.total_ways as i64,
            relations_diff: new.total_relations as i64 - old.total_relations as i64,
            completeness_diff: new.completeness_score - old.completeness_score,
            errors_diff: (new.geometry_errors + new.topology_errors + new.tag_errors) as i64
                - (old.geometry_errors + old.topology_errors + old.tag_errors) as i64,
            feature_changes,
        }
    }

    /// Categorize issues by severity
    pub fn categorize_issues(issues: &[QualityIssue]) -> HashMap<String, usize> {
        let mut categories = HashMap::new();

        for issue in issues {
            let severity_str = match issue.severity {
                IssueSeverity::Critical => "critical",
                IssueSeverity::High => "high",
                IssueSeverity::Medium => "medium",
                IssueSeverity::Low => "low",
            };

            *categories.entry(severity_str.to_string()).or_insert(0) += 1;
        }

        categories
    }

    /// Generate issue summary text
    pub fn generate_issue_summary(issues: &[QualityIssue]) -> String {
        let categories = categorize_issues(issues);
        let total = issues.len();

        if total == 0 {
            return "No issues found".to_string();
        }

        let mut parts = Vec::new();

        if let Some(&critical) = categories.get("critical") {
            if critical > 0 {
                parts.push(format!("{} critical", critical));
            }
        }

        if let Some(&high) = categories.get("high") {
            if high > 0 {
                parts.push(format!("{} high", high));
            }
        }

        if let Some(&medium) = categories.get("medium") {
            if medium > 0 {
                parts.push(format!("{} medium", medium));
            }
        }

        if let Some(&low) = categories.get("low") {
            if low > 0 {
                parts.push(format!("{} low", low));
            }
        }

        format!("{} issues found: {}", total, parts.join(", "))
    }
}
