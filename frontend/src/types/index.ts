// API Types matching backend models

export interface BoundingBox {
    min_lat: number;
    min_lon: number;
    max_lat: number;
    max_lon: number;
}

export interface Region {
    id: string;
    name: string;
    admin_level: string;
    parent_id?: string;
    bounding_box: BoundingBox;
    area_km2?: number;
    population?: number;
    country_code?: string;
    geofabrik_url?: string;
    has_children: boolean;
    provides_data_services: boolean;
    created_at: string;
    updated_at: string;
}

export interface DataFile {
    id: string;
    region_id: string;
    version: string;
    file_path: string;
    file_size: number;
    format: 'OsmPbf' | 'OsmXml' | 'GeoJson';
    created_at: string;
    is_latest: boolean;
    quality_report_id?: string;
}

export interface QualityMetrics {
    total_nodes: number;
    total_ways: number;
    total_relations: number;
    tagged_nodes: number;
    tagged_ways: number;
    tagged_relations: number;
    completeness_score: number;
    geometry_errors: number;
    tag_errors: number;
    topology_errors: number;
    custom_metrics: Record<string, any>;
}

export interface QualityIssue {
    issue_type: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    description: string;
    location?: [number, number]; // [lat, lon]
    osm_id?: number;
    osm_type?: string;
}

export interface QualityReport {
    id: string;
    region_id: string;
    report_date: string;
    completeness_score: number;
    accuracy_score: number;
    freshness_score: number;
    overall_score: number;
    issues: {
        missing_tags: number;
        geometry_errors: number;
        topology_issues: number;
        outdated_data: number;
    };
    recommendations: string[];
}

export interface RegionTree {
    region: Region;
    children: RegionTree[];
    data_files: DataFile[];
}

export interface RegionComparison {
    region_id: string;
    from_version: string;
    to_version: string;
    comparison_date: string;
    metrics_diff: QualityMetricsDiff;
    summary: string;
}

export interface QualityMetricsDiff {
    nodes_diff: number;
    ways_diff: number;
    relations_diff: number;
    completeness_diff: number;
    errors_diff: number;
}

export interface ProcessingJob {
    id: string;
    region_id: string;
    job_type: 'Download' | 'Process' | 'QualityAnalysis' | 'Cleanup';
    status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
    progress: number;
    message?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
}

// UI State Types
export interface MapViewState {
    center: [number, number];
    zoom: number;
    selectedRegion?: string;
}

export interface FilterState {
    dateRange?: {
        start: string;
        end: string;
    };
    format?: string[];
    minSize?: number;
    maxSize?: number;
} 