'use client'

import { useState } from 'react'
import { ChevronRight, Download, BarChart3, GitCompare, MapPin, FileText, Clock } from 'lucide-react'
import { RegionTree } from '@/types'

interface CompactRegionListProps {
    regions: RegionTree[]
    selectedRegion: RegionTree | null
    onRegionSelect: (region: RegionTree) => void
    onDownload: (regionId: string, version: string) => void
    onQualityReport: (regionId: string, regionName: string) => void
    onVersionCompare: (regionId: string, regionName: string, files: any[]) => void
}

export default function CompactRegionList({
    regions,
    selectedRegion,
    onRegionSelect,
    onDownload,
    onQualityReport,
    onVersionCompare
}: CompactRegionListProps) {
    const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())

    const toggleExpanded = (regionId: string) => {
        const newExpanded = new Set(expandedRegions)
        if (newExpanded.has(regionId)) {
            newExpanded.delete(regionId)
        } else {
            newExpanded.add(regionId)
        }
        setExpandedRegions(newExpanded)
    }

    const formatFileSize = (bytes: number): string => {
        const mb = bytes / (1024 * 1024)
        return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`
    }

    const formatDate = (dateString: string): string => {
        try {
            return new Date(dateString).toLocaleDateString()
        } catch {
            return 'Unknown date'
        }
    }

    const renderRegion = (region: RegionTree, level = 0) => {
        const isExpanded = expandedRegions.has(region.region.id)
        const hasChildren = region.children.length > 0
        const latestFile = region.data_files.find(file => file.is_latest)
        const isSelected = selectedRegion?.region.id === region.region.id

        return (
            <div key={region.region.id} className="border-b border-gray-100">
                <div
                    className={`flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                    style={{ paddingLeft: `${16 + level * 24}px` }}
                    onClick={() => onRegionSelect(region)}
                >
                    {/* Expand/Collapse Button */}
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(region.region.id)
                            }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                            <ChevronRight
                                className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''
                                    }`}
                            />
                        </button>
                    )}
                    {!hasChildren && <div className="w-6 h-6" />}

                    {/* Region Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <h3 className={`font-medium text-gray-900 truncate ${isSelected ? 'text-blue-900' : ''
                                    }`}>
                                    {region.region.name}
                                </h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                    <span>Level {region.region.admin_level}</span>
                                    {region.region.area_km2 && (
                                        <span>{region.region.area_km2.toLocaleString()} km²</span>
                                    )}
                                    {region.region.population && (
                                        <span>{region.region.population.toLocaleString()} people</span>
                                    )}
                                    <span>{region.children.length} sub-regions</span>
                                    <span>{region.data_files.length} files</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                {/* Quality Report Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onQualityReport(region.region.id, region.region.name)
                                    }}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                    title="View Quality Report"
                                >
                                    <BarChart3 className="h-4 w-4" />
                                </button>

                                {/* Version Compare Button */}
                                {region.data_files.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onVersionCompare(region.region.id, region.region.name, region.data_files)
                                        }}
                                        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                        title="Compare Versions"
                                    >
                                        <GitCompare className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Download Button */}
                                {latestFile && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDownload(region.region.id, latestFile.version)
                                        }}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                        title={`Download ${formatFileSize(latestFile.file_size)}`}
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* File Details (when expanded or selected) */}
                        {(isExpanded || isSelected) && region.data_files.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {region.data_files.slice(0, 3).map((file) => (
                                        <div key={file.id} className="bg-gray-50 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {file.version}
                                                </span>
                                                {file.is_latest && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                        Latest
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-1 text-xs text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3 w-3" />
                                                    <span>{formatFileSize(file.file_size)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{formatDate(file.created_at)}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDownload(file.region_id, file.version)
                                                }}
                                                className="mt-2 w-full px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                            >
                                                Download
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {region.data_files.length > 3 && (
                                    <div className="mt-2 text-sm text-gray-500">
                                        ... and {region.data_files.length - 3} more files
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bounds Info */}
                        {isSelected && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <MapPin className="h-3 w-3" />
                                    <span className="font-mono">
                                        {region.region.bounding_box.min_lat.toFixed(4)}°N - {region.region.bounding_box.max_lat.toFixed(4)}°N, {' '}
                                        {region.region.bounding_box.min_lon.toFixed(4)}°E - {region.region.bounding_box.max_lon.toFixed(4)}°E
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Render Children */}
                {isExpanded && hasChildren && (
                    <div>
                        {region.children.map(childRegion =>
                            renderRegion(childRegion, level + 1)
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3">
                <h3 className="font-semibold text-gray-900">Regions Overview</h3>
                <p className="text-sm text-gray-600 mt-1">
                    {regions.length} regions • Click to expand details
                </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {regions.map(region => renderRegion(region))}
            </div>
        </div>
    )
} 