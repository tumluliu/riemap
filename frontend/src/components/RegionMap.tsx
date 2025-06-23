'use client'

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RegionTree, BoundingBox } from '@/types';

interface RegionMapProps {
    regions: RegionTree[];
    selectedRegion: RegionTree | null;
    onRegionSelect: (region: RegionTree) => void;
    className?: string;
}

export default function RegionMap({ regions, selectedRegion, onRegionSelect, className = '' }: RegionMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!mapContainer.current) return;

        // Initialize the map
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'osm-tiles': {
                        type: 'raster',
                        tiles: [
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    }
                },
                layers: [
                    {
                        id: 'osm-tiles',
                        type: 'raster',
                        source: 'osm-tiles'
                    }
                ]
            },
            center: selectedRegion ? [
                (selectedRegion.region.bounding_box.min_lon + selectedRegion.region.bounding_box.max_lon) / 2,
                (selectedRegion.region.bounding_box.min_lat + selectedRegion.region.bounding_box.max_lat) / 2
            ] : [0, 0],
            zoom: selectedRegion ? calculateZoom(selectedRegion.region.bounding_box) : 2
        });

        // Add navigation controls
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Add scale control
        map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        map.current.on('load', () => {
            setIsLoading(false);

            if (selectedRegion) {
                addRegionBoundary(selectedRegion);
            } else {
                // If no specific region, show world view with continent boundaries
                loadContinentBoundaries();
            }
        });

        // Cleanup
        return () => {
            if (map.current) {
                map.current.remove();
            }
        };
    }, [selectedRegion]);

    const calculateZoom = (bbox: BoundingBox) => {
        const latDiff = bbox.max_lat - bbox.min_lat;
        const lonDiff = bbox.max_lon - bbox.min_lon;
        const maxDiff = Math.max(latDiff, lonDiff);

        if (maxDiff > 50) return 3;
        if (maxDiff > 20) return 4;
        if (maxDiff > 10) return 5;
        if (maxDiff > 5) return 6;
        if (maxDiff > 2) return 7;
        if (maxDiff > 1) return 8;
        if (maxDiff > 0.5) return 9;
        return 10;
    };

    const addRegionBoundary = (region: RegionTree) => {
        if (!map.current) return;

        const bbox = region.region.bounding_box;
        const coordinates = [
            [
                [bbox.min_lon, bbox.min_lat],
                [bbox.max_lon, bbox.min_lat],
                [bbox.max_lon, bbox.max_lat],
                [bbox.min_lon, bbox.max_lat],
                [bbox.min_lon, bbox.min_lat]
            ]
        ];

        // Add region boundary source
        map.current.addSource('region-boundary', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {
                    id: region.region.id,
                    name: region.region.name
                },
                geometry: {
                    type: 'Polygon',
                    coordinates
                }
            }
        });

        // Add boundary line layer
        map.current.addLayer({
            id: 'region-boundary-line',
            type: 'line',
            source: 'region-boundary',
            paint: {
                'line-color': '#ff6b6b',
                'line-width': 3,
                'line-opacity': 0.8
            }
        });

        // Add boundary fill layer
        map.current.addLayer({
            id: 'region-boundary-fill',
            type: 'fill',
            source: 'region-boundary',
            paint: {
                'fill-color': '#ff6b6b',
                'fill-opacity': 0.1
            }
        });

        // Add click handler for region selection
        map.current.on('click', 'region-boundary-fill', (e) => {
            if (onRegionSelect && e.features && e.features[0]) {
                const regionId = e.features[0].properties?.id;
                if (regionId) {
                    const foundRegion = regions.find((r: RegionTree) => r.region.id === regionId);
                    if (foundRegion) {
                        onRegionSelect(foundRegion);
                    }
                }
            }
        });

        // Change cursor on hover
        map.current.on('mouseenter', 'region-boundary-fill', () => {
            if (map.current) {
                map.current.getCanvas().style.cursor = 'pointer';
            }
        });

        map.current.on('mouseleave', 'region-boundary-fill', () => {
            if (map.current) {
                map.current.getCanvas().style.cursor = '';
            }
        });

        // Fit to bounds
        map.current.fitBounds([
            [bbox.min_lon, bbox.min_lat],
            [bbox.max_lon, bbox.max_lat]
        ], { padding: 20 });
    };

    const loadContinentBoundaries = async () => {
        if (!map.current) return;

        try {
            // For world view, just fit to world bounds without drawing continent rectangles
            // This gives a clean world view without the messy overlapping bounding boxes

            // Fit map to show the entire world
            map.current.fitBounds([
                [-180, -85], // Southwest corner (min lon, min lat)
                [180, 85]    // Northeast corner (max lon, max lat)
            ], {
                padding: 20,
                maxZoom: 4 // Prevent zooming in too much for world view
            });

        } catch (error) {
            console.error('Failed to load world view:', error);
            // Fallback to world bounds if anything fails
            if (map.current) {
                map.current.fitBounds([
                    [-180, -85],
                    [180, 85]
                ], {
                    padding: 20,
                    maxZoom: 4
                });
            }
        }
    };

    return (
        <div className={`relative ${className}`}>
            <div
                ref={mapContainer}
                className="w-full h-full rounded-lg overflow-hidden"
            />
            {isLoading && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
                    <div className="text-gray-600">Loading map...</div>
                </div>
            )}
        </div>
    );
} 